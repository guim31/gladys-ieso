// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake IESO (the three public
// reports, real answers recorded on 2026-11-19, behind one fake `fetch`), a
// temporary /data and a manual clock, with the integration wired on top
// through registerHandlers. No timer runs unless `timers: true` (with
// node:test mock timers): the tests call `app.tick()`. No test touches the
// network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';
import { GENERATORS_URL, PRICE_URL, TOTALS_URL, generatorsUrlOf } from '../../src/ieso.js';
import { gridIds } from '../../src/devices.js';

// The integration logs its lifecycle; keep the test output readable.
process.env.LOG_LEVEL ??= 'silent';

export const fixture = (name) =>
  readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

/**
 * Real IESO answers of 2026-11-19, hour ending 17 (16:00–17:00 EST): the price
 * and the totals up to interval 5, the generators (27 of them, a few of each
 * fuel type, trimmed from the 188 of the report) up to hour 16.
 */
export const PRICE_XML = fixture('ieso-price.xml');
export const TOTALS_XML = fixture('ieso-totals.xml');
export const GENERATORS_XML = fixture('ieso-generators.xml');
/** The day of the fall clock change (1 November 2026): still 24 hours. */
export const GENERATORS_DST_XML = fixture('ieso-generators-20261101.xml');

/** 2026-11-19 16:23 EST: three minutes after the start of interval 5. */
export const START = Date.UTC(2026, 10, 19, 21, 23, 0);
export const PRICE_AT = '2026-11-19T21:20:00.000Z';
export const PRICE = 43.83;
export const DEMAND_MW = 17253.3;
/** The end of hour 16 (15:00–16:00 EST). */
export const MIX_AT = '2026-11-19T21:00:00.000Z';

export const xml = (status, body) =>
  new Response(body, { status, headers: { 'content-type': 'text/xml' } });

/**
 * The price report with a new latest interval: interval 6 (16:25 EST) filled
 * with `price`, or interval `interval` of `hour`.
 */
export function withPrice(price, { interval = 6, hour = 17 } = {}) {
  return PRICE_XML.replace(
    '<DeliveryHour>17</DeliveryHour>',
    `<DeliveryHour>${hour}</DeliveryHour>`,
  )
    .replace(
      new RegExp(`(<Interval>${interval}</Interval>\\s*<Flag)/>\\s*<LmpCap/>`),
      `$1>DSO-RD</Flag>\n<LmpCap>${price}</LmpCap>`,
    )
    .replace(
      new RegExp(`(<Interval>${interval}</Interval>\\s*<Flag>[^<]*</Flag>\\s*<LmpCap>)[^<]*<`),
      `$1${price}<`,
    );
}

/** A report of a new hour with no interval published yet. */
export const EMPTY_PRICE_XML = PRICE_XML.replace(/<LmpCap>[^<]*<\/LmpCap>/g, '<LmpCap/>');

/** The generator report just after midnight: the new day, no hour yet. */
export const EMPTY_GENERATORS_XML = GENERATORS_XML.replace(
  '<Date>2026-11-19</Date>',
  '<Date>2026-11-20</Date>',
).replace(/<Outputs>[\s\S]*?<\/Outputs>/g, '<Outputs>\n</Outputs>');

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * A fake IESO. Its answers can be changed between two calls; every call is
 * recorded (url, headers).
 */
export function createFakeIeso() {
  const ieso = {
    calls: [],
    price: () => xml(200, PRICE_XML),
    totals: () => xml(200, TOTALS_XML),
    generators: () => xml(200, GENERATORS_XML),
    /** The dated generator files: none by default. */
    generatorsOf: () => xml(404, 'Not Found'),
    /** @type {typeof fetch} */
    fetch: async (url, init = {}) => {
      const request = { url: String(url), headers: init.headers ?? {} };
      ieso.calls.push(request);
      if (request.url === PRICE_URL) {
        return ieso.price();
      }
      if (request.url === TOTALS_URL) {
        return ieso.totals();
      }
      if (request.url === GENERATORS_URL) {
        return ieso.generators();
      }
      const day = request.url.match(/_(\d{8})\.xml$/);
      if (day && request.url === generatorsUrlOf(day[1])) {
        return ieso.generatorsOf(day[1]);
      }
      throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
    },
    count: (kind) =>
      ieso.calls.filter((c) =>
        kind === 'price'
          ? c.url === PRICE_URL
          : kind === 'totals'
            ? c.url === TOTALS_URL
            : c.url.includes('GenOutputCapability'),
      ).length,
  };
  return ieso;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers]
 */
export async function createWorld({
  clock = createClock(),
  ieso = createFakeIeso(),
  config = { language: 'fr' },
  devices = [],
  connect = true,
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-ieso-')),
  timers = false,
} = {}) {
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, {
    fetch: ieso.fetch,
    store: new Store(dataDir),
    now: clock.now,
    timers,
  });
  if (connect) {
    await gladys.connect();
  }
  return { gladys, fake: gladys.fake, ieso, app, clock, dataDir };
}

export const gridId = (gladys) => gridIds(gladys);

/** Add every discovered device in Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.fake.discoveredDevices) {
    await world.fake.deviceCreated(device);
  }
}

/** The discovered devices of a configuration. */
export async function discoveredDevices(config) {
  const world = await createWorld({ config, connect: true });
  const devices = world.fake.discoveredDevices;
  await world.app.stop();
  return devices;
}
