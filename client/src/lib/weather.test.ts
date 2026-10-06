import { describe, expect, it } from 'vitest';

import {
  DESTINATIONS,
  WEEKEND_LABEL,
  clearestDayIndex,
  recommendedDestination,
  scoreTone,
  type DayForecast,
  type Destination,
} from './weather';

function day(overrides: Partial<DayForecast> = {}): DayForecast {
  return {
    day: 'Fri',
    date: '9 Oct',
    condition: 'sunny',
    conditionLabel: 'Sunny',
    highC: 15,
    lowC: 8,
    rainPct: 10,
    windKmh: 10,
    ...overrides,
  };
}

function destination(overrides: Partial<Destination> = {}): Destination {
  return {
    id: 'toronto',
    name: 'Toronto',
    region: 'ON',
    score: 50,
    heroReason: 'Friday is the clearest day.',
    days: [
      day({ day: 'Fri', date: '9 Oct' }),
      day({ day: 'Sat', date: '10 Oct' }),
      day({ day: 'Sun', date: '11 Oct' }),
    ],
    packing: [],
    ...overrides,
  };
}

describe('DESTINATIONS sample dataset', () => {
  it('has three cities with three days each and the expected scores', () => {
    expect(DESTINATIONS).toHaveLength(3);
    expect(WEEKEND_LABEL).toBe('Fri 9 – Sun 11 Oct 2026');

    const byId = Object.fromEntries(DESTINATIONS.map((city) => [city.id, city]));
    expect(byId.vancouver.score).toBe(90);
    expect(byId.montreal.score).toBe(68);
    expect(byId.toronto.score).toBe(67);

    for (const city of DESTINATIONS) {
      expect(city.days).toHaveLength(3);
      expect(city.score).toBeGreaterThanOrEqual(0);
      expect(city.score).toBeLessThanOrEqual(100);
      for (const forecast of city.days) {
        expect(forecast.rainPct).toBeGreaterThanOrEqual(0);
        expect(forecast.rainPct).toBeLessThanOrEqual(100);
        expect(forecast.windKmh).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('clearestDayIndex', () => {
  it('picks Saturday for Vancouver and Friday for Montreal and Toronto', () => {
    const byId = Object.fromEntries(DESTINATIONS.map((city) => [city.id, city]));
    expect(clearestDayIndex(byId.vancouver)).toBe(1);
    expect(clearestDayIndex(byId.montreal)).toBe(0);
    expect(clearestDayIndex(byId.toronto)).toBe(0);
  });

  it('breaks a rain tie by lower wind', () => {
    const city = destination({
      days: [
        day({ day: 'Fri', rainPct: 20, windKmh: 18 }),
        day({ day: 'Sat', rainPct: 20, windKmh: 8 }),
        day({ day: 'Sun', rainPct: 40, windKmh: 4 }),
      ],
    });
    expect(clearestDayIndex(city)).toBe(1);
  });

  it('breaks a rain-and-wind tie by earliest day', () => {
    const city = destination({
      days: [
        day({ day: 'Fri', rainPct: 15, windKmh: 10 }),
        day({ day: 'Sat', rainPct: 15, windKmh: 10 }),
        day({ day: 'Sun', rainPct: 15, windKmh: 10 }),
      ],
    });
    expect(clearestDayIndex(city)).toBe(0);
  });
});

describe('recommendedDestination', () => {
  it('picks the highest-scoring city from the sample set', () => {
    expect(recommendedDestination(DESTINATIONS)?.id).toBe('vancouver');
  });

  it('breaks a score tie alphabetically by name', () => {
    const tied = [
      destination({ id: 'toronto', name: 'Toronto', score: 80 }),
      destination({ id: 'montreal', name: 'Montreal', score: 80 }),
    ];
    expect(recommendedDestination(tied)?.name).toBe('Montreal');
  });

  it('returns undefined for an empty list', () => {
    expect(recommendedDestination([])).toBeUndefined();
  });
});

describe('scoreTone', () => {
  it('maps score boundaries to good, fair, and poor', () => {
    expect(scoreTone(100)).toBe('good');
    expect(scoreTone(80)).toBe('good');
    expect(scoreTone(79)).toBe('fair');
    expect(scoreTone(60)).toBe('fair');
    expect(scoreTone(59)).toBe('poor');
    expect(scoreTone(0)).toBe('poor');
  });
});
