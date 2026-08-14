/**
 * src/services/aiService.js
 * CORE PIECE: this is the "single AI service layer" that unifies
 * Groq, OpenRouter, AIMLAPI, and BazaarLink under one function.
 */
const config = require('../config');
const statsService = require('./statsService');

const adapters = {
  groq: require('../providers/groqProvider'),
  openrouter: require('../providers/openrouterProvider'),
  aimlapi: require('../providers/aimlapiProvider'),
  bazaarlink: require('../providers/bazaarlinkProvider'),
  gemini: require('../providers/geminiProvider'),
  pollinations: require('../providers/pollinationsProvider'),
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function providerReady(key) {
  const cfg = config.providers[key];
  return !!(cfg && cfg.enabled);
}

function supportsCapability(key, capability) {
  const cfg = config.providers[key];
  return !!(cfg && cfg.capabilities && cfg.capabilities[capability]);
}

async function tryProvider(key, method, args) {
  const adapter = adapters[key];
  const maxRetries = config.retry.maxRetries;
  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const start = Date.now();
    try {
      const result = await adapter[method](args);
      statsService.recordSuccess(key, Date.now() - start);
      return { ...result, providerUsed: key };
    } catch (err) {
      statsService.recordFailure(key, Date.now() - start);
      lastErr = err;
      if (attempt < maxRetries) await sleep(400 * (attempt + 1));
    }
  }
  throw lastErr;
}

function resolveCapabilityForTask(task) {
  if (task === 'vision') return 'vision';
  if (task === 'imageGen') return 'imageGen';
  return 'chat';
}

function methodForTask(task) {
  if (task === 'vision') return 'vision';
  if (task === 'imageGen') return 'imageGen';
  return 'chat';
}

async function generateAIResponse(opts) {
  const {
    provider = 'auto',
    task = 'chat',
    message,
    history = [],
    systemPrompt = '',
    images = [],
    stream = false,
    onToken,
    prompt,
    size,
  } = opts;

  const capability = resolveCapabilityForTask(task);
  const method = methodForTask(task);

  const args = { task, systemPrompt, history, message, images, stream, onToken, prompt: prompt || message, size };

  if (provider !== 'auto') {
    if (!providerReady(provider)) {
      return { reply: null, providerUsed: null, modelUsed: null, tokens: null, error: `Provider "${provider}" has no API key configured (not ready).` };
    }
    if (!supportsCapability(provider, capability)) {
      return { reply: null, providerUsed: null, modelUsed: null, tokens: null, error: `Provider "${provider}" does not support "${capability}".` };
    }
    if (stream && !supportsCapability(provider, 'streaming')) {
      args.stream = false;
      args.onToken = undefined;
    }
    try {
      const r = await tryProvider(provider, method, args);
      return { reply: r.reply ?? null, providerUsed: r.providerUsed, modelUsed: r.model || null, tokens: r.tokens ?? null, error: null, imageUrl: r.imageUrl, imageBase64: r.imageBase64 };
    } catch (err) {
      return { reply: null, providerUsed: provider, modelUsed: null, tokens: null, error: err.message || String(err) };
    }
  }

  let candidates = config.fallbackOrder.filter(key => providerReady(key) && supportsCapability(key, capability));
  if (stream) {
    const streamCapable = candidates.filter(key => supportsCapability(key, 'streaming'));
    if (streamCapable.length) {
      candidates = streamCapable;
    } else {
      args.stream = false;
      args.onToken = undefined;
    }
  }

  if (!candidates.length) {
    return { reply: null, providerUsed: null, modelUsed: null, tokens: null, error: `No provider with a configured key supports "${capability}".` };
  }

  const errors = [];
  for (const key of candidates) {
    try {
      const r = await tryProvider(key, method, args);
      return { reply: r.reply ?? null, providerUsed: r.providerUsed, modelUsed: r.model || null, tokens: r.tokens ?? null, error: null, imageUrl: r.imageUrl, imageBase64: r.imageBase64 };
    } catch (err) {
      errors.push(`${key}: ${err.message || err}`);
    }
  }

  return {
    reply: null,
    providerUsed: null,
    modelUsed: null,
    tokens: null,
    error: `All providers failed → ${errors.join(' | ')}`,
  };
}

module.exports = { generateAIResponse };
