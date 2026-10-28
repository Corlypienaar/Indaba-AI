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

// The writing prompt is the fenced block under WRITING PROMPT.
export function getWritingPrompt(): string {
  try {
    const text = fenced(section(getContentRaw(), "WRITING PROMPT"));
    if (text.length > 200) return text;
  } catch {
    // fall through
  }
  return "Write 3 Facebook/Instagram ads for the business below. Each ad uses a different hook (problem call-out, proof or result, curiosity or bold claim). Keep the offer, call-to-action button and destination identical across all 3 ads. Use only the facts given.\n\n=== BUSINESS DETAILS ===\n1. Business name and product/service: [ANSWER 1]\n2. Customers and area: [ANSWER 2]\n3. Customer's problem (in their words): [ANSWER 3]\n4. Proof (checkable): [ANSWER 4]\n5. Common mistake or myth: [ANSWER 5]\n6. Price or offer: [ANSWER 6]\n7. Main worry or objection: [ANSWER 7]\n8. How to contact/buy and reply speed: [ANSWER 8]\n9. Real reason to act now: [ANSWER 9]\n10. Language, tone, words to use/avoid: [ANSWER 10]";
}

export type Question = {
  key: string;
  required: boolean;
  text: string;
  hint: string;
  choices: string[];
};

const FALLBACK_SYSTEM =
  "You are IndabaAI, a friendly South African marketing helper for small business owners. Use plain, warm English. Use only facts the owner gave. Never invent anything. Write three different Meta ads, each with a different hook.";

// Hard-coded fallback, copied from content/prompts.md, used only if the file
// can't be parsed (so the app never dies on a formatting typo).
const FALLBACK_QUESTIONS: Question[] = [
  { key: "business", required: true, text: "What is your business name, and what one product or service do you want to advertise?", hint: "Pipe Pros: same-day geyser replacement", choices: [] },
  { key: "customers", required: false, text: "Who are your customers, and what area do you serve?", hint: "Homeowners in Pretoria East and Centurion", choices: [] },
  { key: "problem", required: false, text: "What problem makes people contact you? Use the words customers actually say.", hint: "My geyser burst and there's water everywhere", choices: [] },
  { key: "proof", required: false, text: "Why should they choose you? Give proof they can check: your rating and number of reviews, years in business, jobs done, a guarantee, a real customer review or a before and after result.", hint: "4.8 stars from 312 Google reviews, 60-minute response", choices: [] },
  { key: "myth", required: false, text: "What mistake do customers often make, or what myth do you keep correcting?", hint: "They replace the whole geyser when only the element is faulty", choices: [] },
  { key: "offer", required: true, text: "What's the price, \"from\" price or special offer?", hint: "From R1,499 installed, or Free quote", choices: [] },
  { key: "objection", required: false, text: "What worry or question stops people from buying?", hint: "Is there a call-out fee?", choices: [] },
  { key: "contact", required: true, text: "How should customers contact you or buy?", hint: "", choices: ["WhatsApp", "Call", "Book online", "Shop online", "Visit us"] },
  { key: "urgency", required: false, text: "Is there a real reason to act now? For example a deadline, limited slots or a season. Skip it if there isn't one.", hint: "Only 6 install slots left this month", choices: [] },
  { key: "tone", required: false, text: "What language and tone suit your customers, and are there words you must use or avoid?", hint: "Casual English with some Afrikaans; never say \"cheapest\"", choices: [] },
];

export function getQuestions(): Question[] {
  try {
    const body = fenced(section(getContentRaw(), "INTERVIEW SCRIPT"));
    const questions: Question[] = [];
    for (const line of body.split("\n")) {
      const m = line.match(/^\s*\d+\.\s+(.*)$/);
      if (!m) continue;
      const parts = m[1].split("|").map((p) => p.trim());
      if (parts.length < 3) continue;
      const [key, req, text, hint = "", choices = ""] = parts;
      questions.push({
        key,
        required: /^required$/i.test(req),
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
