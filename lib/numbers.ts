// Reading a number out of the way an owner actually types it.
//
//   "R100"                                  -> 100
//   "R5 000"  /  "R5,000"  /  "5000"         -> 5000
//   "R20 for soap and wax, and R40 petrol, so R60"  -> 60   (the total after "so")
//   "R20 soap and R40 petrol"                -> 60   (no total given: add them up)
//   "about 20"                              -> 20
//   "R2.5k"                                 -> 2500
//   "I am not sure"                         -> null
//
// Sanity limits are per question, so "72 000 hours a month" is treated as not understood.

export type NumberKind = "money" | "hours" | "count" | "times";

const LIMITS: Record<NumberKind, number> = {
  money: 50_000_000,
  hours: 200, // hours per job or per week
  count: 5_000, // jobs or sales per month
  times: 400, // purchases per year
};

function allNumbers(text: string): number[] {
  // Join thousands written with a space or comma: "5 000", "5,000". Keep "2.5".
  const cleaned = text
    .replace(/(\d)[ ,](?=\d{3}\b)/g, "$1")
    .replace(/(\d+(?:\.\d+)?)\s*k\b/gi, (_, n) => String(parseFloat(n) * 1000));
  const found = cleaned.match(/\d+(?:\.\d+)?/g) || [];
  return found.map((x) => parseFloat(x)).filter((x) => !isNaN(x));
}

export function parseNumber(text: string, kind: NumberKind = "money"): number | null {
  if (!text) return null;
  const t = text.trim();
  if (!/\d/.test(t)) return null;

  // A stated total wins: "..., so R60" / "total R60" / "= 60" / "altogether 60".
  const totalMatch = t.match(/(?:\bso\b|\btotal(?:s|ling)?\b|altogether|in total|=|comes to|about\s+R?)\s*[:\-]?\s*R?\s*(\d[\d ,]*(?:\.\d+)?)\s*(k\b)?/i);
  let value: number | null = null;
  if (totalMatch && /\bso\b|total|altogether|=|comes to/i.test(totalMatch[0])) {
    value = parseFloat(totalMatch[1].replace(/[ ,]/g, "")) * (totalMatch[2] ? 1000 : 1);
  } else {
    const nums = allNumbers(t);
    if (nums.length === 0) return null;
    // One number: take it. Several money amounts joined by "and", "+" or "plus": add them up.
    // Hours and counts are never added ("1 hour, 45 minutes" is about 1, not 46).
    const looksLikeList = kind === "money" && /\band\b|\+|plus|,\s*R?\d/i.test(t);
    value = nums.length === 1 || !looksLikeList ? nums[0] : nums.reduce((a, b) => a + b, 0);
  }
  if (value === null || !isFinite(value) || value < 0) return null;
  if (value > LIMITS[kind]) return null;
  return value;
}

export const AI_NUMBERS_CAUTION =
  "AI can make mistakes. Please double check these numbers against your own records before you act on them.";

export function rand(x: number): string {
  return "R" + Math.round(x).toLocaleString("en-ZA");
}
