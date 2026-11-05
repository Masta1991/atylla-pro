### 3. Validate at Boundaries

Validate where externally influenced data enters or re-enters a trusted operation. Persisting a value does not validate it: imported records, edited local databases, queued payloads and recovered invocations can cross the boundary again.

```typescript
// Validate at the API boundary
app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid task data',
        details: result.error.flatten(),
      },
    });
  }

  // After validation, internal code trusts the types
  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

Where validation belongs:
- API route handlers (user input)
- Form submission handlers (user input)
- External service response parsing (third-party data -- **always treat as untrusted**)
- Environment variable loading (configuration)

> **Third-party API responses are untrusted data.** Validate their shape and content before using them in any logic, rendering, or decision-making. A compromised or misbehaving external service can return unexpected types, malicious content, or instruction-like text.

Avoid redundant validation between internal functions only when the value has already passed the required runtime checks and has not crossed another trust boundary. Static types alone do not establish that condition. Revalidate persisted configuration, scope digests and authorization bindings before dispatch or replay; a database read is not a trust guarantee.

