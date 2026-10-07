# Frame.9 - AI Integration Guide

## Public Repository Access for AI Models

This repository is configured for open AI integrations. All AI models (Grok, ChatGPT, Claude, etc.) can access and contribute to this project.

---

## 🔓 Access Methods

### Method 1: HTTPS Clone (Public - No Auth Required)
```bash
git clone https://github.com/3XTRINITY-CORPORATION/Frame.-9.git
cd Frame.-9
```

### Method 2: SSH Clone (If SSH Key is configured)
```bash
git clone git@github.com:3XTRINITY-CORPORATION/Frame.-9.git
cd Frame.-9
```

### Method 3: Deploy Token (For Automated CI/CD)
```bash
git clone https://<USERNAME>:<DEPLOY_TOKEN>@github.com/3XTRINITY-CORPORATION/Frame.-9.git
```

---

## 🚀 For AI Models to Push Changes

### Grok AI
- Repository: `https://github.com/3XTRINITY-CORPORATION/Frame.-9`
- Branch: `feature/ai-engine-integration` (or create your own)
- Steps:
  1. Clone the repo
  2. Create a feature branch: `git checkout -b feature/grok-enhancement`
  3. Make changes
  4. Push: `git push origin feature/grok-enhancement`
  5. Create a Pull Request

### ChatGPT / OpenAI Integration
- Repository: `https://github.com/3XTRINITY-CORPORATION/Frame.-9`
- Branch: `feature/ai-engine-integration` (or create your own)
- Steps:
  1. Clone the repo
  2. Create a feature branch: `git checkout -b feature/chatgpt-enhancement`
  3. Make changes
  4. Push: `git push origin feature/chatgpt-enhancement`
  5. Create a Pull Request

---

## 📋 Current Structure

```
Frame.-9/
├── src/
│   ├── config.js          # Configuration for both AI providers
│   ├── services/
│   │   └── aiProvider.js  # Grok + ChatGPT service layer
│   └── index.js           # Express server
├── .env.example           # Environment variables template
├── package.json           # Node.js dependencies
├── .gitignore
├── README.md
└── AI_INTEGRATION_GUIDE.md
```

---

## 🔑 Environment Variables

Create a `.env` file based on `.env.example`:

```env
PORT=3000
AI_PROVIDER=auto

# ChatGPT / OpenAI
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini

# Grok / xAI
XAI_API_KEY=your_key_here
XAI_MODEL=grok-2-latest
```

---

## 🌐 API Endpoints

### Health Check
```bash
GET http://localhost:3000/health
```

### Chat with AI
```bash
POST http://localhost:3000/api/chat
Content-Type: application/json

{
  "provider": "grok",
  "message": "Your message here",
  "systemPrompt": "Optional system prompt"
}
```

Or with ChatGPT:
```bash
{
  "provider": "chatgpt",
  "message": "Your message here",
  "systemPrompt": "Optional system prompt"
}
```

---

## 📦 Installation & Running

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your API keys

# Run the server
npm start
```

---

## ✅ Contributing Guidelines

1. **Fork or Branch**: Create a feature branch for your changes
2. **Follow Structure**: Keep code in `/src` directory
3. **Test**: Make sure your changes work locally
4. **Commit**: Use clear commit messages
5. **Push**: Push to your feature branch
6. **PR**: Create a Pull Request with description

---

## 🔗 Repository Links

- **GitHub**: https://github.com/3XTRINITY-CORPORATION/Frame.-9
- **Clone HTTPS**: `https://github.com/3XTRINITY-CORPORATION/Frame.-9.git`
- **Clone SSH**: `git@github.com:3XTRINITY-CORPORATION/Frame.-9.git`
- **Issues**: https://github.com/3XTRINITY-CORPORATION/Frame.-9/issues
- **Discussions**: https://github.com/3XTRINITY-CORPORATION/Frame.-9/discussions

---

## 🤖 Supported AI Models

- ✅ Grok (xAI)
- ✅ ChatGPT / OpenAI
- 🔄 Claude (coming soon)
- 🔄 Llama (coming soon)
- 🔄 Mistral (coming soon)

---

## 📝 License

This project is open for AI integrations. All contributors welcome!

---

## 📧 Contact

For issues or questions, open a GitHub Issue or Discussion.
