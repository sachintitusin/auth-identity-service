# Security-First Authentication & Identity Service

An **invariant-driven, threat-modeled authentication system** designed around
explicit identity, session, and token lifecycles.

This project explores what authentication looks like when correctness,
non-observability, and security guarantees are treated as first-class concerns —
not framework defaults or afterthoughts.

---

## Why This Project Exists

Most authentication systems evolve organically and fail in subtle but dangerous ways:

- token replay bugs
- session resurrection
- user enumeration via error messages
- unsafe OAuth account linking
- security logic split between frontend and backend
- database states that *should never exist*

This project was built to answer a different question:

> **What if authentication were designed from invariants and threat models first,
> and only then implemented?**

The result is not a generic auth starter kit, but a **reference-grade authentication system**
that prioritizes correctness, auditability, and security boundaries.

---

## What Makes This Different

- **Session-first authentication model**  
  Login creates a session; access tokens are issued *only* via refresh.

- **Single-use refresh tokens with rotation & replay detection**  
  Token reuse is treated as an active compromise.

- **Non-observable failure behavior by design**  
  Identity existence, verification state, and token validity are never leaked.

- **Explicit trust boundaries & threat modeling**  
  Security decisions are intentional, not implicit.

- **Database as a security boundary**  
  Invariants are enforced via constraints, partial indexes, and immutability.

- **OAuth without email-based identity merging**  
  External identities are bound strictly by `(provider, subject)`.

- **Immutable audit logging**  
  Security events are preserved for forensics without affecting auth behavior.

---

## Core Design Principles

- Trust boundaries are explicit  
- APIs represent **state transitions**, not actions  
- Frontends never coordinate security invariants  
- Authentication ≠ verification ≠ authorization  
- Security failures fail closed  
- Token delivery does not change token semantics  

---

## System Overview

### Core Concepts

- **Identity** — a stable representation of a person or system  
- **Credential** — a method used to authenticate an identity  
- **Session** — a server-recognized authenticated context  
- **Access Token** — short-lived proof of authentication  
- **Refresh Token** — single-use continuation capability  
- **Verification** — proof of control over an attribute  
- **Principal** — an authenticated user or service  

### Ownership Model

```
Identity           → ROOT
Credential         → OWNED BY Identity
Session            → OWNED BY Identity
Refresh Token      → OWNED BY Session
Verification       → OWNED BY Identity
External Identity  → OWNED BY Identity
Audit Log          → ROOT
Service Principal  → ROOT
```

---

## Authentication Model (High Level)

- **Login**
  - Verifies credentials
  - Creates a session
  - Issues a refresh token
  - Does *not* issue access tokens

- **Token Refresh**
  - Validates refresh token
  - Detects reuse
  - Rotates refresh token
  - Issues access token

- **Logout**
  - Per-session or global
  - Irreversible

---

## Public API Philosophy

Public APIs are **orchestration facades**, not domain primitives.

They:
- represent user intent
- compose multiple invariant-enforced operations
- are atomic
- collapse failure modes intentionally

The frontend never coordinates identity, session, or token lifecycles.

---

## Documentation (Start Here)

This repository is intentionally **documented from first principles**.

If you want to understand *why* the system works the way it does,
start with the `/docs` directory:

### Suggested Reading Order

1. **Trust Boundaries** — where assumptions stop  
2. **Threat Model** — what the system is designed to survive  
3. **Domain Invariants** — rules that must never break  
4. **Public APIs** — user-facing workflows & guarantees  
5. **Database Design** — how invariants are enforced at persistence  
6. **Testing Strategy** — how non-observable behavior is validated  

---

## Testing Philosophy

Authentication correctness is often **intentionally non-observable**.

This project uses:
- **HTTP contract tests** to assert what clients can observe
- **Domain-level tests** to validate invariant enforcement and silent behavior

Tests avoid asserting on behavior that is intentionally hidden for security reasons.

---

## What This Project Is NOT

- Not a drop-in auth library
- Not a complete IAM solution
- Not UI-focused
- Not production-scaled infrastructure

This is a **reference implementation and learning project**,
built to demonstrate system-level reasoning about authentication.

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express
- **Database:** PostgreSQL
- **Tokens:** JWT (access), opaque refresh tokens
- **Validation:** Zod
- **Testing:** Jest + Supertest
- **Persistence:** Real database (no auth-logic mocks)

---

## Closing Note

This project is intentionally **over-designed** for its size.

That is the point.

It reflects how authentication systems are designed, reviewed,
and reasoned about in security-sensitive environments —
with explicit guarantees, clear failure semantics, and defense in depth.

Feedback, critique, and discussion are welcome.
