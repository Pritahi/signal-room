# Live Otari verification (hosted gateway)

Verified 2026-11-11 ~00:31 IST (2026-11-10 19:01 UTC) against the hosted Otari
gateway at `https://otari.ai/api/v1` from the workspace holding the hackathon
API key (US region).

- `GET /api/v1/models` -> HTTP 200, 165 models across 10 providers.
- Model 1 `meta/llama-3.3-70b-instruct`: `POST /api/v1/chat/completions`
  -> HTTP 200, completion "OK", usage {prompt_tokens: 40, completion_tokens: 2,
  cost_usd: "0.000030"}.
- Model 2 `alibaba/qwen3-coder-30b-a3b-instruct`: same request -> HTTP 200,
  completion "OK", cost_usd "0.000003".
- Both `Otari-Key: <key>` and OpenAI-style `Authorization: Bearer <key>`
  authenticate; the app's client uses `Authorization: Bearer` unchanged.

Notes for judges:

- The gateway model catalog spells model IDs as
  `meta/llama-3.3-70b-instruct` and does not list `Qwen/Qwen2.5-Coder-32B-Instruct`;
  the closest current coder model, `alibaba/qwen3-coder-30b-a3b-instruct`,
  is used as the Stage 2 default. Both defaults are overridable with
  `OTARI_MODEL_1` / `OTARI_MODEL_2` or the in-app Gateway Config modal.
- Earlier scaffold referenced `https://gateway.otari.mozilla.ai/v1`; the live
  hosted endpoint is `https://otari.ai/api/v1` (see the Models page "Make your
  first call" snippet and the Otari quickstart).
- Account balance at signup: USD 2.00 credit (US region). Each smoke test
  above cost under $0.0001.
