import Link from "next/link";
import { MENU } from "@/lib/menu";
import TopBar from "./topbar";

// The home screen: a menu of guided tools.
// Every card opens a chat where IndabaAI asks a few questions, builds a
// best-practice prompt behind the scenes, and brings back expert advice.

export default function Home() {
  return (
    <div className="shell home-shell">
      <TopBar />
      <main className="home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/image.png" alt="IndabaAI logo" className="home-logo" />
        <h1>
          Grow your business with <em>AI on your side</em>.
        </h1>
        <p className="home-sub">
          Own a business, or want to start one? Things that felt out of reach,
          like a pricing review, a growth plan or ads that work, are now within
          your reach. Pick where you want to start and we will take it from there.
        </p>

        <div className="menu">
          {MENU.map((item) =>
            item.live ? (
              <Link
                key={item.href}
                href={item.href}
                className={`card${item.featured ? " featured" : ""}`}
              >
                <b>{item.title}</b>
                <small>{item.line}</small>
              </Link>
            ) : (
              <div key={item.href} className="card soon" aria-disabled="true">
                <b>{item.title}</b>
                <small>{item.line}</small>
                <span className="soon-tag">Coming soon. We are building this one next.</span>
              </div>
            )
          )}
        </div>

        <p className="fineprint">
          No sign-up. Please do not share ID numbers, bank details or client names.
          We will never ask for them.
        </p>
      </main>
    </div>
  );
}
