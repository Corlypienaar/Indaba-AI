// The shape of an ad in Meta's fields, the code checks that run before anything is
// shown to the owner, and the launch card and checklist built from the owner's answers.
// Shared by the API route (server) and the chat screen (client), so nothing in here
// touches the file system or the network.

import { parseNumber } from "./numbers";

export type Answers = Record<string, string>; // keyed by question key: business, area, offer, ...

export type Concept = "problem" | "proof" | "curiosity";

export type Ad = {
  id: number;
  concept: Concept;
  hook: string;
  primary: string[]; // 3 variants, each up to 125 characters
  headline: string; // up to 27
  description: string; // up to 27
  cta: string; // Meta button label
  onImage: string; // 3 to 7 words
  claims: { claim: string; source: string }[];
};

export type Creative = {
  id: number;
  shotList: string;
  imagePrompt45: string;
  imagePrompt916: string;
  videoScript: string;
  whatsappGreeting: string;
};

export type Issue = { adId: number; field: string; reason: string };

export const LIMITS = { primary: 125, headline: 27, description: 27, hookWords: 10, onImageMin: 3, onImageMax: 7 };

export const CONCEPT_LABEL: Record<Concept, string> = {
  problem: "Problem call-out",
  proof: "Proof and result",
  curiosity: "Curiosity and bold claim",
};

// ---------- Facts pulled from the answers ----------

export type Facts = {
  answers: Answers;
  price: number | null;
  cost: number | null;
  hasUrgency: boolean;
  urgencyText: string;
  whatsappDigits: string; // 27XXXXXXXXX or "" when not found
  allowedNumbers: Set<string>; // every number the owner typed, so the copy can be checked
};

export function noUrgency(text: string): boolean {
  return !text || /^\s*(no\b|none|nothing|not really|n\/a|skip|not sure)/i.test(text);
}

export function buildFacts(answers: Answers): Facts {
  const offer = answers.offer || "";
  const priceMatch = offer.match(/R\s?(\d[\d ,]*(?:\.\d+)?)/i);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(/[ ,]/g, "")) : parseNumber(offer, "money");
  const cost = answers.cost ? parseNumber(answers.cost, "money") : null;
  const urgencyText = answers.urgency || "";
  const hasUrgency = !noUrgency(urgencyText);

  const contact = answers.contact || "";
  const digitsOnly = contact.replace(/[^\d+]/g, "");
  let whatsappDigits = "";
  const m = digitsOnly.match(/(?:\+?27|0)(\d{9})/);
  if (m) whatsappDigits = "27" + m[1];

  const allowedNumbers = new Set<string>();
  for (const key of Object.keys(answers)) {
    const text = (answers[key] || "").replace(/(\d)[ ,](?=\d{3}\b)/g, "$1");
    for (const n of text.match(/\d+(?:\.\d+)?/g) || []) allowedNumbers.add(String(parseFloat(n)));
  }
  if (price !== null) allowedNumbers.add(String(price));
  if (cost !== null) allowedNumbers.add(String(cost));

  return { answers, price, cost, hasUrgency, urgencyText, whatsappDigits, allowedNumbers };
}

// ---------- Cleaning and auto-fixes ----------

const CASING: [RegExp, string][] = [
  [/whats\s?app/gi, "WhatsApp"],
  [/hairsalon/gi, "hair salon"],
  [/\bR\s+(\d)/g, "R$1"],
  [/\br(\d{2,})/g, "R$1"],
  [/\s+([,.!?])/g, "$1"],
  [/\s{2,}/g, " "],
  [/\s[-–—]\s/g, ". "],
];

export function tidy(text: string): string {
  let t = (text || "").replace(/\*\*|__|^#+\s*/g, "").trim();
  for (const [re, to] of CASING) t = t.replace(re, to);
  // Labels that sometimes leak into a field.
  t = t.replace(/^(hook|headline|description|primary text( \d)?|on[- ]image text|cta|button)\s*:\s*/i, "").trim();
  return t;
}

export function cleanAd(ad: Ad): Ad {
  return {
    ...ad,
    hook: tidy(ad.hook),
    primary: (ad.primary || []).map(tidy).filter(Boolean).slice(0, 3),
    headline: tidy(ad.headline).replace(/!+$/, ""),
    description: tidy(ad.description),
    cta: tidy(ad.cta) || "Send WhatsApp message",
    onImage: tidy(ad.onImage),
    claims: Array.isArray(ad.claims) ? ad.claims : [],
  };
}

// ---------- Checks ----------

const LEAKS = /headline:|offer sentence|no specific deadline|no deadline|the user\b|interview|holds up|primary text|\[[^\]]*\]|note for dev|placeholder/i;
const URGENCY_WORDS = /\b(limited|hurry|today only|last chance|while stocks last|don'?t miss|before it'?s gone|this week only|only \d+ (slots?|spots?|spaces?)|ends (soon|friday|sunday|today)|act now|book now before)\b/i;
const VAGUE = /\b(the best|best \w+ in|number one|#1|loved by thousands|quality service|professional service|reliable service|top rated|guaranteed)\b/i;

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9' ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function checkAd(ad: Ad, facts: Facts, others: Ad[]): Issue[] {
  const issues: Issue[] = [];
  const push = (field: string, reason: string) => issues.push({ adId: ad.id, field, reason });
  const allText = [ad.hook, ...ad.primary, ad.headline, ad.description, ad.onImage].join(" ");
  const ownerText = Object.values(facts.answers).join(" ").toLowerCase();

  // Lengths
  if (!ad.hook) push("hook", "missing");
  else if (wordCount(ad.hook) > LIMITS.hookWords) push("hook", `over ${LIMITS.hookWords} words`);
  if (ad.primary.length < 3) push("primary", "needs 3 variants");
  ad.primary.forEach((p, i) => {
    if (p.length > LIMITS.primary) push(`primary ${i + 1}`, `over ${LIMITS.primary} characters (${p.length})`);
    else if (p.length < 70) push(`primary ${i + 1}`, "too short, write 2 to 4 full sentences (90 to 125 characters)");
    else if (!/[.?!]\s+\S/.test(p)) push(`primary ${i + 1}`, "one long phrase, write it as 2 to 4 full sentences");
    else if ((p.match(/,/g) || []).length >= 4 && (p.match(/[.?!]/g) || []).length < 2) push(`primary ${i + 1}`, "a comma list of facts, write sentences instead");
  });
  if (ad.hook && wordCount(ad.hook) < 3) push("hook", "too short to stop a scroll, write a full line (a question, the quote or the myth)");
  if (ad.headline && ad.headline.length < 10) push("headline", "too short, use the offer or answer an objection");

  // Pasted answers: an owner answer of 5+ words appearing word for word in the ad text.
  // The quote, the problem and the myth are meant to be used as said, so they are allowed.
  const bodyText = [...ad.primary, ad.headline, ad.description].join(" ").toLowerCase();
  for (const key of ["business", "offer", "customer", "proof", "whyyou", "contact"]) {
    const ans = (facts.answers[key] || "").trim().toLowerCase().replace(/[.!?]+$/, "");
    if (ans.split(/\s+/).length >= 5 && bodyText.includes(ans)) {
      push("copy", `pastes the owner's "${key}" answer word for word, rewrite it as ad copy`);
      break;
    }
  }
  if (!ad.headline) push("headline", "missing");
  else if (ad.headline.length > LIMITS.headline) push("headline", `over ${LIMITS.headline} characters (${ad.headline.length})`);
  if (ad.description.length > LIMITS.description) push("description", `over ${LIMITS.description} characters (${ad.description.length})`);
  const oi = wordCount(ad.onImage);
  if (oi < LIMITS.onImageMin || oi > LIMITS.onImageMax) push("on-image text", `must be ${LIMITS.onImageMin} to ${LIMITS.onImageMax} words`);

  // Leaked labels and notes
  if (LEAKS.test(allText)) push("copy", "contains an internal note or label");

  // Numbers: every number in the copy must come from the owner
  const cleaned = allText.replace(/(\d)[ ,](?=\d{3}\b)/g, "$1");
  for (const n of cleaned.match(/\d+(?:\.\d+)?/g) || []) {
    const v = String(parseFloat(n));
    if (!facts.allowedNumbers.has(v)) {
      push("numbers", `uses ${n}, which the owner did not give`);
      break;
    }
  }

  // Price must appear (in the first primary text or the headline) when we have one
  if (facts.price !== null) {
    const priceRe = new RegExp("R\\s?" + Math.round(facts.price).toLocaleString("en-ZA").replace(/[ ,]/g, "[ ,]?") + "\\b");
    if (!priceRe.test(ad.primary[0] || "") && !priceRe.test(ad.headline)) push("price", "the price is missing from the first ad text and headline");
  }

  // Action
  if (!/whatsapp/i.test(ad.primary[0] || "")) push("action", "the first ad text does not tell people to WhatsApp");

  // Urgency only when real
  if (!facts.hasUrgency && URGENCY_WORDS.test(allText)) push("urgency", "urgency words with no real reason to act now");

  // Vague claims unless the owner said them
  const vague = allText.match(VAGUE);
  if (vague && !ownerText.includes(vague[0].toLowerCase())) push("claims", `"${vague[0]}" is a vague claim the owner did not back up`);

  // Quote only in the proof concept, and word for word
  const quote = (facts.answers.quote || "").trim();
  if (quote && ad.concept !== "proof" && allText.includes(`"${quote}"`)) push("quote", "the customer quote belongs in the proof ad only");

  // Different from the other ads. Words every ad must share (the product, the area,
  // WhatsApp, the price) are taken out before comparing, so only the idea is compared.
  const common = words([facts.answers.business, facts.answers.area, facts.answers.offer, "whatsapp book booking"].join(" "));
  const idea = (x: Ad) => new Set(Array.from(words([x.hook, x.primary[0], x.headline].join(" "))).filter((w) => !common.has(w)));
  for (const o of others) {
    if (o.id === ad.id) continue;
    const a = idea(ad);
    const b = idea(o);
    const shared = Array.from(a).filter((w) => b.has(w)).length;
    const smaller = Math.max(1, Math.min(a.size, b.size));
    if (shared / smaller >= 0.5) push("variety", `too similar to ad ${o.id}`);
    if (ad.hook.toLowerCase() === o.hook.toLowerCase()) push("hook", `same hook as ad ${o.id}`);
  }

  return issues;
}

// ---------- JSON helpers ----------

export function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("no json");
  return JSON.parse(t.slice(first, last + 1));
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export function toAd(raw: unknown, fallbackId: number, concept: Concept): Ad {
  const r = (raw || {}) as Record<string, unknown>;
  const primaryRaw = Array.isArray(r.primary) ? r.primary : r.primary ? [r.primary] : [];
  const claimsRaw = Array.isArray(r.claims) ? r.claims : [];
  return cleanAd({
    id: Number(r.id) || fallbackId,
    concept,
    hook: str(r.hook),
    primary: primaryRaw.map(str),
    headline: str(r.headline),
    description: str(r.description),
    cta: str(r.cta),
    onImage: str(r.onImage ?? r.on_image ?? r.onImageText),
    claims: claimsRaw.map((c) => {
      const o = (c || {}) as Record<string, unknown>;
      return { claim: str(o.claim), source: str(o.source) };
    }),
  });
}

export function toCreative(raw: unknown, fallbackId: number): Creative {
  const r = (raw || {}) as Record<string, unknown>;
  return {
    id: Number(r.id) || fallbackId,
    shotList: tidy(str(r.shotList ?? r.shot_list)),
    imagePrompt45: str(r.imagePrompt45 ?? r.image_prompt_45).trim(),
    imagePrompt916: str(r.imagePrompt916 ?? r.image_prompt_916).trim(),
    videoScript: str(r.videoScript ?? r.video_script).trim(),
    whatsappGreeting: tidy(str(r.whatsappGreeting ?? r.whatsapp_greeting)),
  };
}

// ---------- Launch card and checklist (no AI, built from the answers) ----------

export function rand(x: number): string {
  return "R" + Math.round(x).toLocaleString("en-ZA");
}

export type LaunchLine = { title: string; text: string };

export function buildLaunchCard(facts: Facts): LaunchLine[] {
  const area = facts.answers.area?.trim();
  const lines: LaunchLine[] = [
    {
      title: "Where to set it up",
      text: "Use Ads Manager, not the blue Boost button. Choose the Engagement or Leads goal with Messaging apps, and pick WhatsApp. This makes it a Click-to-WhatsApp ad, so the button opens a chat with you.",
    },
    {
      title: "Audience",
      text:
        "Keep the audience broad and let Meta's Advantage+ settings choose placements. Set location only" +
        (area ? `: ${area}` : "") +
        " plus a radius you can serve. The words and picture in each ad do the targeting, so you do not need to add interests.",
    },
    {
      title: "Ads",
      text: "Put all three ads in one ad set. Meta will show each one and learn which hook your customers respond to.",
    },
  ];

  if (facts.price !== null && facts.cost !== null) {
    const left = facts.price - facts.cost;
    lines.push({
      title: "Most you can spend per booking",
      text:
        left > 0
          ? `You charge ${rand(facts.price)} and one job costs you about ${rand(facts.cost)}, so ${rand(left)} is left per booking before your own time. That is your break-even. A healthy target is to spend about a third of it, around ${rand(left / 3)}, to win one WhatsApp booking.`
          : `You charge ${rand(facts.price)} and one job costs you about ${rand(facts.cost)}, so nothing is left per booking before your own time. Check your price before you spend on ads.`,
    });
  }

  lines.push({
    title: "Testing",
    text: "Leave the ads alone for 5 to 7 days and about 1,000 views each. Then judge them in this order: how many people stopped to watch or read, then how many clicked, then what one WhatsApp chat cost you. Pause the weakest, and every 2 to 3 weeks add a new version of the winner.",
  });
  lines.push({
    title: "Reply fast",
    text: "Someone must answer the WhatsApp within minutes. Save the greeting from each ad as a quick reply in WhatsApp Business so the first message matches what the ad promised.",
  });
  return lines;
}

export type CheckItem = { label: string; ok: boolean; fix: string };

export function buildChecklist(facts: Facts, ads: Ad[]): CheckItem[] {
  const a = facts.answers;
  const has = (k: string) => !!(a[k] && a[k].trim() && !/^(skip|not sure)$/i.test(a[k].trim()));
  const hooks = new Set(ads.map((x) => x.hook.toLowerCase()));
  return [
    { label: "Who it is for", ok: has("customer") || has("area"), fix: "Add your best customer or your area so the ad says who it is for." },
    { label: "What you sell", ok: has("offer"), fix: "Name the one service or product you are advertising." },
    { label: "Why you (proof people can check)", ok: has("proof") || has("quote"), fix: "Add your Google rating, number of clients, years open, or a real customer quote." },
    { label: "The deal (a price)", ok: facts.price !== null, fix: "Add a price or a from price to the offer." },
    { label: "How to get it (WhatsApp)", ok: !!facts.whatsappDigits, fix: "Add the WhatsApp number people should message." },
    { label: "Why now (only if real)", ok: true, fix: "" },
    { label: "Three different hooks", ok: hooks.size === 3, fix: "Two ads share a hook. Tap Try again on the ads." },
    { label: "A 4:5 and a 9:16 version of each picture", ok: false, fix: "Make both sizes in Canva or Meta AI using the prompts below." },
    { label: "WhatsApp Business set up with quick replies", ok: false, fix: "Save each ad's greeting as a quick reply before the ads go live." },
    { label: "Someone ready to reply within minutes", ok: false, fix: "Decide who watches WhatsApp while the ads run." },
  ];
}

export function whatsappLink(facts: Facts, greeting: string): string {
  const base = facts.whatsappDigits ? `https://wa.me/${facts.whatsappDigits}` : "https://wa.me/";
  return greeting ? `${base}?text=${encodeURIComponent(greeting)}` : base;
}
