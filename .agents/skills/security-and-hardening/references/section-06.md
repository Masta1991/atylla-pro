### Injection, XSS, and access control

- Parameterize every query. Never build SQL, NoSQL, or shell commands from input strings.
- Encode output through the framework's auto-escaping. If raw HTML is unavoidable, sanitize with an allowlist sanitizer first.
- Check **authorization** on every request, not just authentication: the authenticated user must own, or be permitted on, the specific resource (A01, IDOR).

Patterns: [Injection](hardening-patterns.md#injection), [XSS](hardening-patterns.md#cross-site-scripting-xss), [Access control](hardening-patterns.md#broken-access-control).

