// -----------------------------------------------------------------------------
// The device and its states: one "Ontario power grid" (platform id "ontario",
// fixed: it must never change).
//
//   currency/decimal + dollar            the Ontario Zonal Price, $/MWh CAD
//                                         (Gladys has no Canadian dollar unit)
//   energy-sensor/power                  the Ontario demand, kW (Gladys has no
//                                         MW unit)
//   grid-carbon-sensor/carbon-intensity  estimated from the fuel mix
//   grid-carbon-sensor/…-percentage      the low-carbon and renewable shares
//   counter-sensor/integer + percent     the share of each IESO fuel type
//                                         (Gladys has no generic percentage
//                                         sensor)
//   text/text                            a one-sentence summary
//
// Shares are of the transmission-connected generation: imports and the
// generators connected to local distribution networks (most rooftop solar)
// are not in the IESO generator report.
//
// The device declares a one-minute poll (the core's onPoll is a fallback of
// the container's own timer, src/app.js): the IESO publishes every five
// minutes.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { FUEL_KEYS } from './ieso.js';
import { MESSAGES, NAMES } from './i18n.js';

export const GRID = 'grid';
const PLATFORM_ID = 'ontario';

/** Feature keys: frozen once published (Gladys keys history and scenes on them). */
export const FEATURES = [
  'price',
  'demand',
  'carbon_intensity',
  'low_carbon_share',
  'renewable_share',
  ...FUEL_KEYS.map((key) => `${key}_share`),
  'summary',
];

/** A price or demand older than this is not published: better no value than a stale one. */
export const REALTIME_MAX_AGE_MS = 30 * 60 * 1000;
/** The mix is published about a quarter of an hour after each hour. */
export const MIX_MAX_AGE_MS = 3 * 60 * 60 * 1000;

/** Ontario's record demand is about 27 GW: display bound, in kW. */
const DEMAND_MAX_KW = 30_000_000;
/** The IESO price cap is $2,000/MWh; prices go negative too: symmetric bounds. */
const PRICE_BOUND = 2000;

export const gridIds = (gladys) => gladys.externalIds(GRID, PLATFORM_ID);

const base = { read_only: true, has_feedback: false, keep_history: true };

function feature(ids, key, name, definition) {
  return { ...base, ...definition, name, external_id: ids.feature(key) };
}

/**
 * The discovery payload: the grid device.
 * @param {object} gladys
 * @param {ReturnType<import('./config.js').normalizeConfig>} config
 */
export function buildDevices(gladys, config) {
  const names = NAMES[config.language] ?? NAMES.fr;
  const ids = gridIds(gladys);
  const percent = (key, category, type) =>
    feature(ids, key, names[key], {
      category,
      type,
      unit: DEVICE_FEATURE_UNITS.PERCENT,
      min: 0,
      max: 100,
    });
  return [
    {
      name: names.grid,
      external_id: ids.device,
      should_poll: true,
      poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
      features: [
        feature(ids, 'price', names.price, {
          category: DEVICE_FEATURE_CATEGORIES.CURRENCY,
          type: DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL,
          unit: DEVICE_FEATURE_UNITS.DOLLAR,
          min: -PRICE_BOUND,
          max: PRICE_BOUND,
        }),
        feature(ids, 'demand', names.demand, {
          category: DEVICE_FEATURE_CATEGORIES.ENERGY_SENSOR,
          type: DEVICE_FEATURE_TYPES.ENERGY_SENSOR.POWER,
          unit: DEVICE_FEATURE_UNITS.KILOWATT,
          min: 0,
          max: DEMAND_MAX_KW,
        }),
        feature(ids, 'carbon_intensity', names.carbon_intensity, {
          category: DEVICE_FEATURE_CATEGORIES.GRID_CARBON_SENSOR,
          type: DEVICE_FEATURE_TYPES.GRID_CARBON_SENSOR.CARBON_INTENSITY,
          unit: DEVICE_FEATURE_UNITS.GRAM_CO2_EQ_PER_KILOWATT_HOUR,
          min: 0,
          max: 1000,
        }),
        percent(
          'low_carbon_share',
          DEVICE_FEATURE_CATEGORIES.GRID_CARBON_SENSOR,
          DEVICE_FEATURE_TYPES.GRID_CARBON_SENSOR.CARBON_FREE_PERCENTAGE,
        ),
        percent(
          'renewable_share',
          DEVICE_FEATURE_CATEGORIES.GRID_CARBON_SENSOR,
          DEVICE_FEATURE_TYPES.GRID_CARBON_SENSOR.RENEWABLE_PERCENTAGE,
        ),
        ...FUEL_KEYS.map((key) =>
          percent(
            `${key}_share`,
            DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
            DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
          ),
        ),
        // A sentence: no history (it changes every five minutes).
        feature(ids, 'summary', names.summary, {
          category: DEVICE_FEATURE_CATEGORIES.TEXT,
          type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
          keep_history: false,
          min: 0,
          max: 0,
        }),
      ],
    },
  ];
}

/** The data if fresh enough, else null. */
export const fresh = (data, maxAge, now) =>
  data && now - Date.parse(data.at) <= maxAge ? data : null;

/**
 * The states of the grid device; a figure whose source is stale is left out.
 * @param {object} gladys
 * @param {{ price, demand, mix }} data as read
 * @param {ReturnType<import('./config.js').normalizeConfig>} config
 * @param {number} now
 */
export function gridStates(gladys, { price, demand, mix }, config, now) {
  const ids = gridIds(gladys);
  const state = (key, value) => ({ device_feature_external_id: ids.feature(key), state: value });
  const states = [];
  const freshPrice = fresh(price, REALTIME_MAX_AGE_MS, now);
  const freshDemand = fresh(demand, REALTIME_MAX_AGE_MS, now);
  const freshMix = fresh(mix, MIX_MAX_AGE_MS, now);
  if (freshPrice) {
    states.push(state('price', freshPrice.price));
  }
  if (freshDemand) {
    states.push(state('demand', Math.round(freshDemand.demandMw * 1000)));
  }
  if (freshMix) {
    states.push(
      state('carbon_intensity', Math.round(freshMix.carbonIntensity)),
      state('low_carbon_share', Math.round(freshMix.lowCarbonPercent)),
      state('renewable_share', Math.round(freshMix.renewablePercent)),
      ...FUEL_KEYS.map((key) => state(`${key}_share`, Math.round(freshMix.sharesPercent[key]))),
    );
  }
  const text = MESSAGES.summary({
    demandMw: freshDemand?.demandMw,
    lowCarbonPercent: freshMix?.lowCarbonPercent,
    carbonIntensity: freshMix?.carbonIntensity,
    price: freshPrice?.price,
  })[config.language];
  if (text) {
    states.push({ device_feature_external_id: ids.feature('summary'), text });
  }
  return states;
}
