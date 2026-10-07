/**
 * Grok AI Provider Example
 * Direct API usage with Grok
 */

const grokProvider = require('../src/services/grokProvider');

async function example() {
  try {
    console.log('🤖 Grok Example\n');

    const response = await grokProvider.callGrok({
      messages: [
        { role: 'user', content: 'Explain quantum computing in simple terms' }
      ],
      systemPrompt: 'You are an expert in physics and able to explain complex concepts simply.',
      temperature: 0.7,
      maxTokens: 500
    });

    console.log('Provider:', response.provider);
    console.log('Model:', response.model);
    console.log('Response:', response.content);
    console.log('Tokens Used:', response.usage);
    console.log('Timestamp:', response.timestamp);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

if (require.main === module) {
  example();
}

module.exports = { example };
