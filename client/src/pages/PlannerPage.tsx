import { useMemo, useRef, useState, type ReactElement, type RefObject } from 'react';
import { motion } from '../theme';
import {
  DESTINATIONS,
  WEEKEND_LABEL,
  clearestDayIndex,
  recommendedDestination,
  scoreTone,
  type Condition,
  type Destination,
} from '../lib/weather';

export interface PlannerPageProps {
  destinations?: readonly Destination[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const toneClasses = {
  good: {
    strip: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    meter: 'bg-emerald-500',
  },
  fair: {
    strip: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    meter: 'bg-amber-500',
  },
  poor: {
    strip: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
    meter: 'bg-rose-500',
  },
} as const;

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900';

/**
 * `/planner`: compares the sample weekend forecast for Toronto, Montreal and
 * Vancouver, highlights the clearest travel window, and offers a scratch
 * packing list. Data is local and deterministic — see `lib/weather.ts`.
 */
export default function PlannerPage({
  destinations = DESTINATIONS,
  loading = false,
  error = null,
  onRetry,
}: PlannerPageProps) {
  const recommended = useMemo(() => recommendedDestination(destinations), [destinations]);
  const [selectedId, setSelectedId] = useState(recommended?.id);
  const [packed, setPacked] = useState<Record<string, boolean[]>>(() =>
    Object.fromEntries(destinations.map((city) => [city.id, city.packing.map(() => false)])),
  );
  const forecastRef = useRef<HTMLElement>(null);

  const selected = destinations.find((city) => city.id === selectedId) ?? recommended;
  const clearest = selected ? clearestDayIndex(selected) : 0;

  function handleViewForecast() {
    if (!recommended) return;
    setSelectedId(recommended.id);
    forecastRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  function togglePacked(cityId: string, index: number) {
    setPacked((current) => {
      const row = current[cityId] ?? [];
      const next = row.slice();
      next[index] = !next[index];
      return { ...current, [cityId]: next };
    });
  }

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-5xl">
        <PlannerSkeleton />
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <SampleBanner />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200"
        >
          <p>We couldn&apos;t load the weekend forecast.</p>
          <button
            type="button"
            onClick={onRetry}
            className={`mt-1.5 font-medium text-rose-800 underline hover:text-rose-900 dark:text-rose-200 ${focusRing}`}
          >
            Retry
          </button>
        </div>
      ) : destinations.length === 0 || !selected ? (
        <EmptyState />
      ) : (
        <>
          {recommended && (
            <RecommendedHero destination={recommended} onViewForecast={handleViewForecast} />
          )}

          <DestinationSelector
            destinations={destinations}
            selectedId={selected.id}
            onSelect={setSelectedId}
          />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
            <ForecastPanel destination={selected} clearest={clearest} panelRef={forecastRef} />
            <PackingList
              destination={selected}
              checked={packed[selected.id] ?? selected.packing.map(() => false)}
              onToggle={(index) => togglePacked(selected.id, index)}
            />
          </div>
        </>
      )}
    </section>
  );
}

function SampleBanner() {
  return (
    <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
      <span className="font-semibold">Sample data.</span> Forecasts for Toronto, Montreal and
      Vancouver are illustrative placeholders for this concept — not a live forecast.
    </p>
  );
}

function RecommendedHero({
  destination,
  onViewForecast,
}: {
  destination: Destination;
  onViewForecast: () => void;
}) {
  const springTiming = `${motion.spring.duration} ${motion.spring.easing}`;

  return (
    <article
      className="rounded-xl bg-gradient-to-br from-sky-500 to-primary p-6 text-white shadow-sm"
      style={{ transition: `transform ${springTiming}` }}
    >
      <p className="text-xs font-semibold tracking-[0.16em] text-sky-100">CLEAREST WINDOW</p>
      <h1 className="mt-2 text-2xl font-semibold">Head to {destination.name} this weekend</h1>
      <p className="mt-1 text-sm text-sky-100">{WEEKEND_LABEL}</p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-sky-50">{destination.heroReason}</p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <p className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold">{destination.score}</span>
          <span className="text-sm text-sky-100">/100 clear-weekend score</span>
        </p>
        <button
          type="button"
          onClick={onViewForecast}
          className={`inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-1.5 text-sm font-medium text-primary shadow hover:bg-sky-50 ${focusRing}`}
        >
          View forecast
          <ArrowRightIcon />
        </button>
      </div>
    </article>
  );
}

function DestinationSelector({
  destinations,
  selectedId,
  onSelect,
}: {
  destinations: readonly Destination[];
  selectedId: Destination['id'];
  onSelect: (id: Destination['id']) => void;
}) {
  return (
    <section>
      <header className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
          Compare destinations
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Tap a city to see its weekend</p>
      </header>
      <div role="group" aria-label="Destinations" className="grid gap-3 sm:grid-cols-3">
        {destinations.map((city) => {
          const tone = toneClasses[scoreTone(city.score)];
          const selected = city.id === selectedId;
          return (
            <button
              key={city.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(city.id)}
              className={`overflow-hidden rounded-xl border bg-white text-left shadow-sm transition-colors duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-800 ${focusRing} ${
                selected
                  ? 'border-primary ring-2 ring-primary'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <span className={`block h-1.5 w-full ${tone.strip}`} aria-hidden="true" />
              <span className="flex flex-col gap-2 p-4">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {city.name}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone.badge}`}>
                    {city.score}
                  </span>
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {city.region} · Fri–Sun
                </span>
                <span
                  className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                  aria-hidden="true"
                >
                  <span
                    className={`block h-full ${tone.meter}`}
                    style={{ width: `${city.score}%` }}
                  />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ForecastPanel({
  destination,
  clearest,
  panelRef,
}: {
  destination: Destination;
  clearest: 0 | 1 | 2;
  panelRef: RefObject<HTMLElement>;
}) {
  return (
    <section ref={panelRef} aria-live="polite">
      <header className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
          Three-day forecast — {destination.name}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Highs in °C · precip chance · wind
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        {destination.days.map((forecast, index) => {
          const isClearest = index === clearest;
          return (
            <article
              key={forecast.day}
              className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-800 ${
                isClearest
                  ? 'border-primary ring-2 ring-primary'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {forecast.day}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{forecast.date}</p>
                </div>
                <WeatherIcon condition={forecast.condition} />
              </div>
              {isClearest && (
                <p className="mt-2 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-primary dark:bg-sky-900/40 dark:text-sky-200">
                  Clearest day
                </p>
              )}
              <p className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {forecast.highC}°
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  / {forecast.lowC}°
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {forecast.conditionLabel}
              </p>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Rain {forecast.rainPct}%
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Wind {forecast.windKmh} km/h
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PackingList({
  destination,
  checked,
  onToggle,
}: {
  destination: Destination;
  checked: boolean[];
  onToggle: (index: number) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Packing checklist
      </h2>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        Tuned for a {destination.name} weekend.
      </p>
      <ul className="flex flex-col gap-2">
        {destination.packing.map((item, index) => {
          const done = Boolean(checked[index]);
          return (
            <li key={item.label}>
              <label
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 text-sm ${focusRing} ${
                  done
                    ? 'line-through text-slate-400 dark:text-slate-500'
                    : 'text-slate-800 dark:text-slate-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => onToggle(index)}
                  className={`mt-0.5 accent-primary ${focusRing}`}
                />
                <span>
                  <span className="font-medium">{item.label}</span>
                  {item.reason && (
                    <span className="mt-0.5 block text-xs font-normal text-slate-500 no-underline dark:text-slate-400">
                      {item.reason}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-surface-alt py-12 text-center dark:border-slate-700 dark:bg-slate-800"
      aria-label="No destinations to compare yet"
    >
      <MapPinIcon />
      <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
        No destinations to compare yet.
      </p>
    </div>
  );
}

function PlannerSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="h-36 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`tile-${index}`}
            className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-700"
          />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`day-${index}`}
            className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-700"
          />
        ))}
      </div>
    </div>
  );
}

function WeatherIcon({ condition }: { condition: Condition }) {
  const paths: Record<Condition, ReactElement> = {
    sunny: (
      <>
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
        <line x1="4.2" y1="4.2" x2="6.3" y2="6.3" />
        <line x1="17.7" y1="17.7" x2="19.8" y2="19.8" />
        <line x1="4.2" y1="19.8" x2="6.3" y2="17.7" />
        <line x1="17.7" y1="6.3" x2="19.8" y2="4.2" />
      </>
    ),
    'mostly-sunny': (
      <>
        <circle cx="10" cy="10" r="3.5" />
        <path d="M6 17h11a3 3 0 0 0 0-6 4 4 0 0 0-7.5-1" />
      </>
    ),
    'partly-cloudy': (
      <>
        <circle cx="8" cy="9" r="3" />
        <path d="M5 18h12a3.5 3.5 0 0 0 0-7 4.5 4.5 0 0 0-8.2-1.8" />
      </>
    ),
    cloudy: <path d="M6 18h12a4 4 0 0 0 0-8 5 5 0 0 0-9.5-1.6A3.5 3.5 0 0 0 6 18z" />,
    showers: (
      <>
        <path d="M6 15h12a4 4 0 0 0 0-8 5 5 0 0 0-9.5-1.6A3.5 3.5 0 0 0 6 15z" />
        <line x1="9" y1="18" x2="8" y2="22" />
        <line x1="13" y1="18" x2="12" y2="22" />
        <line x1="17" y1="18" x2="16" y2="22" />
      </>
    ),
    'light-rain': (
      <>
        <path d="M6 15h12a4 4 0 0 0 0-8 5 5 0 0 0-9.5-1.6A3.5 3.5 0 0 0 6 15z" />
        <line x1="10" y1="18" x2="9" y2="21" />
        <line x1="15" y1="18" x2="14" y2="21" />
      </>
    ),
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primary"
      aria-hidden="true"
    >
      {paths[condition]}
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400 dark:text-slate-500"
      aria-hidden="true"
    >
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
