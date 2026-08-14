/**
 * src/config/index.js
 * Central configuration: API keys, capability matrix, model choices.
 * Update the model IDs here if a provider deprecates a given model.
 */
require('dotenv').config();

const KNOWN_PROVIDER_KEYS = ['groq', 'openrouter', 'aimlapi', 'bazaarlink', 'gemini', 'pollinations'];

const PROVIDER_FALLBACK_ORDER = (process.env.PROVIDER_FALLBACK_ORDER || 'groq,openrouter,aimlapi,pollinations,bazaarlink,gemini')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .filter(k => {
    const isKnown = KNOWN_PROVIDER_KEYS.includes(k);
    if (!isKnown) {
      console.warn(`[CONFIG WARNING] Ignoring unknown provider "${k}" found in PROVIDER_FALLBACK_ORDER - check for typos or a broken paste in your .env / Render env vars.`);
    }
    return isKnown;
  });

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  fallbackOrder: PROVIDER_FALLBACK_ORDER,

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
    max: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 30),
  },

  retry: {
    maxRetries: Number(process.env.PROVIDER_MAX_RETRIES || 1),
    timeoutMs: Number(process.env.PROVIDER_TIMEOUT_MS || 25000),
  },

  tavily: {
    enabled: !!process.env.TAVILY_API_KEY,
    apiKey: process.env.TAVILY_API_KEY,
    baseURL: 'https://api.tavily.com',
  },

  library: {
    enabled: process.env.LIBRARY_ENABLED === 'true' || process.env.LIBRARY_ENABLED === '1',
    baseURL: (process.env.LIBRARY_API_URL || '').replace(/\/$/, ''),
    serviceToken: process.env.LIBRARY_SERVICE_TOKEN || '',
    timeoutMs: Number(process.env.LIBRARY_TIMEOUT_MS || 5000),
  },

  providers: {
    // Groq — Aug 16 2026 deprecation: llama-3.3-70b-versatile + llama-3.1-8b-instant
    // shut down for free/developer tier. Migrated to official replacements:
    //   chat/reasoning → openai/gpt-oss-120b
    //   fast           → openai/gpt-oss-20b
    // See: https://console.groq.com/docs/deprecations
    groq: {
      enabled: !!process.env.GROQ_API_KEY,
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      capabilities: { chat: true, vision: false, imageGen: false, streaming: true, reasoning: true },
      models: {
        chat: process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b',
        reasoning: process.env.GROQ_REASONING_MODEL || 'openai/gpt-oss-120b',
        fast: process.env.GROQ_FAST_MODEL || 'openai/gpt-oss-20b',
      },
    },
    openrouter: {
      enabled: !!process.env.OPENROUTER_API_KEY,
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      siteUrl: process.env.OPENROUTER_SITE_URL || '',
      siteName: process.env.OPENROUTER_SITE_NAME || 'SKONGA AI',
      capabilities: { chat: true, vision: true, imageGen: false, streaming: true, reasoning: true },
      models: {
        chat: 'meta-llama/llama-3.3-70b-instruct',
        vision: 'qwen/qwen-2.5-vl-72b-instruct',
        reasoning: 'deepseek/deepseek-r1',
        longContext: 'google/gemini-2.0-flash-001',
      },
    },
    aimlapi: {
      enabled: !!process.env.AIMLAPI_KEY,
      apiKey: process.env.AIMLAPI_KEY,
      baseURL: 'https://api.aimlapi.com/v1',
      capabilities: { chat: true, vision: true, imageGen: true, streaming: true, reasoning: true },
      models: {
        chat: 'gpt-4o-mini',
        vision: 'gpt-4o-mini',
        reasoning: 'o3-mini',
        imageGen: process.env.AIMLAPI_IMAGE_MODEL || 'flux/schnell',
      },
    },
    bazaarlink: {
      enabled: !!process.env.BAZAARLINK_API_KEY,
      apiKey: process.env.BAZAARLINK_API_KEY,
      baseURL: process.env.BAZAARLINK_BASE_URL || 'https://api.bazaarlink.ai/v1',
      capabilities: { chat: true, vision: false, imageGen: false, streaming: false, reasoning: false },
      models: { chat: 'default' },
    },
    gemini: {
      enabled: !!process.env.GEMINI_API_KEY,
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      capabilities: { chat: true, vision: true, imageGen: true, streaming: false, reasoning: false },
      models: {
        chat: 'gemini-2.0-flash',
        vision: 'gemini-2.0-flash',
        imageGen: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',
      },
    },
    pollinations: {
      enabled: true,
      apiKey: process.env.POLLINATIONS_API_KEY || null,
      baseURL: 'https://image.pollinations.ai/prompt',
      capabilities: { chat: false, vision: false, imageGen: true, streaming: false, reasoning: false },
      models: { imageGen: process.env.POLLINATIONS_MODEL || 'flux' },
    },
  },
};
