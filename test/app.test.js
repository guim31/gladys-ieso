// -----------------------------------------------------------------------------
// The integration end to end, against the SDK's fake Gladys and a fake IESO
// serving real answers: the device, its states (never from a stale or failed
// read), the container's own timer, the triggers (once per crossing, kept
// across a restart), the widget and the test action.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { MIX_NEXT_MS, PERIOD_MS, TICK_MS } from '../src/app.js';
import { REALTIME_MAX_AGE_MS } from '../src/devices.js';
import { WIDGET_KEY } from '../src/widgets.js';
import {
  GENERATORS_XML,
  PRICE_XML,
  createAll,
  createClock,
  createFakeIeso,
  createWorld,
  gridId,
  withPrice,
  xml,
} from './helpers/world.js';

const widget = (world, settings = {}, language = 'fr') =>
  world.fake.widgetGet(WIDGET_KEY, { settings, language, units: 'metric' });

/** Five minutes later, a new interval of hour 17 at `price` (interval 6 to 12). */
async function step(world, price) {
  world.clock.advance(PERIOD_MS);
  const minute = new Date(world.clock.now() - 5 * 3_600_000).getUTCMinutes();
  const body = withPrice(price, { interval: Math.floor(minute / 5) + 1 });
  world.ieso.price = () => xml(200, body);
  await world.app.tick();
}

test('discovery: one device, a fixed external id, French names by default', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const devices = world.fake.discoveredDevices;
  assert.equal(devices.length, 1);
  assert.equal(devices[0].name, "Réseau électrique de l'Ontario");
  assert.equal(devices[0].external_id, gridId(world.gladys).device);
  assert.match(devices[0].external_id, /:grid:ontario$/);
});

test('the device added gets every figure at once, in kW and $/MWh', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  // Nothing added yet: nothing published.
  assert.equal(world.fake.states.length, 0);
  await createAll(world);
  const grid = gridId(world.gladys);
  assert.equal(world.fake.lastState(grid.feature('price')), 43.83);
  assert.equal(world.fake.lastState(grid.feature('demand')), 17_253_300);
  assert.equal(world.fake.lastState(grid.feature('carbon_intensity')), 136);
  assert.equal(world.fake.lastState(grid.feature('low_carbon_share')), 75);
  assert.equal(world.fake.lastState(grid.feature('renewable_share')), 18);
  assert.equal(world.fake.lastState(grid.feature('nuclear_share')), 57);
  assert.equal(world.fake.lastState(grid.feature('biofuel_share')), 0);
  assert.equal(
    world.fake.lastState(grid.feature('summary')),
    '17,3 GW de demande, 75 % bas carbone, 136 g CO₂/kWh, 43,83 $/MWh',
  );
  assert.ok(world.fake.widgetRefreshes.includes(WIDGET_KEY));
});

test('only the changes are published, and nothing from a stale or failed read', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const price = gridId(world.gladys).feature('price');
  const count = world.fake.states.length;
  world.clock.advance(PERIOD_MS);
  await world.app.tick();
  assert.equal(world.fake.states.length, count, 'same figures: nothing sent');

  await step(world, -3.5);
  assert.equal(world.fake.lastState(price), -3.5);

  // The IESO down for an hour: the last price stays, no zero is ever sent.
  world.ieso.price = () => xml(503, 'down');
  world.ieso.totals = () => xml(503, 'down');
  world.ieso.generators = () => xml(503, 'down');
  const before = world.fake.states.length;
  for (let i = 0; i < 12; i += 1) {
    world.clock.advance(PERIOD_MS);
    await world.app.tick();
  }
  // Only the summary loses the figures that aged out; no number is sent.
  assert.deepEqual(
    world.fake.states.slice(before).filter((s) => s.text === undefined),
    [],
  );
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.deepEqual(Object.keys(world.fake.connectionStatus.message), ['en', 'fr', 'de', 'es']);

  world.ieso.price = () => xml(200, PRICE_XML);
  world.clock.advance(PERIOD_MS);
  await world.app.tick();
  // The report still says 16:20 EST, more than 30 minutes ago: stale.
  assert.ok(world.clock.now() - Date.parse(world.app.price.at) > REALTIME_MAX_AGE_MS);
  assert.equal(world.fake.lastState(price), -3.5);
  assert.equal(world.fake.connectionStatus.connected, false, 'the demand is still down');
});

test('a new hour with no interval yet keeps the last price', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  world.ieso.price = () => xml(200, PRICE_XML.replace(/<LmpCap>[^<]*<\/LmpCap>/g, '<LmpCap/>'));
  world.clock.advance(PERIOD_MS);
  await world.app.tick();
  assert.equal(world.app.price.price, 43.83);
  assert.equal(world.fake.lastState(gridId(world.gladys).feature('price')), 43.83);
});

test('the container reads the IESO on its own timer, without the core polling', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clock = createClock();
  const world = await createWorld({ clock, timers: true });
  t.after(() => world.app.stop());
  await createAll(world);
  const calls = world.ieso.count('price');
  for (let i = 0; i < 5; i += 1) {
    clock.advance(TICK_MS);
    t.mock.timers.tick(TICK_MS);
    await new Promise((resolve) => setImmediate(resolve));
    await world.app.tick();
  }
  assert.equal(world.ieso.count('price'), calls + 1, 'one read per five minutes');
});

test('the generator report is read once per new hour, not every five minutes', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const calls = world.ieso.count('generators');
  // 16:23 EST, hour 16 ended at 16:00: hour 17 is not due before 17:10.
  for (let i = 0; i < 9; i += 1) {
    world.clock.advance(PERIOD_MS);
    await world.app.tick();
  }
  assert.equal(world.ieso.count('generators'), calls);
  world.clock.advance(Date.parse(world.app.mix.at) + MIX_NEXT_MS - world.clock.now());
  await world.app.tick();
  assert.equal(world.ieso.count('generators'), calls + 1);
  // Still hour 16: retried ten minutes later, not at every tick.
  world.clock.advance(PERIOD_MS);
  await world.app.tick();
  assert.equal(world.ieso.count('generators'), calls + 1);
  world.clock.advance(PERIOD_MS);
  await world.app.tick();
  assert.equal(world.ieso.count('generators'), calls + 2);
});

test('the core poll is only a fallback of the timer', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const calls = world.ieso.count('price');
  await world.fake.poll(world.fake.discoveredDevices[0]);
  assert.equal(world.ieso.count('price'), calls);
  world.clock.advance(PERIOD_MS);
  await world.fake.poll(world.fake.discoveredDevices[0]);
  assert.equal(world.ieso.count('price'), calls + 1);
});

test('nothing added, no threshold, nothing shown: the IESO is not read', async (t) => {
  const world = await createWorld({ config: { language: 'fr' } });
  t.after(() => world.app.stop());
  const calls = world.ieso.calls.length;
  world.clock.advance(PERIOD_MS * 30);
  await world.app.tick();
  assert.equal(world.ieso.calls.length, calls);
});

test('price triggers: once per crossing, re-armed past the margin', async (t) => {
  const world = await createWorld({
    config: { language: 'fr', price_high: 100, price_low: '20' },
  });
  t.after(() => world.app.stop());
  const keys = () => world.fake.sceneEvents.map((e) => e.key);
  assert.deepEqual(keys(), []); // 43.83: between the thresholds
  await step(world, 150);
  await step(world, 98); // not 5 below the threshold yet: still on
  await step(world, 120);
  assert.deepEqual(keys(), ['price_above']);
  assert.deepEqual(world.fake.sceneEvents[0].data, { price: 150, threshold: 100 });
  await step(world, 90); // re-armed
  await step(world, 101);
  assert.deepEqual(keys(), ['price_above', 'price_above']);
  await step(world, -2);
  await step(world, -8);
  assert.deepEqual(keys(), ['price_above', 'price_above', 'price_below']);
  assert.deepEqual(world.fake.sceneEvents[2].data, { price: -2, threshold: 20 });
});

test('a restart does not fire again; a new threshold starts afresh', async (t) => {
  const config = { language: 'fr', price_high: 30 };
  const first = await createWorld({ config });
  await first.app.stop();
  assert.deepEqual(
    first.fake.sceneEvents.map((e) => e.key),
    ['price_above'],
  );
  const again = await createWorld({ config, dataDir: first.dataDir });
  t.after(() => again.app.stop());
  assert.deepEqual(again.fake.sceneEvents, []);
  await again.fake.configUpdated({ ...config, price_high: 31 });
  assert.deepEqual(
    again.fake.sceneEvents.map((e) => e.key),
    ['price_above'],
  );
  // No threshold: the trigger is off and forgotten.
  await again.fake.configUpdated({ language: 'fr' });
  assert.equal(again.app.triggers.price_above, undefined);
});

test('the low-carbon trigger, with its figures', async (t) => {
  const world = await createWorld({ config: { language: 'fr', low_carbon_high: 70 } });
  t.after(() => world.app.stop());
  assert.deepEqual(world.fake.sceneEvents, [
    {
      key: 'low_carbon_above',
      data: { low_carbon_share: 75, renewable_share: 18, carbon_intensity: 136, threshold: 70 },
    },
  ]);
  // The threshold makes the mix read even without any device, but not the price.
  const prices = world.ieso.count('price');
  world.clock.advance(Date.parse(world.app.mix.at) + MIX_NEXT_MS - world.clock.now());
  const mixes = world.ieso.count('generators');
  await world.app.tick();
  assert.equal(world.ieso.count('generators'), mixes + 1);
  assert.equal(world.ieso.count('price'), prices);
  assert.equal(world.fake.sceneEvents.length, 1);
});

test('a new low-carbon threshold is checked at once against the mix already read', async (t) => {
  const world = await createWorld({ config: { language: 'fr' } });
  t.after(() => world.app.stop());
  const mixes = world.ieso.count('generators');
  world.clock.advance(TICK_MS);
  await world.fake.configUpdated({ language: 'fr', low_carbon_high: 70 });
  assert.equal(world.ieso.count('generators'), mixes, 'no new read within ten minutes');
  assert.deepEqual(
    world.fake.sceneEvents.map((e) => e.key),
    ['low_carbon_above'],
  );
});

test('the widget: valid content, hideable blocks, the chart once the device exists', async (t) => {
  const world = await createWorld({ config: { language: 'fr', price_high: 30 } });
  t.after(() => world.app.stop());
  const ack = await widget(world, {}, 'en');
  assert.equal(ack.success, true, ack.error);
  const content = ack.data.content;
  assert.deepEqual(validateWidgetContent(content), []);
  assert.deepEqual(
    content.components.map((c) => c.type),
    ['value', 'value', 'value', 'value', 'status', 'text'],
  );
  assert.equal(content.components[0].value, 43.83);
  assert.equal(content.components[0].color, 'danger');
  assert.equal(content.components[3].value, 17.3);
  assert.equal(content.components[4].items[0].label, 'Nuclear');
  assert.match(content.components[4].items[0].value, /^██████░░░░ 57 %$/);
  assert.match(content.components.at(-1).text, /^Wholesale price, not your rate · \d\d:\d\d$/);

  await createAll(world);
  const withChart = (await widget(world)).data.content;
  assert.deepEqual(validateWidgetContent(withChart), []);
  const chart = withChart.components.find((c) => c.type === 'chart');
  assert.deepEqual(chart.device_features, [gridId(world.gladys).feature('price')]);
  const bare = (await widget(world, { show_chart: false, show_mix: false })).data.content;
  assert.deepEqual(
    bare.components.map((c) => c.type),
    ['value', 'value', 'value', 'value', 'text'],
  );
});

test('the widget says so when the IESO cannot be read', async (t) => {
  const ieso = createFakeIeso();
  ieso.price = () => xml(503, 'down');
  ieso.totals = () => xml(503, 'down');
  ieso.generators = () => xml(503, 'down');
  const world = await createWorld({ ieso });
  t.after(() => world.app.stop());
  const content = (await widget(world, {}, 'de')).data.content;
  assert.deepEqual(validateWidgetContent(content), []);
  assert.deepEqual(content.components, [
    {
      type: 'text',
      variant: 'body',
      text: 'Die IESO ist gerade nicht erreichbar: lieber keine Zahl als eine veraltete.',
    },
  ]);
});

test('the test action answers in the configured language, and fails in red', async (t) => {
  const world = await createWorld({ config: { language: 'es' } });
  t.after(() => world.app.stop());
  const ok = await world.fake.action('test_connection', {});
  assert.equal(ok.success, true, ok.error);
  assert.match(
    ok.data.message ?? ok.data,
    /^El IESO responde: 43,83 \$\/MWh \(\d\d:\d\d\), demanda 17,3 GW, 75 % bajo en carbono\.$/,
  );
  world.ieso.price = () => xml(500, 'oops');
  const failed = await world.fake.action('test_connection', {});
  assert.equal(failed.success, false);
  assert.match(failed.error.fr, /Le rapport de prix ou de demande de l'IESO est illisible/);
  assert.deepEqual(Object.keys(failed.error).sort(), ['de', 'en', 'es', 'fr']);

  world.ieso.price = () => xml(200, PRICE_XML);
  world.ieso.generators = () => xml(404, 'Not Found');
  const noMix = await world.fake.action('test_connection', {});
  assert.equal(noMix.success, false);
  assert.match(noMix.error.fr, /Le rapport de production de l'IESO est illisible/);
  world.ieso.generators = () => xml(200, GENERATORS_XML);
});
