# Add weekend weather planner for outdoor getaways

Client-only `/planner` page that compares labelled sample weekend weather for Toronto, Montreal, and Vancouver, recommends the clearest window, and offers a session-local packing list. The boards app is unchanged.

## Summary

- New authenticated route at `/planner`, lazy-loaded beside `/boards` and gated by the existing `RequireAuth` guard.
- Header nav (**Boards**, **Weekend planner**) appears only when a session is present, with `aria-current="page"` on the active link.
- Deterministic sample data and scoring helpers live in `client/src/lib/weather.ts` (no API, no SQLite, no new dependencies).
- Recommended weekend is always Vancouver (score 90). Selecting a city updates the three-day forecast, clearest-day tag, and packing checklist.

## Files

- Added: `client/src/lib/weather.ts`, `client/src/lib/weather.test.ts`, `client/src/pages/PlannerPage.tsx`, `client/src/pages/PlannerPage.test.tsx`, `client/src/App.test.tsx`, `client/src/components/Layout.test.tsx`
- Modified: `client/src/App.tsx`, `client/src/components/Layout.tsx`

## Test plan

- [ ] Sign in, then open **Weekend planner** from the header.
- [ ] Confirm the amber sample-data banner is visible.
- [ ] Confirm the hero recommends Vancouver (score 90) and that city is selected on first load.
- [ ] Select Toronto, then Montreal: forecast heading, day cards, clearest-day tag, and packing list update.
- [ ] Toggle a packing item and confirm it strikes through; uncheck to restore.
- [ ] Sign out and visit `/planner` — redirected to `/sign-in`.
- [ ] Confirm the boards list and board view still work, including the new header nav.

## Verification

Ran from the repo root with Node 22 (`/opt/node22/bin`):

- `npm run build` — server `tsc` and client `tsc --noEmit && vite build` succeeded. Planner is a separate lazy chunk (`PlannerPage-*.js`).
- `npm test` — server **104** passed; client **44** passed (was 25; 19 new).
- `npm run lint` — passed.
- `npm run format:check` — still fails on **15 pre-existing files** this change did not touch (`client/src/api/client.ts`, `BoardView.tsx`, several server test/source files). New and edited planner files are Prettier-clean.

No browser tools were available in this sandbox, so the ready-state layout was checked against the design spec and covered by component tests rather than a live signed-in click-through. An interactive HTML preview of the implemented UI is on the card at `/workspace/artifacts/weekend-weather-planner.html` (not committed).

## Plan fidelity

The engineering requirements were buildable as written. One gap: the design copy deck specified packing items only for Vancouver. Montreal and Toronto lists are weather-appropriate placeholders in `DESTINATIONS`, not a change of scope. Loading and error states are implemented behind optional `PlannerPage` props for the future live-forecast seam; the default path is the ready state.

## Pull request

Automatic PR creation is off for this stage. Title and description are also set via Bento `set_pull_request` for when the branch is published.
