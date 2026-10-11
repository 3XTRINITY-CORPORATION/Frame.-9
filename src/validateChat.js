const PROVIDERS = new Set(['auto', 'chatgpt', 'grok']);
const ROLES = new Set(['system', 'user', 'assistant']);
const LIMITS = { message: 8000, systemPrompt: 4000, messages: 50, model: 100, maxTokens: 8192 };

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Returns { value } on success or { error } with a client-safe message.
function validateChatBody(body, { fixedProvider } = {}) {
  if (!isObject(body)) return { error: 'Body must be a JSON object' };
  const { message, messages, model, systemPrompt, temperature, maxTokens, context } = body;
  const provider = fixedProvider || (body.provider === undefined ? 'auto' : body.provider);

  if (typeof provider !== 'string' || !PROVIDERS.has(provider)) {
    return { error: 'provider must be one of: auto, chatgpt, grok' };
  }
  if (model !== undefined && (typeof model !== 'string' || model.length === 0 || model.length > LIMITS.model)) {
    return { error: `model must be a string of at most ${LIMITS.model} characters` };
  }
  if (systemPrompt !== undefined && (typeof systemPrompt !== 'string' || systemPrompt.length > LIMITS.systemPrompt)) {
    return { error: `systemPrompt must be a string of at most ${LIMITS.systemPrompt} characters` };
  }
  if (temperature !== undefined && (typeof temperature !== 'number' || !(temperature >= 0 && temperature <= 2))) {
    return { error: 'temperature must be a number between 0 and 2' };
  }
  if (maxTokens !== undefined && (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > LIMITS.maxTokens)) {
    return { error: `maxTokens must be an integer between 1 and ${LIMITS.maxTokens}` };
  }
  if (context !== undefined && !isObject(context)) return { error: 'context must be an object' };

  if (messages !== undefined) {
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > LIMITS.messages) {
      return { error: `messages must be a non-empty array of at most ${LIMITS.messages} items` };
    }
    for (const m of messages) {
      if (!isObject(m) || typeof m.content !== 'string' || m.content.length > LIMITS.message ||
          (m.role !== undefined && !ROLES.has(m.role))) {
        return { error: `each message needs string content (max ${LIMITS.message} chars) and role system|user|assistant` };
      }
    }
  } else if (typeof message !== 'string' || message.trim() === '' || message.length > LIMITS.message) {
    return { error: `message must be a non-empty string of at most ${LIMITS.message} characters` };
  }

  return { value: { provider, message, messages, model, systemPrompt, temperature, maxTokens, context } };
}

module.exports = { validateChatBody, LIMITS };
