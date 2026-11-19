// -----------------------------------------------------------------------------
// Every text the integration shows, in the four languages of the Gladys
// interface (en, fr, de, es). German says "du", Spanish says "usted", like the
// rest of guim31's integrations. Brands (IESO) stay as is.
//
//   - NAMES    : device and feature names, written once in the language of
//                the configuration (Gladys freezes them when a device is added);
//   - TEXT     : the fixed texts (widget, configuration screen, actions);
//   - MESSAGES : the texts built from a value, numbers in the local format.
//
// test/i18n.test.js checks that every entry carries exactly the four
// languages, with no empty text and no polite German.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

export { LANGUAGES };

/** Device and feature names, by language then key. */
export const NAMES = {
  en: {
    grid: 'Ontario power grid',
    demand: 'Ontario demand',
    price: 'Ontario price ($/MWh CAD)',
    carbon_intensity: 'CO₂ intensity (estimated)',
    low_carbon_share: 'Low-carbon share',
    renewable_share: 'Renewable share',
    nuclear_share: 'Nuclear share',
    hydro_share: 'Hydro share',
    gas_share: 'Natural gas share',
    wind_share: 'Wind share',
    solar_share: 'Solar share',
    biofuel_share: 'Biofuel share',
    other_share: 'Other sources share',
    summary: 'Summary',
  },
  fr: {
    grid: "Réseau électrique de l'Ontario",
    demand: "Demande de l'Ontario",
    price: "Prix de l'Ontario ($/MWh CAD)",
    carbon_intensity: 'Taux de CO₂ (estimé)',
    low_carbon_share: 'Part bas carbone',
    renewable_share: 'Part renouvelable',
    nuclear_share: 'Part du nucléaire',
    hydro_share: "Part de l'hydraulique",
    gas_share: 'Part du gaz naturel',
    wind_share: "Part de l'éolien",
    solar_share: 'Part du solaire',
    biofuel_share: 'Part des biocombustibles',
    other_share: 'Part des autres sources',
    summary: 'Résumé',
  },
  de: {
    grid: 'Stromnetz Ontario',
    demand: 'Verbrauch Ontario',
    price: 'Strompreis Ontario ($/MWh CAD)',
    carbon_intensity: 'CO₂-Intensität (geschätzt)',
    low_carbon_share: 'CO₂-armer Anteil',
    renewable_share: 'Erneuerbarer Anteil',
    nuclear_share: 'Anteil Kernkraft',
    hydro_share: 'Anteil Wasserkraft',
    gas_share: 'Anteil Erdgas',
    wind_share: 'Anteil Wind',
    solar_share: 'Anteil Solar',
    biofuel_share: 'Anteil Biobrennstoffe',
    other_share: 'Anteil andere Quellen',
    summary: 'Zusammenfassung',
  },
  es: {
    grid: 'Red eléctrica de Ontario',
    demand: 'Demanda de Ontario',
    price: 'Precio de Ontario ($/MWh CAD)',
    carbon_intensity: 'Intensidad de CO₂ (estimada)',
    low_carbon_share: 'Proporción baja en carbono',
    renewable_share: 'Proporción renovable',
    nuclear_share: 'Proporción nuclear',
    hydro_share: 'Proporción hidráulica',
    gas_share: 'Proporción de gas natural',
    wind_share: 'Proporción eólica',
    solar_share: 'Proporción solar',
    biofuel_share: 'Proporción de biocombustibles',
    other_share: 'Proporción de otras fuentes',
    summary: 'Resumen',
  },
};

/** Fixed texts, by key then language. */
export const TEXT = {
  price: { en: 'Price', fr: 'Prix', de: 'Preis', es: 'Precio' },
  lowCarbon: { en: 'Low-carbon', fr: 'Bas carbone', de: 'CO₂-arm', es: 'Bajo en carbono' },
  co2: { en: 'CO₂ (estimated)', fr: 'CO₂ (estimé)', de: 'CO₂ (geschätzt)', es: 'CO₂ (estimado)' },
  demand: { en: 'Demand', fr: 'Demande', de: 'Verbrauch', es: 'Demanda' },
  nuclear: { en: 'Nuclear', fr: 'Nucléaire', de: 'Kernkraft', es: 'Nuclear' },
  hydro: { en: 'Hydro', fr: 'Hydraulique', de: 'Wasserkraft', es: 'Hidráulica' },
  gas: { en: 'Natural gas', fr: 'Gaz naturel', de: 'Erdgas', es: 'Gas natural' },
  wind: { en: 'Wind', fr: 'Éolien', de: 'Wind', es: 'Eólica' },
  solar: { en: 'Solar', fr: 'Solaire', de: 'Solar', es: 'Solar' },
  biofuel: { en: 'Biofuel', fr: 'Biocombustibles', de: 'Biobrennstoffe', es: 'Biocombustibles' },
  other: { en: 'Other', fr: 'Autres', de: 'Andere', es: 'Otras' },
  priceChart: {
    en: 'Price, last 24 h',
    fr: 'Prix sur 24 h',
    de: 'Preis, letzte 24 h',
    es: 'Precio, últimas 24 h',
  },
  waiting: {
    en: 'Waiting for the first IESO figures.',
    fr: "En attente des premiers chiffres de l'IESO.",
    de: 'Warte auf die ersten Zahlen der IESO.',
    es: 'Esperando las primeras cifras del IESO.',
  },
  unreachable: {
    en: 'The IESO cannot be reached right now: no figure is shown rather than an old one.',
    fr: "L'IESO ne répond pas pour l'instant : aucun chiffre plutôt qu'un chiffre périmé.",
    de: 'Die IESO ist gerade nicht erreichbar: lieber keine Zahl als eine veraltete.',
    es: 'El IESO no responde por ahora: mejor ninguna cifra que una caducada.',
  },
  realtimeDown: {
    en: 'The IESO price or demand report cannot be read. Retrying every five minutes.',
    fr: "Le rapport de prix ou de demande de l'IESO est illisible. Nouvel essai toutes les cinq minutes.",
    de: 'Der Preis- oder Verbrauchsbericht der IESO ist nicht lesbar. Neuer Versuch alle fünf Minuten.',
    es: 'No se puede leer el informe de precio o demanda del IESO. Nuevo intento cada cinco minutos.',
  },
  mixDown: {
    en: 'The IESO generation report cannot be read. Retrying every ten minutes.',
    fr: "Le rapport de production de l'IESO est illisible. Nouvel essai toutes les dix minutes.",
    de: 'Der Erzeugungsbericht der IESO ist nicht lesbar. Neuer Versuch alle zehn Minuten.',
    es: 'No se puede leer el informe de generación del IESO. Nuevo intento cada diez minutos.',
  },
  initFailed: {
    en: 'The integration could not start. See its logs.',
    fr: "L'intégration n'a pas pu démarrer. Voir ses journaux.",
    de: 'Die Integration konnte nicht starten. Sieh in ihre Logs.',
    es: 'La integración no pudo iniciarse. Consulte sus registros.',
  },
};

const locale = (language) => (LANGUAGES.includes(language) ? language : 'en');

/** A number in the format of a language. */
export function formatNumber(value, language, digits = 0) {
  return value.toLocaleString(locale(language), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const each = (build) =>
  Object.fromEntries(LANGUAGES.map((language) => [language, build(language)]));

/** Texts built from values: each returns the four languages. */
export const MESSAGES = {
  /** "Wholesale price, not your rate · 18:25". */
  updatedAt: (time) => ({
    en: `Wholesale price, not your rate · ${time}`,
    fr: `Prix de gros, pas votre tarif · ${time}`,
    de: `Großhandelspreis, nicht dein Tarif · ${time}`,
    es: `Precio mayorista, no su tarifa · ${time}`,
  }),
  /** The summary feature: the figures known, in one sentence. */
  summary: ({ demandMw, lowCarbonPercent, carbonIntensity, price }) =>
    each((language) => {
      const words = {
        en: ['GW demand', 'low-carbon', 'g CO₂/kWh'],
        fr: ['GW de demande', 'bas carbone', 'g CO₂/kWh'],
        de: ['GW Verbrauch', 'CO₂-arm', 'g CO₂/kWh'],
        es: ['GW de demanda', 'bajo en carbono', 'g CO₂/kWh'],
      }[language];
      const parts = [];
      if (Number.isFinite(demandMw)) {
        parts.push(`${formatNumber(demandMw / 1000, language, 1)} ${words[0]}`);
      }
      if (Number.isFinite(lowCarbonPercent)) {
        parts.push(`${formatNumber(lowCarbonPercent, language)} % ${words[1]}`);
      }
      if (Number.isFinite(carbonIntensity)) {
        parts.push(`${formatNumber(carbonIntensity, language)} ${words[2]}`);
      }
      if (Number.isFinite(price)) {
        parts.push(`${formatNumber(price, language, 2)} $/MWh`);
      }
      return parts.join(', ');
    }),
  /** The answer of the test action. */
  testOk: ({ price, time, demandMw, lowCarbonPercent }) =>
    each((language) => {
      const head = {
        en: 'The IESO answers',
        fr: "L'IESO répond",
        de: 'Die IESO antwortet',
        es: 'El IESO responde',
      }[language];
      const demand = Number.isFinite(demandMw)
        ? {
            en: `, demand ${formatNumber(demandMw / 1000, language, 1)} GW`,
            fr: `, demande ${formatNumber(demandMw / 1000, language, 1)} GW`,
            de: `, Verbrauch ${formatNumber(demandMw / 1000, language, 1)} GW`,
            es: `, demanda ${formatNumber(demandMw / 1000, language, 1)} GW`,
          }[language]
        : '';
      const lowCarbon = Number.isFinite(lowCarbonPercent)
        ? {
            en: `, ${formatNumber(lowCarbonPercent, language)} % low-carbon`,
            fr: `, ${formatNumber(lowCarbonPercent, language)} % bas carbone`,
            de: `, ${formatNumber(lowCarbonPercent, language)} % CO₂-arm`,
            es: `, ${formatNumber(lowCarbonPercent, language)} % bajo en carbono`,
          }[language]
        : '';
      const colon = language === 'fr' ? ' :' : ':';
      return `${head}${colon} ${formatNumber(price, language, 2)} $/MWh (${time})${demand}${lowCarbon}.`;
    }),
};

/** The text of a language, English when missing. */
export function pick(text, language) {
  return text[language] ?? text.en;
}
