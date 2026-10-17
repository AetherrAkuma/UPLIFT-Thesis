---
ArtifactMetadata:
  UserFacing: true
---

# Findings — Cloudflare Turnstile: fixed and validated end-to-end

- **Date:** 2026-10-17 · **Widget:** "uplift" · **Sitekey:** `0x4AAAAAAFYoUcDpsjGiehNC`
- **Status:** code fixed, live-validated with a real token from the public domain, replayed-token rejection verified.
- **Companion:** `.agents/artifacts/implementation_plan.md` (EXECUTED) · Spec: `docs/specs/2026-10-17-cloudflare-turnstile-design.md`

## Why "Siteverify isn't being called" and "it doesn't go in"

| # | Root cause (verified on this machine) | Symptom explained |
| :-- | :--- | :--- |
| 1 | **The port-8000 server was stale**: process started 12:26 PM, `server.py` last written 12:44 PM. Uvicorn runs without reload here (`main.py`), so the live process can never run code added afterwards. | "Siteverify isn't being called for uplift" — the running backend predates the verification code; no request could ever reach Cloudflare. |
| 2 | **Widget rejects `localhost`** — Cloudflare error `110200` ("sitekey not enabled for this hostname") when rendering on `http://localhost:8015`. The public domain renders and mints fine. | "it doesn't go in" — on local URLs the widget shows an error and never produces a token, so the submit button stays disabled. |
| 3 | Real secret was duplicated into the tracked `.env.example` (identical to `.env`). Git history scan proved it was **never committed** — the file was still uncommitted, so the leak was scrubbed before it could enter history. | Secret-hygiene risk, not the runtime bug. |
| 4 | Landing.jsx quick-employer widget declared action `employer_login` but posts to `/auth/register/employer`. | Would have rejected employer registrations once actions were enforced. |
| 5 | Cloudflare docs say tokens are single-use, but siteverify **accepted the same token 4×** within its 5-minute window in on-machine testing. | No replay protection from Cloudflare in practice. |

## What changed

1. **`server.py` — canonical siteverify (Cloudflare spin flow)**
   - Production path (real secret): require `success=true`, token `action` ∈ caller's expected set, `hostname` ∈ `TURNSTILE_HOSTNAMES` (default `uplift.ragetech.dev,localhost,127.0.0.1`), **fail closed**; log `[INFO] Turnstile verified: action=…, hostname=…` on success and exact `[WARN]` reasons on rejection.
   - Dev/test path (official `1x…` secret): unchanged frictionless behavior for local development.
   - **Server-side single-use**: redeemed token digests (sha256) remembered for 10 minutes; replays rejected before any network call.
   - Expected actions wired: `/api/auth/register` → `candidate_register|candidate_quick_register`; `/api/auth/register/employer` → `employer_register`; `/api/auth/login` → `login|employer_login`.
2. **`frontend/src/pages/Landing.jsx`** — quick-employer action fixed → `employer_register`; **`frontend/dist` rebuilt** (bundle `index-B5a7r5Q3.js`: real sitekey present, no test-key fallback, all action strings correct). The public site already serves this bundle (safe with the old backend — extra fields are ignored).
3. **`.env.example`** — real key pair replaced with Cloudflare's official test keys + documented `TURNSTILE_HOSTNAMES`; **`.env`** gained `TURNSTILE_HOSTNAMES=uplift.ragetech.dev,localhost,127.0.0.1`.

## Validation evidence (new code on test port 8015, public site untouched for serving)

| Test | Result |
| :--- | :--- |
| Secret probe (dummy token → siteverify) | `success=false, error-codes=["invalid-input-response"]` → **secret is valid** (never `invalid-input-secret`) |
| Register — no token | `400` (rejected before any call, by design) |
| Register — garbage token | `400` + `[WARN] … ['invalid-input-response']` → **siteverify really called with the real secret** |
| 3 wrong logins | `401 ×3` — captcha not required yet (progressive-gate design) |
| 4th login — garbage token | `403` + `[WARN] … invalid-input-response` — gate enforced |
| **Real token** (minted in a real browser on `uplift.ragetech.dev`, solved widget, `metadata.interactive=false`) | `[INFO] Turnstile verified: action='login', hostname='uplift.ragetech.dev'` → request passed the gate (`401` invalid credentials, not `403`) |
| **Replay** of that token | `403` + `[WARN] Turnstile token replay rejected (token was already redeemed)` |
| Raw Cloudflare response, same token, 4th redemption (pre-fix probe) | `{"success": true, "error-codes": [], "hostname": "uplift.ragetech.dev", "action": "login"}` → Cloudflare does not enforce single-use in practice |
| `tests/test_turnstile_auth.py` | `[ALL UNIT TESTS PASSED FOR TURNSTILE AUTH]` (exit 0) |
| Startup log during tests | Bi-Encoder → Cross-Encoder → Qwen verbalizer; **no Flan anywhere** |

No database writes occurred during validation (login-path only; register attempts were rejected pre-insertion). Test server terminated; browser tabs closed.

## You need to do (2 minutes)

1. **Restart the backend: run `start.bat`.** The public server keeps running the stale code until then — this is what makes siteverify live for widget "uplift" on port 8000, and it also activates the single-load `main.py` fix (each model banner exactly once).
2. *(Optional but recommended)* In the Cloudflare dashboard → Turnstile → **uplift** → Settings → **Hostname management**: add `localhost` and `127.0.0.1`. Without this, the widget still errors `110200` when you test on local URLs — the public domain is unaffected.
3. The `.env.example` secret was never committed, so **no secret rotation is needed** — just keep `.env` out of commits as before.

## Related, still parked (from earlier work)

- Inert Flan cache on disk (947.5 MB) — delete when you confirm nothing else references it.
- Resume-path docs claim an LLM in `render_engine.py` where none was ever implemented (Flan or Qwen) — decide remove/keep/implement.
- Commit timing: everything remains uncommitted until you say so.
