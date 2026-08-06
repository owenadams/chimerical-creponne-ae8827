import asyncio
import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlencode

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from ai_processor import AIProcessor
from gmail_client import GmailClient

load_dotenv()

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")  # explicit path for uvicorn subprocess
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

SUGGESTIONS_FILE = DATA_DIR / "current_suggestions.json"
FEEDBACK_FILE = DATA_DIR / "feedback.jsonl"
TOKEN_FILE = DATA_DIR / "token.json"

DEFAULT_CREDENTIALS_FILE = BASE_DIR.parent / "client_secret_857904640068-g5g59gmcmll4hu4gtdrrf2bg3gfp10uj.apps.googleusercontent.com.json"
CREDENTIALS_PATH = os.getenv("GOOGLE_CLIENT_SECRETS_PATH")
if not CREDENTIALS_PATH and DEFAULT_CREDENTIALS_FILE.exists():
    CREDENTIALS_PATH = str(DEFAULT_CREDENTIALS_FILE)

GOOGLE_CLIENT_SECRET_JSON = os.getenv("GOOGLE_CLIENT_SECRET_JSON")
GMAIL_OAUTH_REDIRECT_URI = os.getenv("GMAIL_OAUTH_REDIRECT_URI")
GMAIL_POST_AUTH_REDIRECT_URL = os.getenv("GMAIL_POST_AUTH_REDIRECT_URL", "")

app = FastAPI(title="Gmail Assistant")
gmail = GmailClient(
    credentials_path=CREDENTIALS_PATH,
    token_path=str(TOKEN_FILE),
    client_secret_json=GOOGLE_CLIENT_SECRET_JSON,
    redirect_uri=GMAIL_OAUTH_REDIRECT_URI,
)
_ai: AIProcessor | None = None
_executor = ThreadPoolExecutor(max_workers=2)


def get_ai() -> AIProcessor:
    global _ai
    if _ai is None:
        _ai = AIProcessor(feedback_path=str(DATA_DIR / "feedback.jsonl"))
    return _ai


# ------------------------------------------------------------------ #
#  Models                                                              #
# ------------------------------------------------------------------ #

class FeedbackRequest(BaseModel):
    email_id: str
    accepted: bool
    suggestion: dict
    email: dict
    # override is the action to apply instead of suggestion (edit-and-accept)
    override: dict | None = None


# ------------------------------------------------------------------ #
#  Auth                                                                #
# ------------------------------------------------------------------ #

@app.get("/api/auth/status")
async def auth_status():
    return {"authenticated": gmail.is_authenticated()}


@app.post("/api/auth/connect")
async def auth_connect():
    if gmail.is_authenticated():
        return {"status": "already_authenticated"}

    # Hosted mode: return OAuth URL for browser redirect.
    if GMAIL_OAUTH_REDIRECT_URI:
        try:
            payload = gmail.begin_auth()
            return {"status": "auth_required", "auth_url": payload["auth_url"]}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))

    # Local fallback mode for desktop development.
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(_executor, gmail.authenticate)
        return {"status": "authenticated"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/auth/callback")
async def auth_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    if error:
        if GMAIL_POST_AUTH_REDIRECT_URL:
            query = urlencode({"gmailAuth": "error", "reason": error})
            return RedirectResponse(url=f"{GMAIL_POST_AUTH_REDIRECT_URL}?{query}", status_code=302)
        return HTMLResponse(f"<h1>Gmail Auth Error</h1><p>{error}</p>", status_code=400)

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(_executor, gmail.complete_auth, code, state)
    except Exception as exc:
        if GMAIL_POST_AUTH_REDIRECT_URL:
            query = urlencode({"gmailAuth": "error", "reason": str(exc)})
            return RedirectResponse(url=f"{GMAIL_POST_AUTH_REDIRECT_URL}?{query}", status_code=302)
        raise HTTPException(status_code=500, detail=str(exc))

    if GMAIL_POST_AUTH_REDIRECT_URL:
        query = urlencode({"gmailAuth": "success"})
        return RedirectResponse(url=f"{GMAIL_POST_AUTH_REDIRECT_URL}?{query}", status_code=302)

    return HTMLResponse("<h1>Gmail Connected</h1><p>You can close this tab.</p>")


# ------------------------------------------------------------------ #
#  Labels                                                              #
# ------------------------------------------------------------------ #

@app.get("/api/labels")
async def get_labels():
    if not gmail.is_authenticated():
        raise HTTPException(status_code=401, detail="Not authenticated")
    loop = asyncio.get_event_loop()
    labels = await loop.run_in_executor(_executor, gmail.list_labels)
    return {"labels": labels}


# ------------------------------------------------------------------ #
#  Process                                                             #
# ------------------------------------------------------------------ #

@app.post("/api/process")
async def process_emails(days: int = 7, max_results: int = 5):
    if not gmail.is_authenticated():
        raise HTTPException(status_code=401, detail="Not authenticated")

    days = max(1, min(days, 7))
    max_results = max(1, min(max_results, 5))
    fetch_limit = max(max_results * 10, 50)
    fetch_limit = min(fetch_limit, 200)

    treated_ids = _load_treated_email_ids()

    loop = asyncio.get_event_loop()
    emails, labels = await asyncio.gather(
        loop.run_in_executor(_executor, gmail.fetch_recent_emails, days, fetch_limit),
        loop.run_in_executor(_executor, gmail.list_labels),
    )

    untreated = [email for email in emails if email.get("id") not in treated_ids]
    batch = untreated[:max_results]

    suggestions = await get_ai().process_emails(batch, labels)
    SUGGESTIONS_FILE.write_text(json.dumps(suggestions, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"suggestions": suggestions, "total": len(suggestions)}


@app.get("/api/suggestions")
async def get_suggestions():
    if not SUGGESTIONS_FILE.exists():
        return {"suggestions": []}
    try:
        data = json.loads(SUGGESTIONS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, ValueError):
        return {"suggestions": []}
    return {"suggestions": data}


# ------------------------------------------------------------------ #
#  Feedback (accept / skip)                                           #
# ------------------------------------------------------------------ #

@app.post("/api/feedback")
async def submit_feedback(req: FeedbackRequest):
    if not gmail.is_authenticated():
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Decide which action to apply
    action_to_apply = req.override if req.override else req.suggestion

    if req.accepted:
        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(
                _executor,
                gmail.apply_action,
                req.email_id,
                action_to_apply.get("action", "keep"),
                action_to_apply.get("add_label_ids", []),
                action_to_apply.get("new_label_name"),
            )
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Gmail apply failed: {exc}")

    get_ai().record_feedback(
        email_id=req.email_id,
        accepted=req.accepted,
        suggestion=req.suggestion,
        applied_action=action_to_apply if req.accepted else None,
        email=req.email,
    )

    # Update status in suggestions file
    _update_suggestion_status(req.email_id, "accepted" if req.accepted else "skipped")
    return {"status": "ok"}


def _update_suggestion_status(email_id: str, status: str) -> None:
    if not SUGGESTIONS_FILE.exists():
        return
    data = json.loads(SUGGESTIONS_FILE.read_text(encoding="utf-8"))
    for item in data:
        if item.get("email_id") == email_id:
            item["status"] = status
            break
    SUGGESTIONS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _load_treated_email_ids() -> set[str]:
    if not FEEDBACK_FILE.exists():
        return set()

    treated_ids: set[str] = set()
    with FEEDBACK_FILE.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            email_id = entry.get("email_id")
            if email_id:
                treated_ids.add(email_id)

    return treated_ids


# ------------------------------------------------------------------ #
#  Static / PWA                                                        #
# ------------------------------------------------------------------ #

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")


@app.get("/manifest.json")
async def manifest():
    return FileResponse(str(BASE_DIR / "static" / "manifest.json"))


@app.get("/sw.js")
async def service_worker():
    return FileResponse(str(BASE_DIR / "static" / "sw.js"), media_type="application/javascript")


@app.get("/")
async def root():
    return FileResponse(str(BASE_DIR / "static" / "index.html"))
