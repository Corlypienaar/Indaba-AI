import { NextResponse } from "next/server";
import { getContentRaw, getModelName, callOpenRouter } from "@/lib/content";

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

// The conditions every ad must carry, pulled straight from the owner's answers.
function mustInclude(answers: Answer[]): string[] {
  const find = (re: RegExp) => answers.find((a) => re.test(a.question))?.answer.trim() || "";
  const rules = find(/How do you want customers to respond/i);
  const urgency = find(/act this week/i);
  const business = find(/your business, in one sentence/i);
  const list: string[] = [];
  if (rules) list.push("How to respond and the rules the owner gave: " + rules);
  if (urgency && !/^\s*(none|no|nothing|not really|n\/a|no real reason)\b/i.test(urgency)) list.push("The real reason to act now: " + urgency);
  if (business) list.push("What is offered, where, and what is and is not included, exactly as the owner said: " + business);
  return list;
}

const ACTION_HINT = "send a WhatsApp, call, visit, book or buy, whichever the owner asked for";

// Ask the model to compare the ads against the owner's answers. Returns "" when clean.
async function factCheck(apiKey: string, answersText: string, ads: string, must: string[]): Promise<string> {
  try {
    const res = await callOpenRouter(apiKey, {
        model: getModelName(),
        messages: [
          { role: "system", content: "You are a strict fact checker for small business ads. You only list contradictions and inventions. You never rewrite." },
          { role: "user", content: "Here is what the business owner said about their business:\n\n" + answersText + "\n\nHere are three ads written from it:\n\n" + ads + "\n\nDo two checks.\n1. INVENTED: list every claim in the ads that contradicts what the owner said, or that the owner never said. Be strict: this includes soft inventions such as a notice period or scheduling rule the owner did not give (\"a couple of days' notice\", \"a heads up so we can schedule\"), promises or guarantees (\"we ensure a safe experience\", \"reliable\", \"professional\"), exaggerated customer praise (\"customers rave\"), delivery when they said collection only, emergency or same-day service, discounts, areas, prices or hours they did not give. Quote the ad words.\n2. MISSING: these must appear in every ad, in the owner's own terms:\n" + must.map((x) => "- " + x).join("\\n") + "\nAlso the conditions a customer must know before they respond: service area, what is and is not included, what the customer must provide, notice or booking rule, collection or delivery, hours, price. For each ad (AD 1, AD 2, AD 3), list anything from this list that ad leaves out, and note if an ad does not end with the action the owner asked for.\nOne problem per line. If there are no problems at all, reply with exactly: NONE" },
        ],
        temperature: 0,
        max_tokens: 400,
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

// Pull the single offer sentence and the honesty check out of the model's reply,
// whether the sentence sits on the OFFER: line or the line after it.
function parseOffer(raw: string): { offer: string; check: string } {
  const text = raw.replace(/\*\*/g, "").trim();
  const m = text.match(/OFFER:\s*\n?\s*([\s\S]*?)\s*(?:\n+\s*(?:CHECK|Inline honesty check|Honesty check):?\s*([\s\S]*))?$/i);
  let offer = "";
  let check = "";
  if (m) {
    offer = m[1].trim().replace(/\s*\n+\s*/g, " ");
    check = (m[2] || "").trim();
  } else {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/template|^here'?s|^here is|^the proposed|^proposed offer/i.test(l));
    const first = lines.find((l) => !/^(check|inline honesty|honesty)/i.test(l)) || "";
    offer = first;
    check = lines.filter((l) => l !== first).join(" ").replace(/^(inline honesty check|honesty check|check):?\s*/i, "");
  }
  // Commentary is not an offer.
  if (/\bthe user\b|\bthe price matches\b|\bseems real\b|\bholds up\b/i.test(offer) || offer.length < 15) offer = "";
  return { offer: offer.replace(/^[*_"]+|[*_"]+$/g, ""), check };
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
        "MUST APPEAR IN EVERY AD, in the owner's own terms:\n" + mustInclude(body.answers || []).map((x) => "- " + x).join("\n") + "\n" +
        "CONDITIONS: each ad must include, in plain words, the conditions a customer needs before responding: service area, what is and is not included, what the customer must provide, notice period, collection or delivery, hours. Pull these from the owner's answers. Work them into each ad naturally and differently: a different sentence in each ad, never the same block of conditions pasted into all three.\n" +
        "AD 1 must open on the exact thing the owner said stops people from buying, and ANSWER it with facts the owner gave: who they are (for example a one-person business), how long they have done this, and what customers say. Naming the worry without answering it is a failure.\n" +
        "THE THREE ADS MUST READ DIFFERENTLY: different first lines, different lengths (one short, one medium, one longer), different structure. Do not repeat the same sentences across ads. Each ad ends with the owner's action in natural words, for example \"WhatsApp us\" when the owner said WhatsApp, never \"send a WhatsApp to arrange\".\n" +
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
        "\n\nMUST APPEAR IN EVERY AD, in the owner's own terms:\n" + mustInclude(body.answers || []).map((x) => "- " + x).join("\n") +
        "\n\nTask: Rewrite the three ads so every problem above is fixed: remove anything invented (no notice periods, guarantees, safety promises or praise the owner did not give), and make sure each ad includes the key conditions a customer must know (area, what is included, what the customer provides, notice or booking rule, collection or delivery, hours, price) in a natural way, and ends with the action the owner asked for. Keep the same format exactly (AD 1 - PROBLEM / AD 2 - RESULT / AD 3 - SOCIAL PROOF, Headline, body), each under 125 words. Output only the three ads."
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
    const ask = (extraInstruction = "") =>
      callOpenRouter(apiKey, {
        model: getModelName(),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage + extraInstruction },
        ],
        temperature: 0.7,
        max_tokens: 1200,
      });
    const res = await ask();

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
      const m = out.match(/OFFER:\s*([\s\S]*?)(?:\n+\s*(?:CHECK|Inline honesty check|Honesty check):?\s*([\s\S]*))?$/i);
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
      const must = mustInclude(body.answers || []);
      if (body.stage === "ads") {
        const problems = await factCheck(apiKey, transcript(body.answers || []), out, must);
        if (problems) {
          return NextResponse.json({ text: out, problems });
        }
      }
      if (body.stage === "ads_fix") {
        // Check the rewrite too. If anything is still off, tell the owner plainly.
        const remaining = await factCheck(apiKey, transcript(body.answers || []), out, must);
        if (remaining) {
          return NextResponse.json({ text: out, warning: "We checked these ads twice against what you told us and a few details may still not match. Please read each ad against your own facts before posting." });
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
