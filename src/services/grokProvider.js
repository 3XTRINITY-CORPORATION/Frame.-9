const config = require('../config');

/**
 * Grok AI Provider
 * Powered by xAI
 */

async function callGrok({
  messages,
  model = config.xai.model,
  systemPrompt,
  temperature = 0.7,
  maxTokens = 2048
}) {
  if (!config.xai.apiKey) {
    throw new Error('XAI_API_KEY is not configured. Add it to .env');
  }

  const payload = {
    model,
    messages: systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages,
    temperature,
    max_tokens: maxTokens,
    stream: false
  };

  try {
    const response = await fetch(`${config.xai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.xai.apiKey}`,
        'User-Agent': 'Frame.9/1.0 (Grok AI Gateway)'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Grok API Error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return {
      provider: 'grok',
      model,
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Grok API Error:', error.message);
    throw error;
  }
}

async function grokStream({
  messages,
  model = config.xai.model,
  systemPrompt,
  temperature = 0.7
}) {
  if (!config.xai.apiKey) {
    throw new Error('XAI_API_KEY is not configured');
  }

  const payload = {
    model,
    messages: systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages,
    temperature,
    stream: true
  };

  try {
    return await fetch(`${config.xai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.xai.apiKey}`,
        'User-Agent': 'Frame.9/1.0 (Grok AI Gateway)'
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('❌ Grok Stream Error:', error.message);
    throw error;
  }
}

module.exports = {
  callGrok,
  grokStream,
  name: 'grok',
  displayName: 'Grok (xAI)',
  available: () => !!config.xai.apiKey
};
