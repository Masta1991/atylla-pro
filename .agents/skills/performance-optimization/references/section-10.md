### Step 5: Guard Against Regression

Guard the metric the user actually feels, not every available number. Use the
same LCP, INP, p95 latency, or other primary metric that justified the fix.

Use two complementary layers when the surface is user-facing:

- **Synthetic CI gate:** Catch reproducible regressions before merge with a
  performance budget. Repeat noisy measurements or compare a median/trend so
  normal run-to-run variance does not turn the gate into a flaky check.
- **Field monitoring:** Alert on a meaningful p75 movement in RUM data. Use
  attributed `web-vitals` data to locate the cause; treat CrUX's rolling window
  as confirmation rather than an immediate alert.

When either guard fires, return to Step 1 and establish a fresh baseline before
proposing another fix.

**Set budgets and enforce them:**

```
JavaScript bundle: < 200KB gzipped (initial load)
CSS: < 50KB gzipped
Images: < 200KB per image (above the fold)
Fonts: < 100KB total
API response time: < 200ms (p95)
Time to Interactive: < 3.5s on 4G
Lighthouse Performance score: ≥ 90
```

**Enforce in CI:**
```bash
# Bundle size check
npx bundlesize --config bundlesize.config.json

# Lighthouse CI
npx lhci autorun
```

