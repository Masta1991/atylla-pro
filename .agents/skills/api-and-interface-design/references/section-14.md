## Red Flags

- Endpoints that return different shapes depending on conditions
- Inconsistent error formats across endpoints
- Validation scattered throughout internal code instead of at boundaries
- Breaking changes to existing fields (type changes, removals)
- List endpoints without pagination
- Verbs in REST URLs (`/api/createTask`, `/api/getUsers`)
- Third-party API responses used without validation or sanitization
- A `SELECT` for an idempotency key followed by an `INSERT` — that's a race, not a guard
- An idempotency key derived from a UUID, timestamp, or anything else regenerated per attempt
- The same key accepted with a different request body, silently returning the first response
- A key retention window shorter than the longest path that can re-deliver the request

