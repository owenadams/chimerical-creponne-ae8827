import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from openai import AsyncOpenAI

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



class AIProcessor:
    def __init__(self, feedback_path: str, model: str = "llama3.2"):
        # Ollama exposes an OpenAI-compatible API on localhost
        self._client = AsyncOpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
        self._model = model
        self._use_model = os.getenv("USE_OLLAMA_AI", "false").lower() in {"1", "true", "yes"}
        self.feedback_path = Path(feedback_path)

    # ------------------------------------------------------------------ #
    #  Processing                                                          #
    # ------------------------------------------------------------------ #

    async def process_emails(self, emails: list[dict], labels: list[dict]) -> list[dict]:
        label_lookup = {label["id"]: label["name"] for label in labels}
        labels_desc = json.dumps(labels, indent=2)
        few_shot = self._build_few_shot_context()

        results_by_id: dict[str, dict] = {}
        ambiguous: list[dict] = []

        for email in emails:
            suggestion = self._rule_based_suggestion(email, label_lookup)
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

    def _load_accepted_examples(self, limit: int = 20) -> list[dict]:
        if not self.feedback_path.exists():
            return []
        examples = []
        with self.feedback_path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entry = json.loads(line)
                        if entry.get("accepted"):
                            examples.append(entry)
                    except json.JSONDecodeError:
                        continue
        return examples[-limit:]

    def _build_few_shot_context(self) -> str:
        examples = self._load_accepted_examples()
        if not examples:
            return ""
        lines = ["\n\nExamples of previously accepted decisions (use as guidance):\n"]
        for ex in examples[-8:]:
            email = ex.get("email", {})
            action = ex.get("applied_action", ex.get("suggestion", {}))
            lines.append(
                f"  From={email.get('from', '')} | Subject={email.get('subject', '')} | "
                f"Snippet={email.get('snippet', '')[:80]}\n"
                f"  → {json.dumps(action)}\n"
            )
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
