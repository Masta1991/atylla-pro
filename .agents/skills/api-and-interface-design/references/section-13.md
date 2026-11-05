## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll document the API later" | The types ARE the documentation. Define them first. |
| "We don't need pagination for now" | You will the moment someone has 100+ items. Add it from the start. |
| "PATCH is complicated, let's just use PUT" | PUT requires the full object every time. PATCH is what clients actually want. |
| "We'll version the API when we need to" | Breaking changes without versioning break consumers. Design for extension from the start. |
| "Nobody uses that undocumented behavior" | Hyrum's Law: if it's observable, somebody depends on it. Treat every public behavior as a commitment. |
| "We can just maintain two versions" | Multiple versions multiply maintenance cost and create diamond dependency problems. Prefer the One-Version Rule. |
| "Internal APIs don't need contracts" | Internal consumers are still consumers. Contracts prevent coupling and enable parallel work. |
| "Accepting the Idempotency-Key header is enough" | The header is the contract; storing the key against the result is the implementation. A key you accept but don't honour tells the client retrying is safe when it isn't. |
| "Our queue guarantees exactly-once delivery" | No queue does across a consumer crash — the broker's ack and your side effect are not in one transaction. Design for at-least-once with idempotent processing. |
| "Duplicate requests are rare" | They're *correlated*. Retries spike exactly when a dependency is degraded — the moment duplicates are most likely and most expensive. |

