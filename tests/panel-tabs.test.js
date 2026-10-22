'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const start = app.indexOf(' let panelCloseTimer=null,tabMotionRevision=0,tabAnimations=[];');
const end = app.indexOf(' function finishPanelClose(){', start);
assert.notEqual(start, -1, 'panel tab implementation should be present');
assert.notEqual(end, -1, 'panel tab implementation boundary should be present');
const panelTabs = app.slice(start, end) + '\nglobalThis.panelTabApi={activateTab,getState:()=>({tab,revision:tabMotionRevision,animations:tabAnimations})};';

function harness({ reduced = false } = {}) {
  const panes = ['tune', 'sessions'].map(name => ({
    id: `pane-${name}`,
    hidden: name !== 'tune',
    calls: [],
    animate: function (frames, options) {
      let resolve;
      const animation = {
        frames,
        options,
        canceled: false,
        finished: new Promise(r => { resolve = r; }),
        finish: () => resolve(),
        cancel() { this.canceled = true; resolve(); },
      };
      this.calls.push(animation);
      return animation;
    },
  }));
  const tabs = ['tune', 'sessions'].map(name => ({
    dataset: { tab: name },
    attrs: {},
    setAttribute(key, value) { this.attrs[key] = value; },
    focus() { this.focused = true; },
  }));
  tabs[0].attrs['aria-selected'] = 'true';
  tabs[0].tabIndex = 0;
  tabs[1].attrs['aria-selected'] = 'false';
  tabs[1].tabIndex = -1;
  const elements = {
    panelScroll: { scrollTop: 20 },
    'pane-tune': panes[0],
    'pane-sessions': panes[1],
    'tab-tune': tabs[0],
    'tab-sessions': tabs[1],
  };
  const scope = {
    visual: { reduced: { matches: reduced } },
    $$: selector => selector === '[data-tab]' ? tabs : selector === '[role=tabpanel]' ? panes : [],
    $: id => elements[id],
    renderSaved() {},
    renderHistory() {},
  };
  vm.runInNewContext(panelTabs, scope);
  return { api: scope.panelTabApi, panes, tabs, scroll: elements.panelScroll, setReduced: value => { scope.visual.reduced.matches = value; } };
}

test('rapid A to B to A keeps the latest tab and pane visible after stale animation settles', async () => {
  const h = harness();
  const staleSwitch = h.api.activateTab('sessions');
  const staleOut = h.panes[0].calls[0];
  assert.ok(staleOut, 'switch should begin an outgoing animation');

  await h.api.activateTab('tune');
  assert.equal(h.panes[0].hidden, false);
  assert.equal(h.panes[1].hidden, true);
  assert.equal(h.tabs[0].attrs['aria-selected'], 'true');
  assert.equal(h.tabs[1].attrs['aria-selected'], 'false');

  staleOut.finish();
  await staleSwitch;
  assert.equal(h.panes[0].hidden, false);
  assert.equal(h.panes[1].hidden, true);
  assert.equal(h.tabs[0].attrs['aria-selected'], 'true');
  assert.equal(h.tabs[1].attrs['aria-selected'], 'false');
});

test('immediate reduced-motion and nonanimated selections invalidate pending transitions', async t => {
  for (const options of [{ reduced: true }, { animate: false }]) {
    await t.test(JSON.stringify(options), async () => {
      const h = harness();
      const staleSwitch = h.api.activateTab('sessions');
      const staleOut = h.panes[0].calls[0];
      if (options.reduced) h.setReduced(true);
      await h.api.activateTab('tune', false, options.animate === false ? false : true);
      assert.equal(h.panes[0].hidden, false);
      assert.equal(h.panes[1].hidden, true);
      assert.equal(h.tabs[0].attrs['aria-selected'], 'true');
      assert.equal(h.tabs[1].attrs['aria-selected'], 'false');
      staleOut.finish();
      await staleSwitch;
      assert.equal(h.panes[0].hidden, false);
      assert.equal(h.panes[1].hidden, true);
      assert.equal(h.tabs[0].attrs['aria-selected'], 'true');
      assert.equal(h.tabs[1].attrs['aria-selected'], 'false');
    });
  }
});

test('animated forward switch ends with selected tab and visible panel in sync', async () => {
  const h = harness();
  const switching = h.api.activateTab('sessions');
  assert.equal(h.tabs[0].attrs['aria-selected'], 'false');
  assert.equal(h.tabs[1].attrs['aria-selected'], 'true');
  h.panes[0].calls[0].finish();
  await new Promise(resolve => setImmediate(resolve));
  const incoming = h.panes[1].calls[0];
  assert.ok(incoming, 'incoming animation should start after outgoing animation');
  assert.equal(h.panes[0].hidden, true);
  assert.equal(h.panes[1].hidden, false);
  incoming.finish();
  await switching;
  assert.equal(h.tabs[0].attrs['aria-selected'], 'false');
  assert.equal(h.tabs[1].attrs['aria-selected'], 'true');
  assert.equal(h.tabs[1].tabIndex, 0);
  assert.equal(h.panes[0].hidden, true);
  assert.equal(h.panes[1].hidden, false);
});
