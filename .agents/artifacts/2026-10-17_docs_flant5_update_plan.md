---
ArtifactMetadata:
  RequestFeedback: true
  UserFacing: true
---

# Implementation Plan — Cloudflare Turnstile: make siteverify actually run

> Status: **executing now** (you asked for the fix; validation runs on a test port).
> Related spec: `docs/specs/2026-10-17-cloudflare-turnstile-design.md` · Widget: "uplift" · Sitekey: `0x4AAAAAAFYoUcDpsjGiehNC`

## What the investigation proved (this machine, today)

| Check | Result |
| :--- | :--- |
| Secret in `.env` validated directly against Cloudflare siteverify (official dummy-token probe) | ✅ **VALID** (`invalid-input-response`, never `invalid-input-secret`) |
| `frontend/.env` + built `dist` bundle carry the real sitekey | ✅ correct (`0x4AAAAAAFYoUcDpsjGiehNC` present, no test-key fallback) |
| All four forms send `turnstile_token`; every widget pass an `action` | ✅ wired in source |
| **Server on port 8000 is STALE** — process started 12:26, `server.py` last changed 12:44 | ❌ **the live process predates the verification code → "Siteverify isn't being called"** |
| `.env.example` (a tracked file) contains the REAL secret, identical to `.env` | ❌ hygiene bug — but never committed (verified via git history), so it can be scrubbed **before** it ever enters history |
| Landing.jsx quick-employer widget uses action `employer_login` while posting to `/auth/register/employer` | ❌ mislabel — would be rejected once actions are enforced |

## Fixes

### 1. `server.py` — canonical siteverify (Cloudflare spin flow)
- `verify_turnstile` hardening:
  - Production (real secret): require `success=true`, token `action` ∈ caller's expected set, `hostname` ∈ `TURNSTILE_HOSTNAMES` (default `uplift.ragetech.dev,localhost,127.0.0.1`); **fail closed**; log `[INFO] Turnstile verified: action=…, hostname=…` on success and exact `[WARN]` reasons on rejection.
  - Dev/test (official `1x…` test secret): skip depth checks, tolerate network hiccups — local work never blocked.
  - `remoteip` sent only when known.
- Expected actions wired at the three endpoints:
  - `/api/auth/register` → `candidate_register` / `candidate_quick_register`
  - `/api/auth/register/employer` → `employer_register`
  - `/api/auth/login` (progressive gate) → `login` / `employer_login`

### 2. `frontend/src/pages/Landing.jsx` — one-line action fix
`employer_login` → `employer_register` on the quick-employer registration widget, then **rebuild `frontend/dist`** (that is what the public server serves).

### 3. Env hygiene
- `.env.example` → official test keys + documented `TURNSTILE_HOSTNAMES` (real pair removed; it never reached git history).
- `.env` → append explicit `TURNSTILE_HOSTNAMES=uplift.ragetech.dev,localhost,127.0.0.1`.

### 4. Validation on this machine (real tokens — spin "validate the destination" step)
1. `py_compile` clean + `tests/test_turnstile_auth.py` green.
2. Test server on **port 8015** — the public site on 8000 stays untouched.
3. No token → 400. Garbage token → 400 **plus a `[WARN] … invalid-input-response` log line: proof siteverify was actually called with the real secret**.
4. Browser triggers the 3-failed-login challenge, solves the real widget → fresh token → posted to the test server → expect `[INFO] Turnstile verified` and the request passing the gate (401 invalid-credentials = gate open, not 403).
5. Replay the same token → rejected (`timeout-or-duplicate`) → single-use confirmed.
6. If the widget refuses to render on localhost, run the same validation with a token minted on the public site.

### 5. Deployment (one manual step, then done)
The port-8000 server keeps running old code until restarted: **run `start.bat` once** after this plan completes (it kills the stale process and boots the new `server.py`). From then on Cloudflare sees siteverify calls for widget "uplift".

## Not changing
Widget keys/settings/challenge mode · public site during validation · DB schema · auth token logic.
