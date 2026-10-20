import { NextResponse } from "next/server";
import { getContentRaw, getModelName, PROVIDER_RULES } from "@/lib/content";

// This route is the only place the app talks to the AI.
// It reads the whole content file (system prompt, templates, rules) and sends
// it to Llama via OpenRouter, together with the user's interview answers and
// a short instruction for the current stage of the flow.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Answer = { question: string; answer: string };

type ChatRequest = {
  stage: "profile" | "profile_fix" | "offer" | "offer_adjust" | "ads" | "ads_fix" | "image";
  ads?: string;
  problems?: string;
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

const ACTION_HINT = "send a WhatsApp, call, visit, book or buy, whichever the owner asked for";

// Ask the model to compare the ads against the owner's answers. Returns "" when clean.
async function factCheck(apiKey: string, answersText: string, ads: string): Promise<string> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://indaba-ai.vercel.app", "X-Title": "IndabaAI" },
      body: JSON.stringify({
        provider: PROVIDER_RULES,
        model: getModelName(),
        messages: [
          { role: "system", content: "You are a strict fact checker for small business ads. You only list contradictions and inventions. You never rewrite." },
          { role: "user", content: "Here is what the business owner said about their business:\n\n" + answersText + "\n\nHere are three ads written from it:\n\n" + ads + "\n\nDo two checks.\n1. INVENTED: list every claim in the ads that contradicts what the owner said, or that the owner never said (for example delivery when they said collection only, last-minute or emergency service when they need notice, a discount, a guarantee, an area, a price, or an opening time they did not give). Quote the ad words.\n2. MISSING: from the owner's answers, pick out the conditions a customer must know before they respond: service area, what is and is not included, what the customer must provide, notice period, collection or delivery, hours, price. For each ad (AD 1, AD 2, AD 3), list any of these key conditions that ad leaves out.\nOne problem per line. If there are no problems at all, reply with exactly: NONE" },
        ],
        temperature: 0,
        max_tokens: 400,
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const text: string = (data?.choices?.[0]?.message?.content || "").trim();
    if (!text || /^none\b/i.test(text)) return "";
    return text;
  } catch {
    return "";
  }
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
        "\n\nTask: Rewrite the offer as ONE sentence using the OFFER TEMPLATE with their change applied. Reply in the same two-part format:\nOFFER: [the single finished offer sentence]\nCHECK: [one or two plain sentences on whether it holds up]"
      );
    case "ads":
      return (
        "The user confirmed this profile:\n" +
        (body.profile || "") +
        "\n\nAnd locked in this offer:\n" +
        (body.offer || "") +
        "\n\nTask: Using the THREE ADS TEMPLATE, write exactly three Meta ads for this business, each under 125 words, each with a different hook.\n" +
        "FACT RULES (these matter more than anything else): every claim must come from the owner's own answers. Stay inside what they said about lead time, delivery or collection, location, price and availability. Never invent urgency, emergencies, same-day or last-minute service, delivery, discounts or guarantees they did not mention. If they said collection only, no ad may mention delivery. If they said five days' notice, no ad may suggest last-minute orders.\n" +
        "CONDITIONS: each ad must include, in plain words, the conditions a customer needs before responding: service area, what is and is not included, what the customer must provide, notice period, collection or delivery, hours. Pull these from the owner's answers. Work them into each ad naturally and differently: a different sentence in each ad, never the same block of conditions pasted into all three.\n" +
        "AD 1 must open on the exact thing the owner said stops people from buying, and answer it. If that worry is trust or safety, say who the owner is, how long they have done this, and what customers say.\n" +
        "STYLE RULES: lead with the specific benefit the owner described, use the words their happy customers actually use, and end every ad with the one action the owner wants (" + ACTION_HINT + "). Banned phrases: look no further, unforgettable, dream, we have got you covered, elevate, game-changing, treat yourself, your one-stop, discover, indulge, perfect for every occasion. No exclamation marks in headlines. No dashes as breaks.\n" +
        "Format them exactly like this:\n\n" +
        "AD 1 - PROBLEM\nHeadline: [headline]\n[body]\n\nAD 2 - RESULT\nHeadline: [headline]\n[body]\n\nAD 3 - SOCIAL PROOF\nHeadline: [headline]\n[body]\n\n" +
        "Output only the three ads in that format, nothing else."
      );
    case "ads_fix":
      return (
        "The user confirmed this profile:\n" +
        (body.profile || "") +
        "\n\nAnd locked in this offer:\n" +
        (body.offer || "") +
        "\n\nYou wrote these three ads:\n" +
        (body.ads || "") +
        "\n\nA fact check found these problems:\n" +
        (body.problems || "") +
        "\n\nTask: Rewrite the three ads so every problem above is fixed: remove anything invented, and make sure each ad includes the key conditions a customer must know (area, what is included, what the customer provides, notice, collection or delivery, hours, price) in a natural way. Keep the same format exactly (AD 1 - PROBLEM / AD 2 - RESULT / AD 3 - SOCIAL PROOF, Headline, body), each under 125 words. Output only the three ads."
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
        provider: PROVIDER_RULES,
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

    let out = text.trim();

    if (body.stage === "profile" || body.stage === "profile_fix") {
      // The chat shows the playback with its question; the copy text keeps only the profile.
      const clean = out
        .replace(/\s*(Did (I|we) get that right|Is that right|Does that sound right|Anything off|Did we get it right)[^\n]*$/i, "")
        .replace(/\bHere'?s what (I|we)'?ve got:?\s*/i, "")
        .trim();
      return NextResponse.json({ text: out, clean });
    }

    if (body.stage === "offer" || body.stage === "offer_adjust") {
      // Keep only the finished sentence in the offer; the check goes to the chat.
      const m = out.match(/OFFER:\s*([\s\S]*?)(?:\n+\s*CHECK:\s*([\s\S]*))?$/i);
      if (m) {
        const offer = m[1].trim().replace(/\s*\n+\s*/g, " ");
        const check = (m[2] || "").trim();
        return NextResponse.json({ text: offer, note: check });
      }
    }

    if (body.stage === "ads" || body.stage === "ads_fix") {
      const hasAll = /AD 1/i.test(out) && /AD 2/i.test(out) && /AD 3/i.test(out);
      if (!hasAll) {
        return NextResponse.json({ error: "The AI sent the ads in the wrong shape. Tap Try again." }, { status: 502 });
      }
      // Drop anything the model wrote before "AD 1" or after the third ad.
      out = out.slice(out.search(/AD 1/i));
      if (body.stage === "ads") {
        const problems = await factCheck(apiKey, transcript(body.answers || []), out);
        if (problems) {
          return NextResponse.json({ text: out, problems });
        }
      }
    }

    return NextResponse.json({ text: out });
  } catch (err) {
    console.error("OpenRouter request failed", err);
    return NextResponse.json(
      { error: "Couldn't reach the AI service. Check your connection and tap Try again." },
      { status: 502 }
    );
  }
}
