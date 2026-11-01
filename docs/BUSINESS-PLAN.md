# Business plan data contract — experimental v1

This additive module is **not** a new Markdoc tag family or a production finance engine. Import `evaluateBusinessPlan` from `src/content/business-plan.js` to validate and calculate a read-only scenario *before* passing its data to an authored Markdoc `model`/`view` or to a trusted host figure renderer. Existing Markdoc consumers are unaffected.

## Data and evidence policy

- `schema: ragbaz.business/1`; `currency: USD` (only USD currently); `overlap_policy: disjoint|unknown`.
- `segments[]`: stable `id`, whole-person `population`, integer `adoption_ppm` (0–1,000,000), integer `annual_price_cents`, and one or more `claim_ids`.
- `claims[]`: `id`, `kind: observed|assumed|derived|target|forecast`, `statement`, optional `limitations`. Observed claims require an explicit `source` and ISO date `as_of`. Neither the URL nor date verifies truth.
- Arithmetic uses BigInt intermediate products and rounds **each cohort's** result to the nearest cent; outputs remain safe integers. Sum reflects cohort estimates; it **must not** be presented as a deduplicated TAM where `overlap_policy=unknown`.
- Rejects unsupported fields, duplicate IDs, invalid amounts, orphan claim references, unknown schemas and overflow. It does not make external requests.
- Calculated output is author-supplied scenario, not a verified fact or certified accounting statement.

## Example

```js
import {evaluateBusinessPlan,formatUSD} from './src/content/business-plan.js';
const result=evaluateBusinessPlan({
  schema:'ragbaz.business/1',
  currency:'USD',
  overlap_policy:'unknown',
  claims:[{id:'cohort-assumption',kind:'assumed',statement:'Scenario only.'}],
  segments:[{id:'consultants',population:200000,adoption_ppm:150000,
    annual_price_cents:30000,claim_ids:['cohort-assumption']}]
});
console.log(formatUSD(result.annual_spend_cents)); // $9,000,000.00
```

Run `node --test tests/business-plan.test.mjs` after adding the test to an appropriate Node test runner, or run `node tests/business-plan.test.mjs` directly.

## Important follow-ups

1. Expose an opt-in trusted `business@1` Markdoc dialect via the existing host registry; do not introduce arbitrary authored JavaScript or SVG.
2. Validate frontmatter model provenance and formulas through typed schemas, including declared units, periods, source locks, cohort overlaps and calculation rounding.
3. Add chart manifest generation with accessible static SVG and printer-safe fallback; maintain CSP and the existing source-digest boundary.
4. Add assumptions sensitivity, forecast cash flow, customer acquisition, churn and error bands; never conflate market spending scenarios with ARR projections.
5. Build deterministic standalone report tests with current `markdoc-ragbaz` output as the regression baseline.
