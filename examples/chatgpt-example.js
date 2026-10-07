/**
 * ChatGPT AI Provider Example
 * Direct API usage with ChatGPT
 */

const chatgptProvider = require('../src/services/chatgptProvider');

async function example() {
  try {
    console.log('🤖 ChatGPT Example\n');

    const response = await chatgptProvider.callChatGPT({
      messages: [
        { role: 'user', content: 'Write a JavaScript function that checks if a number is prime' }
      ],
      systemPrompt: 'You are a helpful coding assistant.',
      temperature: 0.5,
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
