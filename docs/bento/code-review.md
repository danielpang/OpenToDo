# Code review — Weekend weather planner

_Stage: Code review · 6 Oct 2026 · reviews the implementation on
`feature/weekend-weather-planner-e8469f44` against `docs/bento/product-investigation.md`,
`design.md`, and `engineering-requirements.md`._

**Verdict: the work is sound — recommend merging.** All four review checks
pass. The only findings are optional nits; none block the merge. No
application code was changed in this stage; the only committed change is
this summary.

## Verification (re-run locally, Node 22)

- `npm run build` — server `tsc` + client `tsc --noEmit && vite build`.
  Planner is its own lazy chunk (`PlannerPage-*.js`, 14.23 kB / gzip 4.18 kB).
- `npm test` — server **104** passed; client **44** passed (19 new).
- `npm run lint` — passed. New and edited planner files are Prettier-clean.
  Repo-wide `format:check` still fails only on pre-existing files this branch
  did not touch.

## 1. Does it do what the requirements said? — Yes

Faithful to the approved design spec and engineering requirements (the
product-investigation “do not build yet” recommendation was superseded by
the design-stage scope expansion):

- **Client-only**, no server/API/SQLite/dependency change (eng-req §1–2);
  `server/` is untouched.
- Sample data in `client/src/lib/weather.ts` matches the design tables
  exactly (Vancouver 90 / Montreal 68 / Toronto 67; per-day condition,
  high/low, rain %, wind). `WEEKEND_LABEL` is hardcoded as specified.
- Pure helpers `clearestDayIndex` (`weather.ts:175`),
  `recommendedDestination` (`weather.ts:190`), and `scoreTone`
  (`weather.ts:199`) match the specified rules and boundaries (80 = good,
  60 = fair, 59 = poor).
- Copy deck matches across banner, hero, selector, forecast, clearest-day
  tag, checklist, error, and empty state.
- Routing/nav per eng-req §5: `/planner` is lazy and behind `RequireAuth`
  (`App.tsx:50-57`); session-gated header nav with `aria-current`
  (`Layout.tsx:50-73`).
- Accessibility per §6: `role="group"` selector with `aria-pressed` tiles,
  `aria-live="polite"` forecast region, textual “Clearest day” tag,
  `<label>`-wrapped checkboxes, focus-visible rings.

Montreal/Toronto packing lists are weather-appropriate placeholders — the
design copy deck specified only Vancouver’s. Disclosed in
`implementation.md`. Not a defect.

## 2. Covered by tests? — Yes

All twelve items in the engineering-requirements test plan are present and
passing: dataset invariants and helper fixtures (`weather.test.ts`), banner /
hero / selection / checklist / empty state (`PlannerPage.test.tsx`),
auth-gated routing (`App.test.tsx`), and session-gated nav
(`Layout.test.tsx`).

The `loading` and `error` prop branches (`PlannerPage.tsx:77-83` and
`PlannerPage.tsx:89-102`) are off-by-default future-live-forecast seams and
were not in the required test plan. Impact today is none.

## 3. Any bugs? — None found

Checked tie-break logic, empty-list handling
(`recommendedDestination([])` → `undefined` → empty state), the
`scrollIntoView?.` jsdom guard, per-city checklist state, and the
`/planner` route sitting before the `path="*"` catch-all. No correctness
issues.

Two cosmetic motion nits, very low severity — they do not change behaviour:

- `PlannerPage.tsx:152` — `RecommendedHero` sets `transition: transform`
  using the spring token, but nothing changes the transform, so the rule
  never runs. The design asked for a spring entrance/hover lift.
- `PlannerPage.tsx:203` — destination tiles use `hover:-translate-y-0.5`
  with `transition-colors`, which does not animate `transform`, so the
  hover lift snaps rather than easing.

## 4. Reads clearly? — Yes

Pure data/logic is separated from the view, subcomponents are small, and
the page reuses existing tokens and error/empty/skeleton patterns. Easy for
the next person to pick up.

One stale comment: `App.tsx:6-8` still describes the lazy imports as F1
placeholders that “resolve to a static heading.” That is no longer true of
`BoardsPage`, `BoardView`, or the new `PlannerPage`.

## Outcome

Findings posted as a PR comment, asking which (if any) optional nit to
address:

1. Motion nits on the hero and destination tiles.
2. Refresh the stale F1 comment in `App.tsx`.
3. Optional tests for the unused loading/error prop branches.
4. Nothing — merge as is.
