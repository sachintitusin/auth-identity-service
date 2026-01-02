# Auth / Identity Service

A security-first, session-centric authentication and identity service designed for real-world production systems.

This project is not a “login API”.
It is an auth platform built around trust boundaries, threat modeling, and explicit domain invariants.

The goal is simple:

Make insecure behavior impossible by design, not just unlikely by implementation.

---

## Why this exists

Most authentication systems fail not because of bad crypto —
they fail because of blurred responsibilities, implicit trust, and leaky abstractions.

This service explicitly avoids:
- User enumeration
- Token replay
- Implicit session trust
- Privilege escalation via OAuth
- Frontend-managed security state
- Long-lived or reusable tokens

---

## Design Philosophy

The system is designed top-down:

1. Trust Boundaries  
2. Threat Model  
3. Domain Invariants  
4. API Contracts  
5. Implementation  

If a lower layer violates a higher one, the system is considered invalid — even if it works.

---

## Core Concepts

- Identity: Stable internal representation of a user or service
- Credential: Authentication method (password, OAuth, etc.)
- Session: Server-recognized authenticated context
- Access Token: Short-lived, stateless authorization proof
- Refresh Token: Single-use secret used to obtain access tokens
- Verification: Proof of control over an attribute (email, phone)

Identity ≠ Credential ≠ Session ≠ Token

---

## Security Invariants (Non-Negotiable)

- Refresh tokens are single-use
- Refresh token reuse is a security incident
- Sessions are explicit and revocable
- Access tokens are short-lived and stateless
- Raw tokens are never stored or logged
- Email verification is not authentication
- Identity existence is not externally observable
- Backend services are never implicitly trusted
- Security failures fail closed

---

## Token Model

Login does NOT issue access tokens.

Flow:
- /auth/login → creates session + refresh token
- /tokens/refresh → rotates refresh token + issues access token

Refresh tokens are rotated on every use.
Reuse triggers global session revocation.

---

## API Surface

Public APIs (frontend-facing):
- POST /register
- POST /auth/login
- POST /auth/oauth/{provider}
- POST /tokens/refresh
- DELETE /sessions/current

Domain APIs (internal only):
- POST /identities
- POST /credentials/password
- POST /sessions

Frontends never coordinate identity, credential, or session lifecycles.

---

## Database Design Highlights

- Internal primary keys are never exposed
- Stable public identifiers exist where required
- Tokens are stored hashed only
- Soft deletes preserve forensic integrity
- Audit logs are immutable

---

## What This System Does NOT Do

- MFA
- Password reset flows
- Device fingerprinting
- Rate limiting logic
- UI or frontend code
- Business-domain authorization

These are layered on top, not mixed into the core.

---

## Technology (Replaceable)

- Node.js / NestJS
- PostgreSQL
- JWT
- Redis (optional)
- Zod validation

Security guarantees live above the framework layer.

---

## Status

Active development.

Architecture, invariants, contracts, and ADRs are stable.
Features are added only if they preserve existing guarantees.

---

This is a reference-quality auth system.
If something feels strict or inconvenient — it is probably protecting you.
