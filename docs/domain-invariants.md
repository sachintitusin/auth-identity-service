# Domain Invariants — Auth / Identity Service

## 1. Purpose

This document defines the **domain invariants** of the Auth / Identity Service.

A **domain invariant** is a rule that must **always** hold true, regardless of:
- API shape
- implementation details
- storage mechanism
- framework or programming language

If a domain invariant is violated, the system is considered **incorrect or insecure**, not merely buggy.

These invariants are derived directly from:
- defined trust boundaries
- the threat model
- the security goals of an enterprise-grade identity system

---

## 2. Core Domain Concepts (Terminology)

Before defining invariants, terminology must be precise.

| Term | Meaning |
|----|--------|
| **Identity** | A unique representation of a person or system |
| **Credential** | A method used to authenticate an identity |
| **Session** | A server-recognized authenticated context |
| **Access Token** | Short-lived proof of authentication |
| **Refresh Token** | Long-lived secret used to obtain new access tokens |
| **Verification** | Proof of control over an attribute (email, phone) |
| **Principal** | An authenticated subject (user or service) |

---

## 3. Identity Invariants

### INV-IDENTITY-1: Identity is independent of credentials
An identity may exist without any active credentials.

**Rationale**
- Required for account recovery
- Required for OAuth-first users
- Required for credential rotation

**Implications**
- Identity lifecycle ≠ credential lifecycle  
- Deleting or revoking a credential must not delete the identity

---

### INV-IDENTITY-2: Identity identifiers are immutable
Once created, an identity’s primary identifier must never change.

**Examples**
- Internal UUID
- `sub` (subject) claim

**Rationale**
- Prevents privilege confusion
- Preserves audit integrity

---

### INV-IDENTITY-3: Identity existence must not be externally observable
External clients must never be able to infer whether an identity exists.

Trusted internal actors (e.g., admins) may access identity data within a trusted boundary.

**Rationale**
- Prevents user enumeration
- Reduces targeted attacks

**Implications**
- Uniform error responses
- Consistent response timing for failures

---

## 4. Credential Invariants

### INV-CRED-1: Credentials are never reversible
Credentials must never be stored in a reversible form.

**Applies to**
- Passwords
- Backup codes
- Secret tokens

**Rationale**
- Limits damage from database compromise

---

### INV-CRED-2: Credential verification is timing-safe
Credential verification must not leak information via timing differences.

CPU-bound secret verification (e.g., bcrypt) must execute consistently whenever a credential exists, regardless of authentication outcome.

**Rationale**
- Prevents side-channel attacks

---

### INV-CRED-3: Credential change invalidates all sessions
Any credential change must immediately invalidate all active sessions for the identity.

**Rationale**
- Limits blast radius after compromise
- Matches user security expectations

---

### INV-CRED-4: Credentials are scoped to one identity
A credential must never authenticate more than one identity.

- One identity may have many credentials  
- One credential belongs to exactly one identity

**Rationale**
- Prevents identity collision
- Prevents privilege crossover

---

## 5. Session Invariants

### INV-SESSION-1: Sessions are explicit and server-recognized
Every authenticated interaction must be associated with a server-recognized session.

**Rationale**
- Enables revocation
- Enables auditing
- Enables replay detection

---

### INV-SESSION-2: Session creation is atomic
Session persistence and associated token issuance must be atomic at the database level.

CPU-bound authentication steps are excluded from this transaction boundary.

**Rationale**
- Prevents partial authentication states
- Prevents phantom sessions

---

### INV-SESSION-3: Session termination is irreversible
Once a session is terminated, it must never become valid again.

**Rationale**
- Prevents replay
- Prevents session resurrection attacks

---

### INV-SESSION-4: Sessions are identity-bound
A session belongs to exactly one identity.

**Rationale**
- Prevents session fixation
- Prevents cross-user confusion

---

## 6. Token Invariants

### INV-TOKEN-1: Access tokens are stateless and short-lived
Access tokens must be self-contained and have a short, fixed lifetime.

**Rationale**
- Limits blast radius
- Avoids server-side token tracking

---

### INV-TOKEN-2: Refresh tokens are single-use
A refresh token may be used **exactly once** for access token issuance.

Issuance of a refresh token (e.g., during login) does not count as usage.

**Rationale**
- Enables replay detection
- Limits token theft impact

---

### INV-TOKEN-3: Refresh token reuse is a security event
Reuse of a refresh token is treated as an active compromise.

**Implications**
- Immediate session revocation
- Invalidation of all descendant refresh tokens

---

### INV-TOKEN-4: Tokens are never stored or logged in raw form
Raw tokens must never be persisted or logged.

**Rationale**
- Prevents secondary leaks
- Limits insider threat

---

### INV-TOKEN-5: Token revocation is permanent
Once revoked, a token can never become valid again.

---

### INV-TOKEN-6: Token delivery does not affect token semantics
The mechanism used to deliver a token (cookie, header, response body) must not alter:
- validity
- lifecycle
- security guarantees

---

## 7. Verification Invariants

### INV-VERIFY-1: Verification is not authentication
Verifying an attribute does not authenticate an identity.

**Examples**
- Email verification
- Phone verification

**Rationale**
- Prevents accidental login flows
- Enforces explicit authentication

---

### INV-VERIFY-2: Verification tokens are single-use and time-bound
Verification tokens expire and are invalid after first use.

---

### INV-VERIFY-3: Verification does not grant privileges
Verification must not imply authorization or role assignment.

---

### INV-VERIFY-INIT (Clarification): Verification is initiated during registration
Email verification must be initiated automatically as part of identity registration.

**Meaning**
- `/register` internally triggers verification
- Frontend does not orchestrate verification during signup

---

### INV-VERIFY-EXPLICIT (Clarification): Verification may be re-initiated
Email verification may be explicitly re-initiated via a public API for resend or recovery.

**Meaning**
- `POST /verifications/email` exists
- Not required for the happy-path signup

---

### INV-VERIFY-BEH-1: Verification never authenticates
Verification must never:
- create a session
- issue access tokens
- issue refresh tokens
- authenticate an identity

---

### INV-VERIFY-BEH-2: Verification confirmation is idempotent and failure-collapsed
Verification confirmation must return a generic success response regardless of:
- token validity
- token reuse
- token expiry
- identity existence
- prior verification state

**Rationale**
- Prevents identity and token state enumeration

---

### INV-VERIFY-BEH-3: Verification token reuse is not recoverable
Reusing a verification token must not:
- refresh token expiry
- re-trigger verification
- mutate identity or identifier state

---

### INV-VERIFY-BEH-4: Verification token expiry is final and silent
Expired verification tokens:
- are treated as invalid
- do not produce distinct errors
- do not implicitly trigger resend flows

---

### INV-VERIFY-BEH-5: Resend verification does not reveal identity existence
Resend endpoints must return a generic success response regardless of:
- identity existence
- identifier existence
- verification state

---

### INV-VERIFY-BEH-6: Resend invalidates existing verification
When verification is re-initiated:
- any existing active verification is invalidated
- exactly one new active verification may exist

---

### INV-VERIFY-BEH-7: Verification mutates identifiers, not identities
Successful verification may update identifier state (e.g., `verified_at`) only.

It must not:
- mutate identity core state
- mutate credentials
- mutate sessions

---

### INV-VERIFY-BEH-8: Email delivery is outside the security boundary
Verification correctness must not depend on email delivery success or timing.

---

### INV-VERIFY-BEH-9: Verification endpoints are rate-limited but silent
Rate limiting may be applied, but responses must remain generic and non-distinguishable.

---

## 8. Authorization Invariants

### INV-AUTHZ-1: Auth service does not own business roles
Application-specific roles must not be embedded into the auth core.

**Rationale**
- Prevents coupling
- Enables reuse across systems

---

### INV-AUTHZ-2: Claims are explicit and minimal
Tokens must contain only explicitly granted claims.

**Rationale**
- Prevents privilege creep
- Improves auditability

---

## 9. Service-to-Service Invariants

### INV-SVC-1: Services are principals
Backend services are treated as principals, not trusted infrastructure.

Authentication methods may include:
- signed tokens
- client credentials
- mTLS (advanced)

---

### INV-SVC-2: Service tokens are audience-bound
A service token must only be valid for its intended audience.

---

### INV-SVC-3: User and service tokens are not interchangeable
A user token must never be accepted as a service token, and vice versa.

---

## 10. Audit & Observability Invariants

### INV-AUDIT-1: Security events are immutable
Security-relevant events must never be deleted or modified.

---

### INV-AUDIT-2: Sensitive data is never logged
Logs must never contain:
- passwords
- tokens
- secrets
- full credential payloads

---

## 11. Failure Mode Invariants

### INV-FAIL-1: Security failures fail closed
If a security decision cannot be made, access must be denied.

---

### INV-FAIL-2: Partial failures do not grant access
Infrastructure or dependency failures must not result in implicit authentication.

---

## 12. OAuth / External Identity Invariants

### INV-OAUTH-1: OAuth authenticates external account control, not internal identity
OAuth proves only that:
- the caller controls an external account
- the assertion is cryptographically valid

OAuth never proves:
- ownership of an internal identity
- authorization
- equivalence to an existing identity

---

### INV-OAUTH-2: External identities are bound by (provider, provider_subject)
An external identity is uniquely identified by `(provider, provider_subject)`.

Email, name, or profile data:
- are non-binding
- may change
- must never be used as identity keys

---

### INV-OAUTH-3: OAuth login must not auto-merge identities
OAuth authentication must never:
- auto-link identities by email
- silently merge identities
- mutate identity ownership

---

### INV-OAUTH-4: OAuth may create identities without credentials
OAuth login may create identities that:
- have no password
- have no internally verified email
- have only external credentials

This is a first-class supported state.

---

### INV-OAUTH-5: OAuth never grants privileges
OAuth authentication must never:
- assign roles
- assign scopes
- elevate permissions
- bypass authorization checks

---

### INV-OAUTH-6: Provider trust is cryptographic only
Providers are trusted only for:
- signature verification
- issuer (`iss`)
- audience (`aud`)
- expiry (`exp`)
- subject (`sub`)

All other claims are informational and non-authoritative.

---

### INV-OAUTH-7: OAuth login is session-creating, not token-creating
OAuth login:
- creates a session
- issues a refresh token
- does not issue access tokens directly

`/tokens/refresh` remains the only access-token issuer.

---

### INV-OAUTH-8: OAuth failure modes are non-observable
OAuth failures must not reveal:
- whether an email exists
- whether an identity exists
- whether a provider account is linked

Provider errors collapse to generic authentication failures.

---

## 13. Invariant Enforcement Strategy

These invariants are enforced through:
- domain services
- database constraints
- transaction boundaries
- token lifecycle rules
- automated tests

Any change that violates an invariant must be rejected during design review.

---

## 14. Relationship to Other Documents

| Document | Relationship |
|--------|-------------|
| Trust Boundaries | Define where invariants apply |
| Threat Model | Justifies why invariants exist |
| API Contracts | Must never violate invariants |
| Implementation | Must enforce invariants |
