// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACTION_KEY, PERIOD_MS, TRIGGER_KEYS } from '../src/app.js';
import { DEFAULT_CONFIG, LANGUAGES } from '../src/config.js';
import { WIDGET_KEY } from '../src/widgets.js';
import { START, createWorld, withPrice, xml } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const field = (key) => manifest.config_schema.find((f) => f.key === key);

test('identity: name, image, cover, cloud transport, energy category, Canada', () => {
  assert.equal(manifest.name, 'IESO Ontario Grid');
  assert.equal(manifest.type, 'device');
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-ieso:/);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-ieso/main/cover.png',
  );
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.categories, ['energy']);
  assert.deepEqual(manifest.countries, ['CA']);
  // `countries` needs Gladys 5.3.0 (and covers the 5.1.0 of the triggers and widget).
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.equal(manifest.network_discovery, undefined);
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version, 'manifest version must match package.json');
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('three triggers, a widget, an action, no scene action', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers), TRIGGER_KEYS);
  assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
  assert.deepEqual(keysOf(manifest.actions), [ACTION_KEY]);
  // An action applies no `default` and cannot fill a secret (Gladys#3154, #3155).
  assert.equal(manifest.actions[0].fields, undefined);
  assert.equal(manifest.scene_actions, undefined);
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  const valued = manifest.config_schema.filter((f) => f.type !== 'section');
  assert.deepEqual(keysOf(valued).sort(), Object.keys(DEFAULT_CONFIG).sort());
  for (const f of valued) {
    if (f.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[f.key], f.default, f.key);
    }
  }
  assert.deepEqual(
    field('language').options.map((o) => o.value),
    LANGUAGES,
  );
  assert.equal(field('language').default, 'fr');
  // Number fields have no `step`: integer bounds only, no default (empty = off).
  for (const key of ['price_high', 'price_low', 'low_carbon_high']) {
    assert.equal(field(key).type, 'number');
    assert.ok(Number.isInteger(field(key).min) && Number.isInteger(field(key).max));
    assert.equal(field(key).default, undefined);
  }
});

test('the widget settings hide each optional block', () => {
  const settings = manifest.widgets[0].settings;
  assert.deepEqual(keysOf(settings), ['show_chart', 'show_mix']);
  for (const key of ['show_chart', 'show_mix']) {
    assert.equal(settings.find((s) => s.key === key).default, true);
  }
});

test('the configuration says wholesale, and not affiliated with the IESO', () => {
  const intro = field('intro');
  assert.match(intro.description.en, /wholesale, not your electricity rate/);
  assert.match(intro.description.en, /Not affiliated with the IESO/);
  assert.match(intro.description.fr, /Sans lien avec l'IESO/);
  for (const link of intro.links) {
    assert.match(link.url, /^https:\/\//);
  }
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});

test('every trigger sends exactly its declared variables, with their types', async (t) => {
  const world = await createWorld({
    config: { language: 'fr', price_high: 100, price_low: 20, low_carbon_high: 50 },
  });
  t.after(() => world.app.stop());
  world.clock.advance(PERIOD_MS);
  world.ieso.price = () => xml(200, withPrice(150));
  await world.app.tick();
  world.clock.advance(PERIOD_MS);
  world.ieso.price = () => xml(200, withPrice(-1, { interval: 7 }));
  await world.app.tick();
  assert.ok(world.clock.now() > START);
  const sent = new Map(world.fake.sceneEvents.map((e) => [e.key, e.data]));
  assert.deepEqual([...sent.keys()].sort(), [...TRIGGER_KEYS].sort());
  for (const trigger of manifest.scene_triggers) {
    const data = sent.get(trigger.key);
    assert.deepEqual(Object.keys(data).sort(), keysOf(trigger.variables).sort(), trigger.key);
    for (const variable of trigger.variables) {
      assert.equal(typeof data[variable.key], variable.type, `${trigger.key}.${variable.key}`);
    }
    assert.equal(trigger.fields, undefined, 'one market: nothing to filter');
  }
});

test('the action has a handler', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await world.fake.action(ACTION_KEY, {});
  assert.equal(ack.success, true, ack.error);
});
