# Public Orchestration APIs — Auth / Identity Service

## 1. Purpose

This document defines the **public, frontend-facing APIs** of the Auth / Identity Service.

These APIs:

- Represent **user workflows**
- Orchestrate **multiple domain-level operations**
- Execute within **clear transactional boundaries**
- Are the **only APIs intended to be called by clients**
- Intentionally **hide domain primitives** such as identity creation and credential attachment

---

## 2. Design Principles

### 2.1 Frontend never coordinates invariants

The frontend must never manage identity, credential, or session lifecycles.  
All orchestration happens **server-side**.

---

### 2.2 Public APIs are workflows, not primitives

- Public APIs describe **what the user is trying to do**
- Domain APIs describe **what transitions are allowed**

---

### 2.3 Public APIs are atomic

A public API either:

- Completes successfully, **or**
- Fails without leaving **externally observable inconsistent state**

---

### 2.4 Public APIs do not leak internal structure

Clients:

- Do not know about identities vs credentials
- Do not know about session tables
- Do not manage retries across steps

---

### What “Public API Planning” does

It answers:

- What does the frontend call?
- What flows must be atomic?
- Which errors are user-facing?
- Which domain steps are composed?
- Where do transactions begin and end?
- Which endpoints are idempotent?

It **does not change invariants** — it composes them.

---

## 3. Domain APIs vs Public APIs

### Domain APIs (internal)

These describe what is possible:

- `POST /identities`
- `POST /credentials/password`
- `POST /sessions`

---

### Public APIs (facade)

These describe how users interact:

- `POST /register`
- `POST /auth/login`
- `POST /auth/oauth/{provider}`

---

## 4. Public API Surface (Complete)

These are the **only endpoints intended for frontend consumption**:

- `POST /register`
- `POST /auth/login`
- `POST /auth/oauth/{provider}`
- `POST /tokens/refresh`
- `PUT /auth/password`
- `DELETE /sessions/current`
- `DELETE /sessions`

**Note:** Access tokens are never issued directly from `/auth/login`.

---

## 5. API Definitions & Internal Orchestration

---

### 5.1 `POST /register`  
*(Email + password signup)*

**User intent**  
“Create an account using email and password”

**Internal orchestration (single unit of work)**

- Create identity  
- Attach password credential  
- Initiate email verification  
- (Optional) create session  

All steps occur inside a transaction.

**Failure behavior**

- Any failure → rollback
- No partial identity exposed
- Generic error response

**Notes**

- Does **not** authenticate email
- Does **not** guarantee a session unless explicitly configured
- Does **not** reveal if email already exists

**Domain APIs used (internal)**

- `POST /identities`
- `POST /credentials/password`
- `POST /verifications/email`
- `(Optional) POST /sessions`

**Email verification flow**

- Verification is mandatory but asynchronous
- Triggered automatically during registration
- Resend via `POST /verifications/email`
- Verification confirmation does **not** authenticate the user

---

### 5.2 `POST /auth/login`  
*(Email + password login)*

**User intent**  
“Sign in to my account”

**Internal orchestration**

- Verify email + password (timing-safe)
- Create authenticated session
- Issue refresh token bound to the session
- Set refresh token as HttpOnly, secure cookie

This endpoint does **not** issue access tokens.

**Failure behavior**

- Uniform `401 Unauthorized`
- No identity existence leakage
- Rate-limited to mitigate brute-force attacks

**Notes**

- Each successful call creates a new session
- Multiple devices → multiple independent sessions
- Access tokens are obtained via `/tokens/refresh`
- Authentication is separated from authorization

**Refresh token delivery**

- Default: HttpOnly cookie
- Optional: response body when header is present

