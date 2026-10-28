import { NextResponse } from "next/server";
import { getSystemPrompt, getWritingPrompt, getModelName, callOpenRouter } from "@/lib/content";
import {
  Ad,
  Answers,
  Concept,
  Facts,
  Issue,
  buildFacts,
  buildChecklist,
  buildLaunchCard,
  checkAd,
  extractJson,
  toAd,
  urgencyMissing,
} from "@/lib/adspec";

// This route is the only place the ads tool talks to the AI.
// One stage, "write": three ads as JSON in Meta's fields, checked in code, failing ads
// regenerated on their own, then one review pass for invented claims.
// Everything the owner sees is built from the JSON. Model commentary never reaches the screen.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChatRequest = { stage: "write"; answers: Answers };

const CONCEPTS: Concept[] = ["problem", "proof", "curiosity"];
const ORDER = ["business", "customers", "problem", "proof", "myth", "offer", "objection", "contact", "urgency"];
const MAX_RETRIES = 2;

function fillAnswers(template: string, facts: Facts): string {
  let out = template;
  ORDER.forEach((key, i) => {
    let v = (facts.answers[key] || "").trim();
    if (key === "urgency" && !facts.hasUrgency) v = "none";
    if (!v) v = "not given";
    out = out.replace(`[ANSWER ${i + 1}]`, v);
  });
  return out;
}

function schema(facts: Facts): string {
  return JSON.stringify({
    ads: [
      {
        id: 1,
        concept: "problem",
        primary: "50 to 150 characters, full sentences, hook first",
        reels: "max 40 characters",
        headline: "max 27 characters",
        description: "max 27 characters",
        cta: facts.cta,
        onScreen: "the hook in 4 to 6 words, never the price",
        badge: "offer badge, e.g. From R1,499",
        imagePrompt: "one complete standalone paragraph that quotes the on-screen text as the heading and the offer badge as the sticker",
        whatsappGreeting: facts.contactMethod === "whatsapp" ? "the first reply the owner sends, repeating the offer, then one question" : "",
      },
    ],
  });
}

function writePrompt(facts: Facts, concepts: Concept[], fixing?: { ad: Ad; issues: Issue[] }): string {
  const base =
    fillAnswers(getWritingPrompt(), facts) +
    `\n\n=== BUTTON ===\nThe contact method is "${facts.answers.contact || "not given"}". Use the button "${facts.cta}" in all 3 ads.` +
    (facts.contactMethod === "whatsapp"
      ? "\nAlso write whatsappGreeting for each ad: the first message the owner sends when someone messages from that ad. Start with a greeting and thanks, repeat the ad's offer in one sentence, then ask one question to move the sale along. Never include a phone number in it."
      : "\nLeave whatsappGreeting empty.") +
    "\n\n=== OUTPUT ===\nReturn JSON only, no prose before or after, exactly in this shape, with one object per ad (ids 1, 2, 3 for problem, proof, curiosity):\n" +
    schema(facts) +
    (concepts.length === 3 ? "" : `\nWrite only the "${concepts[0]}" ad.`);

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
    const factsList = ORDER.map((k, i) => `${i + 1}. ${k}: ${(facts.answers[k] || "").trim() || "not given"}`).join("\n");
    const user =
      "FACTS the owner gave:\n" +
      factsList +
      "\n\nADS:\n" +
      ads.map((ad) => `AD ${ad.id}: ${ad.primary} | ${ad.reels} | ${ad.headline} | ${ad.description} | ${ad.onScreen} | ${ad.badge}`).join("\n") +
      "\n\nTASK: you are a strict fact checker. List every claim in the ads that the owner did not say or that contradicts the facts: invented numbers, years, ratings, areas, hours, delivery, discounts, guarantees, praise, urgency or deadlines. Rewording the owner's facts is fine. A [NEEDED: ...] placeholder is fine. Only invention counts.\n" +
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

  const system = getSystemPrompt();
  const facts = buildFacts(body.answers || {});
  const started = Date.now();
  const elapsed = () => (Date.now() - started) / 1000;

  try {
    const raw = (await askJson(apiKey, system, writePrompt(facts, CONCEPTS), 3000)) as { ads?: unknown[] };
    const list = Array.isArray(raw.ads) ? raw.ads : [];
    let ads: Ad[] = CONCEPTS.map((c, i) => toAd(list.find((x) => Number((x as { id?: number })?.id) === i + 1) ?? list[i], i + 1, c));

    // Code checks, then regenerate only the ads that fail, up to MAX_RETRIES each.
    let remaining: Issue[] = [];
    for (let round = 0; round <= MAX_RETRIES; round++) {
      const issuesByAd = ads.map((ad) => checkAd(ad, facts, ads));
      if (urgencyMissing(facts, ads)) issuesByAd[0].push({ adId: 1, field: "why now", reason: `use the real reason to act now in this ad, in the owner's words: "${facts.answers.urgency}"` });
      const failing = ads.filter((_, i) => issuesByAd[i].length > 0);
      if (failing.length === 0) break;
      if (round === MAX_RETRIES || elapsed() > 36) {
        remaining = issuesByAd.flat();
        break;
      }
      const fixed = await Promise.all(
        failing.map(async (ad) => {
          try {
            const r = (await askJson(apiKey, system, writePrompt(facts, [ad.concept], { ad, issues: issuesByAd[ad.id - 1] }), 1400)) as { ads?: unknown[] };
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
            const r = (await askJson(apiKey, system, writePrompt(facts, [ad.concept], { ad, issues }), 1400)) as { ads?: unknown[] };
            const one = Array.isArray(r.ads) ? r.ads[0] : r;
            const next = toAd(one, ad.id, ad.concept);
            return checkAd(next, facts, ads.map((x) => (x.id === id ? next : x))).length === 0 ? next : ad;
          } catch {
            return ad;
          }
        })
      );
      ads = ads.map((ad) => fixed.find((f) => f && f.id === ad.id) || ad);
      remaining = ads.flatMap((ad) => checkAd(ad, facts, ads));
    }

    // Keep the button and badge identical across the three ads, as the prompt asks.
    const badge = ads.find((a) => a.badge)?.badge || "";
    ads = ads.map((a) => ({ ...a, cta: facts.cta, badge: a.badge || badge }));

    if (remaining.length) console.warn("Ad checks still failing", remaining);

    return NextResponse.json({
      ads,
      issues: remaining,
      launch: buildLaunchCard(facts),
      checklist: buildChecklist(facts, ads),
      whatsappDigits: facts.whatsappDigits,
      contactMethod: facts.contactMethod,
    });
  } catch (err) {
    console.error("Ads route failed", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 502 });
  }
}
