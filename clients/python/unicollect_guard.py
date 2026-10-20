"""
Unicollect Guard: tiny Python client (standard library only).

    from unicollect_guard import Guard
    g = Guard.from_status_page("https://<user>.github.io/<repo>/")   # finds the live link
    # or: g = Guard("https://xxxx.trycloudflare.com", api_key=None)
    print(g.check("to khar hasti")["decision"])
    print(g.is_safe("Have a nice day"))
"""
import json
import urllib.error
import urllib.request


class GuardError(Exception):
    def __init__(self, status, code, message):
        super().__init__(f"{status} {code}: {message}")
        self.status, self.code, self.message = status, code, message


class Guard:
    def __init__(self, base_url, api_key=None, timeout=120):
        self.base = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

    @classmethod
    def from_status_page(cls, pages_url, **kw):
        """Read <pages>/api/links.json and connect to the current live link."""
        url = pages_url.rstrip("/") + "/api/links.json"
        with urllib.request.urlopen(url, timeout=20) as r:
            links = json.load(r)
        if not links.get("base_url"):
            raise GuardError(503, "offline", "No live Guard link is published right now.")
        return cls(links["base_url"], **kw)

    # -- transport ------------------------------------------------------
    def _call(self, method, path, body=None):
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            try:
                err = json.load(e).get("error", {})
            except Exception:
                err = {}
            raise GuardError(e.code, err.get("code", "http_error"), err.get("message", str(e))) from None

    # -- guard ----------------------------------------------------------
    def check(self, text, detailed=True):
        return self._call("POST", "/api/v1/check", {"text": text, "detailed": detailed})

    def check_batch(self, texts, detailed=False):
        return self._call("POST", "/api/v1/check/batch", {"texts": list(texts), "detailed": detailed})

    def verdict(self, text):
        return self._call("POST", "/api/v1/verdict", {"text": text})

    def is_safe(self, text):
        return self.verdict(text)["decision"] == "SAFE"

    def score(self, text, models=None, script=None):
        return self._call("POST", "/api/v1/score", {"text": text, "models": models, "script": script})

    def sentences(self, text):
        return self._call("POST", "/api/v1/sentences", {"text": text})

    def censor(self, text, char="*", mode="words", include_contextual=False):
        return self._call("POST", "/api/v1/censor", {"text": text, "char": char, "mode": mode,
                                                     "include_contextual": include_contextual})["text"]

    def moderations(self, inp):
        return self._call("POST", "/api/v1/moderations", {"input": inp})

    # -- utilities ------------------------------------------------------
    def profanity(self, text):
        return self._call("POST", "/api/v1/profanity", {"text": text})

    def language(self, text):
        return self._call("POST", "/api/v1/language", {"text": text})

    def transliterate(self, text):
        return self._call("POST", "/api/v1/fingilish/transliterate", {"text": text})["persian"]

    def normalize(self, text):
        return self._call("POST", "/api/v1/normalize", {"text": text})["normalized"]

    # -- discovery ------------------------------------------------------
    def health(self):
        return self._call("GET", "/api/v1/health")

    def models(self):
        return self._call("GET", "/api/v1/models")

    def config(self):
        return self._call("GET", "/api/v1/config")

    def stats(self):
        return self._call("GET", "/api/v1/stats")


if __name__ == "__main__":
    import sys
    g = Guard(sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000")
    for t in sys.argv[2:] or ["salam khoobi", "to khar hasti", "Have a nice day"]:
        r = g.check(t, detailed=False)
        print(f"{r['decision']:8} {r['confidence']:.2f}  {t}")
