import os
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path

from google.auth.transport.requests import Request as GoogleRequest, AuthorizedSession
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow, InstalledAppFlow

# Google can return a scope superset for accounts with previously granted app
# permissions. This prevents oauthlib from raising "Scope has changed" errors.
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.labels",
]
GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


class GmailClient:
    def __init__(
        self,
        credentials_path: str | None,
        token_path: str,
        client_secret_json: str | None = None,
        redirect_uri: str | None = None,
    ):
        self.credentials_path = credentials_path
        self.token_path = token_path
        self.client_secret_json = client_secret_json
        self.redirect_uri = redirect_uri
        self.oauth_state_path = f"{token_path}.oauth_state"

    def _extract_code_verifier(self, flow: Flow) -> str | None:
        verifier = getattr(flow, "code_verifier", None)
        if isinstance(verifier, str) and verifier:
            return verifier

        oauth_client = getattr(getattr(flow, "oauth2session", None), "_client", None)
        verifier = getattr(oauth_client, "code_verifier", None)
        if isinstance(verifier, str) and verifier:
            return verifier

        return None

    def _apply_code_verifier(self, flow: Flow, code_verifier: str) -> None:
        flow.code_verifier = code_verifier
        oauth_client = getattr(getattr(flow, "oauth2session", None), "_client", None)
        if oauth_client is not None:
            oauth_client.code_verifier = code_verifier

    # ------------------------------------------------------------------ #
    #  Auth                                                                #
    # ------------------------------------------------------------------ #

    def _load_client_config(self) -> dict:
        if self.client_secret_json:
            return json.loads(self.client_secret_json)

        if self.credentials_path and os.path.exists(self.credentials_path):
            return json.loads(Path(self.credentials_path).read_text(encoding="utf-8"))

        raise RuntimeError(
            "Google OAuth client secrets are not configured. Set GOOGLE_CLIENT_SECRET_JSON "
            "or provide GOOGLE_CLIENT_SECRETS_PATH."
        )

    def _build_flow(self, state: str | None = None) -> Flow:
        if not self.redirect_uri:
            raise RuntimeError("GMAIL_OAUTH_REDIRECT_URI is not configured")

        return Flow.from_client_config(
            self._load_client_config(),
            SCOPES,
            state=state,
            redirect_uri=self.redirect_uri,
        )

    def _save_oauth_state(self, state: str, code_verifier: str | None) -> None:
        payload = {
            "state": state,
            "code_verifier": code_verifier,
            "created_at": datetime.now(timezone.utc).timestamp(),
        }
        Path(self.oauth_state_path).write_text(json.dumps(payload), encoding="utf-8")

    def _load_oauth_state(self) -> dict | None:
        path = Path(self.oauth_state_path)
        if not path.exists():
            return None

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return None

        created_at = payload.get("created_at")
        if not isinstance(created_at, (int, float)):
            return None

        age_seconds = datetime.now(timezone.utc).timestamp() - float(created_at)
        if age_seconds > 15 * 60:
            return None

        state = payload.get("state")
        if not isinstance(state, str) or not state:
            return None

        code_verifier = payload.get("code_verifier")
        if code_verifier is not None and not isinstance(code_verifier, str):
            return None

        return {"state": state, "code_verifier": code_verifier}

    def _clear_oauth_state(self) -> None:
        path = Path(self.oauth_state_path)
        if path.exists():
            path.unlink()

    def _load_creds(self) -> Credentials | None:
        if not os.path.exists(self.token_path):
            return None

        # Load token without strict scope equality because Google can return a
        # superset when include_granted_scopes is enabled.
        try:
            creds = Credentials.from_authorized_user_file(self.token_path)
        except ValueError:
            Path(self.token_path).unlink(missing_ok=True)
            return None

        granted_scopes = set(creds.scopes or [])
        required_scopes = set(SCOPES)
        if not required_scopes.issubset(granted_scopes):
            Path(self.token_path).unlink(missing_ok=True)
            return None

        if creds.expired and creds.refresh_token:
            creds.refresh(GoogleRequest())
            Path(self.token_path).write_text(creds.to_json())
        return creds if creds.valid else None

    def _session(self) -> AuthorizedSession:
        creds = self._load_creds()
        if not creds:
            raise RuntimeError("Not authenticated")
        return AuthorizedSession(creds)

    def is_authenticated(self) -> bool:
        return self._load_creds() is not None

    def begin_auth(self) -> dict:
        flow = self._build_flow()
        auth_url, state = flow.authorization_url(
            access_type="offline",
            prompt="consent",
        )
        self._save_oauth_state(state, self._extract_code_verifier(flow))
        return {"auth_url": auth_url, "state": state}

    def complete_auth(self, code: str, state: str) -> None:
        oauth_state = self._load_oauth_state()
        if not oauth_state or state != oauth_state["state"]:
            raise RuntimeError("Invalid or expired OAuth state")

        flow = self._build_flow(state=state)
        code_verifier = oauth_state.get("code_verifier")
        if isinstance(code_verifier, str) and code_verifier:
            self._apply_code_verifier(flow, code_verifier)
        flow.fetch_token(code=code)
        creds = flow.credentials
        Path(self.token_path).write_text(creds.to_json(), encoding="utf-8")
        self._clear_oauth_state()

    def authenticate(self) -> None:
        # Local desktop fallback for development.
        flow = InstalledAppFlow.from_client_secrets_file(self.credentials_path, SCOPES)
        creds = flow.run_local_server(port=0)
        Path(self.token_path).write_text(creds.to_json(), encoding="utf-8")

    # ------------------------------------------------------------------ #
    #  Labels                                                              #
    # ------------------------------------------------------------------ #

    def list_labels(self) -> list[dict]:
        resp = self._session().get(f"{GMAIL_BASE}/labels")
        resp.raise_for_status()
        return [{"id": l["id"], "name": l["name"]} for l in resp.json().get("labels", [])]

    def ensure_label(self, name: str) -> str:
        for label in self.list_labels():
            if label["name"].lower() == name.lower():
                return label["id"]
        resp = self._session().post(
            f"{GMAIL_BASE}/labels",
            json={"name": name, "labelListVisibility": "labelShow", "messageListVisibility": "show"},
        )
        resp.raise_for_status()
        return resp.json()["id"]

    # ------------------------------------------------------------------ #
    #  Fetch emails                                                        #
    # ------------------------------------------------------------------ #

    def fetch_recent_emails(self, days: int = 7, max_results: int = 15) -> list[dict]:
        days = max(1, min(days, 7))
        session = self._session()

        resp = session.get(
            f"{GMAIL_BASE}/messages",
            params={"q": f"newer_than:{days}d", "maxResults": max_results},
        )
        resp.raise_for_status()
        messages = resp.json().get("messages", [])

        def fetch_one(msg_id: str) -> dict | None:
            r = session.get(
                f"{GMAIL_BASE}/messages/{msg_id}",
                params={"format": "metadata", "metadataHeaders": ["From", "Subject", "Date"]},
            )
            if not r.ok:
                return None
            detail = r.json()
            headers = {h["name"]: h["value"] for h in detail.get("payload", {}).get("headers", [])}
            return {
                "id": msg_id,
                "thread_id": detail.get("threadId"),
                "from": headers.get("From", ""),
                "subject": headers.get("Subject", "(no subject)"),
                "date": headers.get("Date", ""),
                "snippet": detail.get("snippet", ""),
                "label_ids": detail.get("labelIds", []),
                "is_unread": "UNREAD" in detail.get("labelIds", []),
            }

        emails = []
        with ThreadPoolExecutor(max_workers=10) as pool:
            futures = {pool.submit(fetch_one, m["id"]): m["id"] for m in messages}
            for future in as_completed(futures):
                result = future.result()
                if result:
                    emails.append(result)

        id_order = {m["id"]: i for i, m in enumerate(messages)}
        emails.sort(key=lambda e: id_order.get(e["id"], 999))
        return emails

    # ------------------------------------------------------------------ #
    #  Apply action                                                        #
    # ------------------------------------------------------------------ #

    def apply_action(self, email_id: str, action: str, add_label_ids: list[str], new_label_name: str | None) -> dict:
        session = self._session()
        add_labels = list(add_label_ids)
        remove_labels: list[str] = []

        if new_label_name:
            add_labels.append(self.ensure_label(new_label_name))

        if action == "delete":
            session.post(f"{GMAIL_BASE}/messages/{email_id}/trash").raise_for_status()
            if add_labels:
                session.post(
                    f"{GMAIL_BASE}/messages/{email_id}/modify",
                    json={"addLabelIds": add_labels, "removeLabelIds": []},
                ).raise_for_status()
            return {"trashed": True}

        if action == "archive":
            remove_labels.append("INBOX")
        elif action == "mark_unread":
            add_labels.append("UNREAD")

        if add_labels or remove_labels:
            session.post(
                f"{GMAIL_BASE}/messages/{email_id}/modify",
                json={"addLabelIds": add_labels, "removeLabelIds": remove_labels},
            ).raise_for_status()

        return {"action": action, "added": add_labels, "removed": remove_labels}

