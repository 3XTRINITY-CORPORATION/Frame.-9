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
- `FRAME9_SERVICE_TOKEN`: a long random value that callers must send as a bearer token
  (for example `openssl rand -hex 32`). If it is unset, `POST /api/chat` answers `503`.

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
  -H "Authorization: Bearer $FRAME9_SERVICE_TOKEN" \
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
  -H "Authorization: Bearer $FRAME9_SERVICE_TOKEN" \
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

## Security

`GET /health` is public and returns only `{ "ok": true, "service": "Frame.9 AI gateway" }`.

`POST /api/chat` is protected:

| Condition | Status |
|---|---|
| `FRAME9_SERVICE_TOKEN` not configured on the server | `503` |
| Missing or wrong `Authorization: Bearer <token>` | `401` |
| More than 30 requests per minute from one IP (in-memory, per process) | `429` |
| Body larger than 32 kB | `413` |
| Invalid JSON, `message` not a non-empty string (max 8000 chars), bad `provider`/`messages` | `400` |
| Upstream AI provider error (details are logged server-side, not returned) | `502` |

The token is compared in constant time. The rate limiter is per process; use a shared store
if you run several instances behind a load balancer.

## Tests

```bash
npm ci
npm test
```

Tests use Node's built-in `node:test` runner and stub the outbound AI call, so no API keys are needed.

## Notes

- In `auto` mode, the app uses OpenAI if `OPENAI_API_KEY` is set; otherwise it falls back to Grok.
- Both providers use a standard OpenAI-compatible chat completion payload design.
- You can switch models with `OPENAI_MODEL` and `XAI_MODEL`.
