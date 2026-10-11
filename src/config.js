require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  aiProvider: process.env.AI_PROVIDER || 'auto',
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  },
  xai: {
    apiKey: process.env.XAI_API_KEY,
    model: process.env.XAI_MODEL || 'grok-2-latest',
    baseUrl: process.env.XAI_BASE_URL || 'https://api.x.ai/v1'
  }
};
