import fs from "fs";
import path from "path";

// Everything that makes the app sound like IndabaAI lives in content/prompts.md.
// This file only READS that file; it never changes the words.

const CONTENT_PATH = path.join(process.cwd(), "content", "prompts.md");

export function getContentRaw(): string {
  return fs.readFileSync(CONTENT_PATH, "utf8");
}

function section(raw: string, heading: string): string {
  const start = raw.indexOf("## " + heading);
  if (start === -1) return "";
  const rest = raw.slice(start);
  const next = rest.indexOf("\n## ", 1);
  return next === -1 ? rest : rest.slice(0, next);
}

function fenced(text: string): string {
  const m = text.match(/```([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

// The system prompt is the fenced block under SYSTEM PROMPT, nothing else.
export function getSystemPrompt(): string {
  try {
    const s = section(getContentRaw(), "SYSTEM PROMPT");
    const text = fenced(s);
    if (text.length > 200) return text;
  } catch {
    // fall through
  }
  return FALLBACK_SYSTEM;
}

export type Question = {
  key: string;
  required: boolean;
  step: string;
  text: string;
  hint: string;
  choices: string[];
};

const FALLBACK_SYSTEM =
  "You are IndabaAI, a friendly South African marketing helper for small business owners. Use plain, warm English. Use only facts the owner gave. Never invent anything. Write three different Meta ads, each with a different hook.";

// Hard-coded fallback, copied from content/prompts.md, used only if the file
// can't be parsed (so the app never dies on a formatting typo).
const FALLBACK_QUESTIONS: Question[] = [
  { key: "business", required: true, step: "Your business", text: "What's your business called, and what do you sell?", hint: "Thandi's Hair Studio: braids, wigs and natural hair", choices: [] },
  { key: "area", required: false, step: "Your business", text: "Which area are most of your customers in?", hint: "Protea Glen and Naledi, Soweto", choices: [] },
  { key: "offer", required: true, step: "Your business", text: "Which ONE service or product do you want to advertise first? What does it cost, and what's included?", hint: "Knotless braids, mid-back, R450, hair included, about 5 hours", choices: [] },
  { key: "customer", required: false, step: "Your customer", text: "Who is your best customer, and what's going on when they need you?", hint: "Working moms who need neat hair that lasts 6 weeks", choices: [] },
  { key: "problem", required: false, step: "Your customer", text: "What problem do they come to you with? Use their words.", hint: "My last braids pulled my edges out", choices: [] },
  { key: "quote", required: false, step: "Your customer", text: "What has a happy customer actually said or sent you? Their exact words.", hint: "Lightest braids I've ever had, no headache", choices: [] },
  { key: "proof", required: false, step: "Why you", text: "What proof can you show? Number of clients, years open, Google or Facebook rating, repeat customers.", hint: "2 years, about 300 clients, 4.9 stars on Google (40 reviews)", choices: [] },
  { key: "whyyou", required: false, step: "Why you", text: "Why do people choose you over other places nearby?", hint: "No tension on the edges, done in 5 hours, open Sundays", choices: [] },
  { key: "myth", required: false, step: "Why you", text: "Is there a common mistake or myth your customers believe?", hint: "That tight braids last longer. They just cause breakage.", choices: [] },
  { key: "contact", required: true, step: "Getting the sale", text: "What WhatsApp number should people message, and any rules? (deposit, notice, hours)", hint: "WhatsApp 07X XXX XXXX, R100 deposit, 2 days' notice", choices: [] },
  { key: "urgency", required: false, step: "Getting the sale", text: "Is there a real reason to book now?", hint: "", choices: ["Limited slots this week", "A season or holiday is coming", "An intro price for a short time", "No, nothing special right now"] },
  { key: "cost", required: false, step: "Getting the sale", text: "Roughly what does one job cost you? Products, petrol, helpers, card fees. A rough total is fine.", hint: "R220", choices: [] },
];

export function getQuestions(): Question[] {
  try {
    const body = fenced(section(getContentRaw(), "INTERVIEW SCRIPT"));
    const questions: Question[] = [];
    for (const line of body.split("\n")) {
      const m = line.match(/^\s*\d+\.\s+(.*)$/);
      if (!m) continue;
      const parts = m[1].split("|").map((p) => p.trim());
      if (parts.length < 4) continue;
      const [key, req, step, text, hint = "", choices = ""] = parts;
      questions.push({
        key,
        required: /^required$/i.test(req),
        step,
        text,
        hint,
        choices: choices ? choices.split(";").map((c) => c.trim()).filter(Boolean) : [],
      });
    }
    return questions.length >= 8 ? questions : FALLBACK_QUESTIONS;
  } catch {
    return FALLBACK_QUESTIONS;
  }
}

export function getModelName(): string {
  try {
    const m = getContentRaw().match(/Model:\*{0,2}\s*`([^`]+)`/);
    if (m) return m[1];
  } catch {
    // fall through
  }
  return "meta-llama/llama-3.3-70b-instruct";
}

// Only Meta Llama answers, through providers that do not log or train on prompts.
// allow_fallbacks: true lets OpenRouter try ANOTHER COMPANY hosting the same Llama model when the
// first one is busy. It never switches to a different model (that would need a "models" list).
export const PROVIDER_RULES = { allow_fallbacks: true, data_collection: "deny", sort: "throughput" } as const;

// One call to OpenRouter. On a 429 (too many requests) or a temporary server hiccup it waits
// and tries again, up to 3 more times (after 2s, 4s, 8s), so a busy moment does not turn into
// an error on the owner's screen.
export async function callOpenRouter(apiKey: string, payload: Record<string, unknown>): Promise<Response> {
  const send = () =>
    fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://indaba-ai.vercel.app",
        "X-Title": "IndabaAI",
      },
      body: JSON.stringify({ ...payload, provider: PROVIDER_RULES }),
    });
  let res = await send();
  for (let attempt = 1; attempt <= 3 && [429, 502, 503].includes(res.status); attempt++) {
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    res = await send();
  }
  return res;
}
