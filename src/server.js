require('dotenv').config();
const express = require('express');
const aiRoutes = require('./routes/aiRoutes');
const { rateLimit } = require('express-rate-limit');
const { port } = require('./config');
const { requireServiceToken } = require('./middleware/serviceAuth');

const BODY_LIMIT = '32kb';

function createApp({ aiRateLimitMax = Number(process.env.AI_RATE_LIMIT_MAX) || 30, aiRateLimitWindowMs = 60_000 } = {}) {
const app = express();

// /ai/* is server-to-server only: per-IP rate limit (also counts failed auth
// attempts), then bearer FRAME9_SERVICE_TOKEN (fail closed when unset). Both
// run before any body parsing, so unauthenticated bodies are never read.
app.use('/ai', rateLimit({
  windowMs: aiRateLimitWindowMs,
  limit: aiRateLimitMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ ok: false, error: 'Too many requests' })
}), requireServiceToken());

// Middleware
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ limit: BODY_LIMIT, extended: false }));

// Request logging
app.use((req, res, next) => {
  console.log(`\n📨 ${req.method} ${req.path}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Frame.9 AI Gateway',
    version: '1.0.0',
    description: 'Universal AI provider interface supporting Grok and ChatGPT',
    endpoints: {
      health: 'GET /ai/health',
      providers: 'GET /ai/providers',
      chat: 'POST /ai/chat',
      grok: 'POST /ai/grok',
      chatgpt: 'POST /ai/chatgpt',
      compare: 'POST /ai/compare'
    },
    docs: 'https://github.com/3XTRINITY-CORPORATION/Frame.-9'
  });
});

// AI routes
app.use('/ai', aiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Endpoint not found',
    availableEndpoints: {
      root: 'GET /',
      health: 'GET /ai/health',
      providers: 'GET /ai/providers',
      chat: 'POST /ai/chat',
      grok: 'POST /ai/grok',
      chatgpt: 'POST /ai/chatgpt',
      compare: 'POST /ai/compare'
    }
  });
});

// Error handler: map body-parser errors, never leak internals to clients
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, error: 'Payload too large' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
  }
  console.error('❌ Server Error:', err && err.message);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

return app;
}

const app = createApp();

// Start server (only when run directly, so tests can import the app)
if (require.main === module) app.listen(port, () => {
  console.log(`\n✨ Frame.9 AI Gateway started`);
  console.log(`📍 Server: http://localhost:${port}`);
  console.log(`🔗 Health: http://localhost:${port}/ai/health`);
  console.log(`📚 API: http://localhost:${port}/`);
  console.log(`\n🤖 Available Providers:`);
  
  const unifiedProvider = require('./services/unifiedProvider');
  const available = unifiedProvider.getAvailableProviders();
  
  if (available.length === 0) {
    console.log(`   ⚠️  No providers configured!`);
    console.log(`   Set OPENAI_API_KEY and/or XAI_API_KEY in .env`);
  } else {
    available.forEach(p => {
      console.log(`   ✅ ${p.name} (Cost: $${p.cost}/1K tokens, Speed: ${p.speed})`);
    });
  }
  
  console.log(`\n📖 Docs: https://github.com/3XTRINITY-CORPORATION/Frame.-9`);
  console.log(`\n`);
});

module.exports = app;
module.exports.createApp = createApp;
