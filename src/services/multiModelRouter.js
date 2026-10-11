const { openai, xai } = require('../config');

/**
 * Multi-Model Router - intelligently routes requests to the best AI provider
 */

class MultiModelRouter {
  constructor() {
    this.providers = {
      grok: {
        name: 'Grok (xAI)',
        isAvailable: () => !!xai.apiKey,
        cost: 0.005, // per 1K tokens (approximate)
        speed: 'fast',
        specialties: ['reasoning', 'real-time', 'current-events']
      },
      chatgpt: {
        name: 'ChatGPT (OpenAI)',
        isAvailable: () => !!openai.apiKey,
        cost: 0.03, // per 1K tokens (approximate)
        speed: 'balanced',
        specialties: ['creative', 'coding', 'analysis']
      },
      claude: {
        name: 'Claude (Anthropic)',
        isAvailable: () => false, // Not yet implemented
        cost: 0.01,
        speed: 'thorough',
        specialties: ['long-form', 'nuanced', 'safety']
      }
    };
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return Object.entries(this.providers)
      .filter(([_, config]) => config.isAvailable())
      .map(([name, config]) => ({ name, ...config }));
  }

  /**
   * Intelligently select a provider based on request context
   */
  selectProvider(context = {}) {
    const { preferredProvider, useCase, budget, speed } = context;

    // If user specified preference, use it
    if (preferredProvider && this.providers[preferredProvider]?.isAvailable()) {
      return preferredProvider;
    }

    // Route based on use case
    if (useCase === 'reasoning' && this.providers.grok.isAvailable()) {
      return 'grok';
    }
    if (useCase === 'coding' && this.providers.chatgpt.isAvailable()) {
      return 'chatgpt';
    }
    if (useCase === 'analysis' && this.providers.chatgpt.isAvailable()) {
      return 'chatgpt';
    }

    // Route based on budget
    if (budget === 'low-cost' && this.providers.grok.isAvailable()) {
      return 'grok';
    }

    // Route based on speed
    if (speed === 'fast' && this.providers.grok.isAvailable()) {
      return 'grok';
    }

    // Default fallback
    const available = this.getAvailableProviders();
    if (available.length === 0) {
      throw new Error('No AI providers configured');
    }
    return available[0].name.toLowerCase().split(' ')[0];
  }

  /**
   * Get provider info
   */
  getProviderInfo(provider) {
    return this.providers[provider] || null;
  }

  /**
   * Log routing decision
   */
  logRouting(selectedProvider, context) {
    console.log(`\n📊 ROUTING DECISION:`);
    console.log(`  Selected: ${this.providers[selectedProvider].name}`);
    console.log(`  Context: ${JSON.stringify(context)}`);
    console.log(`  Available: ${this.getAvailableProviders().map(p => p.name).join(', ')}`);
    console.log(`\n`);
  }
}

module.exports = new MultiModelRouter();
