import { notFound } from "next/navigation";
import { CARDS } from "@/lib/cards";
import Guided from "../guided";

// One page for every guided card. The slug picks the card content.

export function generateStaticParams() {
  return Object.keys(CARDS).map((slug) => ({ slug }));
}

export default function ToolPage({ params }: { params: { slug: string } }) {
  if (!CARDS[params.slug]) notFound();
  return <Guided slug={params.slug} />;
}
