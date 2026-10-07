const { openai, xai } = require('./config');

async function callOpenAI({ messages, model = openai.model, systemPrompt }) {
  if (!openai.apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Add it to .env');
  }

  const payload = {
    model,
    messages: systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages,
    temperature: 0.7
  };

  const response = await fetch(`${openai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openai.apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorData}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGrok({ messages, model = xai.model, systemPrompt }) {
  if (!xai.apiKey) {
    throw new Error('XAI_API_KEY is missing. Add it to .env');
  }

  const payload = {
    model,
    messages: systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages,
    temperature: 0.7
  };

  const response = await fetch(`${xai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${xai.apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Grok API error: ${response.status} ${errorData}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function normalizeMessages(rawMessages, text) {
  if (Array.isArray(rawMessages) && rawMessages.length > 0) {
    return rawMessages.map((msg) => ({
      role: msg.role || 'user',
      content: String(msg.content || '')
    }));
  }

  return [{ role: 'user', content: String(text || '') }];
}

async function generateText({ provider, messages, text, systemPrompt, model }) {
  const normalizedMessages = normalizeMessages(messages, text);
  const selectedProvider = provider || 'auto';

  if (selectedProvider === 'chatgpt') {
    return callOpenAI({ messages: normalizedMessages, model, systemPrompt });
  }

  if (selectedProvider === 'grok') {
    return callGrok({ messages: normalizedMessages, model, systemPrompt });
  }

  // auto mode: prefer OpenAI if configured, otherwise fallback to Grok.
  if (openai.apiKey) {
    return callOpenAI({ messages: normalizedMessages, model: model || openai.model, systemPrompt });
  }

  if (xai.apiKey) {
    return callGrok({ messages: normalizedMessages, model: model || xai.model, systemPrompt });
  }

  throw new Error('No AI provider configured. Set OPENAI_API_KEY or XAI_API_KEY in .env');
}

module.exports = {
  generateText,
  callOpenAI,
  callGrok
};
