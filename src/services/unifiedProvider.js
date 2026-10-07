const grokProvider = require('./grokProvider');
const chatgptProvider = require('./chatgptProvider');
const multiModelRouter = require('./multiModelRouter');

/**
 * Unified AI Provider Interface
 * Routes requests to the appropriate AI model based on configuration
 */

const providers = {
  grok: grokProvider,
  chatgpt: chatgptProvider
};

async function chat({
  message,
  messages,
  provider = 'auto',
  systemPrompt = 'You are a helpful AI assistant.',
  model,
  temperature = 0.7,
  maxTokens = 2048,
  context = {}
}) {
  // Normalize messages
  const normalizedMessages = Array.isArray(messages) && messages.length > 0
    ? messages.map(msg => ({
        role: msg.role || 'user',
        content: String(msg.content || '')
      }))
    : [{ role: 'user', content: String(message || '') }];

  if (normalizedMessages.length === 0) {
    throw new Error('No messages provided');
  }

  // Select provider
  let selectedProvider = provider;
  if (provider === 'auto') {
    selectedProvider = multiModelRouter.selectProvider(context);
  }

  if (!providers[selectedProvider]) {
    throw new Error(`Unknown provider: ${selectedProvider}`);
  }

  if (!providers[selectedProvider].available()) {
    throw new Error(`Provider ${selectedProvider} is not configured`);
  }

  // Log routing decision
  multiModelRouter.logRouting(selectedProvider, context);

  // Call appropriate provider
  if (selectedProvider === 'grok') {
    return grokProvider.callGrok({
      messages: normalizedMessages,
      model: model || 'grok-2-latest',
      systemPrompt,
      temperature,
      maxTokens
    });
  } else if (selectedProvider === 'chatgpt') {
    return chatgptProvider.callChatGPT({
      messages: normalizedMessages,
      model: model || 'gpt-4o-mini',
      systemPrompt,
      temperature,
      maxTokens
    });
  }

  throw new Error('Provider routing failed');
}

function getAvailableProviders() {
  return multiModelRouter.getAvailableProviders();
}

function getProviderInfo(provider) {
  return providers[provider] || null;
}

module.exports = {
  chat,
  getAvailableProviders,
  getProviderInfo,
  grokProvider,
  chatgptProvider,
  multiModelRouter
};
