const PROVIDERS = new Set(['auto', 'chatgpt', 'grok']);
const ROLES = new Set(['system', 'user', 'assistant']);
const LIMITS = { message: 8000, systemPrompt: 4000, messages: 50, model: 100 };

// Returns { value } on success or { error } with a client-safe message.
function validateChatBody(body, defaultProvider = 'auto') {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Body must be a JSON object' };
  }

  const { provider = defaultProvider, message, messages, model, systemPrompt = 'You are a helpful assistant.' } = body;

  if (typeof provider !== 'string' || !PROVIDERS.has(provider)) {
    return { error: 'provider must be one of: auto, chatgpt, grok' };
  }
  if (model !== undefined && (typeof model !== 'string' || model.length > LIMITS.model)) {
    return { error: `model must be a string of at most ${LIMITS.model} characters` };
  }
  if (typeof systemPrompt !== 'string' || systemPrompt.length > LIMITS.systemPrompt) {
    return { error: `systemPrompt must be a string of at most ${LIMITS.systemPrompt} characters` };
  }

  if (messages !== undefined) {
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > LIMITS.messages) {
      return { error: `messages must be a non-empty array of at most ${LIMITS.messages} items` };
    }
    for (const m of messages) {
      if (!m || typeof m !== 'object' || typeof m.content !== 'string' || m.content.length > LIMITS.message ||
          (m.role !== undefined && !ROLES.has(m.role))) {
        return { error: `each message needs string content (max ${LIMITS.message} chars) and role system|user|assistant` };
      }
    }
  } else if (typeof message !== 'string' || message.trim() === '' || message.length > LIMITS.message) {
    return { error: `message must be a non-empty string of at most ${LIMITS.message} characters` };
  }

  return { value: { provider, message, messages, model, systemPrompt } };
}

module.exports = { validateChatBody, LIMITS };
