# Engineering requirements — Weekend weather planner

_Stage: Engineering requirements · 6 Oct 2026 · builds on
`docs/bento/product-investigation.md` and `docs/bento/design.md`_

This document turns the approved design spec into a plan the Implementation
stage can build from without re-deriving decisions. **No application code is
changed in this stage**; the only committed change is this document.

## 1. Architecture decision: client-only, zero server change

The planner is implemented entirely inside the `opentodo-client` workspace.
There is **no new API endpoint, no SQLite table, no server code change, and no
new dependency** in either workspace.

Reasons:

- The approved scope uses deterministic, clearly-labelled sample data for three
  fixed cities. A server round-trip would add a network failure mode and an
  auth-protected endpoint for data that never changes.
- The server (`server/src/index.ts`) is a pure `/api` JSON service — it 404s
  every non-`/api` path and does not serve the client build. Adding weather
  routes would be the first non-CRUD surface and is not justified by static
  data.
- Checklist state is an ephemeral scratch list per the design spec
  ("local to the session, not saved"), so nothing needs persistence.

If a live forecast provider is adopted later (open decision #2 in the product
investigation), the seam is the data module described in §3: swap its exported
constant for an async loader, keep the pure helpers and the page contract
unchanged. The design already defines loading/error states for that future.

## 2. Files that change

### New files

| File | Contents |
| --- | --- |
| `client/src/lib/weather.ts` | Types, the `DESTINATIONS` sample dataset, and the pure helpers `clearestDayIndex`, `recommendedDestination`, `scoreTone` (§3–4). No React imports — framework-agnostic like `client/src/api/client.ts`. |
| `client/src/pages/PlannerPage.tsx` | The planner page: sample-data banner, recommended-weekend hero, destination selector, three-day forecast, packing checklist, plus the skeleton/error/empty states defined in the design spec. Default export, like the other pages. |
| `client/src/lib/weather.test.ts` | Unit tests for the pure logic (§7). |
| `client/src/pages/PlannerPage.test.tsx` | Component tests (§7). |

### Modified files

| File | Change |
| --- | --- |
| `client/src/App.tsx` | Add `const PlannerPage = lazy(() => import('./pages/PlannerPage'))` and a `/planner` route wrapped in `<RequireAuth>`, as a sibling of `/boards` inside the existing `Layout` layout route and shared `<Suspense>`. |
| `client/src/components/Layout.tsx` | Add a header nav (`<nav aria-label="Primary">` with `NavLink`s **Boards** → `/boards` and **Weekend planner** → `/planner`), rendered only when `session` is present — same gating as the existing sign-out control. Active link: `aria-current="page"` (NavLink sets this automatically) plus the primary-colour treatment; inactive: the muted slate treatment already used on "Sign out". |

Nothing else changes. `RequireAuth`, `SignIn`, the API client, `types.ts`,
`theme.ts`, `tailwind.config.js`, and the whole `server/` workspace stay
untouched. The existing tokens already cover every colour the design needs
(primary/accent via Tailwind config; emerald/amber/rose/slate are stock
Tailwind classes already used by `BoardsPage`'s error banner).

## 3. Data model (client-side types, no storage)

Defined in `client/src/lib/weather.ts`. These are deliberately **not** added to
`client/src/types.ts`, which is documented as the canonical mirror of the REST
contract — planner data never crosses the network, so it must not look like a
DTO.

```ts
export type Condition =
  | 'sunny' | 'mostly-sunny' | 'partly-cloudy' | 'cloudy' | 'showers' | 'light-rain';

export interface DayForecast {
  day: 'Fri' | 'Sat' | 'Sun';
  date: string;          // display string, e.g. '9 Oct'
  condition: Condition;  // drives the icon
  conditionLabel: string; // display string, e.g. 'Mostly sunny'
  highC: number;
  lowC: number;
  rainPct: number;       // 0–100, chance of precipitation
  windKmh: number;
}

export interface PackingItem {
  label: string;
  reason?: string;       // muted explanatory text, optional
}

export interface Destination {
  id: 'toronto' | 'montreal' | 'vancouver';
  name: string;          // 'Toronto'
  region: string;        // 'ON' | 'QC' | 'BC'
  score: number;         // 0–100 clear-weekend score (placeholder formula)
  heroReason: string;    // one sentence for the hero when this city is recommended
  days: [DayForecast, DayForecast, DayForecast]; // exactly Fri, Sat, Sun
  packing: PackingItem[];
}

export const WEEKEND_LABEL = 'Fri 9 – Sun 11 Oct 2026';
export const DESTINATIONS: readonly Destination[] = [/* Toronto, Montreal, Vancouver */];
```

The dataset values are fixed and must match the "Sample data" tables and copy
deck in `docs/bento/design.md` exactly (Vancouver 90 / Montreal 68 / Toronto
67; per-day condition, high/low, rain %, wind). The weekend dates are
**hardcoded** (`Fri 9 – Sun 11 Oct 2026`), not computed from `Date.now()`:
the data is labelled sample data, and hardcoding keeps rendering and tests
deterministic regardless of when they run. Invariants the tests enforce:
exactly 3 destinations, exactly 3 days each, scores and percentages within
0–100.

Checklist checked-state lives in `useState` inside `PlannerPage` (a
`Record<destinationId, boolean[]>` or equivalent) and resets on unmount.
**Decision: no `localStorage`** — the spec calls it a scratch list, and
persisting it would raise sync/expiry questions the product hasn't answered.

## 4. Logic requirements (pure functions)

All in `client/src/lib/weather.ts`, no DOM, fully unit-testable:

- `clearestDayIndex(destination: Destination): 0 | 1 | 2` — the day with the
  lowest `rainPct`; ties broken by lower `windKmh`, then by earliest day.
  Expected on sample data: Vancouver → 1 (Sat), Montreal → 0 (Fri),
  Toronto → 0 (Fri).
- `recommendedDestination(list: readonly Destination[]): Destination | undefined` —
  highest `score`, ties broken alphabetically by `name`; `undefined` for an
  empty list (feeds the designed empty state instead of throwing). Expected:
  Vancouver.
- `scoreTone(score: number): 'good' | 'fair' | 'poor'` — `good` ≥ 80,
  `fair` 60–79, `poor` < 60 (boundaries: 80 is good, 60 is fair, 59 is poor).
  The page maps tones to emerald/amber/rose classes; tone is never conveyed by
  colour alone (the numeric badge always accompanies it).

The hero always reflects `recommendedDestination(DESTINATIONS)` regardless of
the currently selected tile; the forecast/checklist follow the selection. The
recommended destination is the initial selection.

## 5. Routing, navigation, and behaviour changes

- `/planner` becomes a real authenticated route. **Behaviour change:** today
  the catch-all `<Route path="*">` silently redirects `/planner` (and any
  unknown path) to `/boards`; after this change `/planner` renders the planner
  for a signed-in user and redirects to `/sign-in` (with `state.from =
  '/planner'`) when signed out — the exact `RequireAuth` behaviour the boards
  routes have. No other URL changes meaning. This is additive, not
  backwards-incompatible: no previously-working URL breaks.
- The catch-all and index redirects to `/boards` are kept as-is. Boards remains
  the home surface; the planner is reached via the new nav link.
- Note on `state.from`: `RequireAuth` already stashes the origin path, but
  `SignIn` currently ignores it (social sign-in redirects to
  `window.location.origin`). That is a pre-existing limitation affecting
  `/boards/:id` deep links identically; **do not fix it in this feature** —
  it belongs in its own change if the product wants it.
- Deep-linking/SPA fallback: in dev, Vite's history fallback serves
  `index.html` for `/planner` exactly as it does for `/boards/:id`. The Express
  server does not serve the client build at all, so production static hosting
  (whenever it is wired up) needs an SPA fallback for every client route
  already — the planner adds no new constraint.
- Header nav is rendered only with a session. On `/sign-in` and during session
  resolution the header looks exactly as it does today, so the sign-in
  experience is unchanged.

## 6. Non-functional requirements

- **Accessibility** (acceptance criteria, from the design spec): destination
  tiles are `<button aria-pressed>` inside `role="group"` labelled
  "Destinations"; the forecast region is `aria-live="polite"`; clearest-day is
  marked with visible text, not colour alone; checklist rows are
  `<label>`-wrapped checkboxes; all interactive elements show the primary
  `focus-visible` ring; nav links carry `aria-current="page"` when active.
- **Dark mode**: every new surface uses the paired `dark:` classes matching
  `BoardCard`/`BoardsPage`; no new CSS files.
- **Bundle**: the page is a lazy route chunk like the others; `weather.ts` is
  imported only by the planner chunk and its tests, so the boards bundle size
  is unchanged. No new npm dependencies; icons are inline SVG per the existing
  convention.
- **i18n**: English-only, matching the rest of the app (open product decision
  #6 stays open; nothing here hardcodes a locale API).

## 7. Test plan

Client: Vitest + Testing Library, jsdom, following the existing patterns —
module-boundary `vi.mock('../lib/auth-client', …)` as in
`RequireAuth.test.tsx`, vitest-core assertions (no jest-dom), `cleanup()` in
`afterEach`. Run with `npm test` (workspace: `npm run test --workspace=client`).

`client/src/lib/weather.test.ts` (pure, no DOM):

1. Dataset invariants: 3 destinations, 3 days each, expected scores (90/68/67),
   rain/wind/score ranges.
2. `clearestDayIndex`: sample-data expectations above, plus constructed
   fixtures for the rain tie → wind rule and the rain+wind tie → earliest-day
   rule.
3. `recommendedDestination`: picks the top score; alphabetical tie-break on a
   constructed two-city tie; `undefined` on `[]`.
4. `scoreTone`: boundary values 100/80/79/60/59/0.

`client/src/pages/PlannerPage.test.tsx` (rendered inside `MemoryRouter`):

5. Sample-data banner is always present.
6. Hero names Vancouver with score 90; "View forecast" selects Vancouver.
7. The recommended destination is selected on first load
   (`aria-pressed="true"`).
8. Clicking Toronto updates the forecast heading, the three day cards, the
   clearest-day tag position, and the packing list (`aria-live` region
   content).
9. Checklist toggle: clicking a label checks the box and applies the
   struck-through style; unchecking restores it.
10. Empty state renders "No destinations to compare yet." when the destination
    list is empty (inject via a props default or module mock — prefer a
    `destinations` prop defaulting to `DESTINATIONS`, which keeps the test
    free of module mocking).

Routing/nav (extend existing suites or add alongside):

11. `App`-level: unauthenticated `/planner` redirects to `/sign-in`
    (mirrors `RequireAuth.test.tsx`); authenticated `/planner` renders the
    planner.
12. `Layout`: nav links absent without a session, present with one; active
    link has `aria-current="page"`.

Server: no changes, so the existing 104 server tests must simply keep passing.
Full gate before the implementation commit: `npm run build`, `npm test`,
`npm run lint`, `npm run format:check` from the repo root.

## 8. Risks, migrations, irreversibility

- **Migrations: none.** No schema, no stored data, no config change. The whole
  feature is reversible by deleting the two new modules and the two small
  diffs in `App.tsx`/`Layout.tsx`.
- **Riskiest touch: `Layout.tsx`.** It wraps every page including sign-in. The
  nav must be gated on `session` exactly like the sign-out control, and the
  header's flex layout must keep the auth control right-aligned. Covered by
  test 12.
- **Catch-all route interaction.** The `/planner` route must be declared
  before the `path="*"` redirect inside the same layout route; test 11 guards
  it.
- **jsdom gaps** are already shimmed in `client/vitest.setup.ts`
  (`matchMedia`, rAF); the planner needs nothing beyond those.
- **Scope creep risk.** The hero/selector/forecast interplay invites state
  libraries or context; requirement: plain `useState` in `PlannerPage` only.

## 9. Backwards compatibility statement

No backwards-incompatible changes. The REST API, DTOs, database schemas, auth
flows, and all existing URLs behave exactly as before. The two observable
additions are the header nav for signed-in users and the `/planner` URL
ceasing to redirect to `/boards` (it was never a documented destination).

## 10. Implementation order (for the next stage)

1. `client/src/lib/weather.ts` + `weather.test.ts` (pure logic first, green).
2. `PlannerPage.tsx` states per the design spec + `PlannerPage.test.tsx`.
3. Route in `App.tsx`, nav in `Layout.tsx`, routing/nav tests.
4. Visual pass against `/workspace/artifacts/weekend-weather-planner-preview.html`
   (the design stage's reference), light and dark.
5. Full gate: root `npm run build && npm test && npm run lint`.

## Verification of this stage

No application code was modified. `npm run build`, `npm test` (server 104
tests, client 25 tests) and `npm run lint` were run on the unchanged code to
confirm the baseline this plan builds on is green.
