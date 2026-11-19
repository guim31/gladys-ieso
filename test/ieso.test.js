// -----------------------------------------------------------------------------
// The IESO reports, parsed from real answers: the price and the demand of the
// latest interval, the mix of the latest hour, Eastern Standard Time all year
// (the clock-change day has 24 hours), the day before read just after
// midnight, and the failures (missing file, network down, empty report).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GENERATORS_URL,
  PRICE_URL,
  fetchMix,
  fetchPrice,
  generatorsUrlOf,
  marketDay,
  marketTime,
  parseDemand,
  parseGenerators,
  parsePrice,
} from '../src/ieso.js';
import { USER_AGENT } from '../src/http.js';
import {
  DEMAND_MW,
  EMPTY_GENERATORS_XML,
  EMPTY_PRICE_XML,
  GENERATORS_DST_XML,
  GENERATORS_XML,
  MIX_AT,
  PRICE,
  PRICE_AT,
  PRICE_XML,
  START,
  TOTALS_XML,
  createFakeIeso,
  withPrice,
  xml,
} from './helpers/world.js';

test('market time is Eastern Standard Time, hour ending', () => {
  // Hour 17 of 19 November: 16:00 EST, 21:00 UTC.
  assert.equal(new Date(marketTime('2026-11-19', 17)).toISOString(), '2026-11-19T21:00:00.000Z');
  // In July too (no daylight saving on the market): 16:00 EST is 21:00 UTC.
  assert.equal(new Date(marketTime('2026-07-15', 17)).toISOString(), '2026-07-15T21:00:00.000Z');
  assert.equal(marketDay(Date.UTC(2026, 10, 20, 4, 59)), '20261119');
  assert.equal(marketDay(Date.UTC(2026, 10, 20, 5, 0)), '20261120');
});

test('the price of the latest interval', () => {
  assert.deepEqual(parsePrice(PRICE_XML, START), { at: PRICE_AT, price: PRICE });
  // An interval published just before it starts is taken.
  assert.deepEqual(parsePrice(withPrice(-4.2), START), {
    at: '2026-11-19T21:25:00.000Z',
    price: -4.2,
  });
  // Far ahead of now (a wrong clock): not taken.
  assert.equal(parsePrice(withPrice(99, { interval: 12 }), START).price, PRICE);
});

test('the demand of the latest interval, not the market totals', () => {
  assert.deepEqual(parseDemand(TOTALS_XML, START), { at: PRICE_AT, demandMw: DEMAND_MW });
});

test('a report with no interval yet, or not a report, is an error', () => {
  assert.throws(() => parsePrice(EMPTY_PRICE_XML, START), /no interval published yet/);
  assert.throws(() => parsePrice('<html>Maintenance</html>', START), /no delivery date/);
});

test('the mix of the latest hour, from the generators by fuel type', () => {
  const mix = parseGenerators(GENERATORS_XML);
  assert.equal(mix.at, MIX_AT);
  assert.equal(mix.hour, 16);
  assert.equal(mix.totalMw, 2689);
  assert.deepEqual(mix.mw, {
    nuclear: 1525,
    hydro: 144,
    gas: 676,
    wind: 281,
    solar: 54,
    biofuel: 0,
    other: 9,
  });
  assert.equal(Math.round(mix.lowCarbonPercent), 75);
  assert.equal(Math.round(mix.renewablePercent), 18);
  assert.equal(Math.round(mix.carbonIntensity), 136);
  const total = Object.values(mix.sharesPercent).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 100) < 1e-9);
});

test('the clock-change day: 24 hours, the last one ends at 05:00 UTC', () => {
  const mix = parseGenerators(GENERATORS_DST_XML);
  assert.equal(mix.hour, 24);
  assert.equal(mix.at, '2026-11-02T05:00:00.000Z');
});

test('an hour reported by few units yet is skipped for the one before', () => {
  // Hour 17 appears for a single generator: the file is being completed.
  const partial = GENERATORS_XML.replace(
    '<Hour>16</Hour>\n<EnergyMW>',
    '<Hour>17</Hour>\n<EnergyMW>9999</EnergyMW>\n</Output>\n<Output>\n<Hour>16</Hour>\n<EnergyMW>',
  );
  assert.equal(parseGenerators(partial).hour, 16);
  assert.equal(parseGenerators(EMPTY_GENERATORS_XML), null);
  // Just after midnight, hour 1 reported by a single unit: no hour yet.
  const firstUnit = EMPTY_GENERATORS_XML.replace(
    '<Outputs>\n</Outputs>',
    '<Outputs>\n<Output>\n<Hour>1</Hour>\n<EnergyMW>900</EnergyMW>\n</Output>\n</Outputs>',
  );
  assert.equal(parseGenerators(firstUnit), null);
});

test('just after midnight, the generators of the day before are read', async () => {
  const ieso = createFakeIeso();
  ieso.generators = () => xml(200, EMPTY_GENERATORS_XML);
  ieso.generatorsOf = (day) => (day === '20261119' ? xml(200, GENERATORS_XML) : xml(404, ''));
  const mix = await fetchMix(ieso.fetch);
  assert.equal(mix.at, MIX_AT);
  assert.deepEqual(
    ieso.calls.map((c) => c.url),
    [GENERATORS_URL, generatorsUrlOf('20261119')],
  );
});

test('the file of the day before missing: a clear error', async () => {
  const ieso = createFakeIeso();
  ieso.generators = () => xml(200, EMPTY_GENERATORS_XML);
  await assert.rejects(fetchMix(ieso.fetch), /IESO generation answered HTTP 404/);
});

test('network down or HTTP error: errors that say what failed', async () => {
  const ieso = createFakeIeso();
  ieso.price = () => xml(503, 'Service Unavailable');
  await assert.rejects(fetchPrice(ieso.fetch, START), /IESO prices answered HTTP 503/);
  const down = async () => {
    throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
  };
  await assert.rejects(fetchPrice(down, START), /IESO prices unreachable \(ECONNREFUSED\)/);
});

test('requests name the integration and read only the current files', async () => {
  const ieso = createFakeIeso();
  await fetchPrice(ieso.fetch, START);
  assert.equal(ieso.calls[0].url, PRICE_URL);
  assert.equal(ieso.calls[0].headers['user-agent'], USER_AGENT);
  assert.ok(!ieso.calls[0].url.endsWith('/'));
});
