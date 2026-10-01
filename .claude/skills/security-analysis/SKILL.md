---
description: Comprehensive security auditing skill targeting OWASP Top 10, injection risks, auth flaws, cryptography pitfalls, and secret leakage
---

# Security Code Review & Vulnerability Analysis

Specialized knowledge base for identifying vulnerabilities, assessing threat severity, and prescribing remediation strategies in full-stack applications.

## Key Threat Categories & Vulnerabilities

### 1. Injections & Command Execution
- **SQL / NoSQL Injection**: Direct string concatenation or template interpolation into database queries without parameterized statements or ORM binding.
  * *Bad*: `db.query("SELECT * FROM users WHERE id = '" + id + "'")`
  * *Remediation*: Use parameterized queries: `db.query("SELECT * FROM users WHERE id = $1", [id])`
- **Remote Code / Script Execution**: Use of `eval()`, `Function()`, `vm.runInThisContext()`, or unsanitized shell process execution (`child_process.exec`).
  * *Bad*: `const val = eval(amountStr);`
  * *Remediation*: Parse strictly using typed converters (`Number(amountStr)`, `parseFloat()`, or JSON schema validators).
- **Cross-Site Scripting (XSS)**: Injecting unescaped user input into DOM or raw HTML snippets (`innerHTML`, `<mark>${input}</mark>`).
  * *Remediation*: Sanitize input via DOMPurify or escape HTML entities before rendering.

### 2. Authentication & Authorization Flaws
- **Insecure Direct Object References (IDOR)**: Using client-supplied IDs without verifying ownership or authorization against session context.
- **Broken Access Control**: Trusting client-controlled flags such as `req.body.isAdmin` or unverified headers without cryptographic signatures or server-side session checks.
- **Weak Token & Secret Generation**: Using `Math.random()` for security tokens or session IDs instead of CSPRNG (`crypto.randomBytes` or `crypto.randomUUID`).

### 3. Cryptography & Secrets Management
- **Broken Algorithms**: Using deprecated hash functions like MD5 or SHA1 for password hashing.
  * *Remediation*: Use robust adaptive hashing algorithms like bcrypt, Argon2, or PBKDF2 with unique salts.
- **Hardcoded Secrets**: Embedded API keys, private keys, database passwords, or administrative bearer tokens in source code.
  * *Remediation*: Move to environment variables (`process.env`), KMS, or vault solutions; rotate any exposed tokens immediately.
- **Sensitive Data Exposure in Logs**: Emitting credit card numbers, passwords, CVVs, or PII into standard stdout/stderr or log files.

## Severity Scoring Framework
- **Critical**: Remote Code Execution (RCE), direct SQL injection exposing database, unauthenticated admin bypass, plaintext credentials in logs.
- **High**: Stored XSS, privilege escalation, weak cryptographic primitives protecting sensitive data.
- **Medium**: Missing rate limiting on sensitive routes, weak CSRF protection, verbose internal error disclosure.
- **Low**: Missing security headers (HSTS, CSP), minor dependency advisory with no active exploit path.
- **Info**: Security hardening recommendations and defensive programming suggestions.
