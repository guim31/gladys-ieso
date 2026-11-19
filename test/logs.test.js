// -----------------------------------------------------------------------------
// Quiet logs: a normal cycle writes nothing at the info level, and a failure
// that lasts writes one line when it starts and one when it ends.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERIOD_MS } from '../src/app.js';
import { createAll, createWorld, xml } from './helpers/world.js';

/** Capture what the loggers write, at a given LOG_LEVEL. */
function captureLogs(t, level) {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  for (const stream of ['log', 'error']) {
    t.mock.method(console, stream, (...args) => lines.push(args.map(String).join(' ')));
  }
  return lines;
}

test('a normal cycle writes nothing at the info level', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 4; i += 1) {
    world.clock.advance(PERIOD_MS);
    await world.app.tick();
    await world.fake.poll(world.fake.discoveredDevices[0]);
    await world.fake.widgetGet('grid', { settings: {}, language: 'fr', units: 'metric' });
  }
  assert.ok(world.ieso.count('price') >= 5 && world.ieso.count('totals') >= 5);
  assert.deepEqual(lines, []);
});

test('a lasting failure: one line when it starts, one when it ends', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const lines = captureLogs(t, 'info');
  const price = world.ieso.price;
  world.ieso.price = () => xml(503, 'down');
  for (let i = 0; i < 5; i += 1) {
    world.clock.advance(PERIOD_MS);
    await world.app.tick();
  }
  assert.equal(lines.length, 1);
  assert.match(
    lines[0],
    /\[WARN\].*IESO price or demand cannot be read: IESO prices answered HTTP 503/,
  );
  world.ieso.price = price;
  world.clock.advance(PERIOD_MS);
  await world.app.tick();
  assert.equal(lines.length, 2);
  assert.match(lines[1], /\[INFO\].*IESO price and demand answer again/);
});
