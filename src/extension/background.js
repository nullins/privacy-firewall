import { PATTERNS, MESSAGE_TYPES } from './modules/config.js';
import { isSetupComplete } from './modules/settings.js';
import { initializeModel, detectEntities } from './lib/transformer-detector.js';

let isModelReady = false;
let isModelLoading = false;
let modelInitialization = null;

async function openSettingsIfNeeded(reason) {
  if (reason === 'install' || (reason === 'update' && !(await isSetupComplete()))) {
    await browser.tabs.create({ url: browser.runtime.getURL('ui/settings.html') });
  }
}

browser.runtime.onInstalled.addListener(({ reason }) => {
  openSettingsIfNeeded(reason).catch(error => {
    console.error('[PrivacyFirewall] Could not open settings:', error);
  });
});

function scanLocally(text) {
  if (typeof text !== 'string' || !text) return [];

  return PATTERNS.filter(pattern => pattern.regex.test(text)).map(pattern => ({
    type: pattern.type,
    value: 'REDACTED',
    description: pattern.desc,
  }));
}

async function notifyContentScripts() {
  const status = {
    type: MESSAGE_TYPES.ENGINE_STATUS,
    reachable: isModelReady,
    loading: isModelLoading,
  };

  try {
    const tabs = await browser.tabs.query({});
    await Promise.all(tabs
      .filter(tab => tab.id != null && /^https?:/.test(tab.url || ''))
      .map(tab => browser.tabs.sendMessage(tab.id, status).catch(() => {})));
  } catch (error) {
    console.warn('[PrivacyFirewall] Could not notify tabs:', error);
  }
}

function getEngineStatus() {
  return { reachable: isModelReady, loading: isModelLoading };
}

function startModelInitialization() {
  if (isModelReady || modelInitialization) return modelInitialization;

  isModelLoading = true;
  notifyContentScripts();
  modelInitialization = initializeModel(progress => {
    if (progress.status === 'done') {
      console.info(`[PrivacyFirewall] Model asset loaded: ${progress.file || progress.name || 'model'}`);
    }
  })
    .then(() => {
      isModelReady = true;
      console.info('[PrivacyFirewall] AI model ready');
    })
    .catch(error => {
      isModelReady = false;
      console.error('[PrivacyFirewall] AI model initialization failed:', error);
    })
    .finally(() => {
      isModelLoading = false;
      modelInitialization = null;
      notifyContentScripts();
    });

  return modelInitialization;
}

async function scanWithAI(text) {
  if (!text) return [];

  await startModelInitialization();
  if (!isModelReady) return [];

  return detectEntities(text);
}

browser.runtime.onMessage.addListener(async request => {
  if (request.type === MESSAGE_TYPES.SCAN_TEXT) {
    try {
      return { success: true, data: await scanWithAI(request.text) };
    } catch (error) {
      console.error('[PrivacyFirewall] AI scan failed:', error);
      return { success: false, error: error.message };
    }
  }

  if (request.type === MESSAGE_TYPES.GET_ENGINE_STATUS) {
    if (!isModelReady && !isModelLoading) startModelInitialization();
    return getEngineStatus();
  }

  if (request.type === MESSAGE_TYPES.SETTINGS_UPDATED) {
    return { success: true };
  }

  return undefined;
});