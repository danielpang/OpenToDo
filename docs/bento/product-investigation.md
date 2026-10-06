# Product investigation: Weekend weather planner

## Recommendation

Do not build this in OpenToDo yet. There is no user evidence (interviews, analytics, or tickets) in the repo or the brief inputs, and the repo is a Boards → Lists → Cards app with no weather or travel scope. Run a time-boxed validation first: 8–10 interviews, a walkthrough of the preview, and a one-week forecast-quality spike for the three sample cities.

## What was produced

- Product brief (Bento artifact, not committed): `/workspace/artifacts/weekend-weather-planner-product-brief.md`. It covers the problem, the hypothesised users and current workflow, the intended outcome, proposed success thresholds, feature ideas, deliberate exclusions, edge cases, and the decisions needed.
- Interactive HTML concept preview (Bento artifact, not committed): `/workspace/artifacts/weekend-weather-planner-preview.html`. It is self-contained and leads with the recommended weekend, then destination comparison, a three-day forecast, and a packing checklist. All weather is labelled as sample data for Toronto, Montreal, and Vancouver.

## Decisions needed

1. Whether this belongs inside OpenToDo or should be a separate product.
2. Forecast provider and licence, including whether commercial use is planned.
3. Fixed three-city set for the MVP, or free-text destinations.
4. Whether long weekends (Thanksgiving Monday, 12 Oct 2026) are in scope.
5. Whether the proposed success thresholds are acceptable.
6. English-only or French from the start.
7. Approval for the two-week discovery spike, including recruiting interviewees.

## Verification

- `npm run build`, `npm test` (server 104 tests, client 25 tests), and `npm run lint` pass on the unchanged application code.
- The preview loads in jsdom without script errors. Scores match the placeholder formula (Vancouver 90, Montreal 68, Toronto 67). Selecting a destination updates the forecast and checklist. A Chromium screenshot confirmed the layout.

## Not changed

No application code was modified. The only committed change is this summary file.
