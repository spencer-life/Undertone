/*
 * Undertone's small WebMCP surface.
 *
 * WebMCP is progressive enhancement: the app remains fully usable when
 * document.modelContext is unavailable. The application adapter is kept
 * deliberately narrow so tools cannot reach arbitrary DOM, URLs, or storage.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.registerUndertoneTools = api.registerUndertoneTools;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const MUSIC_TIMEOUT_MS = 30_000;
  const registrations = typeof WeakMap === 'function' ? new WeakMap() : null;

  const FALLBACK_OPTIONS = Object.freeze({
    presets: ['focus', 'soft', 'relax', 'ambient'],
    scenes: ['tides', 'dunes', 'orbit', 'rain'],
    themes: ['noir', 'slate', 'frost', 'rose', 'ocean', 'moss', 'ember', 'violet', 'mono'],
    tracks: ['broken-glimmers', 'safe-space'],
    sources: ['library', 'generated'],
    routes: ['speakers', 'headphones'],
    noiseTypes: ['brown', 'pink', 'white']
  });

  const STATE_KEYS = [
    'musicSource', 'track', 'autoMix', 'music', 'beats', 'beatVolume', 'master',
    'hz', 'carrier', 'route', 'rain', 'ocean', 'noise', 'noiseType', 'theme',
    'scene', 'motion', 'brightness', 'eco', 'blackout', 'preset'
  ];

  const SCENE_KEYS = ['scene', 'theme', 'motion', 'brightness', 'eco', 'blackout'];
  const SOUND_KEYS = [
    'music', 'beatVolume', 'rain', 'ocean', 'noise', 'master', 'hz', 'carrier',
    'beats', 'route', 'noiseType'
  ];
  const MUSIC_KEYS = ['track', 'source', 'autoMix'];

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function abortError(message) {
    const error = new Error(message || 'The WebMCP action was cancelled.');
    error.name = 'AbortError';
    return error;
  }

  function timeoutError() {
    const error = new Error('Music selection timed out after 30 seconds.');
    error.name = 'TimeoutError';
    return error;
  }

  function signalAborted(signal) {
    return Boolean(signal && signal.aborted);
  }

  function assertObject(input, toolName) {
    if (!isObject(input)) throw new TypeError(`${toolName} expects an object.`);
  }

  function assertKeys(input, keys, toolName) {
    for (const key of Object.keys(input)) {
      if (!keys.includes(key)) throw new TypeError(`${toolName} does not accept “${key}”.`);
    }
  }

  function assertNonEmpty(input, toolName) {
    if (Object.keys(input).length === 0) throw new TypeError(`${toolName} needs at least one setting.`);
  }

  function assertString(value, key, allowed) {
    if (typeof value !== 'string' || !allowed.includes(value)) {
      throw new RangeError(`${key} must be one of: ${allowed.join(', ')}.`);
    }
  }

  function assertNumber(value, key, min, max) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(`${key} must be a number from ${min} to ${max}.`);
    }
  }

  function assertBoolean(value, key) {
    if (typeof value !== 'boolean') throw new TypeError(`${key} must be a boolean.`);
  }

  function valuesFrom(options, names, fallback) {
    if (!isObject(options)) return fallback.slice();
    for (const name of names) {
      const candidate = options[name];
      if (Array.isArray(candidate)) {
        const values = candidate.filter(value => typeof value === 'string' && value.length > 0);
        if (values.length) return [...new Set(values)];
      }
      if (isObject(candidate)) {
        const values = Object.keys(candidate).filter(value => value.length > 0);
        if (values.length) return values;
      }
    }
    return fallback.slice();
  }

  function labelsFrom(options, names, ids) {
    if (isObject(options)) {
      for (const name of names) {
        const candidate = options[name];
        if (isObject(candidate)) {
          const labels = {};
          for (const id of ids) if (typeof candidate[id] === 'string') labels[id] = candidate[id];
          if (Object.keys(labels).length) return labels;
        }
      }
    }
    return Object.fromEntries(ids.map(id => [id, id]));
  }

  function optionCatalog(api) {
    let supplied;
    try { supplied = api.getOptions(); } catch (_) { supplied = null; }
    const catalog = {
      presets: valuesFrom(supplied, ['presets', 'preset'], FALLBACK_OPTIONS.presets),
      scenes: valuesFrom(supplied, ['scenes', 'scene'], FALLBACK_OPTIONS.scenes),
      themes: valuesFrom(supplied, ['themes', 'theme'], FALLBACK_OPTIONS.themes),
      tracks: valuesFrom(supplied, ['tracks', 'track'], FALLBACK_OPTIONS.tracks),
      sources: valuesFrom(supplied, ['sources', 'musicSource', 'source'], FALLBACK_OPTIONS.sources),
      routes: valuesFrom(supplied, ['routes', 'route'], FALLBACK_OPTIONS.routes),
      noiseTypes: valuesFrom(supplied, ['noiseTypes', 'noiseType'], FALLBACK_OPTIONS.noiseTypes)
    };
    catalog.labels = {
      presets: labelsFrom(supplied, ['presets', 'preset'], catalog.presets),
      scenes: labelsFrom(supplied, ['scenes', 'scene'], catalog.scenes),
      themes: labelsFrom(supplied, ['themes', 'theme'], catalog.themes),
      tracks: labelsFrom(supplied, ['tracks', 'track'], catalog.tracks)
    };
    return catalog;
  }

  function pickSettings(raw) {
    const source = isObject(raw) && isObject(raw.settings) ? raw.settings : raw;
    const settings = {};
    if (!isObject(source)) return settings;
    for (const key of STATE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(source, key)) settings[key] = source[key];
    }
    return settings;
  }

  function pickTrack(raw, options) {
    if (!isObject(raw)) return null;
    const track = typeof raw.currentTrack === 'string'
      ? { id: raw.currentTrack }
      : isObject(raw.currentTrack) ? raw.currentTrack : null;
    if (!track || typeof track.id !== 'string' || !options.tracks.includes(track.id)) return null;
    return { id: track.id };
  }

  function snapshot(api, options) {
    const raw = api.getState();
    const source = isObject(raw) ? raw : {};
    const settings = pickSettings(source);
    const motionStatus = typeof source.motionStatus === 'string'
      ? source.motionStatus
      : settings.motion === 0 ? 'still' : 'moving';
    return {
      settings,
      playing: source.playing === true,
      loading: source.loading === true,
      currentTrack: pickTrack(source, options),
      motionStatus,
      options
    };
  }

  function validatePatch(input, schema, toolName, options) {
    assertObject(input, toolName);
    assertKeys(input, Object.keys(schema), toolName);
    assertNonEmpty(input, toolName);
    for (const [key, rule] of Object.entries(schema)) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
      const value = input[key];
      if (rule.type === 'string') assertString(value, key, rule.values(options));
      else if (rule.type === 'number') assertNumber(value, key, rule.min, rule.max);
      else if (rule.type === 'boolean') assertBoolean(value, key);
    }
    return { ...input };
  }

  function validateGetter(input) {
    const value = input === undefined ? {} : input;
    assertObject(value, 'get_undertone_state');
    assertKeys(value, [], 'get_undertone_state');
    return value;
  }

  function combineSignal(signal, timeoutMs) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timer = null;
    let onAbort = null;
    let rejectTimeout;
    let rejectCancel;
    const deadline = new Promise((_, reject) => { rejectTimeout = reject; });
    const cancellation = new Promise((_, reject) => { rejectCancel = reject; });
    // These promises may be rejected before the operation starts (for example
    // when an already-aborted signal is supplied); keep those branches handled
    // even when the caller never reaches Promise.race.
    deadline.catch(() => {});
    cancellation.catch(() => {});
    if (!controller) return { signal, deadline, cancellation, dispose() {} };
    onAbort = () => {
      controller.abort(signal && signal.reason);
      rejectCancel(abortError());
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
    timer = setTimeout(() => {
      const error = timeoutError();
      controller.abort(error);
      rejectTimeout(error);
    }, timeoutMs);
    return {
      signal: controller.signal,
      deadline,
      cancellation,
      timedOut: () => controller.signal.aborted && controller.signal.reason && controller.signal.reason.name === 'TimeoutError',
      dispose() {
        if (timer !== null) clearTimeout(timer);
        if (signal && onAbort) signal.removeEventListener('abort', onAbort);
      }
    };
  }

  function executeMusic(api, input, options, signal, readState) {
    const patch = validatePatch(input, {
      track: { type: 'string', values: current => current.tracks },
      source: { type: 'string', values: current => current.sources },
      autoMix: { type: 'boolean' }
    }, 'select_music', options);
    if (patch.source === 'generated' && (Object.prototype.hasOwnProperty.call(patch, 'track') || patch.autoMix === true)) {
      throw new RangeError('Generated music cannot be combined with a library track or automatic mixing.');
    }
    if (!Object.prototype.hasOwnProperty.call(patch, 'source') &&
        (Object.prototype.hasOwnProperty.call(patch, 'track') || patch.autoMix === true)) {
      patch.source = 'library';
    }
    if (signalAborted(signal)) return Promise.reject(abortError());
    const combined = combineSignal(signal, MUSIC_TIMEOUT_MS);
    if (signalAborted(combined.signal)) {
      combined.dispose();
      return Promise.reject(combined.timedOut() ? timeoutError() : abortError());
    }
    const applicationPatch = { ...patch };
    if (Object.prototype.hasOwnProperty.call(applicationPatch, 'source')) {
      applicationPatch.musicSource = applicationPatch.source;
      delete applicationPatch.source;
    }
    const operation = Promise.resolve()
      .then(() => {
        if (signalAborted(combined.signal)) {
          throw combined.timedOut() ? timeoutError() : abortError();
        }
        return api.applyMusic(applicationPatch, combined.signal);
      })
      .then(result => {
        if (signalAborted(combined.signal)) {
          throw combined.timedOut() ? timeoutError() : abortError();
        }
        return result || readState();
      })
      .catch(error => {
        if (signalAborted(combined.signal)) {
          if (combined.timedOut()) throw timeoutError();
          throw abortError();
        }
        throw error;
      });
    return Promise.race([operation, combined.deadline, combined.cancellation])
      .finally(() => combined.dispose());
  }

  function registerUndertoneTools(api) {
    const modelContext = api && api.modelContext
      ? api.modelContext
      : typeof document === 'object' ? document.modelContext : null;
    if (!modelContext || typeof modelContext.registerTool !== 'function') {
      const unsupported = function cleanup() {};
      unsupported.supported = false;
      unsupported.tools = [];
      unsupported.cleanup = unsupported;
      return unsupported;
    }
    for (const key of ['getState', 'getOptions', 'change', 'setPreset', 'applyMusic']) {
      if (!api || typeof api[key] !== 'function') throw new TypeError(`Undertone WebMCP adapter needs ${key}().`);
    }
    if (registrations && registrations.has(api)) return registrations.get(api);

    const options = optionCatalog(api);
    const readState = () => snapshot(api, options);
    const sceneSchema = {
      scene: { type: 'string', values: current => current.scenes },
      theme: { type: 'string', values: current => current.themes },
      motion: { type: 'number', min: 0, max: 100 },
      brightness: { type: 'number', min: 10, max: 100 },
      eco: { type: 'boolean' },
      blackout: { type: 'boolean' }
    };
    const soundSchema = {
      music: { type: 'number', min: 0, max: 100 },
      beatVolume: { type: 'number', min: 0, max: 100 },
      rain: { type: 'number', min: 0, max: 100 },
      ocean: { type: 'number', min: 0, max: 100 },
      noise: { type: 'number', min: 0, max: 100 },
      master: { type: 'number', min: 0, max: 100 },
      hz: { type: 'number', min: 1, max: 40 },
      carrier: { type: 'number', min: 80, max: 600 },
      beats: { type: 'boolean' },
      route: { type: 'string', values: current => current.routes },
      noiseType: { type: 'string', values: current => current.noiseTypes }
    };

    const definitions = [
      {
        name: 'get_undertone_state',
        description: 'Read current Undertone settings, playback state, and available fixed options.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, consequentialHint: false },
        execute(input) { validateGetter(input); return readState(); }
      },
      {
        name: 'set_scene',
        description: 'Change Undertone scene, theme, movement, brightness, or display power settings.',
        inputSchema: {
          type: 'object', properties: {
            scene: { type: 'string', enum: options.scenes },
            theme: { type: 'string', enum: options.themes },
            motion: { type: 'number', minimum: 0, maximum: 100 },
            brightness: { type: 'number', minimum: 10, maximum: 100 },
            eco: { type: 'boolean' }, blackout: { type: 'boolean' }
          }, additionalProperties: false
        },
        annotations: { readOnlyHint: false, consequentialHint: false },
        execute(input, context) {
          const patch = validatePatch(input, sceneSchema, 'set_scene', options);
          if (signalAborted(context && context.signal)) throw abortError();
          return Promise.resolve(api.change(patch)).then(() => readState());
        }
      },
      {
        name: 'set_sound',
        description: 'Change Undertone music, beat, texture, frequency, route, or master levels.',
        inputSchema: {
          type: 'object', properties: {
            music: { type: 'number', minimum: 0, maximum: 100 },
            beatVolume: { type: 'number', minimum: 0, maximum: 100 },
            rain: { type: 'number', minimum: 0, maximum: 100 },
            ocean: { type: 'number', minimum: 0, maximum: 100 },
            noise: { type: 'number', minimum: 0, maximum: 100 },
            master: { type: 'number', minimum: 0, maximum: 100 },
            hz: { type: 'number', minimum: 1, maximum: 40 },
            carrier: { type: 'number', minimum: 80, maximum: 600 },
            beats: { type: 'boolean' },
            route: { type: 'string', enum: options.routes },
            noiseType: { type: 'string', enum: options.noiseTypes }
          }, additionalProperties: false
        },
        annotations: { readOnlyHint: false, consequentialHint: false },
        execute(input, context) {
          const patch = validatePatch(input, soundSchema, 'set_sound', options);
          if (signalAborted(context && context.signal)) throw abortError();
          return Promise.resolve(api.change(patch)).then(() => readState());
        }
      },
      {
        name: 'apply_preset',
        description: 'Apply one of Undertone’s fixed listening presets.',
        inputSchema: {
          type: 'object', properties: { preset: { type: 'string', enum: options.presets } },
          required: ['preset'], additionalProperties: false
        },
        annotations: { readOnlyHint: false, consequentialHint: false },
        execute(input, context) {
          assertObject(input, 'apply_preset'); assertKeys(input, ['preset'], 'apply_preset');
          if (typeof input.preset !== 'string') throw new TypeError('preset must be a string.');
          assertString(input.preset, 'preset', options.presets);
          if (signalAborted(context && context.signal)) throw abortError();
          return Promise.resolve(api.setPreset(input.preset)).then(() => readState());
        }
      },
      {
        name: 'select_music',
        description: 'Select a fixed library track or generated music and optional automatic mixing.',
        inputSchema: {
          type: 'object', properties: {
            track: { type: 'string', enum: options.tracks },
            source: { type: 'string', enum: options.sources },
            autoMix: { type: 'boolean' }
          }, additionalProperties: false
        },
        annotations: { readOnlyHint: false, consequentialHint: false },
        execute(input, context) {
          return executeMusic(api, input, options, context && context.signal, readState);
        }
      }
    ];

    const registrationController = typeof AbortController === 'function' ? new AbortController() : null;
    let active = true;
    const registered = [];

    function registerNow() {
      if (!active || registered.length) return;
      const signal = registrationController && registrationController.signal;
      for (const definition of definitions) {
        registered.push(definition.name);
        try {
          const result = modelContext.registerTool(definition, signal ? { signal } : undefined);
          if (result && typeof result.catch === 'function') {
            result.catch(error => {
              if (!active) return;
              removeNow();
              if (typeof console === 'object' && typeof console.warn === 'function') {
                console.warn('Undertone WebMCP registration failed.', error);
              }
            });
          }
        } catch (error) {
          removeNow();
          if (typeof console === 'object' && typeof console.warn === 'function') {
            console.warn('Undertone WebMCP registration failed.', error);
          }
          return;
        }
      }
    }
    function removeNow() {
      if (registrationController && !registrationController.signal.aborted) registrationController.abort();
      registered.length = 0;
    }
    registerNow();
    const handle = function cleanup() {
      if (!active) return;
      active = false;
      removeNow();
      if (registrations) registrations.delete(api);
    };
    handle.supported = true;
    handle.tools = definitions.map(definition => definition.name);
    handle.cleanup = handle;
    if (registrations) registrations.set(api, handle);
    return handle;
  }

  return { registerUndertoneTools, MUSIC_TIMEOUT_MS };
});
