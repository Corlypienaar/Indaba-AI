// Every guided card is a content entry. The shared chat engine runs it.
// A card = intro, questions, a calculation step, the expert role and task
// for Llama, and a "go deeper" prompt the owner can copy.
//
// This file is shared by the browser (questions, sums, deeper prompt) and
// the server (role and task for Llama). It has no secrets in it.

export type Question = {
  id: string;
  text: string;
  why?: string; // one line under the question
  help: string; // shown when the owner taps "I am not sure what this means"
  type: "text" | "number" | "choice" | "multi";
  options?: string[];
  optional?: boolean;
  tough?: boolean; // show the kind lead-in before this question
};

export type Answers = Record<string, string>; // id -> answer, "" when skipped

export type Calc = Record<string, string>; // human readable numbers

export type Card = {
  slug: string;
  title: string;
  intro: string[]; // bubbles shown before the first question
  minutes: number;
  questions: Question[];
  calculate: (a: Answers) => Calc;
  role: string; // who Llama is for this card
  task: (a: Answers, c: Calc) => string; // what Llama must do, filled in
  maxWords: number;
  deeper: (a: Answers, c: Calc) => string; // prompt for the owner to copy
  nextSlug?: string;
};

export const TOUGH_LEAD_IN =
  "This next question can feel uncomfortable. Ask it anyway. You cannot fix what you cannot see, and now you have a tool that helps you see it.";

export const HELP_LEAD_IN =
  "That is fine. Plenty of owners have never worked this out, because nobody showed them how. Here is a simple way to find it.";

export const CLOSING_LINE =
  "You looked at something many owners keep putting off. That took courage. Pick one small step from this list and do it this month. Come back when you are ready for the next one.";

const n = (v: string) => {
  const x = parseFloat(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return isNaN(x) ? null : x;
};
const rand = (x: number) => "R" + Math.round(x).toLocaleString("en-ZA");
const or = (v: string, fallback: string) => (v && v.trim() ? v.trim() : fallback);

// ---------------------------------------------------------------------------
// Card 1: Are my prices and profit right?
// ---------------------------------------------------------------------------

const prices: Card = {
  slug: "prices",
  title: "Are my prices and profit right?",
  minutes: 5,
  intro: [
    "Many owners work hard and wonder where the money went. In about 5 minutes we will look at what you charge, what it really costs you, and what you keep.",
    "Rough numbers are fine. Use labels like Client A instead of real names. We never ask for ID numbers or bank details.",
  ],
  questions: [
    {
      id: "what",
      text: "What do you sell? Tell us the main thing customers pay you for.",
      why: "So we can talk about your business, and not business in general.",
      help: "Think of the thing most customers come to you for, for example \"garden services\" or \"handmade candles\".",
      type: "text",
    },
    {
      id: "price",
      text: "What do you usually charge for one job or one sale? (in rand)",
      help: "Pick a typical one. If your prices vary a lot, use the one you sell most.",
      type: "number",
    },
    {
      id: "cost",
      text: "What does it cost you to deliver that one job or sale? (in rand)",
      why: "The money you collect is not the money you keep.",
      help: "Take one recent job and add up everything that went into it: materials or stock, helpers, fuel, data, card fees, power, and anything lost or damaged. If you are not sure, skip it and we will flag it.",
      type: "number",
      tough: true,
    },
    {
      id: "overheads",
      text: "Are there monthly costs you have not counted yet, like rent, power, phone, insurance, tools or software? Roughly how much a month? (in rand, or 0)",
      why: "These are the costs that quietly eat a busy business.",
      help: "Look at last month's bank statement and add up the amounts that go out every month no matter how many jobs you did.",
      type: "number",
    },
    {
      id: "hours",
      text: "About how many hours of your own time does one job or sale take, from first message to getting paid?",
      help: "Include quotes, travel, admin and follow-up. Estimates are fine.",
      type: "number",
    },
    {
      id: "count",
      text: "About how many of these do you sell in a normal month?",
      help: "Count last month, or a typical month if last month was unusual.",
      type: "number",
    },
    {
      id: "when",
      text: "When did you last raise your prices?",
      help: "Think of the last time your price list or your usual quote went up.",
      type: "choice",
      options: ["In the last year", "More than a year ago", "More than two years ago", "Never", "Not sure"],
    },
    {
      id: "pay",
      text: "What do you pay yourself from the business?",
      help: "A fixed amount means you decide your pay first. Without it, it is hard to tell whether the business really works.",
      type: "choice",
      options: ["A fixed amount every month", "Whatever is left", "Nothing yet", "Not sure"],
    },
    {
      id: "result",
      text: "What does your customer get from you, and what would it cost them if the problem stayed unsolved?",
      help: "Think of the last customer who called you. What were they worried about, and what did it cost them in money, time or stress?",
      type: "text",
      optional: true,
    },
  ],
  calculate(a) {
    const price = n(a.price);
    const cost = n(a.cost);
    const hours = n(a.hours);
    const count = n(a.count);
    const overheads = n(a.overheads) ?? 0;
    const c: Calc = {};
    if (price !== null) c["Price per job or sale"] = rand(price);
    if (price !== null && cost !== null) {
      const profit = price - cost;
      c["Profit per job or sale (before monthly costs)"] = rand(profit);
      c["Margin"] = price > 0 ? Math.round((profit / price) * 100) + "%" : "unknown";
      if (hours && hours > 0) c["Profit per hour of your own time"] = rand(profit / hours);
      if (count !== null) {
        const monthly = profit * count;
        c["Monthly profit before monthly costs"] = rand(monthly);
        c["Monthly costs you listed"] = rand(overheads);
        c["Monthly profit after those costs"] = rand(monthly - overheads);
        if (hours) c["Your hours a month on this"] = Math.round(hours * count) + " hours";
      }
    } else if (price !== null) {
      c["Profit per job or sale"] = "unknown (cost not given)";
    }
    return c;
  },
  role:
    "You are an expert business analyst who specialises in pricing and profit margins for small businesses.",
  task: (a, c) =>
    `The owner sells: ${or(a.what, "not given")}.\n` +
    `Their numbers, calculated by the app (use these, do not recalculate):\n${calcLines(c)}\n` +
    `They last raised prices: ${or(a.when, "not given")}. They pay themselves: ${or(a.pay, "not given")}. ` +
    `What the customer gets, in the owner's words: ${or(a.result, "not given")}.\n\n` +
    `Look at: whether the price covers costs and the owner's own time; whether the monthly costs leave real profit; whether the owner pays themselves a fixed amount; how long since the last price rise; whether the customer's result is worth more than the price.\n` +
    `Useful ideas to draw on in plain words: pay yourself and keep some profit first, then run the business on what is left; a busy business can still lose money if costs are missed; pricing can reflect what the result is worth to the customer; small improvements in several areas (more enquiries, more sales closed, more repeat sales, a slightly higher average sale, a slightly better margin) add up together.\n` +
    `Do not state what other businesses charge. Say "check what three similar businesses charge" and explain how. Suggest at most one price test, for example a higher price with new customers first, and describe the risk honestly. Do not give tax advice.`,
  maxWords: 300,
  deeper: (a, c) =>
    `Act as an expert business analyst who specialises in pricing and profit for small businesses. I run a ${or(a.what, "small business")}. I charge about R${or(a.price, "?")} per job or sale. It costs me about R${or(a.cost, "?")} to deliver. My monthly costs are about R${or(a.overheads, "?")}. One job takes about ${or(a.hours, "?")} hours of my time, and I do about ${or(a.count, "?")} a month. I last raised my prices: ${or(a.when, "not sure")}. I pay myself: ${or(a.pay, "not sure")}. My customers get this result: ${or(a.result, "not sure")}.\n` +
    (Object.keys(c).length ? `My numbers so far: ${calcLines(c, "; ")}.\n` : "") +
    `Please tell me honestly whether my pricing is right. Do not just agree with me. First tell me what is working. Then show me where I may be undercharging or losing money, using my numbers. Then give me three practical options to try this month, with the risk of each. Ask me questions one at a time if you need more information. Use plain English. Do not guess market prices. If you mention tax or legal rules, tell me to check with my accountant or tax authority.`,
  nextSlug: "blindspots",
};

// ---------------------------------------------------------------------------
// Card 2: What might I not be seeing?
// ---------------------------------------------------------------------------

const blindspots: Card = {
  slug: "blindspots",
  title: "What might I not be seeing?",
  minutes: 5,
  intro: [
    "Every owner has blind spots. We stand so close to the business that some things are hard to see.",
    "These questions are honest on purpose. Your answers stay with you, and the point is to help.",
  ],
  questions: [
    {
      id: "what",
      text: "What does your business do, and how many people work in it, including you?",
      help: "One line is enough, for example \"a bakery, three of us\".",
      type: "text",
    },
    {
      id: "away",
      text: "If you were away for two weeks, what would happen?",
      why: "If everything stops when you step away, the business owns you.",
      help: "Imagine you are in hospital. Who answers the phone and who does the work?",
      type: "choice",
      options: ["Everything would stop", "Most things would stop", "About half would keep going", "Most would keep going", "Not sure"],
    },
    {
      id: "concentration",
      text: "About how much of your income comes from your three biggest customers?",
      help: "Add up what your three biggest customers paid you last year and divide by your total income.",
      type: "choice",
      options: ["Less than a quarter", "About half", "Three quarters or more", "Not sure"],
    },
    {
      id: "sources",
      text: "How do new customers find you today? Pick all that apply.",
      help: "Think of your last five new customers. How did each one hear about you?",
      type: "multi",
      options: ["Referrals", "Social media", "WhatsApp", "Walking past or word of mouth", "Ads", "Website or Google search", "I am not sure"],
    },
    {
      id: "repeat",
      text: "Of the customers who buy once, how many come back?",
      why: "Losing customers quietly is one of the most expensive blind spots.",
      help: "Think of ten customers from six months ago. How many have bought again since?",
      type: "choice",
      options: ["Most", "About half", "A few", "Hardly any", "Not sure"],
    },
    {
      id: "numbers",
      text: "Which numbers do you check every week? Pick all that apply.",
      help: "Even three numbers, checked every Monday, beat a big report you never open.",
      type: "multi",
      options: ["Money coming in", "Money owed to me", "New enquiries", "Jobs done on time", "Cash in the bank", "None of these"],
    },
    {
      id: "putoff",
      text: "What is one thing you keep putting off?",
      help: "The thing you think about at night and do not get to during the day.",
      type: "text",
      tough: true,
    },
    {
      id: "truth",
      text: "Who could tell you the honest truth about your business, and have you asked?",
      help: "Someone who is not afraid to disagree with you, such as a partner, a supplier or a friend in business.",
      type: "choice",
      options: ["I have asked", "I could ask someone", "I do not have anyone", "Not sure"],
    },
  ],
  calculate: () => ({}),
  role:
    "You are an honest, experienced business advisor who helps small business owners find the blind spots they cannot see themselves.",
  task: (a) =>
    `The owner runs: ${or(a.what, "not given")}. If they were away for two weeks: ${or(a.away, "not given")}. Income from the top three customers: ${or(a.concentration, "not given")}. New customers come from: ${or(a.sources, "not given")}. Repeat customers: ${or(a.repeat, "not given")}. Numbers checked weekly: ${or(a.numbers, "not given")}. They keep putting off: ${or(a.putoff, "not given")}. Someone who tells them the truth: ${or(a.truth, "not given")}.\n\n` +
    `Start with the real strengths in their answers. Then name two or three possible blind spots, each written as a question for the owner to think about, with a short honest reason why their answers point to it. Choose the ones their answers support most: dependence on the owner, dependence on a few customers, customers who do not return, no weekly numbers, relying on a single source of new customers, a task that keeps being avoided, nobody giving honest feedback. ` +
    `Give one practical thing to do this month, small enough to do in an hour. Do not diagnose or predict. Do not say the business will fail.`,
  maxWords: 300,
  deeper: (a) =>
    `Act as an honest, practical advisor for small businesses who does not just agree with me. I run ${or(a.what, "a small business")}. If I were away for two weeks: ${or(a.away, "not sure")}. About ${or(a.concentration, "not sure")} of my income comes from my three biggest customers. New customers find me through: ${or(a.sources, "not sure")}. Of customers who buy once, ${or(a.repeat, "not sure")} come back. Each week I check: ${or(a.numbers, "not sure")}. I keep putting off: ${or(a.putoff, "not sure")}. When I ask who could tell me the honest truth about my business, my answer is: ${or(a.truth, "not sure")}.\n` +
    `Please start with what is strong. Then ask me the three questions I should be asking about my business but probably am not. Ask them one at a time and wait for my answer. After that, tell me what you think my biggest blind spot is and one small thing I can do about it this month. Be direct and kind. Use plain English.`,
  nextSlug: "whatsapp",
};

// ---------------------------------------------------------------------------
// Card 3: Help me with WhatsApp
// ---------------------------------------------------------------------------

const whatsapp: Card = {
  slug: "whatsapp",
  title: "Help me with WhatsApp",
  minutes: 5,
  intro: [
    "Your customers are probably already on WhatsApp. In about 5 minutes we will look at how you use it today and give you a simple plan to start, plus messages you can copy.",
  ],
  questions: [
    {
      id: "what",
      text: "What do you sell, and who buys it?",
      help: "One line is enough, for example \"school uniforms, parents in Soweto\".",
      type: "text",
    },
    {
      id: "whatsapp",
      text: "Which do you use for your business?",
      help: "WhatsApp Business is a free, separate app made for businesses. It lets you set up a business profile, quick replies, a greeting message and a catalogue.",
      type: "choice",
      options: ["WhatsApp Business app", "Normal WhatsApp", "Both", "I do not use WhatsApp for business yet", "Not sure"],
    },
    {
      id: "channels",
      text: "How do customers reach you today? Pick all that apply.",
      help: "Think of the last ten enquiries. Where did they come in?",
      type: "multi",
      options: ["WhatsApp", "Phone calls", "Facebook or Instagram messages", "Email", "In person"],
    },
    {
      id: "speed",
      text: "How quickly do you usually reply to a new enquiry?",
      why: "The business that replies first often gets the job.",
      help: "Be honest. Look at your last few new chats and check the time between their message and your reply.",
      type: "choice",
      options: ["Within minutes", "Within a few hours", "The same day", "The next day or later", "Not sure"],
    },
    {
      id: "faq",
      text: "What are the three questions customers ask you most? Type them in one message, one per line.",
      help: "Think of the last ten messages you received. What did people want to know? Prices, hours, location, how to book?",
      type: "text",
      optional: true,
    },
    {
      id: "followup",
      text: "When someone asks for a price and goes quiet, do you follow up?",
      why: "Many sales are lost because nobody followed up, and most people need more than one nudge.",
      help: "Think of the last five quotes you sent. How many did you chase?",
      type: "choice",
      options: ["Always", "Sometimes", "Rarely", "Never"],
    },
    {
      id: "goal",
      text: "What would you like WhatsApp to do for you?",
      help: "Pick the one that would make the biggest difference this month.",
      type: "choice",
      options: ["Bring in more customers", "Help me reply faster", "Help me follow up better", "Help me send offers", "All of it"],
    },
  ],
  calculate: () => ({}),
  role:
    "You are a practical WhatsApp Business coach who sets small businesses up to win customers on WhatsApp.",
  task: (a) =>
    `The owner sells: ${or(a.what, "not given")}. They use: ${or(a.whatsapp, "not given")}. Customers reach them by: ${or(a.channels, "not given")}. They reply: ${or(a.speed, "not given")}. They follow up on quotes: ${or(a.followup, "not given")}. They want WhatsApp to: ${or(a.goal, "not given")}. Their most asked questions: ${or(a.faq, "not given")}.\n\n` +
    `Start with what they already do well. Then give a simple starting plan of three to five steps in the right order for where they are today: set up the business profile, write a greeting message, write an away message, add quick replies for their most asked questions, and build a small catalogue. Tailor it to their answers and be honest if their reply speed or follow-up habit is costing them sales. ` +
    `Then write, ready to copy: one greeting message, one away message, and one quick reply for each question they gave (if none were given, write quick replies for price, hours and location). Keep each under 40 words. Friendly and plain. Then write one short follow-up message for someone who asked for a price and went quiet, with no false urgency. ` +
    `Give one thing to do this week. Rules: no false urgency or fake scarcity. Messages to groups of customers go only to people who agreed to hear from the business. Keep customers' phone numbers safe. Do not claim features or settings you cannot confirm. Do not give legal advice. Tell the owner to check WhatsApp's own help pages for the current steps.`,
  maxWords: 400,
  deeper: (a) =>
    `Act as a practical WhatsApp Business coach for small businesses. I sell ${or(a.what, "products and services")}. I use: ${or(a.whatsapp, "not sure")}. Customers contact me by: ${or(a.channels, "not sure")}. I usually reply: ${or(a.speed, "not sure")}. I follow up on quotes: ${or(a.followup, "not sure")}. My most common customer questions are: ${or(a.faq, "not sure")}. I want WhatsApp to: ${or(a.goal, "help my business")}.\n` +
    `Please give me a simple plan to set up my business profile, greeting message, away message, quick replies and catalogue, one step at a time. After each step, ask me if I am ready for the next. Then help me write a short follow-up message for people who asked for a price and went quiet. Be honest if something I do is costing me sales. Use plain English. Do not use false urgency. Remind me to only message people who agreed to hear from me.`,
  nextSlug: "prices",
};

function calcLines(c: Calc, sep = "\n"): string {
  const lines = Object.entries(c).map(([k, v]) => `${k}: ${v}`);
  return lines.length ? lines.join(sep) : "none";
}

export const CARDS: Record<string, Card> = { prices, blindspots, whatsapp };

export function getCard(slug: string): Card | undefined {
  return CARDS[slug];
}
