// ------------------------------------------------------------------ //
//  State                                                               //
// ------------------------------------------------------------------ //
const state = {
  authenticated: false,
  suggestions: [],      // full list from server
  labels: [],
  filter: "all",        // all | pending | accepted | skipped
  processing: false,
};

// ------------------------------------------------------------------ //
//  API helpers                                                         //
// ------------------------------------------------------------------ //
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ------------------------------------------------------------------ //
//  Boot                                                                //
// ------------------------------------------------------------------ //
async function boot() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
  const { authenticated } = await api("/api/auth/status");
  state.authenticated = authenticated;
  if (authenticated) {
    await loadLabels();
    await loadSuggestions();
  }
  render();
}

async function loadLabels() {
  try {
    const { labels } = await api("/api/labels");
    state.labels = labels;
  } catch (_) {}
}

async function loadSuggestions() {
  try {
    const { suggestions } = await api("/api/suggestions");
    state.suggestions = suggestions || [];
  } catch (_) {}
}

// ------------------------------------------------------------------ //
//  Actions                                                             //
// ------------------------------------------------------------------ //
async function connectGmail() {
  const btn = document.getElementById("connect-btn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Opening browser…`;
  try {
    await api("/api/auth/connect", { method: "POST" });
    state.authenticated = true;
    await loadLabels();
    await loadSuggestions();
    render();
  } catch (err) {
    toast(`Auth failed: ${err.message}`, "error");
    btn.disabled = false;
    btn.textContent = "Connect Gmail";
  }
}

async function processEmails() {
  state.processing = true;
  render();
  const maxEmails = document.getElementById("max-emails-select")?.value || 5;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);
  try {
    const { suggestions } = await api(`/api/process?days=7&max_results=${maxEmails}`, {
      method: "POST",
      signal: controller.signal,
    });
    state.suggestions = suggestions;
    await loadLabels();
    toast(`Analysed ${suggestions.length} emails`);
  } catch (err) {
    toast(`Error: ${err.name === "AbortError" ? "Analysis timed out" : err.message}`, "error");
  } finally {
    clearTimeout(timeoutId);
    state.processing = false;
    render();
  }
}

async function acceptSuggestion(emailId, suggestion, email, override = null) {
  const card = document.querySelector(`[data-id="${emailId}"]`);
  const btn = card?.querySelector(".accept-btn");
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner" style="border-top-color:#fff"></span>`; }

  try {
    await api("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ email_id: emailId, accepted: true, suggestion, email, override }),
    });
    updateLocalStatus(emailId, "accepted");
    render();
    toast("Action applied ✓");
  } catch (err) {
    toast(`Failed: ${err.message}`, "error");
    if (btn) { btn.disabled = false; btn.textContent = "Accept"; }
  }
}

async function skipSuggestion(emailId, suggestion, email) {
  try {
    await api("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ email_id: emailId, accepted: false, suggestion, email }),
    });
    updateLocalStatus(emailId, "skipped");
    render();
  } catch (err) {
    toast(`Failed: ${err.message}`, "error");
  }
}

function updateLocalStatus(emailId, status) {
  const item = state.suggestions.find((s) => s.email_id === emailId);
  if (item) item.status = status;
}

// ------------------------------------------------------------------ //
//  Render                                                              //
// ------------------------------------------------------------------ //
function render() {
  document.getElementById("auth-screen").style.display = state.authenticated ? "none" : "flex";
  document.getElementById("main-screen").style.display = state.authenticated ? "block" : "none";

  if (!state.authenticated) return;

  renderStats();
  renderFilters();
  renderCards();
  renderProcessBtn();
}

function renderProcessBtn() {
  const btn = document.getElementById("process-btn");
  if (state.processing) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Analysing…`;
    document.getElementById("progress-bar-wrap").classList.add("visible");
  } else {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg> Analyse Emails`;
    document.getElementById("progress-bar-wrap").classList.remove("visible");
  }
}

function renderStats() {
  const total   = state.suggestions.length;
  const pending  = state.suggestions.filter((s) => s.status === "pending").length;
  const accepted = state.suggestions.filter((s) => s.status === "accepted").length;
  const skipped  = state.suggestions.filter((s) => s.status === "skipped").length;
  document.getElementById("stats").textContent =
    total ? `${pending} pending · ${accepted} accepted · ${skipped} skipped` : "";
}

function renderFilters() {
  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.filter === state.filter);
  });
}

function renderCards() {
  const list = document.getElementById("card-list");
  const filtered = state.suggestions.filter((s) => {
    if (state.filter === "all") return true;
    return s.status === state.filter;
  });

  if (!filtered.length && !state.suggestions.length) {
    list.innerHTML = `<div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8l10 7 10-7"/></svg>
      <p>No emails yet</p>
      <small>Click "Analyse Emails" to start</small>
    </div>`;
    return;
  }
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><p>No ${state.filter} items</p></div>`;
    return;
  }

  list.innerHTML = filtered.map((item) => buildCard(item)).join("");
  attachCardListeners();
}

function buildCard(item) {
  const { email_id, email, suggestion, status } = item;
  const sg = suggestion || {};
  const action = sg.action || "keep";
  const isDone = status === "accepted" || status === "skipped";
  const initial = (email.from || "?")[0].toUpperCase();

  const labelChips = (sg.add_label_ids || []).map((id) => {
    const label = state.labels.find((l) => l.id === id);
    return `<span class="label-chip">${label ? label.name : id}</span>`;
  }).join("");
  const newLabelChip = sg.new_label_name
    ? `<span class="label-chip new">+ ${sg.new_label_name}</span>` : "";

  const actionsHtml = isDone
    ? `<span class="status-badge status-${status}">${status === "accepted" ? "✓ Applied" : "→ Skipped"}</span>`
    : `<button class="btn-success btn-sm accept-btn" data-id="${email_id}">✓ Accept</button>
       <button class="btn-outline btn-sm edit-btn" data-id="${email_id}">✎ Edit</button>
       <button class="btn-outline btn-sm skip-btn" data-id="${email_id}">→ Skip</button>`;

  const editPanel = isDone ? "" : buildEditPanel(email_id, sg);

  return `<div class="email-card status-${status}" data-id="${email_id}">
    <div class="card-header" data-toggle="${email_id}">
      <div class="card-avatar">${initial}</div>
      <div class="card-meta">
        <div class="card-from">${esc(formatFrom(email.from))}</div>
        <div class="card-subject">${esc(email.subject)}</div>
      </div>
      <div class="card-date">${esc(formatDate(email.date))}</div>
    </div>
    <div class="card-suggestion">
      <span class="action-badge action-${action}">${action.replace("_", " ")}</span>
      ${labelChips}${newLabelChip}
    </div>
    <div class="card-reason">${esc(sg.reason || "")}</div>
    <div class="card-snippet" id="snippet-${email_id}">${esc(email.snippet || "")}</div>
    <div class="card-actions">${actionsHtml}</div>
    ${editPanel}
  </div>`;
}

function buildEditPanel(emailId, sg) {
  const actionOptions = ["keep", "archive", "delete", "mark_unread"].map((a) =>
    `<option value="${a}" ${sg.action === a ? "selected" : ""}>${a.replace("_", " ")}</option>`
  ).join("");

  const labelToggles = state.labels
    .filter((l) => !["INBOX","SENT","TRASH","SPAM","STARRED","UNREAD","IMPORTANT","CATEGORY_PERSONAL","CATEGORY_SOCIAL","CATEGORY_PROMOTIONS","CATEGORY_UPDATES","CATEGORY_FORUMS"].includes(l.id))
    .map((l) => {
      const sel = (sg.add_label_ids || []).includes(l.id) ? "selected" : "";
      return `<button type="button" class="label-toggle ${sel}" data-label-id="${l.id}" data-ep="${emailId}">${esc(l.name)}</button>`;
    }).join("");

  return `<div class="edit-panel" id="edit-${emailId}">
    <h4>Edit suggestion</h4>
    <div class="edit-row">
      <label>Action
        <select id="edit-action-${emailId}">${actionOptions}</select>
      </label>
    </div>
    <div class="labels-grid" id="labels-grid-${emailId}">${labelToggles}</div>
    <div class="new-label-row">
      <input type="text" id="new-label-${emailId}" placeholder="New label name (optional)" value="${esc(sg.new_label_name || "")}">
    </div>
    <div class="edit-row" style="margin-top:12px">
      <button class="btn-success btn-sm apply-override-btn" data-id="${emailId}">✓ Apply Changes</button>
      <button class="btn-outline btn-sm cancel-edit-btn" data-id="${emailId}">Cancel</button>
    </div>
  </div>`;
}

function attachCardListeners() {
  // Toggle snippet on header click
  document.querySelectorAll("[data-toggle]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.toggle;
      document.getElementById(`snippet-${id}`)?.classList.toggle("visible");
    });
  });

  // Accept
  document.querySelectorAll(".accept-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = state.suggestions.find((s) => s.email_id === id);
      if (item) acceptSuggestion(id, item.suggestion, item.email);
    });
  });

  // Edit
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      document.getElementById(`edit-${id}`)?.classList.toggle("open");
    });
  });

  // Cancel edit
  document.querySelectorAll(".cancel-edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById(`edit-${btn.dataset.id}`)?.classList.remove("open");
    });
  });

  // Skip
  document.querySelectorAll(".skip-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = state.suggestions.find((s) => s.email_id === id);
      if (item) skipSuggestion(id, item.suggestion, item.email);
    });
  });

  // Label toggles inside edit panels
  document.querySelectorAll(".label-toggle").forEach((btn) => {
    btn.addEventListener("click", () => btn.classList.toggle("selected"));
  });

  // Apply override
  document.querySelectorAll(".apply-override-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = state.suggestions.find((s) => s.email_id === id);
      if (!item) return;

      const action = document.getElementById(`edit-action-${id}`)?.value || item.suggestion.action;
      const addLabelIds = [...document.querySelectorAll(`.label-toggle.selected[data-ep="${id}"]`)]
        .map((t) => t.dataset.labelId);
      const newLabelName = document.getElementById(`new-label-${id}`)?.value.trim() || null;

      const override = { action, add_label_ids: addLabelIds, new_label_name: newLabelName, reason: "Manually edited" };
      acceptSuggestion(id, item.suggestion, item.email, override);
    });
  });
}

// ------------------------------------------------------------------ //
//  Helpers                                                             //
// ------------------------------------------------------------------ //
function formatFrom(from) {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.replace(/<.*>/, "").trim() || from;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch (_) { return dateStr; }
}

function esc(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toast(msg, type = "info") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.style.background = type === "error" ? "#c62828" : "#323232";
  el.classList.add("show");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 3000);
}

// ------------------------------------------------------------------ //
//  Event wiring                                                        //
// ------------------------------------------------------------------ //
document.getElementById("connect-btn")?.addEventListener("click", connectGmail);
document.getElementById("process-btn")?.addEventListener("click", processEmails);
document.querySelectorAll(".filter-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    state.filter = chip.dataset.filter;
    renderFilters();
    renderCards();
  });
});

boot();
