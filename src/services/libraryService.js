/**
 * src/services/libraryService.js
 * Client for SKONGA Library API v2 (FastAPI, JSON-based, no database).
 */
const config = require('../config');

let lastLibraryError = null;
let lastLibraryOkAt = null;

function getLibraryStatus() {
  return {
    configured: !!(config.library.enabled && config.library.baseURL && config.library.serviceToken),
    baseURL: config.library.baseURL || null,
    lastError: lastLibraryError,
    lastOkAt: lastLibraryOkAt,
  };
}

async function getRagContext({ query, subjectHint = null, formHint = null, topK = 5 } = {}) {
  if (!config.library.enabled || !config.library.baseURL || !config.library.serviceToken) {
    lastLibraryError = 'Library not configured (LIBRARY_ENABLED / LIBRARY_API_URL / LIBRARY_SERVICE_TOKEN)';
    return null;
  }
  if (!query || typeof query !== 'string' || !query.trim()) {
    return null;
  }

  let form = formHint != null && formHint !== '' ? Number(formHint) : null;
  if (form != null && (!Number.isInteger(form) || form < 1 || form > 6)) {
    form = null;
  }

  const base = config.library.baseURL.replace(/\/$/, '');
  const params = new URLSearchParams();
  params.set('q', query.trim().slice(0, 500));
  params.set('top_k', String(topK));
  if (subjectHint) params.set('subject_id', subjectHint);
  if (form != null && query.trim().split(/\s+/).length >= 4) {
    params.set('form', String(form));
  }

  const url = `${base}/v1/rag/context?${params.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.library.timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.library.serviceToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      lastLibraryError = `HTTP ${res.status}: ${errText.slice(0, 200)}`;
      console.warn(`[LIBRARY] RAG ${lastLibraryError}`);
      if (res.status === 401 || res.status === 403) {
        console.warn('[LIBRARY] Auth failed — check LIBRARY_SERVICE_TOKEN (raw key) vs Library SKONGA_API_KEY_HASH');
      }
      return null;
    }

    const data = await res.json();
    const citations = Array.isArray(data.citations) ? data.citations : [];
    const topicsFound = data.topics_found ?? citations.length;
    const aligned = !!(data.curriculum_aligned ?? data.curriculumAligned ?? topicsFound > 0);

    if (topicsFound === 0) {
      console.warn(`[LIBRARY] No topics matched for q="${query.trim().slice(0, 80)}"`);
    } else {
      lastLibraryOkAt = new Date().toISOString();
      lastLibraryError = null;
      console.log(`[LIBRARY] RAG ok — ${topicsFound} topic(s) for q="${query.trim().slice(0, 60)}"`);
    }

    return {
      context_text: data.context_text || '',
      citations,
      curriculum_aligned: aligned,
      topics_found: topicsFound,
    };
  } catch (err) {
    lastLibraryError = err.message || String(err);
    console.warn('[LIBRARY] RAG fetch failed (non-critical):', lastLibraryError);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function injectCurriculumContext(systemPrompt, libraryResult, clientCurriculumContext) {
  const block =
    (libraryResult && libraryResult.context_text && libraryResult.context_text.trim()) ||
    (typeof clientCurriculumContext === 'string' && clientCurriculumContext.trim()) ||
    '';

  if (!block) return systemPrompt || '';
  return `${systemPrompt || ''}\n\n${block}`.trim();
}

module.exports = { getRagContext, injectCurriculumContext, getLibraryStatus };
