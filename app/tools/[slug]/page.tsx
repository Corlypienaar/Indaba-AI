import { notFound } from "next/navigation";
import { CARDS } from "@/lib/cards";
import Guided from "../guided";

// One page for every guided card. The slug picks the card content.

export function generateMetadata({ params }: { params: { slug: string } }) {
  const card = CARDS[params.slug];
  if (!card) return {};
  return { title: card.title, description: card.intro[0] };
}

export function generateStaticParams() {
  return Object.keys(CARDS).map((slug) => ({ slug }));
}

export default function ToolPage({ params }: { params: { slug: string } }) {
  if (!CARDS[params.slug]) notFound();
  return <Guided slug={params.slug} />;
}
