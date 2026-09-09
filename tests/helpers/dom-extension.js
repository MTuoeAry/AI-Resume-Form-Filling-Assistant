const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

function loadExtension(html, url = 'https://unseen-employer.example/apply') {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  const w = dom.window;
  // jsdom has no layout. Only geometry is substituted; DOM traversal, labels,
  // selectors, events, value setters and the entire production script are real.
  w.HTMLElement.prototype.getClientRects = function () {
    for (let el = this; el; el = el.parentElement) {
      if (el.hidden || w.getComputedStyle(el).display === 'none') return [];
    }
    return [{ left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 }];
  };
  w.HTMLElement.prototype.getBoundingClientRect = function () { return this.getClientRects()[0] || { width: 0, height: 0 }; };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  const nativeTimeout = w.setTimeout.bind(w);
  w.setTimeout = callback => nativeTimeout(callback, 0);
  w.structuredClone = global.structuredClone;
  const logs = [];
  let listener;
  w.chrome = {
    runtime: { onMessage: { addListener(fn) { listener = fn; } }, sendMessage(message, callback) {
      logs.push(message);
      if (message.action === 'callAI') callback({ success: false, error: 'offline test transport' });
    } },
    storage: { local: { async get() { return {}; }, async set() {} } },
  };
  const scripts = ['resume-schema','diagnostics','field-text','field-concepts','mapping-policy','field-semantics','page-structure','repeat-alignment','repeat-flow','fill-runtime','site-adapters','content-bridge','ai-client'];
  for (const name of scripts) w.eval(fs.readFileSync(path.join(__dirname, '../../shared', `${name}.js`), 'utf8'));
  // Expose private functions only in this test copy, never in the shipped extension.
  const source = fs.readFileSync(path.join(__dirname, '../../content.js'), 'utf8');
  w.eval(source.replace(/\}\)\(\);\s*$/, 'window.testApi = {scanFields, normalizeMappings, fillOne, hasExistingFieldValue, refreshRuntimeElement, deriveFillValue, alignIncrementalRepeatSourceIndexes, buildFieldMappingPayload, inferRepeatItemIndexFromIdentifier, assignFallbackRepeatItemIndexes, prepareTextValueForRuntime, parseJsonFromAiText, sanitizePageUrl, normalizeImpactFactorValue, normalizeDeepScanText, parseDateParts, normalizeSelectionRect, rectsIntersect, bindRecordTarget, readRecordTarget, captureRepeatFlowState, waitForRepeatFlowChange, getScopedCustomPickerOptions, getCustomPickerRootText, customPickerValueMatches, fillCustomPicker, createFormTemplateKey, applyConceptMemories, mappingRuleVersion, describeMappingCacheLookup};})();'));
  return { window: w, api: w.testApi, logs, close: () => w.close(),
    request: message => new Promise(resolve => listener(message, {}, resolve)) };
}
module.exports = { loadExtension };
