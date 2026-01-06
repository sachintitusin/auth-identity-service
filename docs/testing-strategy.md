# Testing Strategy — Auth / Identity Service

## 1. Purpose

This document describes the **testing strategy** for the Auth / Identity Service.

Authentication systems require a fundamentally different testing approach than
typical CRUD or business-domain applications because:

- Correct behavior is often **intentionally non-observable**
- Many security guarantees cannot be asserted via HTTP responses
- Some failure modes must collapse to identical external behavior
- Invariants must hold even under malformed input or adversarial usage

This strategy ensures:
- domain invariants are preserved
- security properties are regression-safe
- non-observability guarantees are not accidentally broken by tests

---

## 2. Testing Philosophy

### 2.1 Correct ≠ Observable

In this system, **lack of observable difference is a security feature**, not a limitation.

Examples:
- Email verification confirmation always returns `204`
- Resend verification always returns success
- Authentication failures are indistinguishable

Tests must therefore **avoid asserting on behavior that is intentionally hidden**.

---

### 2.2 Invariants are the Primary Test Target

Tests exist to validate:
- domain invariants
- security guarantees
- failure-mode behavior

They do **not** exist to validate:
- UI flows
- frontend assumptions
- internal implementation details

---

## 3. Test Categories

The system uses **two complementary test categories**:

1. **HTTP Contract Tests**  
2. **Domain-Level Tests**

Each category exists for a specific reason.

---

## 4. HTTP Contract Tests

### 4.1 Purpose

HTTP contract tests validate:

- public API shape
- status code guarantees
- non-observable behavior
- resilience to malformed input

They answer the question:

> “What is externally observable to a client?”

---

### 4.2 What HTTP Tests Assert

HTTP tests assert only:
- response status codes
- presence or absence of cookies/headers
- idempotency of endpoints
- stability under invalid or unexpected input

They **never** assert:
- identity existence
- verification state
- token validity
- internal branching decisions

---

### 4.3 Example: Email Verification (HTTP)

The following behaviors are intentionally verified via HTTP:

- `POST /verifications/email` returns `204` for:
  - existing unverified emails
  - non-existent emails
  - already verified emails
  - malformed input

This confirms:
- identity existence is non-observable
- verification state is non-observable
- the endpoint is safe against probing and enumeration

The test does **not** attempt to infer which internal path was taken.

---

## 5. Domain-Level Tests

### 5.1 Purpose

Domain-level tests exist to validate behavior that **cannot and must not** be exposed via public APIs.

They validate:
- invariant enforcement
- idempotency rules
- state transitions
- security-critical edge cases

They answer the question:

> “Did the system do the right thing internally, even though it said nothing externally?”

---

### 5.2 Why Domain Tests Are Necessary

Some guarantees are intentionally silent at the API layer, including:

- verification token reuse handling
- invalid token handling
- expired token behavior
- OAuth identity resolution outcomes
- session revocation cascades

Testing these via HTTP would either:
- require breaking non-observability, or
- require brittle, timing-based assumptions

Domain tests avoid this.

---

### 5.3 Example: Email Verification (Domain)

Domain-level tests directly invoke:

- verification initiation
- verification confirmation

These tests assert:
- verification records are created correctly
- tokens are single-use
- token reuse is idempotent
- invalid tokens produce no state mutation
- identifier state transitions occur correctly

Database state is inspected **only after the transaction commits**,
mirroring real-world behavior.

---

## 6. Transaction-Aware Testing

Many domain operations execute inside explicit transactions.

Domain tests:
- manually begin and commit transactions
- assert state only after commit
- ensure no partial writes are observable

This ensures:
- atomicity guarantees are testable
- rollback behavior is meaningful
- invariants hold under transactional boundaries

---

## 7. Why Some Things Are *Not* Tested via HTTP

The following behaviors are **explicitly not asserted via HTTP**:

- Whether an email exists
- Whether a verification token is valid or expired
- Whether a verification was already completed
- Whether a refresh token was reused

These are validated **internally** to preserve:
- enumeration resistance
- timing uniformity
- security ambiguity

This is intentional, not a test gap.

---

## 8. Database Assertions in Tests

Database assertions are used only when:

- behavior is intentionally non-observable
- invariants must be validated directly
- the database is the enforcement layer

This aligns with the design principle that the database is a **security boundary**, not a passive store.

---

## 9. Time-Dependent Behavior

Time-dependent behavior (expiry, TTLs) is tested using:

- real time with short TTLs
- explicit state transitions
- invariant enforcement rather than timing precision

Tests avoid brittle clock assumptions wherever possible.

---

## 10. Tooling & Environment

- Test runner: **Jest**
- HTTP testing: **Supertest**
- Database: **Real PostgreSQL (test database)**
- Isolation: Database cleaned between tests

The system intentionally avoids mocks for:
- database writes
- token persistence
- invariant enforcement

Real persistence is required to validate correctness.

---

## 11. Security Regression Prevention

This testing strategy is designed to prevent regressions such as:

- accidental identity enumeration
- reintroduction of observable failure modes
- broken idempotency
- token reuse vulnerabilities
- partial authentication states

Any change that requires modifying these tests should be treated as a **security-sensitive change**.

---

## 12. Relationship to Other Documents

| Document | Relationship |
|--------|-------------|
| Trust Boundaries | Define where observability stops |
| Threat Model | Justifies silent failure behavior |
| Domain Invariants | Define what tests must protect |
| Public APIs | Define what is safe to assert externally |
| Database Design | Defines persistence-level guarantees |
