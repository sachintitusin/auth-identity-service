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

## Documentation (Recommended Reading Order)

This repository is intentionally **documented from first principles**.

1. [Trust Boundaries](docs/trust-boundaries.md)
2. [Threat Model](docs/threat-model.md)
3. [Domain Invariants](docs/domain-invariants.md)
4. [Public APIs](docs/public-apis.md)
5. [Database Design](docs/database-design.md)
6. [Testing Strategy](docs/testing-strategy.md)
7. [OpenAPI Specification](docs/openapi.yaml)

> Behavioral guarantees and security semantics are defined in the design documents above.  
> The OpenAPI specification describes request/response **shape only**.

---

## Getting the App Running (For Testing & Exploration)

### Prerequisites

- Node.js (LTS)
- PostgreSQL
- npm or pnpm

### Setup

```bash
git clone <repo-url>
cd <repo>
npm install
```

### Environment Configuration

Create a `.env` file:

```env
DATABASE_URL=postgres://user:password@localhost:5432/auth_db
JWT_SECRET=dev-secret
```

### Database

```bash
npm run migrate
```

### Start the Server

```bash
npm run dev
```

API available at `http://localhost:3000`

---

## Testing

```bash
npm test
```

Tests use a real PostgreSQL database and validate both
HTTP contracts and domain-level invariants.

---

## Infrastructure & Extensibility Notes

Email delivery is intentionally treated as **outside the authentication security boundary**.

The system is designed to support **asynchronous delivery pipelines** for verification
and notification emails. In a production deployment, this can be backed by:

- AWS SQS
- Redis-backed queues
- Other message brokers

Queue-backed delivery ensures that:
- authentication correctness does not depend on email latency or availability
- verification workflows remain non-blocking
- transient infrastructure failures do not affect auth invariants

The boundary between authentication logic and delivery infrastructure
is explicit and replaceable by design.

---

## What This Project Is NOT

- Not a drop-in auth library
- Not a complete IAM solution
- Not UI-focused
- Not production-scaled infrastructure

---

## Closing Note

This project is intentionally **over-designed** for its size.

That is the point.

It reflects how authentication systems are designed, reviewed,
and reasoned about in security-sensitive environments —
with explicit guarantees, clear failure semantics, and defense in depth.
