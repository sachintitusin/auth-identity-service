# **Public Orchestration APIs — Auth / Identity Service**

## **1\. Purpose**

This document defines the **public, frontend-facing APIs** of the Auth / Identity Service.

These APIs:

* Represent **user workflows**  
* Orchestrate multiple domain-level operations  
* Execute within **clear transactional boundaries**  
* Are the **only APIs intended to be called by clients**

They intentionally **hide domain primitives** such as identity creation and credential attachment.

## **2\. Design Principles**

### **2.1 Frontend never coordinates invariants**

The frontend must never manage identity, credential, or session lifecycles.

All orchestration happens **server-side**.

---

### **2.2 Public APIs are workflows, not primitives**

* Public APIs describe **what the user is trying to do**  
* Domain APIs describe **what transitions are allowed**

---

### **2.3 Public APIs are atomic**

A public API either:

* Completes successfully, or  
* Fails without leaving externally visible inconsistent state

---

### **2.4 Public APIs do not leak internal structure**

Clients:

* Do not know about identities vs credentials  
* Do not know about session tables  
* Do not manage retries across steps

## 

## **What “Public API Planning” actually does**

It answers questions like:

* What does the **frontend call**?  
* What flows must be **atomic**?  
* Which errors are **user-facing**?  
* Which domain steps are **composed**?  
* Where do transactions begin and end?  
* Which endpoints are **idempotent**?

It does **not** change invariants — it **composes** them.

## **Distinction between domain APIs and Public APIs**

### **Domain APIs (internal)**

* `POST /identities`  
* `POST /credentials/password`  
* `POST /sessions`

These describe **what is possible**.

---

### **Public APIs (facade)**

* `POST /register`  
* `POST /auth/login`  
* `POST /auth/oauth/{provider}`

These describe **how users interact**.

## **3\. Public API Surface (Complete)**

These are the **only endpoints intended for frontend consumption**.

`POST   /register`

`POST   /auth/login`

`POST   /auth/oauth/{provider}`

`POST   /tokens/refresh`

`DELETE /sessions/current`

## **4\. API Definitions & Internal Orchestration**

---

### **4.1 POST /register**

**(Email \+ password signup)**

#### **User intent**

“Create an account using email and password”

---

#### **Internal orchestration (single unit of work)**

1. Create identity  
2. Attach password credential  
3. Initiate email verification  
4. (Optional) Create session

All steps occur **inside a transaction**.

---

#### **Failure behavior**

* Any failure → rollback

* No partial identity exposed

* Generic error response

---

#### **Notes**

* Does NOT authenticate email  
* Does NOT guarantee session unless explicitly configured  
* Does NOT reveal if email already exists

---

#### **Domain APIs used (internal)**

* `POST /identities`  
* `POST /credentials/password`  
* `POST /verifications/email`  
* (optional) `POST /sessions`

---

### **4.2 POST /auth/login**

**(Email \+ password login)**

#### **User intent**

“Sign in to my account”

---

#### **Internal orchestration**

1. Verify credentials (timing-safe)  
2. Create session  
3. Issue access \+ refresh tokens

---

#### **Failure behavior**

* Uniform 401 on failure  
* No indication of identity existence  
* Rate-limited

---

#### **Notes**

* Each successful call creates a **new session**  
* Multiple devices \= multiple sessions

---

#### **Domain APIs used**

* `POST /sessions`

---

### **4.3 POST /auth/oauth/{provider}**

**(Google, GitHub, etc.)**

#### **User intent**

“Sign in using an external provider”

---

#### **Internal orchestration**

1. Verify provider token  
2. Resolve existing identity **or** create new identity  
3. Attach external credential if new  
4. Create session

---

#### **Failure behavior**

* Provider errors are mapped to generic auth failures  
* No partial identity exposed

---

#### **Notes**

* External verification ≠ authentication  
* Identity may exist without password  
* Email collision handled explicitly

---

#### **Domain APIs used**

* `POST /identities` (conditional)  
* `POST /credentials/oauth`  
* `POST /sessions`

---

### **4.4 POST /tokens/refresh**

**(Token rotation)**

#### **User intent**

“Continue my authenticated session”

---

#### **Internal orchestration**

1. Validate refresh token  
2. Rotate refresh token  
3. Issue new access token  
4. Detect reuse and revoke session if violated

---

#### **Failure behavior**

* Fail closed  
* Reuse triggers global session revocation

---

#### **Notes**

* Single-use refresh tokens  
* Not idempotent by design

---

### **4.5 DELETE /sessions/current**

**(Logout)**

#### **User intent**

“Sign out from this device”

---

#### **Internal orchestration**

1. Terminate current session  
2. Revoke tokens

---

#### **Failure behavior**

* Idempotent

* Always safe to call

## **5\. What Is Explicitly NOT Public**

The following **must never be called by frontend clients**:

* `POST /identities`  
* `POST /credentials/password`  
* `PUT /credentials/password`  
* Direct session creation  
* Any admin or audit endpoints

These exist as **domain-level capabilities only**.

## **6\. Error Contract (Public APIs)**

Public APIs follow strict rules:

* No identity existence leakage  
* No credential validity leakage  
* No internal step exposure

| Scenario | Response |
| ----- | ----- |
| Invalid login | 401 (generic) |
| Invalid refresh token | 401 |
| Rate limited | 429 |
| Unauthorized | 403 |

## 7\. Transaction Boundaries (Critical)

| API | Transaction Scope |
| ----- | ----- |
| POST /register | Identity \+ Credential \+ Verification |
| POST /auth/login | Session creation |
| POST /auth/oauth/\* | Identity resolution \+ Credential attach \+ Session |
| POST /tokens/refresh | Token rotation |
| DELETE /sessions/current | Session termination |

## 8\. Relationship to Other Documents

| Document | Role |
| ----- | ----- |
| Trust Boundaries | Define client assumptions |
| Threat Model | Defines risks to mitigate |
| Domain Invariants | Define what is allowed |
| Domain APIs | Define primitives |
| **Public APIs** | Define workflows |

