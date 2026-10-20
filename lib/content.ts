import fs from "fs";
import path from "path";

// Everything that makes the app sound like IndabaAI lives in content/prompts.md.
// This file only READS that file; it never changes the words.

const CONTENT_PATH = path.join(process.cwd(), "content", "prompts.md");

export function getContentRaw(): string {
  return fs.readFileSync(CONTENT_PATH, "utf8");
}

export type Question = { text: string; optional: boolean };

// Hard-coded fallback, copied word for word from content/prompts.md, used only
// if the file can't be parsed (so the app never dies on a formatting typo).
const FALLBACK_QUESTIONS: Question[] = [
  { text: "What's your business, in one sentence? (what you do, who it's for, and where you are)", optional: false },
  { text: "How long have you been running it?", optional: false },
  { text: "Where are you with marketing today: never posted, boosted a post once or twice, or already in Ads Manager?", optional: false },
  { text: "What do people usually say when they're happy with what you did for them?", optional: false },
  { text: "What's the one thing stopping people from buying right now (price, trust, not knowing you exist)?", optional: false },
  { text: "What do you charge, or want to charge, for your main offer? (If you already told us, just confirm it.)", optional: false },
  { text: "Roughly what does one job or sale cost you: products or stock, fuel or travel, helpers, card fees? A rough total in rand is fine.", optional: false },
  { text: "How do you want customers to respond to the ad: send a WhatsApp, call, visit, book, or buy online? And any rules they must know, like how much notice you need, or collection only?", optional: false },
  { text: "Is there a reason someone should act this week rather than \"someday\"? (a deadline, limited slots, a seasonal reason; if truly none, say so, don't invent one)", optional: false },
  { text: "Anything else about the business you think matters?", optional: true },
];

export function getQuestions(): Question[] {
  try {
    const raw = getContentRaw();
    const start = raw.indexOf("## INTERVIEW SCRIPT");
    if (start === -1) return FALLBACK_QUESTIONS;
    const rest = raw.slice(start);
    const nextSection = rest.indexOf("\n## ", 1);
    const section = nextSection === -1 ? rest : rest.slice(0, nextSection);

    // The questions sit inside a ``` fenced block.
    const fenceMatch = section.match(/```([\s\S]*?)```/);
    const body = fenceMatch ? fenceMatch[1] : section;

    const questions: Question[] = [];
    let current: string | null = null;
    for (const line of body.split("\n")) {
      const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
      if (numbered) {
        if (current !== null) questions.push(makeQuestion(current));
        current = numbered[1].trim();
      } else if (current !== null && line.trim() !== "") {
        current += " " + line.trim();
      }
    }
    if (current !== null) questions.push(makeQuestion(current));

    return questions.length >= 5 ? questions : FALLBACK_QUESTIONS;
  } catch {
    return FALLBACK_QUESTIONS;
  }
}

function makeQuestion(text: string): Question {
  const optional = /^\(optional/i.test(text);
  // Strip the "(optional, only if answers are thin)" note from what the user sees.
  const cleaned = optional ? text.replace(/^\(optional[^)]*\)\s*/i, "") : text;
  return { text: cleaned.trim(), optional };
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
