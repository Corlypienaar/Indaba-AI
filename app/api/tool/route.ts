import { NextResponse } from "next/server";
import { getCard, type Answers, type Calc } from "@/lib/cards";
import { getModelName, callOpenRouter } from "@/lib/content";

// The guided cards talk to Llama through this route only.
// The browser sends the card slug, the owner's answers and the numbers the
// app already calculated. This route builds the best-practice prompt
// (expert role, honesty rules, the owner's answers) and sends it to Llama.
// Nothing is stored.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ToolRequest = { slug: string; answers: Answers; calc: Calc; skipped: string[] };

const COMMON_RULES = `You are the helper inside IndabaAI, a free tool for small business owners. Speak as "we" and to "you". Never say "I". Never claim personal experience.
Write in plain, warm, honest English that a person with no business or AI background understands after one read. Use short sentences and short paragraphs.
Be honest and do not simply agree with the owner. If a number, plan or habit looks weak, say so kindly, say why, and say what would make it stronger.
Start with what is working. Then show two or three things worth a closer look, written as clear observations or questions. Then give one practical thing to do this month.
Use only the information and numbers given. Never invent facts, statistics, market prices, laws or expert quotes. If a number is missing, say how the owner can find it.
Do not give tax, legal or medical advice. If a tax or legal point matters, tell the owner to check with their accountant or the relevant authority.
Never use dashes as breaks. Use full stops, commas or colons. Do not use the pattern "not X, but Y" or "neither X nor Y". State the positive thing directly.
Avoid jargon and hype words. Reply in plain text only, with no markdown symbols like ** or #. You may use simple headings on their own line, such as "What is working".
Treat names and numbers as the owner's private information. Do not repeat more personal detail than needed.`;

// Replace dashes used as breaks, so the result matches the app's voice.
function tidy(text: string): string {
  return text
    .split("\n")
    .filter((l) => !/^\s*(Note|Let me know|I hope|Feel free|Would you like)/i.test(l))
    .join("\n")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s--\s/g, ", ")
    .replace(/[*#_]{1,3}/g, "")
    .trim();
}

export async function POST(req: Request) {
  let body: ToolRequest;
  try {
    body = (await req.json()) as ToolRequest;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const card = getCard(body.slug);
  if (!card) return NextResponse.json({ error: "Unknown tool." }, { status: 404 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The OPENROUTER_API_KEY environment variable is missing. Add it in Vercel under Settings > Environment Variables, then redeploy." },
      { status: 500 }
    );
  }

  const skippedNote =
    body.skipped && body.skipped.length
      ? `\n\nThe owner skipped these questions, so treat them as unknown and say briefly how to find the answer: ${body.skipped.join("; ")}.`
      : "";

  const systemPrompt = `${card.role}\n\n${COMMON_RULES}`;
  const userMessage =
    card.task(body.answers || {}, body.calc || {}) +
    skippedNote +
    `\n\nKeep the whole answer under ${card.maxWords} words.`;

  try {
    const res = await callOpenRouter(apiKey, {
      model: getModelName(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.6,
      max_tokens: 1200,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("OpenRouter error", res.status, detail);
      const friendly =
        res.status === 429
          ? "The AI is getting too many requests right now. Wait a minute and tap Try again."
          : "The AI service returned an error. Tap Try again in a moment.";
      return NextResponse.json({ error: friendly }, { status: 502 });
    }

    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "The AI sent back an empty reply. Tap Try again." }, { status: 502 });
    }
    return NextResponse.json({ text: tidy(text) });
  } catch (err) {
    console.error("OpenRouter request failed", err);
    return NextResponse.json(
      { error: "Couldn't reach the AI service. Check your connection and tap Try again." },
      { status: 502 }
    );
  }
}
