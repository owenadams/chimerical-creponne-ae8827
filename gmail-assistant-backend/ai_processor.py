import asyncio
import json
import os
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from openai import AsyncOpenAI

VALID_ACTIONS = {"keep", "archive", "delete", "mark_unread"}
DECAY = 0.97
MIN_DECAY = 0.25
SENDER_MIN_DECISIONS = 1
DOMAIN_MIN_DECISIONS = 3
CONFIDENCE_RATIO = 0.6

SYSTEM_PROMPT = """\
You are an email management assistant. For each email, decide:
1. action: "keep" | "archive" | "delete" | "mark_unread"
   - Newsletters / automated notifications already actioned → archive
   - Marketing or spam → delete
   - Emails needing a reply or attention → mark_unread
   - Everything else important → keep
2. add_label_ids: list of IDs from the provided label list that fit
3. new_label_name: a new label name to create if none of the existing labels fit (or null)
4. reason: one short sentence

Respond ONLY with a valid JSON object, no markdown fences. Format:
{"action":"...","add_label_ids":["..."],"new_label_name":null,"reason":"..."}"""



def _sender_address(raw: str) -> str:
    match = re.search(r"<([^>]+)>", raw or "")
    address = match.group(1) if match else (raw or "")
    return address.strip().strip('"').lower()


def _sender_domain(address: str) -> str:
    return address.rsplit("@", 1)[-1] if "@" in address else ""


class LearnedPreferences:
    def __init__(self, entries: list[dict]):
        self._weights: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        self._counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self._labels: dict[str, list[str]] = {}
        self._corrections: list[dict] = []
        self._confirmations: list[dict] = []

        decisions = [e for e in entries if e.get("accepted") and isinstance(e.get("applied_action"), dict)]
        total = len(decisions)
        for index, entry in enumerate(decisions):
            applied = entry["applied_action"]
            action = applied.get("action")
            if action not in VALID_ACTIONS:
                continue

            email = entry.get("email") or {}
            address = _sender_address(email.get("from", ""))
            if not address:
                continue

            weight = max(DECAY ** (total - 1 - index), MIN_DECAY)
            keys = [f"sender:{address}"]
            domain = _sender_domain(address)
            if domain:
                keys.append(f"domain:{domain}")
            for key in keys:
                self._weights[key][action] += weight
                self._counts[key][action] += 1
                self._labels[f"{key}|{action}"] = applied.get("add_label_ids") or []

            suggested = (entry.get("suggestion") or {}).get("action")
            record = {"email": email, "suggested": suggested, "applied": applied}
            if suggested and suggested != action:
                self._corrections.append(record)
            else:
                self._confirmations.append(record)

    def suggest(self, email: dict) -> dict | None:
        address = _sender_address(email.get("from", ""))
        if not address:
            return None

        candidates = [(f"sender:{address}", SENDER_MIN_DECISIONS, address)]
        domain = _sender_domain(address)
        if domain:
            candidates.append((f"domain:{domain}", DOMAIN_MIN_DECISIONS, f"@{domain}"))

        for key, min_decisions, scope_label in candidates:
            actions = self._weights.get(key)
            if not actions:
                continue
            total_weight = sum(actions.values())
            action, weight = max(actions.items(), key=lambda item: item[1])
            decisions = sum(self._counts[key].values())
            if decisions < min_decisions or weight / total_weight < CONFIDENCE_RATIO:
                continue
            times = self._counts[key][action]
            return {
                "action": action,
                "add_label_ids": self._labels.get(f"{key}|{action}", []),
                "new_label_name": None,
                "reason": (
                    f"Learned preference: you chose \"{action}\" for {scope_label} "
                    f"{times} time{'s' if times != 1 else ''} before"
                ),
            }
        return None

    def rules(self, limit: int = 50) -> list[dict]:
        rules = []
        for key, actions in self._weights.items():
            scope, _, target = key.partition(":")
            min_decisions = SENDER_MIN_DECISIONS if scope == "sender" else DOMAIN_MIN_DECISIONS
            total_weight = sum(actions.values())
            action, weight = max(actions.items(), key=lambda item: item[1])
            decisions = sum(self._counts[key].values())
            if decisions < min_decisions or weight / total_weight < CONFIDENCE_RATIO:
                continue
            rules.append({
                "scope": scope,
                "target": target,
                "action": action,
                "decisions": decisions,
                "confidence": round(weight / total_weight * 100, 1),
            })
        rules.sort(key=lambda rule: (-rule["decisions"], -rule["confidence"]))
        return rules[:limit]

    def corrections(self, limit: int = 8) -> list[dict]:
        return self._corrections[-limit:]

    def confirmations(self, limit: int = 6) -> list[dict]:
        return self._confirmations[-limit:]


class AIProcessor:
    def __init__(self, feedback_path: str, model: str = "llama3.2"):
        # Ollama exposes an OpenAI-compatible API on localhost
        self._client = AsyncOpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
        self._model = model
        self._use_model = os.getenv("USE_OLLAMA_AI", "false").lower() in {"1", "true", "yes"}
        self.feedback_path = Path(feedback_path)
        self._learning: LearnedPreferences | None = None
        self._learning_mtime: float | None = None

    # ------------------------------------------------------------------ #
    #  Processing                                                          #
    # ------------------------------------------------------------------ #

    async def process_emails(self, emails: list[dict], labels: list[dict]) -> list[dict]:
        label_lookup = {label["id"]: label["name"] for label in labels}
        labels_desc = json.dumps(labels, indent=2)
        learning = self._get_learning()
        few_shot = self._build_few_shot_context()

        results_by_id: dict[str, dict] = {}
        ambiguous: list[dict] = []

        for email in emails:
            suggestion = learning.suggest(email) or self._rule_based_suggestion(email, label_lookup)
            if suggestion is None:
                ambiguous.append(email)
            else:
                results_by_id[email["id"]] = {
                    "email_id": email["id"],
                    "email": email,
                    "suggestion": suggestion,
                    "status": "pending",
                }

        if ambiguous:
            if self._use_model:
                model_suggestions = await self._call_model_batch(ambiguous, labels_desc, few_shot)
                for email in ambiguous:
                    suggestion = model_suggestions.get(email["id"], {
                        "action": "mark_unread",
                        "add_label_ids": [],
                        "new_label_name": None,
                        "reason": "Needs manual review",
                    })
                    results_by_id[email["id"]] = {
                        "email_id": email["id"],
                        "email": email,
                        "suggestion": suggestion,
                        "status": "pending",
                    }
            else:
                for email in ambiguous:
                    results_by_id[email["id"]] = {
                        "email_id": email["id"],
                        "email": email,
                        "suggestion": {
                            "action": "mark_unread",
                            "add_label_ids": [],
                            "new_label_name": None,
                            "reason": "Needs manual review",
                        },
                        "status": "pending",
                    }

        return [results_by_id[email["id"]] for email in emails if email["id"] in results_by_id]

    async def _call_model_batch(self, emails: list[dict], labels_desc: str, few_shot: str) -> dict[str, dict]:
        batch_payload = [
            {
                "id": email.get("id"),
                "from": email.get("from", ""),
                "subject": email.get("subject", ""),
                "date": email.get("date", ""),
                "current_label_ids": email.get("label_ids", []),
                "snippet": email.get("snippet", ""),
            }
            for email in emails
        ]
        user_content = (
            f"Available labels:\n{labels_desc}\n"
            f"{few_shot}\n\n"
            "For each email below, return a JSON object keyed by email id.\n"
            "Each value must be: {\"action\":\"keep|archive|delete|mark_unread\",\"add_label_ids\":[],\"new_label_name\":null,\"reason\":\"short reason\"}.\n"
            "Respond with JSON only.\n\n"
            f"Emails:\n{json.dumps(batch_payload, ensure_ascii=False)}"
        )
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                max_tokens=256,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
            )
            text = response.choices[0].message.content.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            parsed = json.loads(text.strip())
            return parsed if isinstance(parsed, dict) else {}
        except Exception as exc:
            return {
                email["id"]: {
                    "action": "keep",
                    "add_label_ids": [],
                    "new_label_name": None,
                    "reason": f"Processing error: {exc}",
                }
                for email in emails
            }

    def _rule_based_suggestion(self, email: dict, label_lookup: dict[str, str]) -> dict | None:
        sender = email.get("from", "").lower()
        subject = email.get("subject", "").lower()
        snippet = email.get("snippet", "").lower()
        labels = {label_lookup.get(label_id, label_id).lower() for label_id in email.get("label_ids", [])}

        if "security alert" in subject or ("google" in sender and "sign in" in snippet):
            return {
                "action": "mark_unread",
                "add_label_ids": [],
                "new_label_name": None,
                "reason": "Security-related email likely needs attention",
            }

        if any(term in subject for term in ["statement", "receipt", "invoice", "order confirmed", "order #", "payment"]):
            return {
                "action": "keep",
                "add_label_ids": [],
                "new_label_name": None,
                "reason": "Transactional or finance-related email",
            }

        if "linkedin job alerts" in sender or "trending on nextdoor" in sender:
            return {
                "action": "archive",
                "add_label_ids": [],
                "new_label_name": None,
                "reason": "Automated alert or newsletter",
            }

        if "category_promotions" in labels and any(term in snippet for term in ["unsubscribe", "view online", "offer", "sale", "newsletter"]):
            return {
                "action": "archive",
                "add_label_ids": [],
                "new_label_name": None,
                "reason": "Promotional email can be archived",
            }

        if "no-reply" in sender and "category_updates" in labels and "unread" not in labels:
            return {
                "action": "archive",
                "add_label_ids": [],
                "new_label_name": None,
                "reason": "Automated update with no reply path",
            }

        return None

    # ------------------------------------------------------------------ #
    #  Learning                                                            #
    # ------------------------------------------------------------------ #

    def _load_entries(self) -> list[dict]:
        if not self.feedback_path.exists():
            return []
        entries = []
        with self.feedback_path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return entries

    def _get_learning(self) -> LearnedPreferences:
        mtime = self.feedback_path.stat().st_mtime if self.feedback_path.exists() else None
        if self._learning is None or mtime != self._learning_mtime:
            self._learning = LearnedPreferences(self._load_entries())
            self._learning_mtime = mtime
        return self._learning

    def learned_rules(self, limit: int = 50) -> list[dict]:
        return self._get_learning().rules(limit)

    def _describe(self, record: dict) -> str:
        email = record.get("email", {})
        return (
            f"  From={email.get('from', '')} | Subject={email.get('subject', '')} | "
            f"Snippet={email.get('snippet', '')[:80]}\n"
            f"  -> {json.dumps(record['applied'])}\n"
        )

    def _build_few_shot_context(self) -> str:
        learning = self._get_learning()
        corrections = learning.corrections()
        confirmations = learning.confirmations()
        rules = learning.rules(limit=20)
        if not corrections and not confirmations and not rules:
            return ""
        lines = []
        if rules:
            lines.append("\n\nLearned rules from the user's past decisions - follow these first:\n")
            for rule in rules:
                target = rule["target"] if rule["scope"] == "sender" else f"@{rule['target']}"
                lines.append(
                    f"  {target} -> {rule['action']} "
                    f"({rule['decisions']} decisions, {rule['confidence']}% consistent)\n"
                )
        if corrections:
            lines.append("\nCorrections the user made to earlier suggestions (strongest signal):\n")
            for record in corrections:
                lines.append(
                    f"  (was suggested \"{record['suggested']}\", user chose \"{record['applied'].get('action')}\")\n"
                    + self._describe(record)
                )
        if confirmations:
            lines.append("\nDecisions the user accepted unchanged:\n")
            for record in confirmations:
                lines.append(self._describe(record))
        return "".join(lines)

    def record_feedback(
        self,
        email_id: str,
        accepted: bool,
        suggestion: dict,
        applied_action: dict | None,
        email: dict | None,
    ) -> None:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "email_id": email_id,
            "accepted": accepted,
            "suggestion": suggestion,
            "applied_action": applied_action,
            "email": email,
        }
        with self.feedback_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
        self._learning = None
