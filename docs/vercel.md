# Deploying Neverland Duel on Vercel

The browser never needs the OpenAI key. It sends a question to your own `/api/tutor` function. That function reads the key from Vercel's server environment and calls OpenAI. It returns only validated fact IDs; the browser displays the corresponding game facts.

```text
Player's browser → your Vercel /api/tutor → OpenAI
                          ↓
                  shared usage counter
```

The game, rules, Fate, and normal Coach all work without this service. Missing configuration or exhausted usage falls back to local guidance.

## 1. Deploy the source project

Import the repository into Vercel, or deploy this project directory with the Vercel CLI. Select the directory containing `package.json`, `api/`, `server/`, and `vercel.json` as the **Root Directory**. If the repository contains the outer workspace folder, this directory is `hook-practice`.

The included configuration selects **Vite**, runs `npm run build`, and serves `dist`. Use **Node.js 22** in the project's build settings. Vercel also deploys `api/tutor.js` as a Node function. Uploading only the static `dist/` directory will not deploy that function.

Keep `.env.local`, `.runtime/`, `node_modules/`, and `release/` out of the repository and upload. They are ignored locally; `.env.example` contains names and empty values only. No key belongs in `public/`, frontend source, `vercel.json`, a screenshot, or a README.

## 2. Save the OpenAI key as a Vercel Secret

Open **Project → Settings → Environment Variables**. Add:

| Name | Value | Type | Environment |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | Your OpenAI API key | **Secret** | **Production** |

Paste the value directly into Vercel's secret field. Never name it `VITE_OPENAI_API_KEY`: Vite's `VITE_` prefix is for values intended for browser code. Vercel's Secret type hides the saved value in its dashboard; keeping all reads in server code is what keeps it out of the frontend.

Enable Preview only if you want preview deployments to use AI too. Prefer a separate key for previews. Local `.env.local` is not automatically your Vercel configuration.

## 3. Connect the shared quota

Public server functions can run on several instances, so a variable in memory or a temporary local file cannot enforce one global allowance. This project requires a shared Redis counter before it sends production requests to OpenAI.

Connect an **Upstash Redis** database through Vercel's Marketplace/Storage integration, or use an existing Upstash database. Review the provider's plan before creating it. Add its REST credentials in the same Vercel environment:

| Name | Value | Type |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | Database's HTTPS REST URL ending in `.upstash.io` | **Secret** |
| `UPSTASH_REDIS_REST_TOKEN` | Database's REST token with read/write permission | **Secret** |

The Vercel integration can instead create `KV_REST_API_URL` and `KV_REST_API_TOKEN` when connected with the prefix **KV**. The server accepts these names as aliases, so there is no need to copy or expose their values. Do not use a read-only token: quota reservations increment counters. Do not set `LUNA_BUDGET_PATH` on Vercel; that file is only for local development.

The shared database receives counters only, not player questions, board facts, or the OpenAI key. Keep key eviction disabled so the total cannot disappear to free space. The total key is `neverland-duel:luna:v1:total`, without an expiry. Deleting that key or changing databases starts a fresh allowance.

The configured allowance is **200 uncached OpenAI attempts for the demo**, across users and deployments, with at most **20 per minute**. Reservations happen before the call; failed calls consume a slot, and the server does not retry them. Each call uses `gpt-6-luna`, no reasoning, and at most 256 output tokens. Individual browser sessions also stop requesting AI after 20 attempts. Cached selections do not require another OpenAI call.

This bounds requests, not an exact dollar amount. Use an OpenAI project-specific key and monitor its usage. This endpoint is public: someone could consume the allowance, but cannot obtain the key through its response. If the counter is missing, invalid, or unavailable, the function does not call OpenAI.

## 4. Redeploy and check

Environment-variable changes apply to new deployments. Redeploy after saving the OpenAI key and connecting both Redis REST variables.

1. Open the new production URL and confirm the title is **Neverland Duel** and the video link is present.
2. Start **Tutorial**, open **Ask Coach a question**, and ask **Why does the next move help?**
3. A working AI reply is labeled **Selected by Luna · facts checked by the game**. **Local Coach · verified explanation** means the game fell back; check that all three server variables are present, the Redis allowance remains, and the OpenAI key has access to Luna.
4. In browser developer tools, the only tutor request should be to your own `/api/tutor`. Its payload contains the question and visible facts, and its response contains IDs. Neither should contain credentials. There should be no browser request directly to `api.openai.com`.
5. Test the video at `/submission/explainer.html`, return to the game, and confirm the tutorial still works.

Never paste a key into logs while diagnosing a failure. Server responses deliberately omit OpenAI error bodies and credentials. To replace the key, update the Vercel Secret and redeploy. To disable AI, remove the server key and redeploy; the local game remains playable.

## References

- [Vite and Vercel Functions](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel environment variables and deployment scope](https://vercel.com/docs/environment-variables)
- [Vercel Config and Secret types](https://vercel.com/changelog/environment-variables-now-use-config-and-secret-types)
- [Upstash Redis REST API](https://upstash.com/docs/redis/features/restapi)

These instructions prepare a deployment; they do not claim this build is already live. The previously published preview must be redeployed from the final source before submission.
