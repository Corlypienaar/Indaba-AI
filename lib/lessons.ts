// "New to AI? Start here": seven fixed lessons. No AI calls.

export type Lesson = {
  title: string;
  text: string[];
  check: string;
  options: string[];
  correct: number | null; // index, or null when any answer is fine
  answer: string;
  encouragement: string;
  prompt: (biz: string) => string;
};

export const LESSONS: Lesson[] = [
  {
    title: "Lesson 1: What is AI?",
    text: [
      "AI is a computer program that has learned from millions of examples. It can read, write, answer questions and spot patterns.",
      "Think about how you learned your own business. Nobody handed you a rulebook for every situation. You saw many customers, many jobs and many mistakes, and you got better each time. AI learns in a similar way, from far more examples than a person could see in a lifetime.",
      "It knows nothing about your business until you tell it. That is why the way you ask matters, and we will get to that.",
    ],
    check: "Quick check: which of these is AI?",
    options: ["A calculator", "Google Maps showing where the traffic is", "A printed price list"],
    correct: 1,
    answer: "Google Maps. It learns from a huge amount of driving data to guess the quickest route.",
    encouragement: "Good start. Every expert once asked this same question.",
    prompt: (b) =>
      `I run a ${b} and I am new to AI. Please be my patient teacher. Explain what AI is in very simple English, using everyday examples and examples from my kind of business. Explain one idea at a time and ask me a short question after each one to check I understood before moving on. Start by asking what I already use that might have AI in it.`,
  },
  {
    title: "Lesson 2: You already use AI",
    text: [
      "Your bank app can block a card payment that looks strange. Your phone unlocks with your face. WhatsApp can turn a voice note into text. Facebook, Instagram and YouTube choose what to show you next. Online shops suggest what you might like.",
      "AI is already in your pocket. The new part is that you can now talk to it and ask it to help with your own work.",
    ],
    check: "Quick check: which of these do you already use?",
    options: ["Face unlock", "Voice note to text", "Maps with traffic", "Shop suggestions", "Bank fraud alerts", "Social media feed", "None of these"],
    correct: null,
    answer: "Any of those has AI inside. If you picked none, that is fine. The next lessons start from the beginning.",
    encouragement: "You are further along than you think.",
    prompt: (b) =>
      `I run a ${b}. Help me find where AI is already part of my day. Ask me what apps and tools I use for banking, shopping, social media and WhatsApp, then explain which ones use AI and what it does for me. Keep it simple, one app at a time. Then suggest two ways AI could save me time in my business, with one simple example each.`,
  },
  {
    title: "Lesson 3: What AI does well, and where it slips",
    text: [
      "AI is great at first drafts, simple explanations, ideas, summaries, translations and plans.",
      "It can also be wrong while sounding completely sure. It is guessing what sounds right, and sometimes the guess is off. This is called \"hallucinating\".",
      "It can also be unfair. It learns from the internet, which has more about some places than others, so it may know New York better than your town.",
      "Here is the rule that keeps you safe: AI writes the first draft, and you own the final version. Always check prices, tax numbers, laws, contracts and anything about money, health or grants.",
    ],
    check: "Quick check: AI tells you the VAT limit for your business. What should you do?",
    options: ["Trust it", "Check it on your tax authority's website", "Ask the AI again"],
    correct: 1,
    answer: "Check it on your tax authority's website (SARS in South Africa). Asking the AI again can give you a different wrong answer.",
    encouragement: "Checking is a skill. You are already building it.",
    prompt: (b) =>
      `I run a ${b}. Explain in simple English what AI does well and where it gets things wrong, including "hallucinating" and bias. Give me three examples from a business like mine. Then give me a short checklist I can use before I trust anything AI tells me about prices, tax, laws or contracts. Ask me a question after each part to check I understood.`,
  },
  {
    title: "Lesson 4: How to ask AI well",
    text: [
      "Brief AI like a new assistant. Give it four things:\n1. Who you are. \"I run a hair salon in Pretoria.\"\n2. What you need. \"A price list to send on WhatsApp.\"\n3. The details. \"Six services, friendly tone, short.\"\n4. How you want it. \"A list I can copy and paste.\"",
      "A weak ask: \"Write a price list.\"\nA strong ask: \"I run a hair salon in Pretoria. Write a short, friendly price list for six services that I can send on WhatsApp.\"",
      "If you do not like the answer, tell it. Say \"Make it shorter\", \"Make it warmer\" or \"Write it in Afrikaans\". It will never be offended.",
    ],
    check: "Quick check: which is the better ask?",
    options: ["Write an ad", "Write a Facebook ad for my plumbing business in Durban, offering a free quote, friendly tone, under 50 words."],
    correct: 1,
    answer: "The second one. More detail gives you a result you can use.",
    encouragement: "This one skill will save you hours.",
    prompt: (b) =>
      `I run a ${b}. Teach me how to write good instructions for AI. Show me a weak instruction and a strong one for something my business does, and explain what makes the strong one better. Then give me one real task from my business, let me write the instruction, and tell me how to improve it. Do this one step at a time and use simple English.`,
  },
  {
    title: "Lesson 5: Pictures and other things AI can make",
    text: [
      "AI can write, draw, summarise and plan. Many tools, including Meta AI on WhatsApp, can make a picture from a description. Some can also read a document and summarise it, or listen to a voice note.",
      "For a good picture, describe what you want to see, where it is, the mood and the style. Then tell it what to change: \"Make it brighter\" or \"Remove the people\".",
      "Keep real photos of customers, children and ID documents out of any AI tool. If you use an AI picture in an ad, check that it shows your product or service truthfully.",
      "The ads card in this app already writes a picture description for you.",
    ],
    check: "Quick check: you want a picture for a Heritage Day special. Which description is best?",
    options: ["A picture", "A bright, friendly picture of a braai table with roast meat and salads, warm light, no people."],
    correct: 1,
    answer: "The second one. It tells the AI what, where, mood and what to leave out.",
    encouragement: "Things that needed a designer last year can start with one sentence today.",
    prompt: (b) =>
      `I run a ${b}. Teach me how to describe a picture so that AI makes what I have in mind. Ask me what the picture is for, then help me write three versions of a description: simple, detailed and creative. Explain what each part of the description does. Remind me to keep photos of customers, children and ID documents out of any AI tool. Then help me improve the picture by asking me what to change.`,
  },
  {
    title: "Lesson 6: Stay safe from AI scams",
    text: [
      "Criminals use AI too. It helps them write messages without spelling mistakes, copy a voice from a short recording, make fake videos of well-known people and build fake websites and apps that look real.",
      "What that can look like for a business owner:\n- A \"supplier\" says their banking details have changed and asks you to pay a new account.\n- A voice that sounds like your boss, partner or family member asks for an urgent payment.\n- A message that looks like it is from your bank, your tax authority or a courier asks you to click a link or share a code.\n- A video of a famous person promises big returns on an \"investment\".",
      "Four habits keep you safe:\n1. Stop. Urgency and fear are the warning signs.\n2. Call back on a number you already have. Skip the number in the message.\n3. Keep your PIN, password and one-time PIN (OTP) to yourself. Your bank will never ask for them.\n4. Check with a second person before you pay a new account or a large amount.",
      "If a deal sounds too good to be true, it is.",
    ],
    check: "Quick check: a voice note from your \"boss\" asks for an urgent payment to a new account. What do you do first?",
    options: ["Pay quickly", "Call them back on the number you already have", "Reply to the voice note"],
    correct: 1,
    answer: "Call back on the number you already have.",
    encouragement: "Slowing down for ten seconds is the best protection there is.",
    prompt: (b) =>
      `I run a ${b}. Teach me how to spot AI scams aimed at small businesses: fake supplier banking-detail changes, cloned voices, fake bank or tax authority messages and fake investment videos. Use short, simple examples. Then give me ten quick yes or no situations to test me, and tell me what to do in each one. Do not give legal advice. Where I need an expert, tell me to call my bank or the right authority.`,
  },
  {
    title: "Lesson 7: Protect your information and your customers'",
    text: [
      "Fine to type into an AI tool: general questions, your town, your type of business, and a draft you want to improve with the names taken out.",
      "Keep out of any AI tool: ID numbers, bank details, PINs, passwords, photos of ID documents and other people's private chats.",
      "Try the \"Client A\" trick. Swap real names for labels before you paste anything. \"Mrs Dlamini in Soweto owes R4,500\" becomes \"Client A owes R4,500\". You get the same help, and the real name stays with you.",
      "This also protects your customers' personal information under privacy rules (POPIA in South Africa).",
      "Be careful with free apps that ask for lots of permissions or push you to act fast. Often your information is the price.",
    ],
    check: "Quick check: which can you safely type into an AI tool?",
    options: ["A customer's ID number", "\"Client A, a retail customer in Durban\"", "Your bank PIN"],
    correct: 1,
    answer: "\"Client A, a retail customer in Durban\".",
    encouragement: "You now protect your customers better than many big companies do.",
    prompt: (b) =>
      `I run a ${b}. Teach me how to use AI without exposing my customers' personal information. Explain the "Client A" trick with three examples from my kind of business. Then give me five pretend messages with real-looking names and details, and ask me to rewrite each one safely. Tell me how I did. Do not give legal advice.`,
  },
];

export function finishPrompt(biz: string, start: string, done: number[], missed: string[], task: string): string {
  return `I run a ${biz}. I just finished a short course on AI basics in an app. I started as: ${start}. I covered: ${done.length ? done.map((i) => LESSONS[i].title).join("; ") : "none yet"}. The quick checks I got wrong were about: ${missed.length ? missed.join("; ") : "none"}. The first thing I want to try in my business is: ${task || "not decided yet"}. Please be my patient teacher and helper. First, check my understanding of the lessons I got wrong. Then help me do the first task step by step, one idea at a time, in simple English.`;
}

// Suggest a card for the owner's first-win task.
export function suggestCard(task: string): { href: string; title: string } {
  const t = task.toLowerCase();
  if (/whatsapp|reply|message|enquir|inquir|chat/.test(t)) return { href: "/tools/whatsapp", title: "Help me with my WhatsApp for Business" };
  if (/price|profit|quote|cost|money|margin|invoice|payment/.test(t)) return { href: "/tools/prices", title: "Help me review my pricing and profit" };
  if (/post|ad|social|facebook|instagram|marketing|promot/.test(t)) return { href: "/ads", title: "Help me create ads and social posts" };
  return { href: "/tools/blindspots", title: "Help me spot problems in my business I may be missing" };
}
