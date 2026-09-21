'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerUndertoneTools } = require('../webmcp.js');

function harness() {
  const calls = [];
  const registrations = [];
  const settings = {
    scene: 'tides', theme: 'rose', motion: 40, brightness: 80, eco: false, blackout: false,
    musicSource: 'library', track: 'broken-glimmers', autoMix: false, music: 70,
    beats: true, beatVolume: 14, master: 35, hz: 10, carrier: 220, route: 'speakers',
    rain: 10, ocean: 0, noise: 10, noiseType: 'brown', preset: 'soft'
  };
  const runtime = { playing: false, loading: false, currentTrack: { id: 'broken-glimmers', title: 'Broken Glimmers' }, motionStatus: 'moving' };
  const modelContext = {
    registerTool(definition, options) {
      registrations.push({ definition, options });
    }
  };
  const api = {
    modelContext,
    getState: () => ({ settings: { ...settings }, ...runtime }),
    getOptions: () => ({
      presets: { focus: 'Focus', soft: 'Relaxed focus', relax: 'Relax', ambient: 'Ambient' },
      scenes: { tides: 'Living contours', dunes: 'Silk drift', orbit: 'Energy orbit', rain: 'Wet glass' },
      themes: { rose: 'Rose Dark', noir: 'Noir' },
      tracks: { 'broken-glimmers': 'Broken Glimmers', 'safe-space': 'Safe Space' }
    }),
    change: patch => { calls.push(['change', patch]); Object.assign(settings, patch); },
    setPreset: preset => { calls.push(['preset', preset]); settings.preset = preset; },
    applyMusic: (patch, signal) => {
      calls.push(['music', patch, signal]);
      Object.assign(settings, { musicSource: patch.musicSource || settings.musicSource, track: patch.track || settings.track, autoMix: patch.autoMix ?? settings.autoMix });
      runtime.currentTrack = { id: settings.track, title: settings.track };
    }
  };
  const cleanup = registerUndertoneTools(api);
  return { api, calls, registrations, settings, runtime, cleanup };
}

function tool(h, name) {
  return h.registrations.find(item => item.definition.name === name).definition;
}

test('unsupported browsers keep the normal app path available', () => {
  const result = registerUndertoneTools({ modelContext: null });
  assert.equal(result.supported, false);
  assert.deepEqual(result.tools, []);
  assert.doesNotThrow(() => result());
});

test('registers the compact imperative tool set with strict schemas', () => {
  const h = harness();
  assert.deepEqual(h.registrations.map(item => item.definition.name), [
    'get_undertone_state', 'set_scene', 'set_sound', 'apply_preset', 'select_music'
  ]);
  for (const item of h.registrations) {
    assert(item.definition.name.length <= 30);
    assert.equal(item.definition.inputSchema.additionalProperties, false);
    assert(item.options && item.options.signal);
  }
  assert.equal(tool(h, 'get_undertone_state').annotations.readOnlyHint, true);
  h.cleanup();
});

test('state reads fixed options and mutations stay synchronized', async () => {
  const h = harness();
  const state = await tool(h, 'get_undertone_state').execute({});
  assert.deepEqual(state.settings.scene, 'tides');
  assert.deepEqual(state.options.scenes, ['tides', 'dunes', 'orbit', 'rain']);
  assert.equal(state.options.labels.scenes.orbit, 'Energy orbit');
  await tool(h, 'set_scene').execute({ scene: 'orbit', motion: 15 });
  await tool(h, 'set_sound').execute({ ocean: 35, route: 'headphones' });
  await tool(h, 'apply_preset').execute({ preset: 'focus' });
  assert.deepEqual(h.calls.map(call => call[0]), ['change', 'change', 'preset']);
  const after = await tool(h, 'get_undertone_state').execute({});
  assert.equal(after.settings.scene, 'orbit');
  assert.equal(after.settings.ocean, 35);
  assert.equal(after.settings.preset, 'focus');
  h.cleanup();
});

test('unknown fields, invalid values, and pre-aborted calls are rejected before mutation', () => {
  const h = harness();
  assert.throws(() => tool(h, 'set_scene').execute({ scene: 'orbit', script: 'x' }), /does not accept/);
  assert.throws(() => tool(h, 'set_sound').execute({ ocean: 101 }), /from 0 to 100/);
  assert.throws(() => tool(h, 'apply_preset').execute({ preset: 'made-up' }), /must be one of/);
  const controller = new AbortController(); controller.abort();
  assert.throws(() => tool(h, 'set_sound').execute({ master: 10 }, { signal: controller.signal }), /cancelled/);
  assert.equal(h.calls.length, 0);
  h.cleanup();
});

test('music selection passes cancellation through and returns updated state', async () => {
  const h = harness();
  const controller = new AbortController();
  const result = await tool(h, 'select_music').execute({ track: 'safe-space', source: 'library', autoMix: true }, { signal: controller.signal });
  assert.equal(result.settings.track, 'safe-space');
  assert.equal(result.settings.autoMix, true);
  assert.equal(h.calls[0][0], 'music');
  assert.equal(h.calls[0][1].musicSource, 'library');
  assert.equal('source' in h.calls[0][1], false);
  assert.notEqual(h.calls[0][2], controller.signal);
  assert.equal(h.calls[0][2].aborted, false);
  h.cleanup();
});

test('music selection infers the library and rejects conflicting generated settings', async () => {
  const h = harness();
  await tool(h, 'select_music').execute({ track: 'safe-space' }, {});
  assert.equal(h.calls[0][1].musicSource, 'library');
  assert.throws(() => tool(h, 'select_music').execute({ source: 'generated', track: 'safe-space' }, {}), /cannot be combined/);
  assert.throws(() => tool(h, 'select_music').execute({ source: 'generated', autoMix: true }, {}), /cannot be combined/);
  h.cleanup();
});

test('music selection aborts without reporting success', async () => {
  const h = harness();
  let resolve;
  h.api.applyMusic = (_patch, signal) => new Promise((res, rej) => {
    resolve = () => res();
    signal.addEventListener('abort', () => rej(signal.reason));
  });
  const controller = new AbortController();
  const pending = tool(h, 'select_music').execute({ track: 'safe-space' }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.equal(resolve, undefined);
  h.cleanup();
});

test('music cancellation rejects even when an adapter ignores the signal', async () => {
  const h = harness();
  h.api.applyMusic = () => new Promise(() => {});
  const controller = new AbortController();
  const pending = tool(h, 'select_music').execute({ track: 'safe-space' }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  h.cleanup();
});

test('music selection has an application timeout', async () => {
  const h = harness();
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  global.setTimeout = callback => { callback(); return 1; };
  global.clearTimeout = () => {};
  try {
    await assert.rejects(
      tool(h, 'select_music').execute({ track: 'safe-space' }, {}),
      error => error.name === 'TimeoutError'
    );
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
  assert.equal(h.calls.length, 0);
  h.cleanup();
});

test('cleanup is idempotent and aborts the registration signal', () => {
  const h = harness();
  const signal = h.registrations[0].options.signal;
  assert.equal(signal.aborted, false);
  h.cleanup(); h.cleanup();
  assert.equal(signal.aborted, true);
  const again = registerUndertoneTools(h.api);
  assert.notEqual(again, h.cleanup);
  again();
});

test('a rejected registration is observed and aborts the partial registration', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const h = harness();
    h.cleanup();
    h.api.modelContext.registerTool = () => Promise.reject(new Error('registration unavailable'));
    const cleanup = registerUndertoneTools(h.api);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.registrations.length, 5);
    assert.equal(h.registrations[4].options.signal.aborted, true);
    cleanup();
  } finally {
    console.warn = originalWarn;
  }
});

test('a synchronous registration failure does not escape app startup', () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const h = harness();
    h.cleanup();
    h.api.modelContext.registerTool = () => { throw new Error('registration unavailable'); };
    assert.doesNotThrow(() => registerUndertoneTools(h.api));
  } finally {
    console.warn = originalWarn;
  }
});
