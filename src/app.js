// -----------------------------------------------------------------------------
// The integration, wired on a Gladys client (the real one in index.js, the
// SDK's fake Gladys in the tests).
//
// Refresh (the core does not poll external devices reliably, Gladys#3198):
// the container ticks every minute on its own timer. A tick
//   - reads the price and the demand every five minutes (the pace of the
//     market), when the device is added, a price trigger has a threshold, or
//     a dashboard showed the widget in the last hour;
//   - reads the generator report when a new hour is due (about a quarter of
//     an hour after each hour), at most every ten minutes, when the device is
//     added, the low-carbon trigger has a threshold, or the widget was shown;
//   - fires the triggers whose threshold a new reading crossed;
//   - publishes the states that changed, each value sent again at least every
//     6 hours (heartbeat). Nothing is published from a stale or failed read.
// The core's onPoll, called every minute for the device, only runs a tick
// when the timer missed one: it is the fallback.
// (From guim31/gladys-us-grid.)
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import {
  MIX_MAX_AGE_MS,
  REALTIME_MAX_AGE_MS,
  buildDevices,
  fresh,
  gridIds,
  gridStates,
} from './devices.js';
import { MESSAGES, TEXT, pick } from './i18n.js';
import { fetchDemand, fetchMix, fetchPrice } from './ieso.js';
import { createIssueLog } from './issues.js';
import { Store } from './store.js';
import { LOW_CARBON_ABOVE, TRIGGER_KEYS, lowCarbonEvent, priceEvents } from './triggers.js';
import { WIDGET_KEY, buildWidgetContent, normalizeSettings } from './widgets.js';

const logger = createLogger({ name: 'ieso' });

export const TICK_MS = 60 * 1000;
export const PERIOD_MS = 5 * 60 * 1000;
export const HEARTBEAT_MS = 6 * 60 * 60 * 1000;
/** The generator report: at most one read every ten minutes. */
export const MIX_RETRY_MS = 10 * 60 * 1000;
/** A new hour of generation is expected this long after the end of the last one. */
export const MIX_NEXT_MS = 70 * 60 * 1000;
/** A widget shown in the last hour keeps the IESO read without any device. */
const WIDGET_INTEREST_MS = 60 * 60 * 1000;

export const ACTION_KEY = 'test_connection';
export { TRIGGER_KEYS };

/**
 * A failed action: Gladys shows the thrown message in red, in the user's
 * language (an action does not say it: the configured one first).
 */
export class ActionFailure extends Error {
  constructor(text) {
    super(text.en);
    this.message = text;
  }
}

/**
 * @param {object} gladys GladysIntegration, or the SDK's fake Gladys
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {Store} [options.store]
 * @param {() => number} [options.now]
 * @param {boolean} [options.timers] run the minute timer
 */
export function registerHandlers(
  gladys,
  {
    fetch: fetchImpl = globalThis.fetch,
    store = new Store(),
    now = () => Date.now(),
    timers = true,
  } = {},
) {
  let config = normalizeConfig(gladys.config ?? {});
  /** What /data keeps: `{ triggers: { price_above: { threshold, on }, … } }`. */
  let persisted = { triggers: {} };
  let price = null;
  let demand = null;
  let mix = null;
  let realtimeAttemptAt = -Infinity;
  let mixAttemptAt = -Infinity;
  let widgetShownAt = -Infinity;
  let lastTickAt = -Infinity;
  let lastStatus = null;
  let firstRead = true;
  let timer = null;
  let stopped = false;
  let ticking = null;

  const realtimeIssues = createIssueLog(logger.child('realtime'));
  const mixIssues = createIssueLog(logger.child('mix'));
  const gladysIssues = createIssueLog(logger);

  const ready = store.load().then((data) => {
    persisted = {
      triggers: data.triggers && typeof data.triggers === 'object' ? data.triggers : {},
    };
  });

  const isGridCreated = () =>
    (gladys.devices ?? []).some((device) => device.external_id === gridIds(gladys).device);
  const widgetWanted = () => now() - widgetShownAt < WIDGET_INTEREST_MS;
  const wantsRealtime = () =>
    isGridCreated() || config.price_high !== null || config.price_low !== null || widgetWanted();
  const wantsMix = () => isGridCreated() || config.low_carbon_high !== null || widgetWanted();
  const mixDue = () =>
    now() - mixAttemptAt >= MIX_RETRY_MS && (!mix || now() >= Date.parse(mix.at) + MIX_NEXT_MS);

  // --- Reading the IESO -------------------------------------------------------

  /** The price and the demand, read together. */
  async function refreshRealtime() {
    realtimeAttemptAt = now();
    const [priceRead, demandRead] = await Promise.allSettled([
      fetchPrice(fetchImpl, now()),
      fetchDemand(fetchImpl, now()),
    ]);
    // Never replace a reading with an older one.
    if (priceRead.status === 'fulfilled' && !(price && priceRead.value.at < price.at)) {
      const changed = priceRead.value.at !== price?.at;
      price = priceRead.value;
      if (changed) {
        logger.debug(`IESO price ${price.at}: ${price.price} $/MWh`);
      }
      // Every read, not only a new one: a new threshold may already be crossed.
      if (fresh(price, REALTIME_MAX_AGE_MS, now())) {
        await firePriceTriggers(price);
      }
    }
    if (demandRead.status === 'fulfilled' && !(demand && demandRead.value.at < demand.at)) {
      demand = demandRead.value;
      logger.debug(`IESO demand ${demand.at}: ${demand.demandMw} MW`);
    }
    const failure = [priceRead, demandRead].find((read) => read.status === 'rejected');
    if (failure) {
      realtimeIssues.fail('read', `IESO price or demand cannot be read: ${failure.reason.message}`);
      return false;
    }
    realtimeIssues.ok('read', 'IESO price and demand answer again');
    if (firstRead) {
      firstRead = false;
      logger.info(`IESO reachable: price of ${price.at}`);
    }
    return true;
  }

  async function refreshMix() {
    mixAttemptAt = now();
    try {
      const next = await fetchMix(fetchImpl);
      if (!(mix && next.at < mix.at)) {
        if (next.at !== mix?.at) {
          logger.debug(
            `IESO mix ${next.at}: ${Math.round(next.lowCarbonPercent)} % low-carbon, ` +
              `${Math.round(next.carbonIntensity)} g/kWh`,
          );
        }
        mix = next;
      }
      mixIssues.ok('read', 'IESO generation answers again');
      if (fresh(mix, MIX_MAX_AGE_MS, now())) {
        await fireLowCarbonTrigger(mix);
      }
      return true;
    } catch (err) {
      mixIssues.fail('read', `IESO generation cannot be read: ${err.message}`);
      return false;
    }
  }

  // --- Triggers ---------------------------------------------------------------

  // A crossing is remembered even when Gladys refuses the event: it fires once
  // per crossing, never in a loop against a Gladys that is down.
  async function sendEvent(key, data) {
    try {
      await gladys.publishSceneEvent(key, data);
      logger.debug(`Trigger ${key}: ${JSON.stringify(data)}`);
    } catch (err) {
      gladysIssues.fail('scene-event', `Trigger ${key} not sent to Gladys: ${err.message}`);
    }
  }

  async function firePriceTriggers(read) {
    const { state, events } = priceEvents(persisted.triggers, read.price, config);
    saveTriggers(state);
    for (const event of events) {
      await sendEvent(event.key, { price: read.price, threshold: event.threshold });
    }
  }

  async function fireLowCarbonTrigger(read) {
    const { state, fire } = lowCarbonEvent(
      persisted.triggers,
      read.lowCarbonPercent,
      config.low_carbon_high,
    );
    saveTriggers(state);
    if (fire) {
      await sendEvent(LOW_CARBON_ABOVE, {
        low_carbon_share: Math.round(read.lowCarbonPercent),
        renewable_share: Math.round(read.renewablePercent),
        carbon_intensity: Math.round(read.carbonIntensity),
        threshold: config.low_carbon_high,
      });
    }
  }

  /** Written only on change: the price moves every five minutes. */
  function saveTriggers(state) {
    if (JSON.stringify(state) !== JSON.stringify(persisted.triggers)) {
      persisted.triggers = state;
      store.save(persisted);
    }
  }

  // --- States ---------------------------------------------------------------

  async function publishStates() {
    if (!isGridCreated()) {
      return;
    }
    const states = gridStates(gladys, { price, demand, mix }, config, now());
    if (states.length === 0) {
      return;
    }
    try {
      const { count } = await gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
      if (count > 0) {
        logger.debug(`${count} state(s) published`);
      }
      gladysIssues.ok('states', 'States accepted by Gladys again');
    } catch (err) {
      gladysIssues.fail('states', `States not accepted by Gladys: ${err.message}`);
    }
  }

  /** The application status of the Configuration screen, sent on change only. */
  async function reportStatus() {
    let status = { connected: true };
    if (realtimeIssues.isFailing('read')) {
      status = { connected: false, message: TEXT.realtimeDown };
    } else if (mixIssues.isFailing('read')) {
      status = { connected: false, message: TEXT.mixDown };
    }
    const key = JSON.stringify(status);
    if (key === lastStatus) {
      return;
    }
    try {
      // The four languages: the core 5.2+ refuses a plain string.
      await gladys.setConnectionStatus(status.connected, status.message);
      lastStatus = key;
    } catch (err) {
      logger.debug(`Connection status not sent: ${err.message}`);
    }
  }

  // --- The tick ---------------------------------------------------------------

  /**
   * Read what is due, publish what changed. One tick at a time: a second
   * caller waits for the one in progress.
   * @param {object} [options]
   * @param {boolean} [options.force] read everything now
   */
  async function tick({ force = false } = {}) {
    // A forced tick (new configuration) must not reuse a tick started with
    // the previous one: it waits for it, then runs.
    while (force && ticking) {
      await ticking.catch(() => {});
    }
    if (ticking) {
      return ticking;
    }
    ticking = (async () => {
      lastTickAt = now();
      if (gladys.connected === false) {
        logger.debug('Gladys unreachable: tick skipped');
        return;
      }
      let read = false;
      if (force || (wantsRealtime() && now() - realtimeAttemptAt >= PERIOD_MS)) {
        await refreshRealtime();
        read = true;
      }
      if ((force && now() - mixAttemptAt >= MIX_RETRY_MS) || (wantsMix() && mixDue())) {
        await refreshMix();
        read = true;
      }
      await publishStates();
      await reportStatus();
      if (read && widgetWanted()) {
        gladys.requestWidgetRefresh(WIDGET_KEY);
      }
    })().finally(() => {
      ticking = null;
    });
    return ticking;
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    timer = setTimeout(async () => {
      timer = null;
      try {
        await tick();
      } catch (err) {
        logger.error(`Refresh failed (${err.message})`);
      } finally {
        schedule();
      }
    }, TICK_MS);
  }

  /** (Re)start: publish the device, read everything, then every minute. */
  async function start() {
    await ready;
    stopped = false;
    lastStatus = null;
    try {
      await gladys.publishDiscoveredDevices(buildDevices(gladys, config));
    } catch (err) {
      logger.error(`Publishing the device failed: ${err.message}`);
    }
    schedule();
    await tick({ force: true });
  }

  // --- Handlers ---------------------------------------------------------------

  gladys.onScanRequest(async () => {
    await gladys.publishDiscoveredDevices(buildDevices(gladys, config));
  });

  gladys.onPoll(async () => {
    // Fallback of the timer: the core polls every minute, a tick runs only
    // when the timer has not ticked for most of a minute.
    if (now() - lastTickAt < TICK_MS * 0.9) {
      return;
    }
    await tick();
  });

  // The device just added: every state again now (the core dropped the ones
  // it received before the feature existed), and the widget gains its chart.
  const onDeviceAdded = async () => {
    if (
      (!fresh(price, REALTIME_MAX_AGE_MS, now()) || !fresh(demand, REALTIME_MAX_AGE_MS, now())) &&
      now() - realtimeAttemptAt >= 60 * 1000
    ) {
      await refreshRealtime();
    }
    if (!fresh(mix, MIX_MAX_AGE_MS, now()) && now() - mixAttemptAt >= 60 * 1000) {
      await refreshMix();
    }
    await publishStates();
    gladys.requestWidgetRefresh(WIDGET_KEY);
  };
  gladys.onDeviceCreated(onDeviceAdded);
  gladys.onDeviceUpdated(onDeviceAdded);
  gladys.onDeviceDeleted(() => gladys.requestWidgetRefresh(WIDGET_KEY));

  gladys.onAction(ACTION_KEY, async () => {
    logger.info('Action: test the connection to the IESO');
    const [realtimeOk, mixOk] = await Promise.all([refreshRealtime(), refreshMix()]);
    await publishStates();
    await reportStatus();
    if (!realtimeOk) {
      throw new ActionFailure(TEXT.realtimeDown);
    }
    if (!mixOk) {
      throw new ActionFailure(TEXT.mixDown);
    }
    const time = new Date(price.at).toLocaleTimeString(config.language, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const message = MESSAGES.testOk({
      price: price.price,
      time,
      demandMw: demand?.demandMw,
      lowCarbonPercent: mix?.lowCarbonPercent,
    });
    return pick(message, config.language);
  });

  gladys.onWidgetGet(WIDGET_KEY, async ({ settings, language }) => {
    widgetShownAt = now();
    if (
      (!fresh(price, REALTIME_MAX_AGE_MS, now()) || !fresh(demand, REALTIME_MAX_AGE_MS, now())) &&
      now() - realtimeAttemptAt >= PERIOD_MS
    ) {
      await refreshRealtime();
    }
    if (!fresh(mix, MIX_MAX_AGE_MS, now()) && now() - mixAttemptAt >= MIX_RETRY_MS) {
      await refreshMix();
    }
    return buildWidgetContent({
      price: fresh(price, REALTIME_MAX_AGE_MS, now()),
      demand: fresh(demand, REALTIME_MAX_AGE_MS, now()),
      mix: fresh(mix, MIX_MAX_AGE_MS, now()),
      settings: normalizeSettings(settings),
      config,
      priceFeature: isGridCreated() ? gridIds(gladys).feature('price') : null,
      failing: realtimeIssues.isFailing('read') || mixIssues.isFailing('read'),
      language,
    });
  });

  gladys.onConfigUpdated(async (raw) => {
    config = normalizeConfig(raw);
    logger.info('New configuration received');
    await start();
  });

  gladys.on('connected', async () => {
    try {
      config = normalizeConfig(await gladys.getConfig());
      await start();
    } catch (err) {
      logger.error(`Post-connection initialization failed: ${err.message}`);
      await gladys.setConnectionStatus(false, TEXT.initFailed).catch(() => {});
    }
  });

  return {
    ready,
    tick,
    /** For the tests: what the integration holds. */
    get price() {
      return price;
    },
    get demand() {
      return demand;
    },
    get mix() {
      return mix;
    },
    get triggers() {
      return persisted.triggers;
    },
    /** Stop the timer and wait for the last write under /data. */
    async stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
      await ticking?.catch(() => {});
      await store.flush();
    },
  };
}
