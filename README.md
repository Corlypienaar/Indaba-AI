# IndabaAI

A guided AI marketing assistant for South African small businesses. An MVP for the Meta AI Academy South Africa Pitchathon, built on Meta's **Llama 4 Maverick** via **OpenRouter**.

## How it's wired

- `content/prompts.md` — the one file that makes the app sound like IndabaAI: the system prompt, interview questions, and output templates. Edit this file on GitHub to change what the app says. No code changes needed.
- `app/chat.tsx` — the chat screen and flow (welcome, interview, profile, offer, ads, image prompt, results).
- `app/api/chat/route.ts` — the only place the app talks to the AI. It sends the content file plus the user's answers to OpenRouter.
- `lib/content.ts` — reads the interview questions and model name out of `content/prompts.md`.

## Deploy (GitHub + Vercel)

1. Upload all of these files to a GitHub repository named `indabaai`.
2. On Vercel: Add New > Project > Import `indabaai`.
3. Before clicking Deploy, under Environment Variables add:
   - Name: `OPENROUTER_API_KEY`
   - Value: your OpenRouter API key (starts with `sk-or-v1-`)
4. Click Deploy. Done.

If the AI parts don't work after deploy, the key was probably added after the build: Settings > Environment Variables, add it, then Deployments > (three dots) > Redeploy.

## Changing the wording later

Edit `content/prompts.md` directly on GitHub (pencil icon > change > Commit changes). Vercel rebuilds automatically in about a minute.

## Model

`meta-llama/llama-4-maverick` via OpenRouter (`https://openrouter.ai/api/v1`). The model name is read from the MODEL AND HOSTING section of `content/prompts.md`.
