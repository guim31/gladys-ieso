// -----------------------------------------------------------------------------
// The IESO public reports (https://reports-public.ieso.ca/public/), XML without
// a key. Only the current file of each report is read, never the directory
// index (over a megabyte):
//
//   - RealtimeOntarioZonalPrice  the Ontario Zonal Price (OZP, $/MWh CAD) of
//     each five-minute interval of the hour in progress, ~2 KB. Since the
//     Market Renewal of 1 May 2025 it replaces the HOEP;
//   - RealtimeTotals  the Ontario demand of each five-minute interval of the
//     hour in progress, ~5 KB;
//   - GenOutputCapability  the hourly output of every transmission-connected
//     generator of the day, with its fuel type, 0.1 to 1 MB. Published about
//     a quarter of an hour after each hour.
//
// Time: the IESO market runs on Eastern Standard Time all year (UTC−5, no
// daylight saving: the day of the clock change still has 24 hours). Hours are
// "hour ending": hour 1 is 00:00–01:00 EST. Just after midnight, the current
// generator file is the new day with no hour yet: the file of the day before
// (dated name) is read instead.
// -----------------------------------------------------------------------------

import { requestText } from './http.js';

export const BASE_URL = 'https://reports-public.ieso.ca/public';
export const PRICE_URL = `${BASE_URL}/RealtimeOntarioZonalPrice/PUB_RealtimeOntarioZonalPrice.xml`;
export const TOTALS_URL = `${BASE_URL}/RealtimeTotals/PUB_RealtimeTotals.xml`;
export const GENERATORS_URL = `${BASE_URL}/GenOutputCapability/PUB_GenOutputCapability.xml`;
export const generatorsUrlOf = (day) =>
  `${BASE_URL}/GenOutputCapability/PUB_GenOutputCapability_${day}.xml`;

/** Eastern Standard Time, all year. */
const EST_OFFSET_MS = -5 * 3_600_000;
/** The IESO publishes an interval just before it starts: a little ahead of now is fine. */
const AHEAD_TOLERANCE_MS = 10 * 60 * 1000;

/**
 * IESO fuel type → key, with the lifecycle emission factor used for the
 * estimated carbon intensity (g CO₂eq/kWh, IPCC AR5 2014 medians, the
 * defaults of Electricity Maps) and its class. OTHER (a few MW: storage and
 * small units) is counted as unknown.
 */
export const FUELS = {
  NUCLEAR: { key: 'nuclear', factor: 12, renewable: false, lowCarbon: true },
  HYDRO: { key: 'hydro', factor: 24, renewable: true, lowCarbon: true },
  GAS: { key: 'gas', factor: 490, renewable: false, lowCarbon: false },
  WIND: { key: 'wind', factor: 11, renewable: true, lowCarbon: true },
  SOLAR: { key: 'solar', factor: 45, renewable: true, lowCarbon: true },
  BIOFUEL: { key: 'biofuel', factor: 230, renewable: true, lowCarbon: true },
  OTHER: { key: 'other', factor: 700, renewable: false, lowCarbon: false },
};
export const FUEL_KEYS = Object.values(FUELS).map((fuel) => fuel.key);
/** A fuel type the IESO might add one day: counted in "other". */
const UNKNOWN = FUELS.OTHER;

/** The text of the first `<tag>` of an XML fragment, or null (empty or absent). */
export function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return match && match[1].trim() !== '' ? match[1].trim() : null;
}

/** The fragments between `<name>` and `</name>`. */
export function blocks(xml, name) {
  return [...xml.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => m[1]);
}

/**
 * The instant of a market time: "2026-11-19", hour ending 17, minute 20 →
 * 2026-11-19 16:20 EST.
 */
export function marketTime(date, hourEnding, minute = 0) {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day, hourEnding - 1, minute) - EST_OFFSET_MS;
}

/** The market day (EST) of an instant, "20261119". */
export function marketDay(at) {
  return new Date(at + EST_OFFSET_MS).toISOString().slice(0, 10).replaceAll('-', '');
}

const number = (text) => {
  if (text === null) {
    return null;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
};

/** The delivery date and hour of a real-time report; throws when absent. */
function deliveryOf(xml, what) {
  const date = tag(xml, 'DeliveryDate');
  const hour = number(tag(xml, 'DeliveryHour'));
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !(hour >= 1 && hour <= 24)) {
    throw new Error(`${what}: no delivery date or hour`);
  }
  return { date, hour };
}

/**
 * The latest filled interval of a real-time report, not further ahead of now
 * than the IESO publishes.
 * @param {Array<{ interval: number, value: number | null }>} rows
 */
function latestInterval(rows, date, hour, now, what) {
  const filled = rows
    .filter((row) => row.value !== null && row.interval >= 1 && row.interval <= 12)
    .map((row) => ({ ...row, at: marketTime(date, hour, (row.interval - 1) * 5) }))
    .filter((row) => row.at <= now + AHEAD_TOLERANCE_MS)
    .sort((a, b) => b.at - a.at);
  if (filled.length === 0) {
    throw new Error(`${what}: no interval published yet`);
  }
  return filled[0];
}

/**
 * The Ontario Zonal Price of the latest interval.
 * @returns {{ at: string, price: number }}
 */
export function parsePrice(xml, now) {
  const { date, hour } = deliveryOf(xml, 'Price report');
  const rows = blocks(xml, 'ZonalPrice').map((block) => ({
    interval: number(tag(block, 'Interval')),
    value: number(tag(block, 'LmpCap')),
  }));
  const latest = latestInterval(rows, date, hour, now, 'Price report');
  return { at: new Date(latest.at).toISOString(), price: latest.value };
}

/**
 * The Ontario demand of the latest interval, MW.
 * @returns {{ at: string, demandMw: number }}
 */
export function parseDemand(xml, now) {
  const { date, hour } = deliveryOf(xml, 'Totals report');
  const rows = blocks(xml, 'IntervalEnergy').map((block) => {
    const demand = blocks(block, 'MQ').find((mq) => tag(mq, 'MarketQuantity') === 'ONTARIO DEMAND');
    return {
      interval: number(tag(block, 'Interval')),
      value: demand ? number(tag(demand, 'EnergyMW')) : null,
    };
  });
  const latest = latestInterval(rows, date, hour, now, 'Totals report');
  return { at: new Date(latest.at).toISOString(), demandMw: latest.value };
}

/**
 * The generation by fuel of the latest complete hour of a generator report,
 * or null when the day has no hour yet.
 * @returns {null | { at: string, date: string, hour: number, totalMw: number,
 *   mw: Record<string, number>, sharesPercent: Record<string, number>,
 *   lowCarbonPercent: number, renewablePercent: number, carbonIntensity: number }}
 */
export function parseGenerators(xml) {
  const date = tag(xml, 'Date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Generator report: no date');
  }
  /** hour → { reporting: generator count, mw: fuel key → MW } */
  const hours = new Map();
  for (const generator of blocks(xml, 'Generator')) {
    const fuel = FUELS[tag(generator, 'FuelType')] ?? UNKNOWN;
    const outputs = blocks(generator, 'Outputs')[0] ?? '';
    for (const output of blocks(outputs, 'Output')) {
      const hour = number(tag(output, 'Hour'));
      const mw = number(tag(output, 'EnergyMW'));
      if (!(hour >= 1 && hour <= 24) || mw === null) {
        continue;
      }
      const entry = hours.get(hour) ?? { reporting: 0, mw: {} };
      entry.reporting += 1;
      // A unit consuming (negative output) counts as nothing generated.
      entry.mw[fuel.key] = (entry.mw[fuel.key] ?? 0) + Math.max(0, mw);
      hours.set(hour, entry);
    }
  }
  const sorted = [...hours.keys()].sort((a, b) => b - a);
  // The latest hour, unless far fewer units report it than the hour before
  // (a file caught while it is being completed).
  const hour = sorted.find((h, i) => {
    const before = hours.get(sorted[i + 1]);
    return !before || hours.get(h).reporting >= 0.9 * before.reporting;
  });
  if (hour === undefined) {
    return null;
  }
  const mw = Object.fromEntries(FUEL_KEYS.map((key) => [key, hours.get(hour).mw[key] ?? 0]));
  const totalMw = FUEL_KEYS.reduce((sum, key) => sum + mw[key], 0);
  if (totalMw <= 0) {
    return null;
  }
  const byKey = Object.fromEntries(Object.values(FUELS).map((fuel) => [fuel.key, fuel]));
  const share = (filter) =>
    (100 * FUEL_KEYS.filter((key) => filter(byKey[key])).reduce((s, key) => s + mw[key], 0)) /
    totalMw;
  return {
    // The end of the hour: the figures cover the hour before.
    at: new Date(marketTime(date, hour) + 3_600_000).toISOString(),
    date,
    hour,
    totalMw,
    mw,
    sharesPercent: Object.fromEntries(FUEL_KEYS.map((key) => [key, (100 * mw[key]) / totalMw])),
    lowCarbonPercent: share((fuel) => fuel.lowCarbon),
    renewablePercent: share((fuel) => fuel.renewable),
    carbonIntensity: FUEL_KEYS.reduce((s, key) => s + byKey[key].factor * mw[key], 0) / totalMw,
  };
}

/** The current Ontario Zonal Price. */
export async function fetchPrice(fetchImpl, now) {
  return parsePrice(await requestText(fetchImpl, PRICE_URL, 'IESO prices'), now);
}

/** The current Ontario demand. */
export async function fetchDemand(fetchImpl, now) {
  return parseDemand(await requestText(fetchImpl, TOTALS_URL, 'IESO demand'), now);
}

/**
 * The latest hour of generation: the current file, or the day before's when
 * the new day has no hour yet.
 */
export async function fetchMix(fetchImpl) {
  const xml = await requestText(fetchImpl, GENERATORS_URL, 'IESO generation');
  const mix = parseGenerators(xml);
  if (mix) {
    return mix;
  }
  const date = tag(xml, 'Date');
  const before = marketDay(marketTime(date, 1) - 3_600_000);
  const previous = parseGenerators(
    await requestText(fetchImpl, generatorsUrlOf(before), 'IESO generation'),
  );
  if (!previous) {
    throw new Error('IESO generation: no hour published');
  }
  return previous;
}
