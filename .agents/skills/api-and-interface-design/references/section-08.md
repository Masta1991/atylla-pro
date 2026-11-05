### 4. Prefer Addition Over Modification

Extend interfaces without breaking existing consumers:

```typescript
// Good: Add optional fields
interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';  // Added later, optional
  labels?: string[];                       // Added later, optional
}

// Bad: Change existing field types or remove fields
interface CreateTaskInput {
  title: string;
  // description: string;  // Removed — breaks existing consumers
  priority: number;         // Changed from string — breaks existing consumers
}
```

#### Carry execution-mode changes through the whole workflow

When adding an opt-in production mode or policy contract:

1. Trace service preparation, native-form intake, host adapter, advertised tool schema, CLI, schedule save/dispatch, worker validation, cache identity and history consumers before editing. A service-only flag leaves other entrypoints silently using the old mode.
2. Preserve the omitted-field behavior and frozen scope serialization. Validate real booleans rather than truthiness; `0`, `1`, strings and null must not impersonate an explicit mode choice.
3. Bind the selected mode and required policy versions into the prepared scope/digest and show them in confirmation. Apply code-owned defaults consistently and visibly; reject an explicit incompatible contract instead of silently replacing it.
4. Propagate optional fields through both schedule validation and eventual dispatch. Test that saving configuration remains inactive and that changing its mode changes the approved digest without installing or activating recurring work.
5. Keep historical test runs unchanged. Do not infer delivery from report generation or promote test results into production history; retain separate evidence and confirmation for presentation/forwarding.
6. Test each entrypoint with disposable data, including refusal, missing fields, digest mismatch, idempotent replay and mode preservation. Describe these as code-path tests, not proof of real native UI consent, provider execution or delivery.

