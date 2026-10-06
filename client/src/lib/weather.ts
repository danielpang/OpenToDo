export type Condition =
  'sunny' | 'mostly-sunny' | 'partly-cloudy' | 'cloudy' | 'showers' | 'light-rain';

export interface DayForecast {
  day: 'Fri' | 'Sat' | 'Sun';
  date: string;
  condition: Condition;
  conditionLabel: string;
  highC: number;
  lowC: number;
  rainPct: number;
  windKmh: number;
}

export interface PackingItem {
  label: string;
  reason?: string;
}

export interface Destination {
  id: 'toronto' | 'montreal' | 'vancouver';
  name: string;
  region: string;
  score: number;
  heroReason: string;
  days: [DayForecast, DayForecast, DayForecast];
  packing: PackingItem[];
}

export const WEEKEND_LABEL = 'Fri 9 – Sun 11 Oct 2026';

export const DESTINATIONS: readonly Destination[] = [
  {
    id: 'toronto',
    name: 'Toronto',
    region: 'ON',
    score: 67,
    heroReason:
      'Friday is the driest of the three days — 20% chance of rain before a wet Saturday.',
    days: [
      {
        day: 'Fri',
        date: '9 Oct',
        condition: 'partly-cloudy',
        conditionLabel: 'Partly cloudy',
        highC: 16,
        lowC: 9,
        rainPct: 20,
        windKmh: 14,
      },
      {
        day: 'Sat',
        date: '10 Oct',
        condition: 'light-rain',
        conditionLabel: 'Light rain',
        highC: 14,
        lowC: 8,
        rainPct: 60,
        windKmh: 22,
      },
      {
        day: 'Sun',
        date: '11 Oct',
        condition: 'cloudy',
        conditionLabel: 'Cloudy',
        highC: 15,
        lowC: 7,
        rainPct: 35,
        windKmh: 18,
      },
    ],
    packing: [
      { label: 'Rain jacket', reason: '60% chance of rain Saturday' },
      { label: 'Layers for 8–16°C', reason: 'Mild but changeable' },
      { label: 'Waterproof shoes', reason: 'Saturday rain' },
      { label: 'Compact umbrella' },
    ],
  },
  {
    id: 'montreal',
    name: 'Montreal',
    region: 'QC',
    score: 68,
    heroReason:
      'Friday looks the driest of the three days — 10% chance of rain before Sunday showers.',
    days: [
      {
        day: 'Fri',
        date: '9 Oct',
        condition: 'sunny',
        conditionLabel: 'Sunny',
        highC: 14,
        lowC: 6,
        rainPct: 10,
        windKmh: 12,
      },
      {
        day: 'Sat',
        date: '10 Oct',
        condition: 'partly-cloudy',
        conditionLabel: 'Partly cloudy',
        highC: 13,
        lowC: 5,
        rainPct: 25,
        windKmh: 16,
      },
      {
        day: 'Sun',
        date: '11 Oct',
        condition: 'showers',
        conditionLabel: 'Showers',
        highC: 12,
        lowC: 6,
        rainPct: 55,
        windKmh: 20,
      },
    ],
    packing: [
      { label: 'Rain jacket', reason: '55% chance of showers Sunday' },
      { label: 'Layers for 5–14°C', reason: 'Cool mornings, mild afternoons' },
      { label: 'Waterproof shoes', reason: 'Sunday showers' },
      { label: 'Light sweater', reason: 'Overnight lows near 5°C' },
    ],
  },
  {
    id: 'vancouver',
    name: 'Vancouver',
    region: 'BC',
    score: 90,
    heroReason:
      'Saturday looks the driest and calmest of the three days — 5% chance of rain and light winds.',
    days: [
      {
        day: 'Fri',
        date: '9 Oct',
        condition: 'sunny',
        conditionLabel: 'Sunny',
        highC: 17,
        lowC: 10,
        rainPct: 10,
        windKmh: 10,
      },
      {
        day: 'Sat',
        date: '10 Oct',
        condition: 'mostly-sunny',
        conditionLabel: 'Mostly sunny',
        highC: 18,
        lowC: 11,
        rainPct: 5,
        windKmh: 8,
      },
      {
        day: 'Sun',
        date: '11 Oct',
        condition: 'partly-cloudy',
        conditionLabel: 'Partly cloudy',
        highC: 16,
        lowC: 10,
        rainPct: 20,
        windKmh: 12,
      },
    ],
    packing: [
      { label: 'Light rain jacket', reason: '20% chance of showers Sunday' },
      { label: 'Layers for 10–18°C', reason: 'Cool mornings, mild afternoons' },
      { label: 'Comfortable walking shoes', reason: 'Seawall and trails' },
      { label: 'Sunglasses', reason: 'Clear skies Fri–Sat' },
      { label: 'Refillable water bottle' },
    ],
  },
];

/** Lowest rain chance, then lower wind, then earliest day. */
export function clearestDayIndex(destination: Destination): 0 | 1 | 2 {
  let best = 0;
  for (let index = 1; index < destination.days.length; index += 1) {
    const current = destination.days[index];
    const leading = destination.days[best];
    if (current.rainPct < leading.rainPct) {
      best = index;
    } else if (current.rainPct === leading.rainPct && current.windKmh < leading.windKmh) {
      best = index;
    }
  }
  return best as 0 | 1 | 2;
}

/** Highest score wins; equal scores break alphabetically by name. */
export function recommendedDestination(list: readonly Destination[]): Destination | undefined {
  if (list.length === 0) return undefined;
  return [...list].reduce((best, city) => {
    if (city.score > best.score) return city;
    if (city.score === best.score && city.name.localeCompare(best.name) < 0) return city;
    return best;
  });
}

export function scoreTone(score: number): 'good' | 'fair' | 'poor' {
  if (score >= 80) return 'good';
  if (score >= 60) return 'fair';
  return 'poor';
}
