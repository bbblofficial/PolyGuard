/**
 * Unicollect Guard: tiny JS client (browser + Node 18+, uses fetch).
 *
 *   import { Guard } from "./unicollect-guard.js";
 *   const g = await Guard.fromStatusPage("https://<user>.github.io/<repo>/");
 *   const r = await g.check("to khar hasti");   // { decision: "TOXIC", ... }
 *   if (!(await g.isSafe(comment))) showWarning();
 */
export class GuardError extends Error {
  constructor(status, code, message) {
    super(`${status} ${code}: ${message}`);
    this.status = status; this.code = code;
  }
}

export class Guard {
  constructor(baseUrl, { apiKey = null, timeoutMs = 120000 } = {}) {
    this.base = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  static async fromStatusPage(pagesUrl, opts) {
    const r = await fetch(pagesUrl.replace(/\/+$/, "") + "/api/links.json?t=" + Date.now(), { cache: "no-store" });
    const links = await r.json();
    if (!links.base_url) throw new GuardError(503, "offline", "No live Guard link is published right now.");
    return new Guard(links.base_url, opts);
  }

  async _call(method, path, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    const headers = { "Content-Type": "application/json" };
    if (this.apiKey) headers["X-API-Key"] = this.apiKey;
    try {
      const r = await fetch(this.base + path, {
        method, headers, signal: ctrl.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const e = data.error || {};
        throw new GuardError(r.status, e.code || "http_error", e.message || r.statusText);
      }
      return data;
    } finally { clearTimeout(timer); }
  }

  check(text, detailed = true)        { return this._call("POST", "/api/v1/check", { text, detailed }); }
  checkBatch(texts, detailed = false) { return this._call("POST", "/api/v1/check/batch", { texts, detailed }); }
  verdict(text)                       { return this._call("POST", "/api/v1/verdict", { text }); }
  async isSafe(text)                  { return (await this.verdict(text)).decision === "SAFE"; }
  score(text, models, script)         { return this._call("POST", "/api/v1/score", { text, models, script }); }
  sentences(text)                     { return this._call("POST", "/api/v1/sentences", { text }); }
  async censor(text, opts = {})       { return (await this._call("POST", "/api/v1/censor", { text, ...opts })).text; }
  moderations(input)                  { return this._call("POST", "/api/v1/moderations", { input }); }
  profanity(text)                     { return this._call("POST", "/api/v1/profanity", { text }); }
  language(text)                      { return this._call("POST", "/api/v1/language", { text }); }
  async transliterate(text)           { return (await this._call("POST", "/api/v1/fingilish/transliterate", { text })).persian; }
  async normalize(text)               { return (await this._call("POST", "/api/v1/normalize", { text })).normalized; }
  health()                            { return this._call("GET", "/api/v1/health"); }
  models()                            { return this._call("GET", "/api/v1/models"); }
  config()                            { return this._call("GET", "/api/v1/config"); }
  stats()                             { return this._call("GET", "/api/v1/stats"); }
}
