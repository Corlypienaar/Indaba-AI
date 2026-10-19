import { NextResponse } from "next/server";
import { getContentRaw, getModelName } from "@/lib/content";

// This route is the only place the app talks to the AI.
// It reads the whole content file (system prompt, templates, rules) and sends
// it to Llama via OpenRouter, together with the user's interview answers and
// a short instruction for the current stage of the flow.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Answer = { question: string; answer: string };

type ChatRequest = {
  stage: "profile" | "profile_fix" | "offer" | "offer_adjust" | "ads" | "image";
  answers: Answer[];
  profile?: string;
  offer?: string;
  note?: string;
};

function transcript(answers: Answer[]): string {
  return answers
    .map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`)
    .join("\n\n");
}

function stageInstruction(body: ChatRequest): string {
  switch (body.stage) {
    case "profile":
      return (
        "Task: Using the PROFILE PLAYBACK TEMPLATE in your instructions, write the profile " +
        "playback for this business and ask if you got it right. Output only the playback text, nothing else."
      );
    case "profile_fix":
      return (
        "You previously wrote this profile playback:\n" +
        (body.profile || "") +
        "\n\nThe user says this needs fixing: " +
        (body.note || "") +
        "\n\nTask: Rewrite the profile playback with that correction applied, using the PROFILE PLAYBACK TEMPLATE, and ask again if it's right. Output only the playback text."
      );
    case "offer":
      return (
        "The user confirmed this profile:\n" +
        (body.profile || "") +
        "\n\nTask: Using the OFFER TEMPLATE, propose ONE sharpened offer sentence for this business. " +
        "Then run the inline honesty check from your instructions in one or two plain sentences: does the price match what they said in the interview, and is the reason to act now real (not invented)? " +
        "If something looks weak, say so and ask if they want to adjust or go ahead as is. If it holds up, say briefly that it holds up. " +
        "Remember: if there is genuinely no urgency, say so honestly rather than inventing a deadline."
      );
    case "offer_adjust":
      return (
        "The user confirmed this profile:\n" +
        (body.profile || "") +
        "\n\nYou previously proposed this offer:\n" +
        (body.offer || "") +
        "\n\nThe user wants this changed: " +
        (body.note || "") +
        "\n\nTask: Rewrite the offer as ONE sentence using the OFFER TEMPLATE with their change applied, then briefly re-run the honesty check in one or two sentences."
      );
    case "ads":
      return (
        "The user confirmed this profile:\n" +
        (body.profile || "") +
        "\n\nAnd locked in this offer:\n" +
        (body.offer || "") +
        "\n\nTask: Using the THREE ADS TEMPLATE, write exactly three Meta ads for this business, each under 125 words, each with a different hook. Format them exactly like this:\n\n" +
        "AD 1 - PROBLEM\nHeadline: [headline]\n[body]\n\nAD 2 - RESULT\nHeadline: [headline]\n[body]\n\nAD 3 - SOCIAL PROOF\nHeadline: [headline]\n[body]\n\n" +
        "Output only the three ads in that format, nothing else."
      );
    case "image":
      return (
        "The user confirmed this profile:\n" +
        (body.profile || "") +
        "\n\nAnd locked in this offer:\n" +
        (body.offer || "") +
        "\n\nTask: Fill in the IMAGE PROMPT TEMPLATE for this business, choosing square or vertical based on where they're most likely to post. Replace every [bracket] with real details from what the user told you. " +
        "Output the filled-in prompt ready to paste into Meta AI, then on a new line add the tip about AI tools often misspelling text in images."
      );
    default:
      return "Task: Continue helping the user per your instructions.";
  }
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "The OPENROUTER_API_KEY environment variable is missing. Add it in Vercel under Settings > Environment Variables, then redeploy.",
      },
      { status: 500 }
    );
  }

  const content = getContentRaw();
  const systemPrompt =
    content +
    "\n\n---\nYou are running inside the IndabaAI web app. Follow the SYSTEM PROMPT, templates and rules above exactly. " +
    "Reply in plain text only (no markdown symbols like ** or #). Keep replies short and warm.";

  const userMessage =
    "Interview transcript (the user's own answers):\n\n" +
    transcript(body.answers || []) +
    "\n\n" +
    stageInstruction(body);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://indabaai.vercel.app",
        "X-Title": "IndabaAI",
      },
      body: JSON.stringify({
        model: getModelName(),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const friendly =
        res.status === 429
          ? "The AI is getting too many requests right now (rate limit). Wait a minute and tap Try again."
          : "The AI service returned an error. Tap Try again in a moment.";
      console.error("OpenRouter error", res.status, detail);
      return NextResponse.json({ error: friendly }, { status: 502 });
    }

    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "The AI sent back an empty reply. Tap Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ text: text.trim() });
  } catch (err) {
    console.error("OpenRouter request failed", err);
    return NextResponse.json(
      { error: "Couldn't reach the AI service. Check your connection and tap Try again." },
      { status: 502 }
    );
  }
}
