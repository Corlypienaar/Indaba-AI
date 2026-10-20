// The home screen menu. One entry per card.
// `featured` cards appear at the top as the three main starting points.
// The lessons card is shown separately as the quiet "New to AI?" route.

export type MenuItem = {
  title: string;
  line: string;
  href: string;
  live: boolean;
  featured?: boolean;
};

export const MENU: MenuItem[] = [
  {
    title: "Help me create ads and social posts",
    line: "A few questions become a clear offer and three ad drafts you can edit and post.",
    href: "/ads",
    live: true,
    featured: true,
  },
  {
    title: "Help me review my pricing and profit",
    line: "See what one job really earns you, and what to try this month.",
    href: "/tools/prices",
    live: true,
    featured: true,
  },
  {
    title: "Help me test my business idea",
    line: "Find out cheaply whether people would pay, before you spend.",
    href: "/tools/idea",
    live: true,
    featured: true,
  },
  {
    title: "Help me spot problems in my business I may be missing",
    line: "Honest questions about the things owners stand too close to see.",
    href: "/tools/blindspots",
    live: true,
  },
  {
    title: "Help me with my WhatsApp for Business",
    line: "A simple setup plan, plus greeting, away and quick-reply messages to copy.",
    href: "/tools/whatsapp",
    live: true,
  },
  {
    title: "Help me find ways to save time",
    line: "Sort your week into keep, stop, batch and hand off.",
    href: "/tools/time",
    live: true,
  },
  {
    title: "Help me identify my best customers",
    line: "Rank your customers by money relative to effort.",
    href: "/tools/customers",
    live: true,
  },
  {
    title: "Help me sell more to existing customers",
    line: "Natural next offers, and a warm message to reconnect.",
    href: "/tools/repeat",
    live: true,
  },
  {
    title: "Help me work through a business decision",
    line: "An honest look at your options, and one next step.",
    href: "/tools/decision",
    live: true,
  },
  {
    title: "Help me prepare for a staff conversation",
    line: "Get the facts straight and plan a fair, calm conversation.",
    href: "/tools/staff",
    live: true,
  },
];

export const LEARN = {
  title: "Help me understand AI",
  line: "New to AI? Seven short lessons. No jargon. You are not behind.",
  href: "/learn",
};
