// -----------------------------------------------------------------------------
// The "Ontario power grid" dashboard widget: the real-time price, the
// low-carbon share, the estimated CO₂ intensity and the demand as tiles, a
// 24-hour price chart from the history Gladys keeps (once the device is
// added), and the mix as bars, one row per fuel type.
//
// The core vocabulary has no bar list: each row of the `status` component
// carries a ten-cell text bar ("███████░░░ 68 %"). Budget (core): 8
// components, 2 texts — this content uses at most 4 tiles, 1 chart, 1 status
// and 1 caption, in the order of importance (the core drops from the end).
// The chart and the mix each have a setting to hide them.
// (From guim31/gladys-us-grid.)
// -----------------------------------------------------------------------------

import {
  WIDGET_COLORS,
  WIDGET_CHART_INTERVALS,
  WIDGET_CHART_TYPES,
} from '@gladysassistant/integration-sdk';
import { FUELS } from './ieso.js';
import { MESSAGES, TEXT, formatNumber, pick } from './i18n.js';

export const WIDGET_KEY = 'grid';

/** The content is cached by the core: refetched every 5 minutes at most. */
export const WIDGET_TTL_SECONDS = 300;

/** Same thresholds as the Gladys badge of the grid carbon category. */
export function co2Color(co2) {
  if (co2 < 150) {
    return WIDGET_COLORS.SUCCESS;
  }
  return co2 < 400 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.DANGER;
}

/** Green when negative or under the low threshold, red over the high one. */
export function priceColor(price, config) {
  if (price < 0 || (config.price_low !== null && price < config.price_low)) {
    return WIDGET_COLORS.SUCCESS;
  }
  if (config.price_high !== null && price > config.price_high) {
    return WIDGET_COLORS.DANGER;
  }
  return undefined;
}

/** "███████░░░" for 68 %. */
export function bar(percent) {
  const cells = Math.max(0, Math.min(10, Math.round(Math.abs(percent) / 10)));
  return '█'.repeat(cells) + '░'.repeat(10 - cells);
}

/** The widget settings, normalized: blocks shown unless switched off. */
export function normalizeSettings(settings = {}) {
  return {
    showChart: settings.show_chart !== false,
    showMix: settings.show_mix !== false,
  };
}

/**
 * Build the widget content.
 * @param {object} options
 * @param {{ at: string, price: number } | null} options.price fresh enough to show
 * @param {{ at: string, demandMw: number } | null} options.demand fresh enough to show
 * @param {ReturnType<import('./ieso.js').parseGenerators> | null} options.mix fresh enough to show
 * @param {ReturnType<typeof normalizeSettings>} options.settings
 * @param {ReturnType<import('./config.js').normalizeConfig>} options.config
 * @param {string | null} options.priceFeature the price feature, once the device exists
 * @param {boolean} options.failing the IESO cannot be read right now
 * @param {string} options.language
 * @param {string} [options.timeZone] for the time of the figures (Gladys' TZ by default)
 */
export function buildWidgetContent({
  price,
  demand,
  mix,
  settings,
  config,
  priceFeature,
  failing,
  language,
  timeZone,
}) {
  const components = [];
  if (price) {
    const color = priceColor(price.price, config);
    components.push({
      type: 'value',
      label: pick(TEXT.price, language),
      value: Number(price.price.toFixed(2)),
      unit: '$/MWh',
      icon: 'dollar-sign',
      ...(color ? { color } : {}),
    });
  }
  if (mix) {
    components.push(
      {
        type: 'value',
        label: pick(TEXT.lowCarbon, language),
        value: Math.round(mix.lowCarbonPercent),
        unit: '%',
        icon: 'feather',
      },
      {
        type: 'value',
        label: pick(TEXT.co2, language),
        value: Math.round(mix.carbonIntensity),
        unit: 'g/kWh',
        icon: 'cloud',
        color: co2Color(mix.carbonIntensity),
      },
    );
  }
  if (demand) {
    components.push({
      type: 'value',
      label: pick(TEXT.demand, language),
      value: Number((demand.demandMw / 1000).toFixed(1)),
      unit: 'GW',
      icon: 'zap',
    });
  }
  if (settings.showChart && priceFeature) {
    components.push({
      type: 'chart',
      device_features: [priceFeature],
      interval: WIDGET_CHART_INTERVALS.LAST_DAY,
      chart_type: WIDGET_CHART_TYPES.LINE,
      title: pick(TEXT.priceChart, language),
      unit: '$/MWh',
    });
  }
  if (settings.showMix && mix) {
    const rows = Object.values(FUELS)
      .map((fuel) => ({
        label: pick(TEXT[fuel.key], language),
        percent: mix.sharesPercent[fuel.key],
        color: fuel.lowCarbon ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.WARNING,
      }))
      .filter((row) => row.percent >= 0.5);
    rows.sort((a, b) => b.percent - a.percent);
    if (rows.length > 0) {
      components.push({
        type: 'status',
        items: rows.map((row) => ({
          label: row.label,
          value: `${bar(row.percent)} ${formatNumber(row.percent, language)} %`,
          color: row.color,
        })),
      });
    }
  }
  const latest = [price, demand]
    .filter(Boolean)
    .map((data) => Date.parse(data.at))
    .sort((a, b) => b - a)[0];
  if (latest !== undefined) {
    const time = new Date(latest).toLocaleTimeString(language, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      ...(timeZone ? { timeZone } : {}),
    });
    components.push({
      type: 'text',
      variant: 'caption',
      text: pick(MESSAGES.updatedAt(time), language),
    });
  } else if (!mix) {
    components.push({
      type: 'text',
      variant: 'body',
      text: pick(failing ? TEXT.unreachable : TEXT.waiting, language),
    });
  }
  return { ttl_seconds: WIDGET_TTL_SECONDS, components };
}
