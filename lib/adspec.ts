// The shape of an ad in Meta's fields, the code checks that run before anything is
// shown to the owner, and the launch card and checklist built from the owner's answers.
// Shared by the API route (server) and the chat screen (client), so nothing in here
// touches the file system or the network.

export type Answers = Record<string, string>; // keyed by question key: business, customers, problem, ...

export type Concept = "problem" | "proof" | "curiosity";

export type Ad = {
  id: number;
  concept: Concept;
  primary: string; // 50 to 150 characters, key message in the first 125
  reels: string; // up to 40
  headline: string; // up to 27
  description: string; // up to 27
  cta: string; // Meta button label, identical across the 3 ads
  onScreen: string; // 3 to 7 words
  badge: string; // offer badge, e.g. "From R1,499"
  imagePrompt: string; // standalone, 9:16
  addAfterwards: string;
  cropAndCheck: string;
  whatsappGreeting: string; // only when the contact method is WhatsApp
};

export type Issue = { adId: number; field: string; reason: string };

export const LIMITS = { primaryMin: 50, primaryMax: 150, primaryKey: 125, reels: 40, headline: 27, description: 27, onScreenMin: 3, onScreenMax: 7 };

export const CONCEPT_LABEL: Record<Concept, string> = {
  problem: "Problem call-out",
  proof: "Proof and result",
  curiosity: "Curiosity and bold claim",
};

export const CTA_FOR_METHOD: Record<string, string> = {
  whatsapp: "Send WhatsApp message",
  call: "Call now",
  "book online": "Book now",
  "shop online": "Shop now",
  "visit us": "Learn more",
};

// ---------- Facts pulled from the answers ----------

export type Facts = {
  answers: Answers;
  hasUrgency: boolean;
  contactMethod: string; // whatsapp, call, book online, shop online, visit us, or ""
  cta: string;
  whatsappDigits: string; // 27XXXXXXXXX or "" when not found
  allowedNumbers: Set<string>; // every number the owner typed, so the copy can be checked
};

export function noUrgency(text: string): boolean {
  return !text || /^\s*(no\b|none|nothing|not really|n\/a|skip|not sure)/i.test(text);
}

export function buildFacts(answers: Answers): Facts {
  const hasUrgency = !noUrgency(answers.urgency || "");
  const contact = answers.contact || "";
  const methodMatch = contact.toLowerCase().match(/^(whatsapp|call|book online|shop online|visit us)/);
  const contactMethod = methodMatch ? methodMatch[1] : /whatsapp/i.test(contact) ? "whatsapp" : "";
  const cta = CTA_FOR_METHOD[contactMethod] || "Learn more";

  const digitsOnly = contact.replace(/[^\d+]/g, "");
  let whatsappDigits = "";
  const m = digitsOnly.match(/(?:\+?27|0)(\d{9})/);
  if (m && contactMethod === "whatsapp") whatsappDigits = "27" + m[1];

  const allowedNumbers = new Set<string>();
  for (const key of Object.keys(answers)) {
    const text = (answers[key] || "").replace(/(\d)[ ,](?=\d{3}\b)/g, "$1");
    for (const n of text.match(/\d+(?:\.\d+)?/g) || []) allowedNumbers.add(String(parseFloat(n)));
  }

  return { answers, hasUrgency, contactMethod, cta, whatsappDigits, allowedNumbers };
}

// ---------- Cleaning and auto-fixes ----------

const CASING: [RegExp, string][] = [
  [/whats\s?app/gi, "WhatsApp"],
  [/\bR\s+(\d)/g, "R$1"],
  [/\br(\d{2,})\b/g, "R$1"],
  [/\s+([,.!?])/g, "$1"],
  [/[ \t]{2,}/g, " "],
  [/\s[-–—]\s/g, ". "],
];

export function tidy(text: string): string {
  let t = (text || "").replace(/\*\*|__|^#+\s*/g, "").trim();
  for (const [re, to] of CASING) t = t.replace(re, to);
  t = t.replace(/^(hook|headline|description|primary text|reels( primary text)?|on[- ]screen text|cta( button)?|button|offer badge|badge)\s*:\s*/i, "").trim();
  return t;
}

export function cleanAd(ad: Ad): Ad {
  return {
    ...ad,
    primary: tidy(ad.primary),
    reels: tidy(ad.reels),
    headline: tidy(ad.headline).replace(/!+$/, ""),
    description: tidy(ad.description),
    cta: tidy(ad.cta),
    onScreen: tidy(ad.onScreen),
    badge: tidy(ad.badge),
    imagePrompt: (ad.imagePrompt || "").replace(/```/g, "").trim(),
    addAfterwards: (ad.addAfterwards || "").trim(),
    cropAndCheck: (ad.cropAndCheck || "").trim(),
    whatsappGreeting: tidy(ad.whatsappGreeting)
      .replace(/\+?\d{2,3}[ -]?\d{3}[ -]?\d{4}/g, "")
      .replace(/\s+([,.?])/g, "$1")
      .trim(),
  };
}

// ---------- Checks ----------

const LEAKS = /headline:|primary text|the user\b|interview|holds up|note for dev|placeholder|answer \d/i;
const URGENCY_WORDS = /\b(limited|hurry|today only|last chance|while stocks last|don'?t miss|before it'?s gone|this week only|only \d+ (slots?|spots?|spaces?)|ends (soon|friday|sunday|today)|act now|book now before)\b/i;
const VAGUE = /\b(the best|best \w+ in|number one|#1|loved by thousands|quality service|professional service|reliable service|top rated)\b/i;
const NEEDED = /\[needed:[^\]]*\]/gi;

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

function firstLine(text: string): string {
  return (text.split(/[.?!]/)[0] || "").trim().toLowerCase();
}

export function checkAd(ad: Ad, facts: Facts, others: Ad[]): Issue[] {
  const issues: Issue[] = [];
  const push = (field: string, reason: string) => issues.push({ adId: ad.id, field, reason });
  const copyText = [ad.primary, ad.reels, ad.headline, ad.description, ad.onScreen, ad.badge].join(" ");
  const copyNoNeeded = copyText.replace(NEEDED, "");
  const ownerText = Object.values(facts.answers).join(" ").toLowerCase();

  // Lengths
  if (!ad.primary) push("primary text", "missing");
  else if (ad.primary.length > LIMITS.primaryMax) push("primary text", `over ${LIMITS.primaryMax} characters (${ad.primary.length})`);
  else if (ad.primary.length < LIMITS.primaryMin) push("primary text", `under ${LIMITS.primaryMin} characters, write 2 to 4 full sentences`);
  else if (!/[.?!]\s+\S/.test(ad.primary)) push("primary text", "one long phrase, write it as 2 to 4 full sentences");
  else if ((ad.primary.match(/,/g) || []).length >= 4 && (ad.primary.match(/[.?!]/g) || []).length < 2) push("primary text", "a comma list of facts, write sentences instead");
  if (!ad.reels) push("reels text", "missing");
  else if (ad.reels.length > LIMITS.reels) push("reels text", `over ${LIMITS.reels} characters (${ad.reels.length})`);
  if (!ad.headline) push("headline", "missing");
  else if (ad.headline.length > LIMITS.headline) push("headline", `over ${LIMITS.headline} characters (${ad.headline.length})`);
  else if (ad.headline.length < 8) push("headline", "too short, use the offer or answer the objection");
  if (ad.description.length > LIMITS.description) push("description", `over ${LIMITS.description} characters (${ad.description.length})`);
  const os = wordCount(ad.onScreen);
  if (os < LIMITS.onScreenMin || os > LIMITS.onScreenMax) push("on-screen text", `must be ${LIMITS.onScreenMin} to ${LIMITS.onScreenMax} words`);
  if (!ad.imagePrompt || ad.imagePrompt.length < 200) push("image prompt", "too short to paste into an image tool, write the full standalone paragraph");
  else if (/the business above|answer \d|business details/i.test(ad.imagePrompt)) push("image prompt", "refers to the brief instead of spelling out the details");

  // Same button in every ad
  if (ad.cta.toLowerCase() !== facts.cta.toLowerCase()) push("button", `must be "${facts.cta}" in every ad`);

  // Leaked labels and notes (NEEDED placeholders are allowed)
  if (LEAKS.test(copyNoNeeded)) push("copy", "contains an internal note or label");

  // Numbers: every number in the copy must come from the owner
  const cleaned = copyNoNeeded.replace(/(\d)[ ,](?=\d{3}\b)/g, "$1");
  for (const n of cleaned.match(/\d+(?:\.\d+)?/g) || []) {
    const v = String(parseFloat(n));
    if (!facts.allowedNumbers.has(v)) {
      push("numbers", `uses ${n}, which the owner did not give`);
      break;
    }
  }

  // No phone numbers or links in the copy
  if (/\b0\d{2}[ -]?\d{3}[ -]?\d{4}\b|\+27|https?:\/\/|www\./i.test(copyText)) push("copy", "contains a phone number or link, the button carries it");

  // Urgency only when real
  if (!facts.hasUrgency && URGENCY_WORDS.test(copyText)) push("urgency", "urgency words with no real reason to act now");

  // Vague claims unless the owner said them
  const vague = copyText.match(VAGUE);
  if (vague && !ownerText.includes(vague[0].toLowerCase())) push("claims", `"${vague[0]}" is a vague claim the owner did not back up`);

  // Pasted answers of 6+ words appearing word for word in the primary text (the problem and myth may be used as said)
  for (const key of ["business", "customers", "proof", "offer", "objection", "contact", "tone"]) {
    const ans = (facts.answers[key] || "").trim().toLowerCase().replace(/[.!?]+$/, "");
    if (ans.split(/\s+/).length >= 6 && ad.primary.toLowerCase().includes(ans)) {
      push("primary text", `pastes the owner's "${key}" answer word for word, rewrite it as ad copy`);
      break;
    }
  }

  // Different from the other ads. Words every ad must share (the product, the area, the
  // offer, the action) are taken out before comparing, so only the idea is compared.
  const common = words([facts.answers.business, facts.answers.customers, facts.answers.offer, "whatsapp book call shop visit"].join(" "));
  const idea = (x: Ad) => new Set(Array.from(words([x.primary, x.headline].join(" "))).filter((w) => !common.has(w)));
  for (const o of others) {
    if (o.id === ad.id) continue;
    const a = idea(ad);
    const b = idea(o);
    const shared = Array.from(a).filter((w) => b.has(w)).length;
    const smaller = Math.max(1, Math.min(a.size, b.size));
    if (shared / smaller >= 0.5) push("variety", `too similar to ad ${o.id}`);
    if (firstLine(ad.primary) === firstLine(o.primary)) push("primary text", `same first line as ad ${o.id}`);
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
  return cleanAd({
    id: Number(r.id) || fallbackId,
    concept,
    primary: str(r.primary ?? r.primaryText ?? r.primary_text),
    reels: str(r.reels ?? r.reelsPrimaryText ?? r.reels_primary_text),
    headline: str(r.headline),
    description: str(r.description),
    cta: str(r.cta ?? r.ctaButton ?? r.cta_button),
    onScreen: str(r.onScreen ?? r.onScreenText ?? r.on_screen_text),
    badge: str(r.badge ?? r.offerBadge ?? r.offer_badge),
    imagePrompt: str(r.imagePrompt ?? r.image_prompt),
    addAfterwards: str(r.addAfterwards ?? r.add_afterwards),
    cropAndCheck: str(r.cropAndCheck ?? r.crop_and_check),
    whatsappGreeting: str(r.whatsappGreeting ?? r.whatsapp_greeting),
  });
}

// ---------- Launch card and checklist (no AI, built from the answers) ----------

export type LaunchLine = { title: string; text: string };

export function buildLaunchCard(facts: Facts): LaunchLine[] {
  const area = facts.answers.customers?.trim();
  const method = facts.contactMethod;
  const objective =
    method === "whatsapp"
      ? "Choose the Engagement or Leads goal with Messaging apps, and pick WhatsApp. This makes it a Click-to-WhatsApp ad, so the button opens a chat with you."
      : method === "call"
        ? "Choose the Leads goal with Calls, so the button dials your number."
        : method === "book online" || method === "shop online"
          ? "Choose the Sales or Leads goal with Website, and put your booking or shop link as the destination. The page must show the same offer as the ad."
          : "Choose the Awareness or Engagement goal and set your address, so people can find you.";
  return [
    { title: "Where to set it up", text: "Use Ads Manager, not the blue Boost button. " + objective },
    {
      title: "Audience",
      text:
        "Keep the audience broad and let Meta's Advantage+ settings choose placements. Set location only" +
        (area ? `: ${area}` : "") +
        " plus a radius you can serve. The words and picture in each ad do the targeting, so you do not need to add interests.",
    },
    {
      title: "Ads",
      text: "Put all three ads in one ad set with the same offer and button. Meta shows each one and learns which opening your customers respond to. That is the whole point of three different openings.",
    },
    {
      title: "Testing",
      text: "Leave the ads alone for 5 to 7 days and about 1,000 views each. Then judge them in this order: how many people stopped to watch or read, then how many clicked, then what one lead cost you. Pause the weakest, and every 2 to 3 weeks add a new version of the winner.",
    },
    {
      title: "Reply fast",
      text:
        method === "whatsapp"
          ? "Someone must answer the WhatsApp within minutes. Save the greeting from each ad as a quick reply in WhatsApp Business so the first message matches what the ad promised."
          : "Someone must respond within minutes of a call, booking or order. A slow reply loses the lead the ad just paid for.",
    },
  ];
}

export type CheckItem = { label: string; ok: boolean; fix: string };

export function buildChecklist(facts: Facts, ads: Ad[]): CheckItem[] {
  const a = facts.answers;
  const has = (k: string) => !!(a[k] && a[k].trim() && !/^(skip|not sure|none)$/i.test(a[k].trim()));
  const firsts = new Set(ads.map((x) => firstLine(x.primary)));
  const needed = ads.some((x) => /\[needed:/i.test([x.primary, x.headline, x.description, x.reels].join(" ")));
  return [
    { label: "Who it is for: the customer or area is named", ok: has("customers"), fix: "Add who your customers are and your area, so Meta knows who to show the ad to." },
    { label: "What it is: one clear product or service", ok: has("business"), fix: "Name the one thing you are advertising." },
    { label: "Why you: proof people can check", ok: has("proof"), fix: "Add your rating and number of reviews, years in business, jobs done or a real customer review." },
    { label: "The deal: a price, from price or offer", ok: has("offer"), fix: "Add a price or a from price." },
    { label: "How to get it: one clear action and a matching button", ok: !!facts.contactMethod, fix: "Choose how customers should contact you." },
    { label: "Why now: only if it is real", ok: true, fix: "" },
    { label: "Three different openings: problem, proof, surprising fact", ok: firsts.size === 3, fix: "Two ads open the same way. Tap Try again." },
    { label: "Nothing left to fill in", ok: !needed, fix: "A field says [NEEDED]. Add that detail before you post." },
    { label: "Image made at 9:16, then cropped to 4:5 and 1:1", ok: false, fix: "Use the image prompt, or a real photo, then crop in Canva." },
    { label: "Someone ready to reply within minutes", ok: false, fix: "Decide who watches the phone or inbox while the ads run." },
  ];
}
