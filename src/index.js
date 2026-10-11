const express = require('express');
const config = require('./config');
const { requireServiceToken } = require('./middleware/serviceAuth');
const { createRateLimiter } = require('./middleware/rateLimit');
const { validateChatBody } = require('./validateChat');

function createApp({
  generateText = require('./services/aiProvider').generateText,
  defaultProvider = config.aiProvider,
  rateLimit = { windowMs: 60_000, max: 30 }
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  // Public liveness probe: no keys, provider names or config values.
  app.get('/health', (req, res) => {
    res.json({ ok: true, service: 'Frame.9 AI gateway' });
  });

  app.post('/api/chat', createRateLimiter(rateLimit), requireServiceToken(), async (req, res) => {
    const { value, error } = validateChatBody(req.body, defaultProvider);
    if (error) {
      return res.status(400).json({ ok: false, error });
    }

    try {
      const result = await generateText({
        provider: value.provider,
        text: value.message,
        messages: value.messages,
        model: value.model,
        systemPrompt: value.systemPrompt
      });
      return res.json({ ok: true, provider: value.provider, response: result });
    } catch (err) {
      console.error('AI provider error:', err.message);
      return res.status(502).json({ ok: false, error: 'AI provider request failed' });
    }
  });

  // Malformed / oversized JSON bodies -> 400 / 413 without stack traces.
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ ok: false, error: 'Request body too large' });
    }
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
    }
    return next(err);
  });

  return app;
}

if (require.main === module) {
  if (!process.env.FRAME9_SERVICE_TOKEN) {
    console.warn('FRAME9_SERVICE_TOKEN is not set: POST /api/chat will answer 503 until it is configured.');
  }
  createApp().listen(config.port, () => {
    console.log(`Frame.9 AI gateway running on http://localhost:${config.port}`);
  });
}

module.exports = { createApp };
