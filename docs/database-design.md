# Database Design — Auth / Identity Service

## 1. Purpose

This document describes the **final, steady-state database design** of the Auth / Identity Service.

It explains:

* the lifecycle roots and ownership model
* how state and deletion are represented
* which security invariants are enforced at the database layer
* how key architectural decisions (ADRs) materialize in schema constraints

This document intentionally **does not mirror migration history**. It describes the model **as it must hold at all times**, regardless of how the schema evolved.

---

## 2. Lifecycle Roots and Ownership

The database models authentication as a set of explicit, long-lived lifecycles with clear ownership boundaries.

### Lifecycle Roots

The following entities are lifecycle roots:

* **Identity** — representation of a person or account
* **Audit Log** — immutable security facts
* **Service Principal** — non-human actors for service-to-service authentication

Lifecycle roots are never implicitly deleted by other entities.

### Ownership Model

Ownership relationships are strict and acyclic:

* Identity → owns Credentials
* Identity → owns Sessions
* Identity → owns Verifications
* Identity → owns External Identities
* Session → owns Refresh Tokens

Audit logs and service principals have no owning parent and are never cascade-deleted.

---

## 3. Deletion and State Representation

The system avoids hard deletes for security-relevant entities. Instead, lifecycle state is represented explicitly using timestamps.

| Entity            | State Representation                      |
| ----------------- | ----------------------------------------- |
| Identity          | `deleted_at`                              |
| Credential        | `revoked_at`                              |
| Session           | `terminated_at`, `termination_reason`     |
| Refresh Token     | `used_at`, `revoked_at`, `expires_at`     |
| Verification      | `used_at`, `invalidated_at`, `expires_at` |
| External Identity | `deleted_at`                              |
| Service Principal | `deleted_at`                              |
| Audit Log         | immutable                                 |

Terminal states are preserved to support forensics, abuse detection, and incident analysis.

---

## 4. Identity and Identifiers

### Identity

Each identity has:

* an **internal immutable primary key** (`id`)
* a **stable external subject identifier** (`subject_id`)

The internal primary key is never exposed outside the service. The subject identifier is safe to embed in tokens and external references.

Identities are soft-deleted via `deleted_at`.

### Identity Identifiers

User-controlled identifiers (email, phone, etc.) are stored separately from the identity record.

Key properties:

* identifiers belong to exactly one identity
* verification state is tracked via `verified_at`
* identifiers may exist before verification

#### Case-insensitive email uniqueness

Email identifiers are treated as case-insensitive for uniqueness and resolution. This is enforced at the database layer:

```sql
CREATE UNIQUE INDEX uq_identity_identifiers_email_lower
ON identity_identifiers (lower(value))
WHERE type = 'email';
```

This prevents identity collisions and account takeover risks caused by casing differences.

---

## 5. Credentials

Credentials represent authentication factors attached to an identity. They are modeled generically, with type-specific data stored in specialized tables (e.g. password credentials).

### Credential lifecycle

* credentials are never hard-deleted
* rotation occurs by revoking the existing credential and creating a new one
* revoked credentials remain for audit and forensic purposes

### Single active credential per type

At most one **active** credential of a given type may exist per identity. This invariant is enforced at the database layer using a partial unique index:

```sql
CREATE UNIQUE INDEX uniq_active_credential_per_identity
ON credentials (identity_id, credential_type)
WHERE revoked_at IS NULL;
```

This allows safe credential rotation while preventing concurrent or accidental duplication.

---

## 6. Sessions

Sessions represent authenticated contexts and are explicit, first-class records.

Key properties:

* internal primary key is never exposed
* a stable public `session_identifier` may be embedded in tokens
* sessions are terminated explicitly via `terminated_at` and `termination_reason`

Sessions are owned by identities and are soft-terminated rather than deleted.

An observational field (`last_token_issued_at`) exists for diagnostics and must never be used for authorization decisions.

---

## 7. Refresh Tokens

Refresh tokens represent authentication continuation capability and are strictly controlled.

Key properties:

* raw tokens are issued once and never stored
* only hashed tokens are persisted
* tokens are single-use and rotated on every refresh

### Lineage tracking

Refresh token rotation is explicitly modeled using a self-reference (`replaced_by_token_id`), allowing precise replay detection and auditability.

### Single active refresh token per session

At most one active refresh token may exist per session. This is enforced at the database level:

```sql
CREATE UNIQUE INDEX uniq_active_refresh_token_per_session
ON refresh_tokens (session_id)
WHERE used_at IS NULL
  AND revoked_at IS NULL;
```

This acts as defense-in-depth beyond application-level locking.

---

## 8. Verifications

Verification records represent proof-of-control challenges (email, phone, etc.).

Key properties:

* verification tokens are single-use and time-bound
* raw tokens are never stored
* verification state is non-observable via public APIs

### Single active verification per identity and type

```sql
CREATE UNIQUE INDEX uq_active_verification_per_identity_type
ON verifications (identity_id, verification_type)
WHERE used_at IS NULL
  AND invalidated_at IS NULL;
```

### Terminal state exclusivity

A verification token may reach exactly one terminal state:

```sql
ALTER TABLE verifications
ADD CONSTRAINT chk_verification_single_terminal_state
CHECK (
  NOT (used_at IS NOT NULL AND invalidated_at IS NOT NULL)
);
```

Verification records are retained after use or invalidation to support abuse detection and audit.

---

## 9. External Identities (OAuth)

External identities model federated authentication via third-party providers.

Key properties:

* uniquely identified by `(provider, provider_subject)`
* no implicit linking via email
* soft-deleted to preserve unlink history

Uniqueness applies only to active external identities:

```sql
CREATE UNIQUE INDEX uq_active_external_provider_subject
ON external_identities (provider, provider_subject)
WHERE deleted_at IS NULL;
```

This prevents re-linking after unlink while preserving historical state.

---

## 10. Service Principals

Service principals represent non-human actors.

Key properties:

* internal primary key never exposed
* stable public identifier (`public_identifier`) may be shared externally
* soft deletion supported

Service principals are lifecycle roots and are not owned by identities.

---

## 11. Audit Logs

Audit logs record immutable security-relevant events.

Key properties:

* append-only and immutable
* stored in the primary database for strong consistency
* structured metadata (`JSONB`) instead of free text
* no foreign keys to prevent loss of historical truth

Immutability is enforced at the database level via triggers that reject UPDATE and DELETE operations.

Actor and target categories are guarded using CHECK constraints to prevent silent semantic drift.

Audit logs never participate in authentication or authorization decisions.

---

## 12. Design Principles Reinforced by the Database

The database enforces critical security invariants directly:

* single active password credential per identity
* single active refresh token per session
* refresh token single-use with lineage tracking
* non-ambiguous verification state transitions
* case-insensitive email uniqueness
* immutable audit history

These guarantees remain valid even under refactors, concurrency, or partial application failures.

---

## 13. Relationship to Other Documents

| Document          | Role                             |
| ----------------- | -------------------------------- |
| Domain Invariants | Define allowed state transitions |
| ADRs              | Explain architectural decisions  |
| Public APIs       | Define user-facing workflows     |
| Threat Model      | Define risks and mitigations     |
| Database Design   | Enforce invariants at rest       |
