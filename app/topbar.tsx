import Link from "next/link";

// Shared header. The brand links back to the home menu.

export default function TopBar() {
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="IndabaAI home">
        <span className="brand-mark">Indaba</span>
        <span className="brand-ai">AI</span>
      </Link>
      <div className="tagline">Powered by Meta Llama 4</div>
    </header>
  );
}
