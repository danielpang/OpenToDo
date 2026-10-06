# Design specification — Weekend weather planner

_Stage: UI/UX design · 6 Oct 2026 · builds on `docs/bento/product-investigation.md`_

## Scope decision for this stage (read first)

This stage produces **design specification and handoff only**. No application
code is changed here.

During this stage the scope was expanded by the user to a working feature —
destination selection, three-day forecasts, a recommended weekend, and a packing
checklist, using clearly labelled deterministic sample data for Toronto,
Montreal and Vancouver, with the boards app left intact and an accessible
planner entry point. That expanded scope is **approved and carried forward**,
but implementation is **deferred to the later Implementation stage**, after
Engineering requirements. Later agents should follow this sequence:

- **Now (design):** this document, the product brief, and the HTML concept
  preview. No app code.
- **Next (engineering requirements):** turn this spec into technical
  requirements — data shape, where the scoring/recommendation logic lives, test
  plan.
- **Then (implementation):** build the planner in the client per the approved
  scope and this spec, with meaningful tests, keeping the boards app intact.

The implementation notes in the "Engineering handoff" section below are
guidance for that later stage, not work done now.

## What a person is trying to do

Pick the best destination and day for an outdoor weekend getaway, understand
why, and know what to pack — without comparing three weather apps by hand. See
the product brief (`/workspace/artifacts/weekend-weather-planner-product-brief.md`)
for the full problem framing.

## Where it lives

The planner is a new authenticated page in the existing OpenToDo client at
**`/planner`**, a sibling of `/boards`. It reuses the app shell (`Layout`) and
sits behind the same `RequireAuth` guard as the boards routes, so its states
inherit the shell's header, theming, and auth behaviour.

### Entry point and navigation

Today the header (`Layout`) shows only the brand and the auth control, with no
navigation between pages. Add a primary nav in the header, visible only when a
session is present (mirroring how the sign-out control is gated):

- **Boards** → `/boards`
- **Weekend planner** → `/planner`

The active link is marked with `aria-current="page"` and the primary colour
underline/weight; the inactive link uses the muted slate treatment already used
for the sign-out button. On narrow screens the two links stay inline (there are
only two). This keeps the boards app fully intact and adds the planner as a
peer, which is the accessible entry point the scope calls for.

## Design-system alignment

The planner uses the existing client tokens (`client/src/theme.ts`,
`tailwind.config.js`) so it reads as the same product:

- **Primary** sky `#0ea5e6` (`bg-primary`, `text-primary`), **accent** amber
  `#f59e0b` (the brand bar, the sample-data banner).
- **Neutrals** slate scale, with full light/dark parity via the `html.dark`
  class already set from the OS preference in `main.tsx`.
- **Surfaces** `rounded-xl border border-slate-200 bg-white shadow-sm`
  (dark: `border-slate-700 bg-slate-800`), matching `BoardCard`.
- **Primary button** `rounded-lg bg-primary px-4 py-1.5 text-sm font-medium
  text-white shadow hover:bg-primary/90`, matching the "New board" button.
- **Error banner** rose palette with an inline **Retry**, matching `BoardsPage`.
- **Skeleton** pulsing slate bars, matching `BoardsSkeleton`.
- **Motion** the `spring` easing token for entrance/hover lift; `easeInOut` for
  colour transitions.
- **Icons** inline SVG (no icon-library dependency), matching the existing
  `PlusIcon` / `XIcon` convention.

Score tone is a small, consistent scale used for the badge and meter:
**good** ≥ 80 (emerald), **fair** 60–79 (amber), **poor** < 60 (rose).

## Screens and states

There is one screen (the planner page) with several states. Because the concept
runs on **deterministic local sample data**, the normal path renders
immediately; the loading/error/empty states still have a defined design so the
later implementation (and any future switch to a live forecast) is covered
rather than discovered.

### 1. Loading (route + data)

The route chunk is lazy-loaded inside the existing `<Suspense>`; while session
resolution is pending, `RequireAuth` already renders the shared `Loading…`
fallback. For the planner's own first paint, show a **skeleton** that matches the
final layout: one wide hero bar, three destination tiles, and three forecast-day
cards as pulsing slate blocks. No spinner. Copy: none (skeleton only), so there
is no text to mistranslate or flash.

### 2. Permission-denied (not signed in)

Handled by `RequireAuth`: an unauthenticated visit to `/planner` redirects to
`/sign-in`, stashing `/planner` in router state so the user returns here after
signing in. No bespoke "access denied" screen — this matches the boards routes
exactly. The sign-in screen's existing copy applies ("Sign in to OpenToDo",
"Sign in with Google", "Sign in with X").

### 3. Ready (the main experience)

Top to bottom:

**a. Sample-data banner.** A dashed amber note, always visible, so no one
mistakes the concept for a live forecast.

> ⓘ **Sample data.** Forecasts for Toronto, Montreal and Vancouver are
> illustrative placeholders for this concept — not a live forecast.

**b. Recommended weekend (hero).** A primary-gradient card leading with the
decision.

- Eyebrow: **CLEAREST WINDOW**
- Heading: **Head to Vancouver this weekend** (destination is the
  highest-scoring city; ties break alphabetically)
- Reason: **Saturday looks the driest and calmest of the three days — 5% chance
  of rain and light winds.**
- Score chip: **90** with the label **/100 clear-weekend score**
- Button: **View forecast** (selects the recommended destination and scrolls to
  the forecast). Icon: arrow-right.

**c. Compare destinations (selector).** Three tiles in a row, each a toggle
button with `aria-pressed`.

- Section label: **COMPARE DESTINATIONS**, hint **Tap a city to see its
  weekend**.
- Each tile: a coloured strip (score tone), the **city name**, a **score badge**
  (e.g. `90`), a meta line **"BC · Fri–Sun"**, and a thin score **meter**.
- Selected tile: primary ring + `aria-pressed="true"`. The recommended
  destination is selected on first load.

**d. Three-day forecast.** Three day cards for the selected city.

- Section label: **THREE-DAY FORECAST — Vancouver**, hint **Highs in °C · precip
  chance · wind**.
- Each card: weekday (**Fri**), date (**9 Oct**), a weather icon, **high°** with
  a muted **/ low°**, a condition label (**Mostly sunny**), and two stats rows —
  **Rain 5%** and **Wind 8 km/h**.
- The clearest day gets a primary ring and a **Clearest day** tag. The region
  below the heading uses `aria-live="polite"` so a screen reader announces the
  city when the selection changes.

**e. Packing checklist.** A surface card beside the forecast (stacked below it
on narrow screens).

- Title: **Packing checklist**, sub: **Tuned for a Vancouver weekend.**
- Checkable items with an optional muted reason, e.g.
  - **Light rain jacket** · 20% chance of showers Sunday
  - **Layers for 10–18°C** · Cool mornings, mild afternoons
  - **Comfortable walking shoes** · Seawall and trails
  - **Sunglasses** · Clear skies Fri–Sat
  - **Refillable water bottle**
- Checking an item strikes it through and mutes it. Checklist state is local to
  the session (it is a scratch list, not saved).

Selecting a different destination updates the forecast heading, the three day
cards, the clearest-day highlight, and the packing list. The recommended-weekend
hero always reflects the top-scoring city, independent of the current selection.

### 4. Error (degraded / future live data)

With deterministic sample data there is no runtime fetch to fail, so the ready
state is the normal path. The error state exists for robustness and for a future
live-forecast source. If destination data cannot be produced, show the shared
rose banner in place of the destination/forecast area (hero omitted):

> We couldn't load the weekend forecast. **Retry**

**Retry** re-runs the load. This reuses the exact banner markup and behaviour
from `BoardsPage`, so error handling stays consistent across the app.

### 5. Empty (no destinations)

Not reachable with the fixed three-city sample set, but defined so the layout is
never blank if the destination list is ever empty. Use the centred empty-state
pattern from `BoardsPage`:

- Icon: a small map-pin.
- Message: **No destinations to compare yet.**
- No primary action in the concept (destinations are fixed); the message stands
  alone.

## Accessibility

- Destination tiles are real `<button>`s with `aria-pressed`; the selector is
  wrapped in a `role="group"` labelled **Destinations**.
- The forecast region is `aria-live="polite"` so selection changes are
  announced; the clearest-day tag is real text, not colour-only.
- Score tone is never conveyed by colour alone — the numeric score and the
  **Clearest day** / badge text carry the same meaning.
- All interactive elements are keyboard reachable with a visible
  `focus-visible` ring in the primary colour; tab order follows reading order
  (banner → hero → selector → forecast → checklist).
- Checklist items use `<label>`-wrapped checkboxes so the whole row is a target.
- Light and dark themes both meet contrast on text and badges.

## Copy deck (the exact words)

| Where                     | Text                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| Nav link                  | `Weekend planner`                                                                                      |
| Sample-data banner        | `Sample data. Forecasts for Toronto, Montreal and Vancouver are illustrative placeholders for this concept — not a live forecast.` |
| Hero eyebrow              | `CLEAREST WINDOW`                                                                                       |
| Hero heading              | `Head to {destination} this weekend`                                                                   |
| Hero reason (Vancouver)   | `Saturday looks the driest and calmest of the three days — 5% chance of rain and light winds.`         |
| Hero score label          | `/100 clear-weekend score`                                                                             |
| Hero button               | `View forecast`                                                                                        |
| Selector label / hint     | `Compare destinations` · `Tap a city to see its weekend`                                               |
| Tile meta                 | `{region} · Fri–Sun`                                                                                   |
| Forecast label / hint     | `Three-day forecast — {destination}` · `Highs in °C · precip chance · wind`                            |
| Forecast stats            | `Rain {n}%` · `Wind {n} km/h`                                                                           |
| Clearest-day tag          | `Clearest day`                                                                                          |
| Checklist title / sub     | `Packing checklist` · `Tuned for a {destination} weekend.`                                              |
| Error banner              | `We couldn't load the weekend forecast.` + `Retry`                                                     |
| Empty state               | `No destinations to compare yet.`                                                                       |
| Weekend label             | `Fri 9 – Sun 11 Oct 2026`                                                                               |

## Sample data (reference for implementation)

Weekend **Fri 9 – Sun 11 Oct 2026**. Clear-weekend score is a placeholder
(0–100); the clearest day is the lowest chance of rain, breaking ties by lower
wind, then earliest day.

**Vancouver — score 90 (good), clearest day: Saturday**

| Day | Condition    | High/Low | Rain | Wind     |
| --- | ------------ | -------- | ---- | -------- |
| Fri | Sunny        | 17°/10°  | 10%  | 10 km/h  |
| Sat | Mostly sunny | 18°/11°  | 5%   | 8 km/h   |
| Sun | Partly cloudy| 16°/10°  | 20%  | 12 km/h  |

**Montreal — score 68 (fair), clearest day: Friday**

| Day | Condition     | High/Low | Rain | Wind     |
| --- | ------------- | -------- | ---- | -------- |
| Fri | Sunny         | 14°/6°   | 10%  | 12 km/h  |
| Sat | Partly cloudy | 13°/5°   | 25%  | 16 km/h  |
| Sun | Showers       | 12°/6°   | 55%  | 20 km/h  |

**Toronto — score 67 (fair), clearest day: Friday**

| Day | Condition     | High/Low | Rain | Wind     |
| --- | ------------- | -------- | ---- | -------- |
| Fri | Partly cloudy | 16°/9°   | 20%  | 14 km/h  |
| Sat | Light rain    | 14°/8°   | 60%  | 22 km/h  |
| Sun | Cloudy        | 15°/7°   | 35%  | 18 km/h  |

Recommendation: highest score → **Vancouver**; its clearest day is Saturday.

## Engineering handoff (for the later Implementation stage)

Guidance, not work for this stage:

- **Client-only, no server changes.** The concept is deterministic sample data,
  so no new `/api` endpoint or SQLite table is needed. Keep the boards app
  untouched.
- Suggested shape: a small pure data/logic module (e.g.
  `client/src/lib/weather.ts`) holding the typed sample destinations plus pure
  helpers — `clearestDayIndex(destination)`, `recommendedDestination(list)`,
  `scoreTone(score)` — and a page component (e.g.
  `client/src/pages/PlannerPage.tsx`) that renders the states above. Add the
  `/planner` route (lazy, behind `RequireAuth`) and the header nav link.
- **Meaningful tests** (Vitest + Testing Library, matching the existing style in
  `client/src/pages/BoardsPage.test.tsx`): the recommendation picks the
  top-scoring city; the clearest-day rule (precip, then wind, then order) is
  correct; selecting a destination updates the forecast, clearest-day highlight,
  and packing list; the sample-data banner is always present; checklist items
  toggle. Keep logic pure so it is unit-testable without the DOM.
- Reuse the shared error/empty/skeleton patterns rather than inventing new ones.

## Artifacts and verification

Visual deliverables for review are under `/workspace/artifacts` (shown on the
card, not committed):

- `weekend-weather-planner-product-brief.md` — the refined product brief.
- `weekend-weather-planner-preview.html` — a self-contained, interactive HTML
  concept preview. It implements the ready state end to end with the labelled
  sample data: recommended-weekend hero, destination selector (keyboard
  accessible, `aria-pressed`), three-day forecast with the clearest day marked,
  packing checklist, and a light/dark toggle. It is the visual reference the
  implementation should match.

No application code was changed in this stage, so there is nothing to build or
test in the app; verification was limited to reviewing the preview's layout,
copy, and interactions against this spec and confirming the sample data is
internally consistent (Saturday is genuinely Vancouver's clearest day).
