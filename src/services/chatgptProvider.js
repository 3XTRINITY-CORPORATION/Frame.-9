const config = require('../config');

/**
 * ChatGPT AI Provider
 * Powered by OpenAI
 */

async function callChatGPT({
  messages,
  model = config.openai.model,
  systemPrompt,
  temperature = 0.7,
  maxTokens = 2048
}) {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is not configured. Add it to .env');
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
    const response = await fetch(`${config.openai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openai.apiKey}`,
        'User-Agent': 'Frame.9/1.0 (ChatGPT AI Gateway)'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ChatGPT API Error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return {
      provider: 'chatgpt',
      model,
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ ChatGPT API Error:', error.message);
    throw error;
  }
}

async function chatgptStream({
  messages,
  model = config.openai.model,
  systemPrompt,
  temperature = 0.7
}) {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
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
    return await fetch(`${config.openai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openai.apiKey}`,
        'User-Agent': 'Frame.9/1.0 (ChatGPT AI Gateway)'
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('❌ ChatGPT Stream Error:', error.message);
    throw error;
  }
}

module.exports = {
  callChatGPT,
  chatgptStream,
  name: 'chatgpt',
  displayName: 'ChatGPT (OpenAI)',
  available: () => !!config.openai.apiKey
};
