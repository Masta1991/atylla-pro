# Atylla Pro 2.1.11

This release includes the validated billing and session fixes, individual client
payments, monthly absence summaries, trainer charts, separate plan preview and
exercise/plan generator, and the restored compact week manager. Month/year fields
in the trainer area now have visible accent borders.

Validation: 72 offline Python/API cases, 19 JavaScript API cases, 5 billing history
cases, and 36 PGlite SQL cases passed. The final production artifact passed browser
checks at five widths (320–1440 px), including copy cancellation/conflicts/stale
requests, monthly summaries and modal interaction; 61 captured states and no
serious/critical axe violations or page errors. Test API data was synthetic and
intercepted; no customer training or billing rows were changed.

The configured database exposes the required functions, with RLS enabled and
trainer isolation on the five core tables. The installed copy function matches
the reviewed migration 011 body, runs as SECURITY INVOKER, denies anonymous execute
and allows authenticated execute. No database migration was performed for this
deployment. A current physical backup/PITR was not available in the backup listing;
no destructive database action is part of this release.

Production JavaScript: `index-151c1bbb3c60cd6c0f81301b11a387cb.js`.
API origin was verified in the final artifact's browser network requests. Expo
exports now clear Metro cache so a previous environment's API origin cannot leak
into a new release. Credentials and personal credential documents are excluded
from the release tree; existing Railway environment configuration is required.

Previous production commit: `dd32b1a7d6bdf5d61c213eaf75c17f0bb4aee843` (2.0.17).
In case of a failed application deployment, use Railway's previous successful
deployment rollback; do not reverse billing data or reapply historical SQL.
