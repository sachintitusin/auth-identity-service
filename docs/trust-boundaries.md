# Trust Boundaries — Auth / Identity Service

## Purpose

This document defines the **trust boundaries** of the Auth / Identity Service.

A **trust boundary** is any point where data crosses from a context we do **not fully control**
into one we **do control**.  
Every trust boundary requires explicit defensive behavior.

This document establishes:
- where trust changes
- what assumptions are invalid
- what security guarantees must be enforced at each boundary

---

## What a Trust Boundary Means

At a trust boundary:
- **Input is untrusted by default**
- **Caller identity is not trusted**
- **Client intent is not trusted**
- **Ordering, timing, and repetition are not trusted**

> **Rule:**  
> Never trust *who* is calling — only trust *what you can verify*.

---

## Boundary 0 (Critical): Internet → Auth Service

This is the **most critical boundary**.

All inbound requests to the Auth API are considered **untrusted**, regardless of origin.

### Untrusted Callers Include
- Browser
- Mobile app
- Postman
- Curl
- A “trusted” frontend
- Your own backend services

There is **no implicit trust** based on client type, network location, or ownership.

---

### What Crosses This Boundary

- Email addresses
- Passwords
- Tokens (access, refresh, verification)
- Headers
- Cookies
- IP address
- User-Agent
- OAuth callbacks

All of the above are treated as **attacker-controlled input**.

---

### Assumptions at This Boundary

We assume that:
- Clients can be malicious
- Requests can be replayed
- Headers can be forged
- Timing can be measured
- Request order can be abused
- Duplicate requests can be intentional

---

### Required Security Controls

At this boundary, the system must enforce:

- Input validation and schema enforcement
- Rate limiting
- Enumeration protection
- Timing-safe comparisons
- CSRF strategy (for browser clients)
- Token verification and validation
- Fail-closed behavior on ambiguity

No downstream component may rely on unchecked input from this boundary.

---

## Boundary 1: Frontend (Browser) ↔ Auth API

Browser clients introduce **unique risks** that do not apply to mobile or backend clients.

Browsers:
- Automatically send cookies
- Execute attacker-controlled JavaScript (XSS)
- Allow user control via devtools
- Execute across multiple origins

---

### Browser-Specific Threats

- Cross-Site Request Forgery (CSRF)
- Cross-Site Scripting (XSS)
- Token exfiltration via malicious scripts or extensions
- Session fixation
- Origin spoofing

---

### Browser Security Characteristics

Browsers involve:
- Cookies
- CSRF
- XSS
- SameSite cookie rules
- CORS
- Mixed-origin execution

---

### Design Decisions at This Boundary

Examples of explicit decisions:
- Are access tokens stored in memory or headers?
- Are refresh tokens stored in HttpOnly cookies?
- Is CSRF mitigated via SameSite or explicit CSRF tokens?
- Are `Origin` or `Referer` headers trusted? (**No**)

Browser-specific assumptions must never leak into mobile or backend logic.

---

## Boundary 2: Mobile App ↔ Auth API

Mobile clients operate under **very different assumptions**.

There are:
- No HttpOnly cookies
- No CSRF
- No reliable device trust

---

### Mobile Threat Model

Mobile apps:
- Can be reverse-engineered
- Can leak embedded secrets
- Run on compromised or rooted devices
- Operate on hostile networks

---

### Implications

- Browser-based security assumptions **do not apply**
- Token transport rules must differ
- Refresh token handling becomes more critical
- Session revocation strategy matters more than client trust

The system must assume **token theft is possible** and limit blast radius accordingly.

---

## Boundary 3: Auth Service ↔ Other Backend Services

Backend services are **not trusted implicitly**, even if they are:
- Owned by the same team
- Deployed in the same network
- Written in the same codebase

---

### Risks

- Service impersonation
- Over-privileged access
- Lateral movement after compromise
- Accidental misuse

---

### Required Controls

- Explicit service authentication
- Clear distinction between user tokens and service tokens
- Audience and issuer validation
- No trust based on network location alone

Internal services must authenticate **explicitly** and minimally.

---

## Boundary 4: Auth Service ↔ Database

The database is **not trusted by default**.

Even with an ORM, the database is susceptible to:
- SQL injection (including ORM bugs)
- Privilege escalation
- Accidental writes
- Broken constraints
- Partial or inconsistent updates

---

### Defensive Strategy

Security responsibilities are split:

- **Database enforces constraints**
- **Application enforces invariants**

There is no “magic trust” in either layer.

---

### Key Decisions

- Unique constraints on identifiers (e.g., email)
- Partial unique indexes for active credentials and tokens
- Token hashes stored — never raw tokens
- Soft deletes for forensic integrity
- Immutable audit logs

The database acts as a **defense-in-depth layer**, not a passive store.

---

## Boundary 5: Auth Service ↔ External Identity Providers (OAuth)

Examples:
- Google
- GitHub
- Apple
- Microsoft

These providers are trusted **cryptographically**, not logically.

---

### What Is Trusted

- Signature validity
- Issuer (`iss`)
- Audience (`aud`)
- Expiry (`exp`)
- Subject (`sub`)

---

### What Is NOT Trusted

- Email ownership as identity binding
- Role or privilege claims
- Provider-specific semantics

---

### Required Controls

- Verify signatures
- Validate issuer and audience strictly
- Map external identity → internal identity explicitly
- Never auto-assign privileges
- Never blindly merge identities

OAuth proves **external account control**, not internal identity ownership.

---

## Boundary 6: Auth Service ↔ Infrastructure

Includes:
- Redis
- Email provider
- Queues
- Secrets manager

Infrastructure dependencies are:
- Unreliable
- Asynchronous
- Failure-prone

---

### Risks

- Redis outages affecting auth behavior
- Email delays affecting verification UX
- Secret leaks destroying trust
- Partial outages causing ambiguous states

---

### Required Design Decisions

- What happens if Redis is unavailable?
- Can authentication continue partially?
- Are emails best-effort and retriable?
- Are secrets rotated and externalized?

Infrastructure failures must **never grant access** or weaken security guarantees.

---

## Summary Rule

Trust boundaries define **where assumptions stop**.

Every security decision in this system:
- originates from a trust boundary
- is justified by a threat model
- is enforced via domain invariants

If a behavior depends on **trusting the caller**, it is considered invalid by design.
