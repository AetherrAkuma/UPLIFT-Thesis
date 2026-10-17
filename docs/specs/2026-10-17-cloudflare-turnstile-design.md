# Technical Specification: Cloudflare Turnstile Integration

- **Date:** 2026-10-17
- **Feature:** Cloudflare Turnstile Bot Protection for Registration & Progressive Login Gate
- **Status:** Approved

---

## 1. Scope & Objectives

### In Scope
1. **Candidate & Employer Registration**:
   - Turnstile verification required on candidate quick registration (`Landing.jsx`).
   - Turnstile verification required on candidate multi-step registration (`Register.jsx`).
   - Turnstile verification required on employer onboarding (`EmployerOnboarding.jsx`).
2. **Progressive Login Gate (3 Failed Attempts)**:
   - Normal login without Turnstile for attempts 1 and 2.
   - If an account/session fails password authentication 3 times consecutively, dynamically render the `<TurnstileWidget />` challenge.
   - Subsequent login submissions require solving the challenge; backend rejects attempts $\ge 3$ without a valid Turnstile token.
   - Applied to both Candidate Login (`Landing.jsx`) and Employer Login (`EmployerLogin.jsx`).
3. **Backend Validation (`server.py`)**:
   - Verify Turnstile tokens against Cloudflare `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
   - Maintain an in-memory sliding window counter for failed login attempts by composite key (`f"{client_ip}:{normalized_email}"`).
   - Reset failed counter upon successful authentication.
4. **Local & Testing Support**:
   - Safe fallbacks to Cloudflare official test keys (`1x00000000000000000000AA` sitekey / `1x00000000000000000000000000000000AA` secret key) so local development works out of the box without requiring manual Cloudflare dashboard credentials.

### Non-Goals
- Changing the password hashing or JWT issuance mechanisms.
- Blocking OAuth / Social login (system currently uses email/password).

---

## 2. Architecture & Components

### 2.1 Reusable Turnstile Component (`frontend/src/components/TurnstileWidget.jsx`)
- Zero third-party dependencies (compatible with React 19).
- Dynamically loads `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`.
- Renders container with unique ID and triggers `window.turnstile.render(...)`.
- Exposes `reset()` via `useImperativeHandle` / forwardRef.
- Prop callbacks: `onVerify(token)`, `onExpire()`, `onError(err)`.
- Respects light/dark themes and styling tokens.

### 2.2 Client-Side Login State Tracking
- Stored in component state and synced with `sessionStorage` (`failed_logins_${email}`).
- When `failedAttempts >= 3` or backend returns `{ require_turnstile: true }`:
  - Show warning message: "Security verification required due to multiple failed login attempts."
  - Render `<TurnstileWidget />` above the submit button.
  - Disable submit button until Turnstile token is generated.

### 2.3 Backend Validation (`server.py`)
- **Rate-limit / Attempt Tracker:**
  - Dict mapping `composite_key -> {"count": int, "reset_at": float}` with a 15-minute sliding TTL.
- **Verification Function:**
  ```python
  async def verify_turnstile(token: str, remote_ip: str | None = None) -> bool
  ```
  - Sends POST to `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
  - Checks `"success": True`.
- **Endpoints Modified:**
  - `POST /api/auth/register`: Requires `turnstile_token`.
  - `POST /api/auth/register/employer`: Requires `turnstile_token`.
  - `POST /api/auth/login`:
    - Checks failed attempts count for `composite_key`.
    - If count $\ge 3$, requires and validates `turnstile_token`.
    - On password mismatch, increments count and returns HTTP 401 with `require_turnstile: count >= 3`.
    - On success, resets counter.

---

## 3. Error Handling & Edge Cases

1. **Turnstile Token Expiration**:
   - `onExpire` hook clears the state token and re-renders the widget with an inline notification.
2. **Ad-Blockers or Network Blocks**:
   - `onError` triggers a friendly warning banner explaining that security verification was blocked and offering a retry button.
3. **Office / Shared Network NAT**:
   - Keys use composite `f"{ip}:{email}"` rather than raw IP alone to prevent locking out entire offices or campuses.

---

## 4. Verification Plan

- [ ] Verify Turnstile widget mounts cleanly on React 19 without errors.
- [ ] Attempt 1 & 2 failed logins: Turnstile does NOT appear; error displays "Invalid credentials".
- [ ] Attempt 3 failed login: Turnstile challenge appears; submit is locked until solved.
- [ ] Valid login resets the counter.
- [ ] Registration forms cannot submit without solving Turnstile challenge.
- [ ] Backend rejects registration or attempt 3+ login if turnstile token is absent or invalid.
