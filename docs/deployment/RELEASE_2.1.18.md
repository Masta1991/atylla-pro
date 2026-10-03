# Atylla Pro 2.1.18

Cancellation now records paid cancellation only. Trainer summaries hide historical unpaid cancellations, and the annual chart counts held and paid-cancelled sessions only. The calendar drawer keeps compact buttons in one row and supports shared packages. Note reminders are individually acknowledged without a carousel counter. Billing changes preserve the selected client context.

The Trainer zone includes a month-by-year seasonality report and historical monthly counts. Manual counts override only the report; missing values remain distinct from zero. Recurring low/high seasons require comparable full years. Text contrast was corrected in both light and dark themes without enlarging the drawer.

Validation: 200 offline checks (100 Python/API, 44 JavaScript, 56 PGlite), syntax of 43 modules, note and seasonality browser scenarios, and both themes at 320/390/768/1024/1366/1440 plus reflow 200%. No serious/critical axe findings, overflow, or JavaScript errors in tested states. The exact production artifact also passed a 390px light-theme browser regression using intercepted synthetic API data.

Migration 013 is additive and has been applied to the configured production Supabase project. Existing calendar/client/package/absence counts were unchanged. RLS, owner policy, constraints and RPC source hashes were verified; PostgREST recognizes the table and RPCs and denies anonymous access. No customer records were changed by acceptance tests.

Rollback: restore application commit f67868b685d3b554bc5d3b8771efa725b468e224 through the deployment platform or a normal Git revert release. Retain the new history table and RPCs so any entered history is preserved. Never reverse customer billing facts. A logged-in physical-device acceptance is separate from this deployment verification.
