# Frame.9

This repository now includes a simple AI gateway that can route requests to both Grok and ChatGPT.

## Features

- ChatGPT / OpenAI-compatible API integration
- Grok / xAI integration
- Single endpoint to send requests to either provider
- Easy environment configuration through `.env`

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file:

```bash
cp .env.example .env
```

3. Add your keys:

- `OPENAI_API_KEY` for ChatGPT
- `XAI_API_KEY` for Grok

4. Start the server:

```bash
npm start
```

5. Test the health check:

```bash
curl http://localhost:3000/health
```

## Example API request

### ChatGPT

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "chatgpt",
    "message": "Write a short welcome message for my app.",
    "systemPrompt": "You are a helpful assistant for a SaaS product."
  }'
```

### Grok

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "grok",
    "message": "Summarize this project in 3 bullet points.",
    "systemPrompt": "You are a concise technical assistant."
  }'
```

## Provider config options

Set the provider in `.env`:

```env
AI_PROVIDER=auto
```

Possible values:

- `auto`
- `chatgpt`
- `grok`

## Notes

- In `auto` mode, the app uses OpenAI if `OPENAI_API_KEY` is set; otherwise it falls back to Grok.
- Both providers use a standard OpenAI-compatible chat completion payload design.
- You can switch models with `OPENAI_MODEL` and `XAI_MODEL`.
