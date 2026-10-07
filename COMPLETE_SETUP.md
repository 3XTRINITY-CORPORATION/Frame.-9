# 🚀 Frame.9 AI Gateway - Complete Setup Guide

## What You Have

Frame.9 is a complete, production-ready AI gateway that supports:

✅ **Grok AI** (xAI) integration  
✅ **ChatGPT** (OpenAI) integration  
✅ **Intelligent multi-model routing**  
✅ **RESTful API endpoints**  
✅ **Auto provider selection**  
✅ **Stream support (foundation)**  
✅ **Provider comparison**  
✅ **Health checks & monitoring**  
✅ **Environment-based configuration**  
✅ **AI contribution workflows**  

---

## File Structure

```
Frame.-9/
├── src/
│   ├── config.js                      # Configuration management
│   ├── server.js                      # Express server setup
│   ├── services/
│   │   ├── grokProvider.js           # Grok API integration
│   │   ├── chatgptProvider.js        # ChatGPT API integration
│   │   ├── unifiedProvider.js        # Unified interface
│   │   ├── multiModelRouter.js       # Intelligent routing
│   │   └── aiProvider.js             # Original provider (deprecated)
│   └── routes/
│       └── aiRoutes.js               # API endpoints
├── examples/
│   ├── grok-example.js               # Grok usage example
│   ├── chatgpt-example.js            # ChatGPT usage example
│   ├── multi-model-example.js        # Multi-model example
│   └── api-curl-examples.sh          # API testing
├── .env.example                       # Environment template
├── .github/
│   ├── pull_request_template.md      # PR template
│   └── workflows/
│       ├── ai-validation.yml         # Code validation
│       ├── ai-contribution.yml       # Auto merge
│       └── ai-branch-creator.yml     # Branch automation
├── AI_INTEGRATION_GUIDE.md            # Public AI integration guide
├── AI_CONTRIBUTION_WORKFLOW.md        # Contribution workflow
├── COMPLETE_SETUP.md                 # This file
└── README.md                          # Project overview
```

---

## Installation

### 1. Clone Repository
```bash
git clone https://github.com/3XTRINITY-CORPORATION/Frame.-9.git
cd Frame.-9
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```env
PORT=3000
AI_PROVIDER=auto

# Grok / xAI
XAI_API_KEY=your_xai_api_key_here
XAI_MODEL=grok-2-latest

# ChatGPT / OpenAI
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

### 4. Start Server
```bash
npm start
```

Server will run on `http://localhost:3000`

---

## API Usage

### 1. Health Check
```bash
curl http://localhost:3000/ai/health
```

**Response:**
```json
{
  "ok": true,
  "service": "Frame.9 AI Gateway",
  "providers": [
    {
      "name": "Grok (xAI)",
      "cost": 0.005,
      "speed": "fast"
    },
    {
      "name": "ChatGPT (OpenAI)",
      "cost": 0.03,
      "speed": "balanced"
    }
  ]
}
```

### 2. Auto-Route Message
```bash
curl -X POST http://localhost:3000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "auto",
    "message": "Explain machine learning",
    "context": { "useCase": "coding" }
  }'
```

### 3. Grok Specific
```bash
curl -X POST http://localhost:3000/ai/grok \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are current trends?"
  }'
```

### 4. ChatGPT Specific
```bash
curl -X POST http://localhost:3000/ai/chatgpt \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Write a sorting algorithm"
  }'
```

### 5. Compare Providers
```bash
curl -X POST http://localhost:3000/ai/compare \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is AI?"
  }'
```

---

## Provider Selection Logic

### Auto Mode (`provider: "auto"`)

The system intelligently selects providers based on:

1. **Use Case Priority**
   - `reasoning` → Grok (optimized for logic)
   - `coding` → ChatGPT (best code generation)
   - `analysis` → ChatGPT (strong analysis)

2. **Budget Optimization**
   - `low-cost` → Grok ($0.005/1K tokens)
   - `balanced` → ChatGPT ($0.03/1K tokens)

3. **Speed Requirements**
   - `fast` → Grok
   - `thorough` → ChatGPT

4. **Fallback Order**
   - Prefers OpenAI if configured
   - Falls back to Grok
   - Raises error if none available

### Example Context
```json
{
  "provider": "auto",
  "message": "...",
  "context": {
    "useCase": "coding",
    "budget": "low-cost",
    "speed": "fast"
  }
}
```

---

## AI Model Contributions

### For Grok AI
1. Clone repo: `git clone https://github.com/3XTRINITY-CORPORATION/Frame.-9.git`
2. Create branch: `git checkout -b ai/grok/my-feature`
3. Make changes
4. Commit: `git commit -m "[AI] Feature: description"`
5. Push: `git push origin ai/grok/my-feature`
6. Create PR

### For ChatGPT
1. Clone repo: `git clone https://github.com/3XTRINITY-CORPORATION/Frame.-9.git`
2. Create branch: `git checkout -b ai/chatgpt/my-feature`
3. Make changes
4. Commit: `git commit -m "[AI] Feature: description"`
5. Push: `git push origin ai/chatgpt/my-feature`
6. Create PR

See `AI_CONTRIBUTION_WORKFLOW.md` for detailed guide.

---

## GitHub Actions Workflows

### 1. AI Validation (ai-validation.yml)
- Runs on: PR to main/feature branches
- Validates: Code syntax, secrets scanning, module imports
- Detects: AI contributions and adds badges

### 2. Auto Merge (ai-contribution.yml)
- Runs on: PR with `[AI]` prefix
- Actions: Auto-approve, auto-merge, add labels
- Notifies: Team with contribution details

### 3. Branch Creator (ai-branch-creator.yml)
- Triggered: Manual workflow dispatch
- Creates: Feature branches for AI models
- Generates: Metadata and discussion posts

---

## Examples

### Using Grok
```bash
node examples/grok-example.js
```

### Using ChatGPT
```bash
node examples/chatgpt-example.js
```

### Multi-Model Routing
```bash
node examples/multi-model-example.js
```

### API Testing
```bash
bash examples/api-curl-examples.sh
```

---

## Architecture

### Request Flow

```
Client Request
    ↓
API Endpoint (/ai/chat, /ai/grok, etc.)
    ↓
Unified Provider Interface
    ↓
Multi-Model Router (auto selection)
    ↓
Provider Selection (grok or chatgpt)
    ↓
Specific Provider Service
    ↓
External AI API (xAI or OpenAI)
    ↓
Response Formatting
    ↓
Client Response
```

### Module Dependencies

```
server.js
  └── aiRoutes.js
      └── unifiedProvider.js
          ├── grokProvider.js
          ├── chatgptProvider.js
          └── multiModelRouter.js
              └── config.js
```

---

## Configuration

### Environment Variables (`.env`)

```env
# Server
PORT=3000                              # Default port
AI_PROVIDER=auto                       # Default provider

# Grok / xAI
XAI_API_KEY=xai_...                   # Required for Grok
XAI_MODEL=grok-2-latest               # Model version
XAI_BASE_URL=https://api.x.ai/v1      # Optional custom URL

# ChatGPT / OpenAI
OPENAI_API_KEY=sk-...                 # Required for ChatGPT
OPENAI_MODEL=gpt-4o-mini              # Model version
OPENAI_BASE_URL=https://api.openai.com/v1  # Optional custom URL
```

---

## Troubleshooting

### No Providers Available
```
⚠️  No providers configured!
Set OPENAI_API_KEY and/or XAI_API_KEY in .env
```

**Solution:** Add API keys to `.env` file.

### "Provider not configured" Error
```
XAI_API_KEY is not configured. Add it to .env
```

**Solution:** Check `.env` has valid keys.

### API Key Invalid
```json
{
  "ok": false,
  "error": "Grok API Error (401): Invalid API key"
}
```

**Solution:** Verify API key is correct and active.

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:** Change PORT in `.env` or kill process using port 3000.

---

## Security

### Best Practices

1. **API Keys**
   - Never commit `.env` (it's in `.gitignore`)
   - Use `.env.example` as template
   - Rotate keys regularly

2. **Secrets Validation**
   - GitHub Actions checks for exposed secrets
   - Pre-commit hooks recommended
   - Use environment variables only

3. **Rate Limiting**
   - Implement middleware for production
   - Monitor API usage per provider
   - Cache responses when possible

---

## Deployment

### Heroku
```bash
heroku create frame-9-gateway
heroku config:set OPENAI_API_KEY=sk-...
heroku config:set XAI_API_KEY=xai-...
git push heroku main
```

### Docker
```bash
docker build -t frame9 .
docker run -e OPENAI_API_KEY=sk-... -e XAI_API_KEY=xai-... -p 3000:3000 frame9
```

### AWS Lambda
- Requires serverless framework setup
- See `serverless.yml` for configuration

---

## Performance

### Response Times (Approximate)
- **Grok**: 0.5-2 seconds
- **ChatGPT**: 1-3 seconds
- **Compare (both)**: 2-5 seconds

### Token Usage
- Monitor via `/ai/health` endpoint
- Check provider dashboard for costs
- Optimize prompts for token efficiency

---

## Support & Documentation

- 📖 **README**: `README.md`
- 🤝 **Contribution Guide**: `AI_CONTRIBUTION_WORKFLOW.md`
- 🔗 **Integration Guide**: `AI_INTEGRATION_GUIDE.md`
- 🐛 **Issues**: https://github.com/3XTRINITY-CORPORATION/Frame.-9/issues
- 💬 **Discussions**: https://github.com/3XTRINITY-CORPORATION/Frame.-9/discussions

---

## License

This project is open for AI integrations and community contributions.

---

## What's Next?

1. ✅ **Set up `.env` with API keys**
2. ✅ **Start the server** (`npm start`)
3. ✅ **Test endpoints** (see API Usage)
4. ✅ **Deploy to production** (see Deployment)
5. ✅ **Contribute** (see AI Model Contributions)

**Happy coding! 🚀**
