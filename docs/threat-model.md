# Threat Model — Auth / Identity Service

## 1. Purpose

This document defines the **threat model** for the Auth / Identity Service.

Its goal is to systematically identify:
- security threats
- attack vectors
- potential impact
- mitigations

across **all trust boundaries** of the system.

This threat model is intended to:
- guide architecture and API design
- prevent security regressions
- establish enterprise-grade security guarantees
- serve as a reference during audits, refactors, and integrations

---

## 2. Scope

### In Scope

- Authentication flows
- Authorization claims
- Token issuance and validation
- Session lifecycle
- Credential lifecycle
- OAuth-based identity federation
- Service-to-service authentication

### Out of Scope

- UI-level security (frontend implementation details)
- Business-domain authorization (application-specific roles)
- Physical infrastructure security
- Network-layer DDoS mitigation (handled externally)

---

## 3. Assets to Protect

| Asset | Description |
|------|-------------|
| User credentials | Passwords, OAuth identities |
| Tokens | Access tokens, refresh tokens |
| Sessions | Active authenticated sessions |
| Identity records | User identity data |
| Authorization claims | Roles, scopes, permissions |
| Audit logs | Security event history |
| Trust relationships | OAuth providers, backend services |

---

## 4. Adversary Model

The system assumes the presence of the following adversaries.

### External Attackers
- Anonymous internet users
- Credential stuffing attackers
- Token thieves
- Automated bots

### Semi-Trusted Actors
- Compromised user devices
- Malicious browser extensions
- Reverse-engineered mobile apps

### Internal Threats
- Compromised backend services
- Misconfigured internal access
- Developer or operator mistakes

No actor is assumed to be trustworthy by default.

---

## 5. Trust Boundaries Overview

| ID | Trust Boundary |
|----|---------------|
| TB-0 | Internet → Auth API |
| TB-1 | Browser Client → Auth API |
| TB-2 | Mobile Client → Auth API |
| TB-3 | Backend Services → Auth API |
| TB-4 | Auth API → Database |
| TB-5 | Auth API → OAuth Providers |
| TB-6 | Auth API → Infrastructure Services |

---

## 6. Threats & Mitigations by Trust Boundary

### TB-0: Internet → Auth API

#### Threats
- **Credential stuffing**  
  Reuse of leaked credentials from other platforms
- **Brute-force attacks**  
  High-frequency login attempts
- **User enumeration**  
  Error responses reveal whether an identity exists
- **Malformed input attacks**  
  Injection via payloads, headers, or query parameters
- **Replay attacks**  
  Reuse of captured requests

#### Mitigations
- Rate limiting per IP and per identity
- Uniform error messages for authentication failures
- Strict input validation and schema enforcement
- Timing-safe credential comparison
- Replay resistance via token lifetimes and rotation

---

### TB-1: Browser Client → Auth API

#### Threats
- **Cross-Site Request Forgery (CSRF)**  
  Automatic cookie submission from malicious sites
- **Cross-Site Scripting (XSS)**  
  JS-accessible tokens leaked via injected scripts
- **Session fixation**  
  Attacker forces victim to reuse a known session
- **Token exfiltration**  
  Malicious browser extensions stealing tokens

#### Mitigations
- Refresh tokens stored in HttpOnly, Secure cookies
- Access tokens stored only in memory
- SameSite cookie strategy or explicit CSRF tokens
- Session regeneration on authentication
- Strict CORS policy (no wildcard credentials)

---

### TB-2: Mobile Client → Auth API

#### Threats
- **Reverse engineering**  
  Extraction of secrets from the application
- **Token leakage**  
  Tokens stored insecurely on the device
- **Man-in-the-middle (MITM) attacks**  
  TLS interception on compromised networks
- **Refresh token replay**  
  Reuse of stolen refresh tokens

#### Mitigations
- No static secrets embedded in mobile apps
- Short-lived access tokens
- Refresh token rotation with reuse detection
- Device-agnostic session invalidation
- Optional TLS pinning (future hardening)

---

### TB-3: Backend Services → Auth API

#### Threats
- **Service impersonation**  
  One service pretending to be another
- **Over-privileged services**  
  Services accessing identities beyond scope
- **Lateral movement**  
  Compromised service accessing auth capabilities

#### Mitigations
- Explicit service authentication
- Signed tokens with strict `aud` (audience) and `iss` validation
- Scoped permissions for service tokens
- Clear separation between user tokens and service tokens
- No implicit trust based on network location

---

### TB-4: Auth API → Database

#### Threats
- **Privilege escalation via data tampering**
- **Inconsistent state due to partial writes**
- **Token replay via leaked database data**
- **Audit log manipulation**

#### Mitigations
- Strong database constraints and indexes
- Token hashes stored instead of raw tokens
- Transactional writes for session and token changes
- Immutable audit logs
- Principle of least privilege for database access

---

### TB-5: Auth API → OAuth Providers

#### Threats
- **Forged identity assertions**
- **Issuer confusion attacks**
- **Account takeover via email collision**
- **Privilege escalation via social login**

#### Mitigations
- Signature verification of ID tokens
- Strict issuer (`iss`) and audience (`aud`) validation
- Explicit mapping between external and internal identities
- No automatic role assignment from external providers
- Email verification treated separately from authentication

---

### TB-6: Auth API → Infrastructure Services

#### Threats
- **Cache poisoning**
- **Secrets leakage**
- **Email abuse**
- **Availability degradation**

#### Mitigations
- Auth system remains functional if cache is unavailable (graceful degradation)
- Secrets stored outside the codebase and rotated
- Email operations are asynchronous and retriable
- Circuit breakers for infrastructure dependencies

---

## 7. Token-Specific Threats

### Refresh Token Reuse
- **Threat:** Stolen refresh token reused after rotation
- **Mitigation:**  
  Refresh token rotation + reuse detection + global session revocation

### Access Token Forgery
- **Threat:** Tampered JWT claims
- **Mitigation:**  
  Strong signing keys, short TTL, strict verification

### Token Leakage
- **Threat:** Tokens exposed via logs or error responses
- **Mitigation:**  
  No token logging, structured redaction, secure error handling

---

## 8. Email Verification Threats

### Verification Token Enumeration
- **Risk:** Attacker guesses or brute-forces verification tokens
- **Mitigations:**
  - High-entropy tokens
  - Hashed token storage only
  - Generic success/failure responses

### Verification Email Abuse (Spam / DoS)
- **Risk:** Repeated triggering of verification emails
- **Mitigations:**
  - Rate limiting on verification initiation
  - Silent success responses
  - Internal throttling per identity/email

### Verification Token Replay
- **Risk:** Token reused after successful verification
- **Mitigations:**
  - Single-use tokens
  - `used_at` enforcement
  - Explicit invalidation on reuse attempt

### Expired Token Usage
- **Risk:** Old verification links used
- **Mitigations:**
  - Strict `expires_at` checks
  - Expired tokens treated as invalid without revealing cause

### Token Leakage (Logs / URLs / Referrers)
- **Risk:** Verification tokens leaked via logs or browser referrers
- **Mitigations:**
  - Never log raw tokens
  - Tokens passed only in request body (not path)
  - Hash-only persistence

### Identity Existence Disclosure
- **Risk:** Verification initiation reveals whether an email exists
- **Mitigations:**
  - Always return generic success
  - No observable timing differences

---

## 9. Security Invariants Enforced by This Threat Model

This threat model enforces the following core invariants:

- Refresh tokens are single-use
- Access tokens are stateless and short-lived
- Authentication is separate from verification
- Token revocation is irreversible
- Backend services are never implicitly trusted
- Security failures fail closed, not open

---

## 10. Residual Risk

The following risks are acknowledged and accepted:

- Compromised user devices cannot be fully defended
- TLS termination depends on infrastructure correctness
- Zero-day browser vulnerabilities are out of scope

These risks are mitigated through **defense-in-depth**, not elimination.

---

## 11. Review & Evolution

This threat model:
- must be reviewed when introducing new authentication flows
- must be updated when adding new trust boundaries
- serves as a baseline for ongoing security reviews and audits
