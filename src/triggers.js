// -----------------------------------------------------------------------------
// The scene triggers: a value crossing a threshold, once per crossing.
//
// A Gladys scene can already start on a device value, but only once the device
// is added, and it fires again at every reading on the wrong side of a
// threshold the market crosses back and forth every five minutes. These
// triggers fire once when the value crosses, and only re-arm once it has gone
// back past the threshold by a margin (hysteresis):
//
//   price_above       the Ontario price rises above `price_high`
//   price_below       the Ontario price falls below `price_low` (0: negative)
//   low_carbon_above  the low-carbon share rises above `low_carbon_high`
//
// What is "on" is kept under /data with its threshold: a restart does not fire
// again, a new threshold starts afresh (and fires if already crossed).
// (From guim31/gladys-us-grid, one market instead of eleven zones.)
// -----------------------------------------------------------------------------

export const PRICE_ABOVE = 'price_above';
export const PRICE_BELOW = 'price_below';
export const LOW_CARBON_ABOVE = 'low_carbon_above';
export const TRIGGER_KEYS = [PRICE_ABOVE, PRICE_BELOW, LOW_CARBON_ABOVE];

/** Re-arm margins: $/MWh for the price, points for the share. */
export const PRICE_MARGIN = 5;
export const SHARE_MARGIN = 2;

/**
 * One crossing detector.
 * @param {object | undefined} entry the persisted `{ threshold, on }`
 * @param {number} threshold
 * @param {number} value
 * @param {(value: number) => boolean} isOn the value is past the threshold
 * @param {(value: number) => boolean} isOff the value is back past the margin
 * @returns {{ entry: { threshold: number, on: boolean }, fire: boolean }}
 */
export function cross(entry, threshold, value, isOn, isOff) {
  const on = entry && entry.threshold === threshold ? entry.on === true : false;
  if (on) {
    return { entry: { threshold, on: !isOff(value) }, fire: false };
  }
  const fire = isOn(value);
  return { entry: { threshold, on: fire }, fire };
}

/**
 * The events due for a new price, and the new persisted state.
 * @param {object} state persisted `{ price_above, price_below, … }`
 * @param {number} price $/MWh
 * @param {ReturnType<import('./config.js').normalizeConfig>} config
 * @returns {{ state: object, events: Array<{ key: string, threshold: number }> }}
 */
export function priceEvents(state, price, config) {
  const next = { ...state };
  const events = [];
  const rules = [
    [PRICE_ABOVE, config.price_high, (t) => (v) => v > t, (t) => (v) => v <= t - PRICE_MARGIN],
    [PRICE_BELOW, config.price_low, (t) => (v) => v < t, (t) => (v) => v >= t + PRICE_MARGIN],
  ];
  for (const [key, threshold, on, off] of rules) {
    if (threshold === null) {
      delete next[key];
      continue;
    }
    const result = cross(next[key], threshold, price, on(threshold), off(threshold));
    next[key] = result.entry;
    if (result.fire) {
      events.push({ key, threshold });
    }
  }
  return { state: next, events };
}

/**
 * The low-carbon event due for a new mix, and the new persisted state.
 * @param {object} state persisted `{ low_carbon_above }`
 * @param {number} share low-carbon share, %
 * @param {number | null} threshold
 */
export function lowCarbonEvent(state, share, threshold) {
  const next = { ...state };
  if (threshold === null) {
    delete next[LOW_CARBON_ABOVE];
    return { state: next, fire: false };
  }
  const result = cross(
    next[LOW_CARBON_ABOVE],
    threshold,
    share,
    (v) => v > threshold,
    (v) => v <= threshold - SHARE_MARGIN,
  );
  next[LOW_CARBON_ABOVE] = result.entry;
  return { state: next, fire: result.fire };
}
