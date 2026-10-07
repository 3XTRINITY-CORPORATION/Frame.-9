require('dotenv').config();
const express = require('express');
const aiRoutes = require('./routes/aiRoutes');
const { port } = require('./config');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    ok: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(port, () => {
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
