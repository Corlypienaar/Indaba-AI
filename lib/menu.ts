// The home screen menu. One entry per card.
// Cards with `live: false` show as "Coming soon" and cannot be tapped.

export type MenuItem = {
  title: string;
  line: string;
  href: string;
  live: boolean;
  featured?: boolean;
};

export const MENU: MenuItem[] = [
  {
    title: "New to AI? Start here",
    line: "Seven short lessons. No jargon. You are not behind.",
    href: "/learn",
    live: true,
    featured: true,
  },
  {
    title: "Write my ads and posts",
    line: "Turn your offer into ads you can post today.",
    href: "/ads",
    live: true,
  },
  {
    title: "Are my prices and profit right?",
    line: "See where your money really comes from.",
    href: "/tools/prices",
    live: true,
  },
  {
    title: "What might I not be seeing?",
    line: "Some of the best answers sit in the questions we skip.",
    href: "/tools/blindspots",
    live: true,
  },
  {
    title: "Help me with WhatsApp",
    line: "Set up the place your customers already are.",
    href: "/tools/whatsapp",
    live: true,
  },
  {
    title: "Stress test my business idea",
    line: "Test an idea, or a business you have not started yet.",
    href: "/tools/idea",
    live: true,
  },
  {
    title: "Where is my time going?",
    line: "Find the hours you can win back.",
    href: "/tools/time",
    live: true,
  },
  {
    title: "Who are my best customers?",
    line: "See who is worth the most for the least effort.",
    href: "/tools/customers",
    live: true,
  },
  {
    title: "Get more from the customers I already have",
    line: "Your best growth may already be on your list.",
    href: "/tools/repeat",
    live: true,
  },
  {
    title: "Help me think through a decision",
    line: "Talk it through with an honest partner.",
    href: "/tools/decision",
    live: true,
  },
  {
    title: "A staff or team situation",
    line: "Prepare for the conversation.",
    href: "/tools/staff",
    live: true,
  },
];
