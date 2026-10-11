# Frame.-9

Frame.9 AI Gateway.
Node 22 (`.nvmrc`). `npm ci && npm start`. Configuration: see `.env.example`.

## Security: `/ai/*` is server-to-server only

- Every `/ai/*` route needs `Authorization: Bearer <FRAME9_SERVICE_TOKEN>`. The token is compared in constant time.
- If `FRAME9_SERVICE_TOKEN` is not set, `/ai/*` answers `503` (fails closed).
- There is a per-IP rate limit (default 30 requests/min via `AI_RATE_LIMIT_MAX`). Failed auth attempts count toward it. Over the limit you get `429` with `Retry-After`.
- Request bodies are limited to 32 KB (`413` above that). Chat input is validated (`400`).
- Never call `/ai/*` from a browser or ship the token to clients.
- `GET /` stays public.
