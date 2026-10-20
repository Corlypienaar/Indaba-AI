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


// ---------------------------------------------------------------------------
// Card 4: Stress test my business idea
// ---------------------------------------------------------------------------

const idea: Card = {
  slug: "idea",
  title: "Stress test my business idea",
  minutes: 5,
  intro: [
    "Every business started as an idea. Testing an idea before you spend money is one of the smartest things you can do. In about 5 minutes we will look at who needs it, whether they would pay, and a cheap way to find out.",
    "A few honest notes first. Money a customer pays before you deliver is their money until you deliver, so keep test payments small and say clearly what you promise and when. Some work needs a licence or registration before you sell. Please do not quit a steady job because of one quick test. Rules differ by country, and we are not giving legal advice.",
  ],
  questions: [
    {
      id: "stage",
      text: "Where are you right now?",
      help: "Pick the one that fits. Both are fine.",
      type: "choice",
      options: ["I have an idea but no business yet", "I have a business and a new idea"],
    },
    {
      id: "idea",
      text: "What is your idea, in one sentence?",
      help: "Say it the way you would tell a friend.",
      type: "text",
    },
    {
      id: "who",
      text: "What problem does it solve, and who has that problem? Name three real people you know who do, using first names or labels like Person A.",
      why: "An idea with no named buyer is still a wish.",
      help: "Think of people who have complained about this problem, or who pay for a worse version of it today.",
      type: "text",
    },
    {
      id: "demand",
      text: "Do people already pay for something like this today? Where do these people spend time: WhatsApp groups, Facebook groups, markets, churches, schools, taxi ranks?",
      help: "If nobody pays for anything like it, that is worth knowing. If they do, that is proof there is money in the problem.",
      type: "text",
    },
    {
      id: "profit",
      text: "How much profit would you make on one sale? (in rand)",
      help: "What you would charge minus what it would cost you to deliver one.",
      type: "number",
    },
    {
      id: "target",
      text: "How much do you need to earn from this each month to make it worthwhile? (in rand)",
      help: "Be honest about the number that would make this worth your time.",
      type: "number",
    },
    {
      id: "test",
      text: "What is the cheapest way you could test this in the next 48 hours, and what is the most you could lose?",
      help: "The smallest version possible: one customer, one product, one weekend.",
      type: "text",
      tough: true,
    },
    {
      id: "presell",
      text: "Could you ask three people this week to pay something small before you build or buy stock?",
      why: "A promise to pay is stronger proof than a compliment.",
      help: "Asking can feel awkward, and people say yes more often than expected.",
      type: "choice",
      options: ["I have already asked", "I could this week", "I am not sure how", "I would feel awkward"],
    },
    {
      id: "licence",
      text: "Do you need a licence, registration or tax number before you can sell?",
      help: "Food, transport, childcare, finance and building work often do. If you are not sure, say so and we will tell you how to check.",
      type: "choice",
      options: ["Yes", "No", "Not sure"],
    },
  ],
  calculate(a) {
    const profit = n(a.profit);
    const target = n(a.target);
    const c: Calc = {};
    if (profit !== null) c["Profit per sale"] = rand(profit);
    if (target !== null) c["Monthly target"] = rand(target);
    if (profit && profit > 0 && target !== null) {
      const sales = Math.ceil(target / profit);
      c["Sales needed per month"] = sales + " sales";
      c["That is about"] = Math.ceil(sales / 4.3) + " sales a week";
    }
    return c;
  },
  role:
    "You are an honest, experienced advisor who helps people test business ideas cheaply before they spend money.",
  task: (a, c) =>
    `Stage: ${or(a.stage, "not given")}. The idea: ${or(a.idea, "not given")}. Who has the problem: ${or(a.who, "not given")}. Existing demand and where they gather: ${or(a.demand, "not given")}.\n` +
    `Numbers calculated by the app (use these): ${calcLines(c, "; ")}.\n` +
    `Cheapest test: ${or(a.test, "not given")}. Willing to ask for small payments: ${or(a.presell, "not given")}. Licence needed: ${or(a.licence, "not given")}.\n\n` +
    `Start with what is promising. Then raise two or three risks as questions the owner can test cheaply, and be honest if the idea looks weak. Cover the ones that matter most for their answers: unnamed buyers, no proof people pay, numbers that do not add up (say plainly if the sales needed per month look unrealistic for one person), no cheap test, licences or registration. ` +
    `Give one small test the owner can do in 48 hours, with a clear success measure, such as three people agreeing to pay a small amount. Never push anyone to quit a job or spend savings. Do not give legal advice; if a licence may be needed, say how to find out.`,
  maxWords: 300,
  deeper: (a, c) =>
    `Act as an honest, practical advisor helping me test a business idea cheaply before I spend money. Do not just agree with me. My idea: ${or(a.idea, "?")}. The problem it solves and who has it: ${or(a.who, "?")}. Where these people already spend money and time: ${or(a.demand, "?")}. My profit per sale would be about R${or(a.profit, "?")}. I need about R${or(a.target, "?")} a month, which is roughly ${c["Sales needed per month"] || "?"}. The cheapest test I can think of: ${or(a.test, "?")}. Asking people to pay a small amount first: ${or(a.presell, "?")}. Licence or registration needed: ${or(a.licence, "not sure")}.\n` +
    `Please start with what is promising. Then ask me the five toughest questions I should answer before I invest, one at a time. After that, help me design a 48-hour test with a clear way to tell whether it worked. Use plain English. Do not push me to quit a job or spend savings. Remind me to check licence and registration rules for my kind of business.`,
  nextSlug: "prices",
};

// ---------------------------------------------------------------------------
// Card 5: Where is my time going?
// ---------------------------------------------------------------------------

const time: Card = {
  slug: "time",
  title: "Where is my time going?",
  minutes: 5,
  intro: [
    "You cannot get back time you cannot see. In about 5 minutes we will look at your week, find the jobs that drain you, and find the ones you could hand off or drop.",
  ],
  questions: [
    {
      id: "week",
      text: "What did you do last week, in rough blocks? For example \"Mon morning: quotes, 3 hours. Tue: deliveries all day.\" A rough list is enough.",
      help: "Use your phone calendar, your WhatsApp or a notebook to remember. A rough picture is enough.",
      type: "text",
    },
    {
      id: "drain",
      text: "Which of those jobs drain you, and which give you energy?",
      help: "Drain: the ones you put off or finish tired. Energy: the ones that make the day feel worth it.",
      type: "text",
    },
    {
      id: "good",
      text: "Which jobs are you good at and enjoy? And which do you dislike or struggle with?",
      help: "Two short lists. Be honest, nobody else sees this.",
      type: "text",
    },
    {
      id: "takehome",
      text: "About how much do you take home from the business each month? (in rand)",
      why: "This tells us what an hour of your time is worth, so we can see which jobs cost more than they are worth.",
      help: "Use a rough average. If it changes a lot, use a normal month.",
      type: "number",
    },
    {
      id: "hours",
      text: "About how many hours do you work in a normal week?",
      help: "Count everything: jobs, admin, driving, messages at night.",
      type: "number",
    },
    {
      id: "only",
      text: "Which jobs can only you do?",
      help: "Cross out anything a helper, a family member or a tool could do, even if not as well as you.",
      type: "text",
    },
    {
      id: "avoid",
      text: "Which job do you avoid that matters?",
      help: "The thing that would move the business forward, and that keeps slipping to next week.",
      type: "text",
      tough: true,
    },
  ],
  calculate(a) {
    const take = n(a.takehome);
    const hours = n(a.hours);
    const c: Calc = {};
    if (take !== null && hours && hours > 0) {
      c["Your hours a month"] = Math.round(hours * 4.3) + " hours";
      c["Rough value of one hour of your time"] = rand(take / (hours * 4.3));
    }
    return c;
  },
  role:
    "You are a practical time coach for small business owners, who helps them find the hours they can win back.",
  task: (a, c) =>
    `The owner's week: ${or(a.week, "not given")}. Jobs that drain or energise: ${or(a.drain, "not given")}. Good at and enjoy, dislike or struggle: ${or(a.good, "not given")}. Numbers calculated by the app: ${calcLines(c, "; ")}. Jobs only they can do: ${or(a.only, "not given")}. The job they avoid: ${or(a.avoid, "not given")}.\n\n` +
    `Start with the jobs that are worth the owner's time. Then sort the rest into Keep, Stop, Batch (do all at once) and Hand off, using their own words for the jobs. Offer low-cost options first for handing off: delete it, batch it, family help, part-time help, a freelancer, a tool. Mention AI only where it fits, for example drafting messages, summarising or planning. ` +
    `Show the owner's hourly value and name one job that costs more than it is worth, and be honest if their week shows a problem they are not naming. Give one job to hand off or drop this week. Do not suggest hiring full-time.`,
  maxWords: 300,
  deeper: (a, c) =>
    `Act as a practical time coach for small business owners. Do not just agree with me. My week looks like this: ${or(a.week, "?")}. These jobs drain me and these give me energy: ${or(a.drain, "?")}. Jobs I like and am good at, and jobs I dislike: ${or(a.good, "?")}. Jobs only I can do: ${or(a.only, "?")}. The job I avoid: ${or(a.avoid, "?")}. My time is worth about ${c["Rough value of one hour of your time"] || "?"} an hour.\n` +
    `Please help me sort my jobs into Keep, Stop, Batch and Hand off. Start with the cheapest ways to hand things off. Then help me plan one change for next week. Ask me questions one at a time. Use plain English.`,
  nextSlug: "customers",
};

// ---------------------------------------------------------------------------
// Card 6: Who are my best customers?
// ---------------------------------------------------------------------------

type Row = { label: string; pay: number | null; hours: number | null; paying: string; feel: string };

function parseRows(text: string): Row[] {
  return text
    .split(/\n|;/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split(",").map((x) => x.trim());
      const nums = parts.map(n).filter((x): x is number => x !== null);
      const words = parts.filter((x) => n(x) === null);
      const lower = l.toLowerCase();
      return {
        label: words[0] || "Client",
        pay: nums[0] ?? null,
        hours: nums[1] ?? null,
        paying: /late/.test(lower) ? (/often/.test(lower) ? "often late" : "sometimes late") : /on time|ontime/.test(lower) ? "on time" : "not given",
        feel: /drain/.test(lower) ? "draining" : /warm|great|love/.test(lower) ? "warm" : /fine|ok/.test(lower) ? "fine" : "not given",
      };
    });
}

const customers: Card = {
  slug: "customers",
  title: "Who are my best customers?",
  minutes: 10,
  intro: [
    "Your best customers may not be the ones who pay the most. They may be the ones who pay well for the least effort. In about 10 minutes we will see who is worth the most to you.",
    "Use labels like Client A and Client B instead of real names. Rough numbers are fine.",
  ],
  questions: [
    {
      id: "rows",
      text: "List up to six customers or customer types, one per line, like this:\nClient A, 4000, 10, on time, warm\nThat is: label, what they pay you a month in rand, hours they take a month, how they pay (on time, sometimes late, often late), and how the relationship feels (warm, fine, draining).",
      why: "Money relative to effort is what shows who is really worth the most.",
      help: "Start with your biggest three. Guess the hours. If you only know what they pay, that is a fine start.",
      type: "text",
    },
    {
      id: "found",
      text: "Where did your best customers first find you?",
      help: "Referral, social media, walking past, an old job, a group?",
      type: "text",
    },
    {
      id: "left",
      text: "Think of customers who left. Did you ask them why?",
      help: "Most owners never ask. The answer is often cheaper than finding a new customer.",
      type: "choice",
      options: ["Yes", "No", "Some"],
      tough: true,
    },
    {
      id: "goal",
      text: "What is your goal with your customers this year?",
      help: "For example: more of the good ones, fewer late payers, less stress, higher average sale.",
      type: "text",
      optional: true,
    },
  ],
  calculate(a) {
    const rows = parseRows(a.rows || "");
    const c: Calc = {};
    const ranked = rows
      .filter((r) => r.pay !== null)
      .map((r) => ({ ...r, perHour: r.hours && r.hours > 0 ? r.pay! / r.hours : null }))
      .sort((x, y) => (y.perHour ?? -1) - (x.perHour ?? -1));
    ranked.forEach((r, i) => {
      c[`${i + 1}. ${r.label}`] =
        `${rand(r.pay!)} a month` +
        (r.hours ? `, ${r.hours} hours, ${rand(r.perHour!)} per hour` : "") +
        (r.paying !== "not given" ? `, pays ${r.paying}` : "") +
        (r.feel !== "not given" ? `, ${r.feel}` : "");
    });
    return c;
  },
  role:
    "You are a practical business analyst who helps small business owners see which customers are worth the most to them.",
  task: (a, c) =>
    `The owner's customers, ranked by the app by rand per hour of the owner's time (use these numbers): ${calcLines(c, "; ")}. Where the best ones found them: ${or(a.found, "not given")}. Asked leaving customers why: ${or(a.left, "not given")}. Their goal: ${or(a.goal, "not given")}.\n\n` +
    `Start with the customers and patterns the owner should feel good about. Then group them as Protect and Grow, Improve, and Gently Release. For each one give a one-line reason and one practical step for this month. Use only the labels given. Be honest and kind. If a draining or late-paying customer is also a big payer, say that the choice is the owner's and suggest a conversation about what the work covers before anything else. Remind the owner to keep real names out of AI tools.`,
  maxWords: 300,
  deeper: (a, c) =>
    `Act as a practical business analyst for small businesses. Do not just agree with me. Here is my anonymised client list with what each pays per month, hours they take, how they pay and how the relationship feels: ${or(a.rows, "?")}. Ranked by money per hour: ${calcLines(c, "; ")}. My best customers found me through: ${or(a.found, "?")}. I asked customers who left why: ${or(a.left, "?")}. My goal: ${or(a.goal, "more of the good ones")}.\n` +
    `Rank my clients by value to me, which means money relative to effort. Start with what is strong. Then group them as Protect and Grow, Improve, and Gently Release, with a one-line reason and one practical step for this month for each. Be direct and honest. Ask clarifying questions first if anything is missing.`,
  nextSlug: "repeat",
};

// ---------------------------------------------------------------------------
// Card 7: Get more from the customers I already have
// ---------------------------------------------------------------------------

const repeat: Card = {
  slug: "repeat",
  title: "Get more from the customers I already have",
  minutes: 5,
  intro: [
    "Most growth hides in the customers who already trust you. In about 5 minutes we will find a few natural next things they might say yes to, and a message to reopen the door with past customers.",
  ],
  questions: [
    {
      id: "what",
      text: "What do you sell?",
      help: "The main thing customers pay you for.",
      type: "text",
    },
    {
      id: "times",
      text: "How many times a year does a typical customer buy from you?",
      help: "Once, twice, every month? A rough number is fine.",
      type: "number",
    },
    {
      id: "sale",
      text: "What is a normal sale worth? (in rand)",
      help: "A typical job or basket, not your biggest one.",
      type: "number",
    },
    {
      id: "next",
      text: "What do your best customers need next, after your job is done?",
      why: "The next thing they need is often the easiest thing to sell.",
      help: "Think of what they ask about, buy elsewhere, or struggle with after you leave.",
      type: "text",
    },
    {
      id: "lastoffer",
      text: "When did you last make an offer to past customers?",
      help: "A message, a call, a special, anything that invited them back.",
      type: "choice",
      options: ["This month", "In the last 3 months", "More than 3 months ago", "Never"],
      tough: true,
    },
    {
      id: "followup",
      text: "Do you follow up every quote?",
      help: "Think of your last five quotes. How many did you chase?",
      type: "choice",
      options: ["Always", "Sometimes", "Rarely", "Never"],
    },
  ],
  calculate(a) {
    const times = n(a.times);
    const sale = n(a.sale);
    const c: Calc = {};
    if (times !== null && sale !== null) {
      c["A typical customer is worth about"] = rand(times * sale) + " a year";
      c["One extra purchase a year per customer adds"] = rand(sale);
    }
    return c;
  },
  role:
    "You are a practical advisor who helps small businesses grow through the customers they already have.",
  task: (a, c) =>
    `The owner sells: ${or(a.what, "not given")}. A typical customer buys ${or(a.times, "?")} times a year, and a normal sale is R${or(a.sale, "?")}. Numbers calculated by the app: ${calcLines(c, "; ")}. Best customers need next: ${or(a.next, "not given")}. Last offer to past customers: ${or(a.lastoffer, "not given")}. Follows up quotes: ${or(a.followup, "not given")}.\n\n` +
    `Start with what is working. Then suggest three or four natural next offers that existing customers would likely say yes to. For each: what it is, which type of customer it suits, why it fits, and one line to raise it naturally. Say honestly if an idea looks weak, and be honest if their follow-up or last-offer answer is costing them sales. ` +
    `Then write one short message (under 100 words) to reconnect with a past customer. No pressure and no pitch. Avoid "just checking in" and "it has been a while". No aggressive sales language. Give one thing to do this week.`,
  maxWords: 350,
  deeper: (a) =>
    `Act as a practical advisor for small businesses. Do not just agree with me. I sell ${or(a.what, "?")}. A typical customer buys ${or(a.times, "?")} times a year, and a normal sale is about R${or(a.sale, "?")}. My best customers usually need this next: ${or(a.next, "?")}. I last made an offer to past customers: ${or(a.lastoffer, "?")}. I follow up on quotes: ${or(a.followup, "?")}.\n` +
    `Show me three or four natural next things my existing customers would likely say yes to. For each, tell me why it fits, which customers it suits, and the simplest way to raise it. If an idea is weak, say so. Then help me write a short, warm message to a customer I have not spoken to in a while, under 100 words, with no pitch. Ask me questions first if anything is missing.`,
  nextSlug: "whatsapp",
};

// ---------------------------------------------------------------------------
// Card 8: Help me think through a decision
// ---------------------------------------------------------------------------

const decision: Card = {
  slug: "decision",
  title: "Help me think through a decision",
  minutes: 5,
  intro: [
    "A good thinking partner asks the questions you have not asked yourself. In about 5 minutes we will look at a decision from all sides. We will be honest with you.",
  ],
  questions: [
    {
      id: "decision",
      text: "What is the decision? One or two sentences.",
      help: "Say it plainly, for example \"whether to take on a second van\" or \"whether to drop my biggest client\".",
      type: "text",
    },
    {
      id: "options",
      text: "What are your options? Two or three short lines.",
      help: "Include \"do nothing for now\" if that is a real option.",
      type: "text",
    },
    {
      id: "outcome",
      text: "What outcome do you want in six months if this goes well?",
      help: "Be specific: more money, more time, less stress, a bigger team?",
      type: "text",
    },
    {
      id: "worst",
      text: "What is the worst that could happen, and could you live with it?",
      help: "Name it. Decisions get easier once the worst case has a shape.",
      type: "text",
      tough: true,
    },
    {
      id: "assumptions",
      text: "What are you assuming has to be true for this to work?",
      why: "Most decisions fail on an assumption nobody checked.",
      help: "For example: that demand stays the same, that a key person stays, that the price holds.",
      type: "text",
    },
    {
      id: "leaning",
      text: "Which option are you leaning towards, and why?",
      help: "Your gut answer is useful. We will test it, not just agree with it.",
      type: "text",
    },
  ],
  calculate: () => ({}),
  role:
    "You are an honest, experienced business advisor and thinking partner who tells owners what you really think, and does not simply agree with them.",
  task: (a) =>
    `The decision: ${or(a.decision, "not given")}. Options: ${or(a.options, "not given")}. Outcome wanted in six months: ${or(a.outcome, "not given")}. Worst case: ${or(a.worst, "not given")}. Assumptions: ${or(a.assumptions, "not given")}. Leaning towards: ${or(a.leaning, "not given")}.\n\n` +
    `First say what is strong about each option. Then say which option best reaches the outcome the owner stated, and why, even if it is not the one they lean towards. Point out what the owner may be underweighting and the assumptions that could be wrong. Say what extra information would change your view. Finish with one next step and a date to review. Do not make the decision for them. Do not give legal or tax advice.`,
  maxWords: 300,
  deeper: (a) =>
    `Act as an honest, practical advisor who tells me what they think and does not just agree with me. My decision: ${or(a.decision, "?")}. My options: ${or(a.options, "?")}. The outcome I want in six months: ${or(a.outcome, "?")}. The worst that could happen: ${or(a.worst, "?")}. What I am assuming: ${or(a.assumptions, "?")}. I am leaning towards: ${or(a.leaning, "?")}.\n` +
    `First tell me what is strong about each option. Then tell me which best reaches my goal and why. Point out what I am probably underweighting and which assumptions could be wrong. Tell me what extra information would change your view. Finish with one next step and a date to review. Be direct and kind. Ask me questions if you need more information.`,
  nextSlug: "blindspots",
};


// ---------------------------------------------------------------------------
// Card 9: A staff or team situation
// ---------------------------------------------------------------------------

const staff: Card = {
  slug: "staff",
  title: "A staff or team situation",
  minutes: 5,
  intro: [
    "Team problems are the ones most owners lose sleep over. In about 5 minutes we will get the facts straight and prepare you for a fair, calm conversation.",
    "One honest note before we start. We help you prepare facts and a conversation. We cannot tell you whether an action is lawful. Before any dismissal, final warning, retrenchment, probation decision, or anything involving illness, pregnancy, union membership, discrimination or someone who has just raised a complaint, get proper advice first. In South Africa the CCMA and the Department of Employment and Labour can point you to help.",
  ],
  questions: [
    {
      id: "situation",
      text: "What is going on, in a few sentences? Use a label like Person A instead of a name.",
      help: "Say what happened, how often, and since when. Facts first, feelings after.",
      type: "text",
    },
    {
      id: "role",
      text: "What is this person's role, and how long have they worked with you?",
      help: "For example \"driver, two years\" or \"part-time helper, three months\".",
      type: "text",
    },
    {
      id: "kind",
      text: "Which is closest to the situation?",
      help: "Pick the one that fits best. If a few apply, pick the biggest one.",
      type: "choice",
      options: ["Work quality or mistakes", "Being late or absent", "Attitude or conflict with others", "Trust or honesty", "I need to cut hours or costs", "Something else"],
    },
    {
      id: "spoken",
      text: "Have you spoken to them about it directly before?",
      why: "Most people cannot fix what nobody has told them clearly.",
      help: "A hint or a joke does not count. A clear, calm conversation does.",
      type: "choice",
      options: ["Yes, clearly, more than once", "Yes, once", "Only hints", "No"],
    },
    {
      id: "written",
      text: "Do you have anything in writing: a contract, job description, written warnings, or notes of past conversations?",
      help: "Even WhatsApp messages or a diary note with a date count as a record.",
      type: "choice",
      options: ["Contract and notes", "Contract only", "Notes only", "Nothing in writing", "Not sure"],
    },
    {
      id: "part",
      text: "What part might you have played in this? For example unclear instructions, no training, a late salary, or a job that grew without the pay growing.",
      help: "This is the question most owners skip. Answering it makes the conversation fairer and usually calmer.",
      type: "text",
      tough: true,
    },
    {
      id: "want",
      text: "What would a good outcome look like for you?",
      help: "For example: they improve and stay, they move to a different role, or we part ways fairly.",
      type: "text",
    },
  ],
  calculate: () => ({}),
  role:
    "You are an experienced, fair-minded small business advisor who helps owners prepare for difficult conversations with staff. You are careful: you prepare facts and conversations, and you never state whether an action is lawful.",
  task: (a) =>
    `The situation: ${or(a.situation, "not given")}. Role and time with the business: ${or(a.role, "not given")}. Kind of issue: ${or(a.kind, "not given")}. Spoken about it before: ${or(a.spoken, "not given")}. In writing: ${or(a.written, "not given")}. The owner's own part: ${or(a.part, "not given")}. Outcome wanted: ${or(a.want, "not given")}.\n\n` +
    `Start with what the owner is doing right, including that they are preparing instead of reacting. Then set out the facts as you understand them, and say honestly what is missing: clear expectations, a direct conversation, a written record, training or support. If the owner has not spoken clearly to the person yet, say so plainly: that conversation comes first. ` +
    `Then give a simple plan for one fair conversation: where and when, how to open it calmly, the two or three facts to state, the question to ask the person, what support or change to offer, what is expected by when, and how to write a short dated note afterwards. Write the opening lines ready to use. ` +
    `Finish with one thing to do this week. Rules: never tell the owner whether a dismissal, warning, retrenchment or probation decision is lawful or recommend one. Say "decide the fair next step, with advice" and tell the owner to get proper advice before any dismissal, final warning, retrenchment, probation decision, or anything involving illness, pregnancy, union membership, discrimination or a recent complaint. Never use wording like "fire fast" or "part ways". Do not give legal advice.`,
  maxWords: 350,
  deeper: (a) =>
    `Act as an experienced, fair-minded advisor who helps small business owners prepare for difficult conversations with staff. Do not just agree with me, and do not tell me whether anything is lawful; tell me to get proper advice where it matters. The situation (I am using Person A instead of a name): ${or(a.situation, "?")}. Their role and time with me: ${or(a.role, "?")}. Kind of issue: ${or(a.kind, "?")}. I have spoken to them about it: ${or(a.spoken, "?")}. What I have in writing: ${or(a.written, "?")}. The part I may have played: ${or(a.part, "?")}. The outcome I want: ${or(a.want, "?")}.\n` +
    `Please help me get the facts straight, tell me honestly what is missing, and help me plan one fair, calm conversation: how to open it, the facts to state, the question to ask, the support to offer, what I expect by when, and how to record it afterwards. Then ask me what happened, one question at a time, and help me decide the fair next step, with advice. Use plain English.`,
  nextSlug: "time",
};

function calcLines(c: Calc, sep = "\n"): string {
  const lines = Object.entries(c).map(([k, v]) => `${k}: ${v}`);
  return lines.length ? lines.join(sep) : "none";
}

export const CARDS: Record<string, Card> = { prices, blindspots, whatsapp, idea, time, customers, repeat, decision, staff };

export function getCard(slug: string): Card | undefined {
  return CARDS[slug];
}
