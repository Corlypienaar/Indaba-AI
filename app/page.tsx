import Link from "next/link";
import { MENU, LEARN } from "@/lib/menu";
import TopBar from "./topbar";

// The home screen. One primary action, three featured tools, the rest under
// "More tools", and the lessons as a quiet route for people new to AI.
// Every tool asks a few questions, builds a best-practice prompt behind the
// scenes, and brings back honest, expert advice the owner can act on.

const featured = MENU.filter((m) => m.featured && m.live);
const more = MENU.filter((m) => !m.featured && m.live);

export default function Home() {
  return (
    <div className="shell home-shell">
      <TopBar />
      <main className="home">
        <section className="hero">
          <h1>
            Practical AI help for <em>South African small businesses</em>.
          </h1>
          <p className="home-sub">
            Answer a few simple questions and we will write your Facebook and Instagram
            ads, check whether your prices make you money, or help you test a business
            idea, one step at a time. Free, no sign-up, and honest when something looks
            weak.
          </p>
          <Link href="/ads" className="btn primary big">
            Write my first ad
          </Link>
          <Link href={LEARN.href} className="quiet-link">
            {LEARN.line}
          </Link>
        </section>

        <section className="example" aria-label="Example result">
          <div className="example-label">Example: what you get in about 5 minutes</div>
          <div className="example-in">
            <b>You tell us:</b> &ldquo;I bake custom birthday cakes in Centurion for parents. People
            say they are moist and beautiful. R450 for a 20cm cake. WhatsApp orders, five days
            notice, collection only.&rdquo;
          </div>
          <div className="example-out">
            <div>
              <b>Your offer</b>
              <p>Custom birthday cakes from R450, ordered five days ahead and collected in Centurion. WhatsApp us to book your date.</p>
            </div>
            <div>
              <b>Ad 1 of 3</b>
              <p>
                <span className="ex-head">A cake they will remember, without the stress.</span>
                Parents in Centurion: tell us the theme and the date, give us five days, and collect a
                moist, beautiful cake that the kids talk about. From R450 for a 20cm cake. WhatsApp us to book.
              </p>
            </div>
          </div>
          <div className="example-note">Every result is a draft for you to check and edit before you use it.</div>
        </section>

        <h2>What do you need help with today?</h2>
        <div className="menu featured-menu">
          {featured.map((item) => (
            <Link key={item.href} href={item.href} className="card featured">
              <b>{item.title}</b>
              <small>{item.line}</small>
              <span className="arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>

        <h2>More ways we can help</h2>
        <div className="menu more-menu">
          {more.map((item) => (
            <Link key={item.href} href={item.href} className="card">
              <b>{item.title}</b>
              <small>{item.line}</small>
              <span className="arrow" aria-hidden="true">→</span>
            </Link>
          ))}
          <Link href={LEARN.href} className="card learn">
            <b>{LEARN.title}</b>
            <small>{LEARN.line}</small>
            <span className="arrow" aria-hidden="true">→</span>
          </Link>
        </div>

        <footer className="home-footer">
          <p className="credit">
            IndabaAI is built by Let&apos;s Learn AI.{" "}
            <a href="https://letslearnai.co.za" target="_blank" rel="noopener noreferrer">
              letslearnai.co.za
            </a>
          </p>
          <p>
            <b>Your information.</b> No sign-up. Your answers are sent to the AI model (Meta Llama,
            through OpenRouter) only to write your result, and we do not store them. Please do not
            share ID numbers, bank details or client names. We will never ask for them, and you can
            use labels like Client A instead.
          </p>
          <p className="fineprint">Powered by Meta Llama. Not affiliated with or endorsed by Meta.</p>
        </footer>
      </main>
    </div>
  );
}
