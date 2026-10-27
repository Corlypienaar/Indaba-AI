import Link from "next/link";
import Image from "next/image";

// Shared header. The brand links back to the home menu, and a small gold
// wave underlines the bar on every screen.

export default function TopBar() {
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="IndabaAI home">
          <Image src="/logo.png" alt="IndabaAI" width={74} height={43} priority />
        </Link>
        <div className="tagline">Powered by Meta Llama</div>
      </header>
      <svg
        className="wave"
        preserveAspectRatio="none"
        viewBox="0 0 400 14"
        aria-hidden="true"
      >
        <path
          d="M0 7 Q 25 0 50 7 T 100 7 T 150 7 T 200 7 T 250 7 T 300 7 T 350 7 T 400 7 V14 H0 Z"
          fill="currentColor"
        />
      </svg>
    </>
  );
}
