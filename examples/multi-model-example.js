/**
 * Multi-Model Router Example
 * Automatic provider selection based on context
 */

const unifiedProvider = require('../src/services/unifiedProvider');

async function compareProviders() {
  try {
    console.log('\n🤖 Multi-Model Router Example\n');
    console.log('Available Providers:');
    const available = unifiedProvider.getAvailableProviders();
    available.forEach(p => {
      console.log(`  - ${p.name} (Speed: ${p.speed}, Cost: $${p.cost})`);
    });

    const message = 'What is the meaning of life?';

    console.log(`\n📝 Query: "${message}"\n`);

    // Auto selection based on reasoning
    console.log('Routing with auto (use case: reasoning)');
    const response1 = await unifiedProvider.chat({
      message,
      provider: 'auto',
      context: { useCase: 'reasoning' }
    });
    console.log(`Selected: ${response1.provider}`);
    console.log(`Response: ${response1.content.substring(0, 100)}...\n`);

    // Auto selection based on coding
    const codingMessage = 'Write a function to sort an array';
    console.log('Routing with auto (use case: coding)');
    const response2 = await unifiedProvider.chat({
      message: codingMessage,
      provider: 'auto',
      context: { useCase: 'coding' }
    });
    console.log(`Selected: ${response2.provider}`);
    console.log(`Response: ${response2.content.substring(0, 100)}...\n`);

    // Direct provider selection
    console.log('Direct provider selection (grok)');
    const response3 = await unifiedProvider.chat({
      message,
      provider: 'grok'
    });
    console.log(`Response: ${response3.content.substring(0, 100)}...\n`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

if (require.main === module) {
  compareProviders();
}

module.exports = { compareProviders };
