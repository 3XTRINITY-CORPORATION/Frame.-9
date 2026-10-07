const express = require('express');
const { generateText } = require('./services/aiProvider');
const { port, aiProvider } = require('./config');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, provider: aiProvider, service: 'Frame.9 AI gateway' });
});

app.post('/api/chat', async (req, res) => {
  try {
    const {
      provider = aiProvider,
      message,
      messages,
      model,
      systemPrompt = 'You are a helpful assistant.'
    } = req.body || {};

    if (!message && (!Array.isArray(messages) || messages.length === 0)) {
      return res.status(400).json({ error: 'Missing message or messages array' });
    }

    const result = await generateText({
      provider,
      text: message,
      messages,
      model,
      systemPrompt
    });

    return res.json({
      ok: true,
      provider,
      response: result
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Frame.9 AI gateway running on http://localhost:${port}`);
});
