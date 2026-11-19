// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of
// `gladys-assistant-integration.json`. This module provides the defaults and
// normalizes the received object, so the rest of the code never deals with
// `undefined` or with a value typed by hand with stray spaces.
// -----------------------------------------------------------------------------

/** The languages of the Gladys interface, every text exists in all four. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  // Language of the feature names (frozen when the device is added) and of
  // the texts the container produces where Gladys does not say the user's
  // language (summary, scene events, configuration messages).
  language: 'fr',
  // The thresholds of the triggers, in $/MWh and %. Empty: trigger off.
  price_high: null,
  price_low: null,
  low_carbon_high: null,
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const language = String(raw.language ?? DEFAULT_CONFIG.language);
  const share = toNumber(raw.low_carbon_high);
  return {
    language: LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.language,
    price_high: toNumber(raw.price_high),
    price_low: toNumber(raw.price_low),
    low_carbon_high: share === null ? null : Math.min(100, Math.max(0, share)),
  };
}

/** A number field, possibly typed as text ("12,5"); empty → null. */
export function toNumber(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return null;
  }
  const value = Number(String(raw).trim().replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}
