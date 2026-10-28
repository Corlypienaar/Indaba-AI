import { NextResponse } from "next/server";
import { getSystemPrompt, getModelName, callOpenRouter } from "@/lib/content";
import {
  Ad,
  Answers,
  Concept,
  Creative,
  Facts,
  Issue,
  buildFacts,
  buildChecklist,
  buildLaunchCard,
  checkAd,
  extractJson,
  toAd,
  toCreative,
} from "@/lib/adspec";

// This route is the only place the ads tool talks to the AI.
// Three stages:
//   write     -> three ads as JSON in Meta's fields, checked in code, failing ads regenerated
//   creative  -> shot list, image prompts, video script and WhatsApp greeting per ad
// Everything the owner sees is built from the JSON. Model commentary never reaches the screen.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChatRequest = {
  stage: "write" | "creative";
  answers: Answers;
  ads?: Ad[];
};

const CONCEPTS: Concept[] = ["problem", "proof", "curiosity"];
const MAX_RETRIES = 2;

function factsText(facts: Facts): string {
  const a = facts.answers;
  const line = (label: string, key: string) => (a[key] && a[key].trim() ? `${label} (source "${key}"): ${a[key].trim()}` : `${label} (source "${key}"): not given`);
  return [
    line("Business name and what they sell", "business"),
    line("Area where most customers are", "area"),
    line("The one offer, price and what is included", "offer"),
    line("Best customer and their situation", "customer"),
    line("Problem customers come with, in their words", "problem"),
    line("What a happy customer actually said", "quote"),
    line("Proof", "proof"),
    line("Why people choose them over others nearby", "whyyou"),
    line("Myth or common mistake customers believe", "myth"),
    line("Contact and rules", "contact"),
    facts.hasUrgency ? `Real reason to act now (source "urgency"): ${facts.urgencyText}` : `Reason to act now: NONE. Use no urgency words at all.`,
    facts.price !== null ? `Price to use: R${Math.round(facts.price)}` : "Price: not given, do not invent one",
  ].join("\n");
}

function adSchema(): string {
  return JSON.stringify({
    ads: [
      {
        id: 1,
        concept: "problem",
        hook: "max 10 words, names who it is for or their problem",
        primary: ["variant 1, max 125 characters", "variant 2, max 125 characters", "variant 3, max 125 characters"],
        headline: "max 27 characters",
        description: "max 27 characters",
        cta: "Send WhatsApp message",
        onImage: "3 to 7 words",
        claims: [{ claim: "the fact as used in the ad", source: "the source key it came from" }],
      },
    ],
  });
}

function conceptBrief(concept: Concept, facts: Facts): string {
  const a = facts.answers;
  switch (concept) {
    case "problem":
      return (
        "CONCEPT 1, problem call-out. Open with the customer's problem as a short question" +
        (a.problem ? `, built from their words: "${a.problem.trim()}"` : a.customer ? `, built from the best customer's situation: "${a.customer.trim()}"` : "") +
        ". Then the fix, the offer with price, and WhatsApp to book. Message: fix the problem."
      );
    case "proof":
      return (
        "CONCEPT 2, proof and result. Open with " +
        (a.quote ? `the customer's exact quote in quotation marks: "${a.quote.trim()}"` : a.proof ? `the checkable proof: ${a.proof.trim()}` : "the result customers get") +
        (a.proof && a.quote ? `. Then add the proof: ${a.proof.trim()}` : "") +
        ". Then the offer with price and WhatsApp to book. Message: trust."
      );
    case "curiosity":
      return (
        "CONCEPT 3, curiosity or bold claim. Open with " +
        (a.myth ? `the myth, stated and corrected in one line: "${a.myth.trim()}"` : a.whyyou ? `a bold true claim or direct question built from why people choose them: "${a.whyyou.trim()}"` : "a direct question the customer asks themselves") +
        ". Then the offer with price and WhatsApp to book. Message: expertise. Do not use the customer quote here."
      );
  }
}

function writePrompt(facts: Facts, concepts: Concept[], fixing?: { ad: Ad; issues: Issue[] }): string {
  const base =
    "FACTS the owner gave (use only these, nothing else):\n" +
    factsText(facts) +
    "\n\nTASK: write Meta ads (Click-to-WhatsApp) for this business.\n" +
    concepts.map((c) => conceptBrief(c, facts)).join("\n") +
    "\n\nRULES\n" +
    "- Rewrite the owner's answers as customer-facing copy in plain South African English. Never paste them as they are, except the customer quote in quotation marks (proof concept only).\n" +
    "- Name the customer or the area in the hook or the first line of every ad.\n" +
    "- Each primary text: hook, then benefit, proof, the price and the action. The three variants of one ad must each make a different argument: variant 1 the price and what is included, variant 2 speed or convenience, variant 3 proof. Every variant must contain the price and the word WhatsApp. Max 125 characters each. Count carefully.\n" +
    "- Headline max 27 characters: the offer, or an answer to a common objection. Description max 27 characters: a reassurance such as what is included.\n" +
    "- onImage: 3 to 7 words, the hook or the offer.\n" +
    "- cta is always \"Send WhatsApp message\".\n" +
    "- Never write a phone number in the copy. The button handles it.\n" +
    "- Every number in the copy must come from the facts. No invented years, counts, ratings, discounts, hours, areas or deadlines.\n" +
    (facts.hasUrgency ? "- The reason to act now is real, so you may use it, plainly.\n" : "- There is no reason to act now, so use no urgency words at all (no limited, hurry, today only, last chance, only X slots).\n") +
    "- The three ads must be three different ideas: different hook, different first line, different headline, different argument. Share as few words as possible between them.\n" +
    "- No dashes as breaks. No exclamation marks in headlines. No hype words.\n" +
    "- claims: list every factual claim you used and which source key it came from.\n" +
    "\nReturn JSON only, no prose before or after, exactly in this shape:\n" +
    adSchema();

  if (!fixing) return base;
  return (
    base +
    "\n\nYou are rewriting only ad " +
    fixing.ad.id +
    " (" +
    fixing.ad.concept +
    "). Your previous version was:\n" +
    JSON.stringify(fixing.ad) +
    "\n\nIt failed these checks, fix every one of them:\n" +
    fixing.issues.map((i) => `- ${i.field}: ${i.reason}`).join("\n") +
    "\n\nReturn JSON with a single ad in the \"ads\" list, same id and concept."
  );
}

function creativePrompt(facts: Facts, ads: Ad[]): string {
  const a = facts.answers;
  return (
    "FACTS the owner gave:\n" +
    factsText(facts) +
    "\n\nThe three finished ads:\n" +
    ads.map((ad) => `Ad ${ad.id} (${ad.concept}): hook "${ad.hook}". Text: ${ad.primary[0]} Headline: ${ad.headline}. On image: ${ad.onImage}`).join("\n") +
    "\n\nTASK: for each ad, plan the picture and the chat so the owner can make it on a phone.\n" +
    "- shotList: 2 or 3 short lines telling the owner what to photograph with their phone for THIS ad: subject (ad 1: the owner or a worker doing the work; ad 2: a real happy customer with the finished result, with their permission; ad 3: the owner talking to camera), setting, framing, light. Local, real, one focal point. Each ad a different subject.\n" +
    "- imagePrompt45: a prompt to paste into Meta AI for a 4:5 (1080 x 1350) feed image. Describe a real-looking local South African person and the actual work or result for this business" +
    (a.area ? ` in ${a.area.trim()}` : "") +
    ", natural light, phone-photo feel, one focal point, no text in the image, and keep the top 14 percent and bottom 35 percent of the frame simple so text can be added later. A different subject per ad.\n" +
    "- imagePrompt916: the same scene for a 9:16 (1080 x 1920) Reels or Stories image, with the subject in the middle and the top and bottom clear.\n" +
    "- videoScript: a 15 second vertical video the owner can film on a phone. Four lines: 0 to 3 seconds the hook as on-screen text, 3 to 7 seconds the problem or promise, 7 to 12 seconds show the work or result, 12 to 15 seconds the offer with price and \"WhatsApp us\". Note that captions must be burned in.\n" +
    "- whatsappGreeting: 1 or 2 lines the owner sends when someone messages from this ad. It repeats the ad's offer and price word for word, then asks one question to move the booking along" +
    (a.contact ? `, staying inside these rules: ${a.contact.trim()}` : "") +
    ".\n" +
    "Use only the facts. No invented details. No dashes as breaks.\n\nReturn JSON only, exactly in this shape:\n" +
    JSON.stringify({
      creatives: [
        { id: 1, shotList: "...", imagePrompt45: "...", imagePrompt916: "...", videoScript: "...", whatsappGreeting: "..." },
      ],
    })
  );
}

async function askJson(apiKey: string, system: string, user: string, maxTokens: number): Promise<unknown> {
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await callOpenRouter(apiKey, {
      model: getModelName(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user + (attempt ? "\n\nYour last reply was not valid JSON. Reply with the JSON object only." : "") },
      ],
      temperature: attempt ? 0.5 : 0.7,
      max_tokens: maxTokens,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("OpenRouter error", res.status, detail);
      throw new Error(res.status === 429 ? "rate" : "service");
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content || "";
    try {
      return extractJson(text);
    } catch (e) {
      lastErr = String(e);
    }
  }
  throw new Error("json:" + lastErr);
}

// Second opinion from the model: anything in the ads the owner never said.
// Only invented claims count. Everything else was already checked in code.
async function reviewInvented(apiKey: string, system: string, facts: Facts, ads: Ad[]): Promise<Issue[]> {
  try {
    const user =
      "FACTS the owner gave:\n" +
      factsText(facts) +
      "\n\nADS:\n" +
      ads.map((ad) => `AD ${ad.id}: ${ad.hook} | ${ad.primary.join(" | ")} | ${ad.headline} | ${ad.description} | ${ad.onImage}`).join("\n") +
      "\n\nTASK: you are a strict fact checker. List every claim in the ads that the owner did not say or that contradicts the facts: invented numbers, years, ratings, areas, hours, delivery, discounts, guarantees, praise, urgency or deadlines. Rewording the owner's facts is fine. Only invention counts.\n" +
      'Return JSON only: {"invented":[{"ad":1,"text":"the invented words","why":"short reason"}]}. If nothing is invented return {"invented":[]}.';
    const out = (await askJson(apiKey, system, user, 500)) as { invented?: { ad: number; text: string; why: string }[] };
    return (out.invented || [])
      .filter((x) => x && x.ad && x.text)
      .map((x) => ({ adId: Number(x.ad), field: "invented", reason: `"${x.text}" (${x.why || "not in the facts"})` }));
  } catch {
    return [];
  }
}

function errorMessage(err: unknown): string {
  const m = String((err as Error)?.message || err);
  if (m.startsWith("rate")) return "The AI is getting too many requests right now. Wait a minute and tap Try again.";
  if (m.startsWith("json")) return "The AI sent the ads in the wrong shape. Tap Try again.";
  return "Couldn't reach the AI service. Check your connection and tap Try again.";
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
      { error: "The OPENROUTER_API_KEY environment variable is missing. Add it in Vercel under Settings > Environment Variables, then redeploy." },
      { status: 500 }
    );
  }

  const system = getSystemPrompt() + "\n\nYou are running inside the IndabaAI web app. Reply with JSON only when asked for JSON. Never add commentary.";
  const facts = buildFacts(body.answers || {});

  try {
    if (body.stage === "write") {
      const started = Date.now();
      const elapsed = () => (Date.now() - started) / 1000;
      const raw = (await askJson(apiKey, system, writePrompt(facts, CONCEPTS), 1800)) as { ads?: unknown[] };
      const list = Array.isArray(raw.ads) ? raw.ads : [];
      let ads: Ad[] = CONCEPTS.map((c, i) => toAd(list[i], i + 1, c));

      // Code checks, then regenerate only the ads that fail, up to MAX_RETRIES each.
      let remaining: Issue[] = [];
      for (let round = 0; round <= MAX_RETRIES; round++) {
        const issuesByAd = ads.map((ad) => checkAd(ad, facts, ads));
        if (round === MAX_RETRIES) {
          remaining = issuesByAd.flat();
          break;
        }
        const failing = ads.filter((_, i) => issuesByAd[i].length > 0);
        if (failing.length === 0) break;
        // Stay inside the serverless time limit: stop retrying when time is short.
        if (elapsed() > 38) {
          remaining = issuesByAd.flat();
          break;
        }
        const fixed = await Promise.all(
          failing.map(async (ad) => {
            try {
              const r = (await askJson(apiKey, system, writePrompt(facts, [ad.concept], { ad, issues: issuesByAd[ad.id - 1] }), 900)) as { ads?: unknown[] };
              const one = Array.isArray(r.ads) ? r.ads[0] : r;
              return toAd(one, ad.id, ad.concept);
            } catch {
              return ad;
            }
          })
        );
        ads = ads.map((ad) => fixed.find((f) => f.id === ad.id) || ad);
      }

      // One review pass for invented claims. If it finds any, one more targeted rewrite.
      const invented = elapsed() > 32 ? [] : await reviewInvented(apiKey, system, facts, ads);
      if (invented.length && elapsed() < 42) {
        const byAd = new Map<number, Issue[]>();
        for (const i of invented) byAd.set(i.adId, [...(byAd.get(i.adId) || []), i]);
        const fixed = await Promise.all(
          Array.from(byAd.entries()).map(async ([id, issues]) => {
            const ad = ads.find((x) => x.id === id);
            if (!ad) return null;
            try {
              const r = (await askJson(apiKey, system, writePrompt(facts, [ad.concept], { ad, issues }), 900)) as { ads?: unknown[] };
              const one = Array.isArray(r.ads) ? r.ads[0] : r;
              const next = toAd(one, ad.id, ad.concept);
              // Only keep the rewrite if it still passes the code checks.
              return checkAd(next, facts, ads.map((x) => (x.id === id ? next : x))).length === 0 ? next : ad;
            } catch {
              return ad;
            }
          })
        );
        ads = ads.map((ad) => fixed.find((f) => f && f.id === ad.id) || ad);
        remaining = ads.flatMap((ad) => checkAd(ad, facts, ads));
      }

      // Server log only. Never shown.
      if (remaining.length) console.warn("Ad checks still failing", remaining);

      return NextResponse.json({
        ads,
        issues: remaining,
        launch: buildLaunchCard(facts),
        checklist: buildChecklist(facts, ads),
        whatsappDigits: facts.whatsappDigits,
      });
    }

    if (body.stage === "creative") {
      const ads = (body.ads || []).map((ad, i) => toAd(ad, i + 1, ad.concept || CONCEPTS[i]));
      if (ads.length === 0) return NextResponse.json({ error: "No ads to plan pictures for." }, { status: 400 });
      const raw = (await askJson(apiKey, system, creativePrompt(facts, ads), 2200)) as { creatives?: unknown[] };
      const list = Array.isArray(raw.creatives) ? raw.creatives : [];
      const creatives: Creative[] = ads.map((ad, i) => toCreative(list.find((c) => Number((c as { id?: number })?.id) === ad.id) ?? list[i], ad.id));
      return NextResponse.json({ creatives });
    }

    return NextResponse.json({ error: "Unknown stage." }, { status: 400 });
  } catch (err) {
    console.error("Ads route failed", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 502 });
  }
}
