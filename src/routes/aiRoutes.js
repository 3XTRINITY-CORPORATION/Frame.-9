const express = require('express');
const unifiedProvider = require('../services/unifiedProvider');

const router = express.Router();

/**
 * GET /ai/health
 * Check AI providers health status
 */
router.get('/health', (req, res) => {
  const available = unifiedProvider.getAvailableProviders();
  return res.json({
    ok: true,
    service: 'Frame.9 AI Gateway',
    timestamp: new Date().toISOString(),
    providers: available.map(p => ({ name: p.name, cost: p.cost, speed: p.speed }))
  });
});

/**
 * GET /ai/providers
 * Get list of available AI providers
 */
router.get('/providers', (req, res) => {
  const available = unifiedProvider.getAvailableProviders();
  return res.json({
    ok: true,
    available: available.length > 0,
    providers: available.map(p => ({
      id: p.name.split(' ')[0].toLowerCase(),
      displayName: p.name,
      cost: p.cost,
      speed: p.speed,
      specialties: p.specialties
    }))
  });
});

/**
 * POST /ai/chat
 * Send a message to selected AI provider
 *
 * Request body:
 * {
 *   "provider": "auto|grok|chatgpt",
 *   "message": "Your message here",
 *   "messages": [{role: "user", content: "..."}],
 *   "systemPrompt": "Optional system prompt",
 *   "model": "Optional model override",
 *   "temperature": 0.7,
 *   "context": { "useCase": "reasoning" }
 * }
 */
router.post('/chat', async (req, res) => {
  try {
    const {
      provider = 'auto',
      message,
      messages,
      systemPrompt,
      model,
      temperature = 0.7,
      maxTokens = 2048,
      context = {}
    } = req.body || {};

    if (!message && (!Array.isArray(messages) || messages.length === 0)) {
      return res.status(400).json({
        ok: false,
        error: 'Missing message or messages array'
      });
    }

    const response = await unifiedProvider.chat({
      message,
      messages,
      provider,
      systemPrompt,
      model,
      temperature,
      maxTokens,
      context
    });

    return res.json({
      ok: true,
      ...response
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * POST /ai/grok
 * Send request specifically to Grok
 */
router.post('/grok', async (req, res) => {
  try {
    const { message, messages, systemPrompt, model, temperature, maxTokens } = req.body || {};

    const response = await unifiedProvider.chat({
      message,
      messages,
      provider: 'grok',
      systemPrompt,
      model,
      temperature,
      maxTokens
    });

    return res.json({ ok: true, ...response });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /ai/chatgpt
 * Send request specifically to ChatGPT
 */
router.post('/chatgpt', async (req, res) => {
  try {
    const { message, messages, systemPrompt, model, temperature, maxTokens } = req.body || {};

    const response = await unifiedProvider.chat({
      message,
      messages,
      provider: 'chatgpt',
      systemPrompt,
      model,
      temperature,
      maxTokens
    });

    return res.json({ ok: true, ...response });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /ai/compare
 * Compare responses from multiple providers
 */
router.post('/compare', async (req, res) => {
  try {
    const { message, systemPrompt } = req.body || {};

    if (!message) {
      return res.status(400).json({
        ok: false,
        error: 'Message is required'
      });
    }

    const available = unifiedProvider.getAvailableProviders();
    const results = {};

    for (const provider of available) {
      const providerId = provider.name.split(' ')[0].toLowerCase();
      try {
        results[providerId] = await unifiedProvider.chat({
          message,
          provider: providerId,
          systemPrompt
        });
      } catch (error) {
        results[providerId] = { error: error.message };
      }
    }

    return res.json({
      ok: true,
      message,
      results
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
