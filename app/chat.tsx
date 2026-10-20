"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import TopBar from "./topbar";
import { parseNumber, rand, AI_NUMBERS_CAUTION } from "@/lib/numbers";

type Question = { text: string; optional: boolean };
type Msg = { role: "app" | "user"; text: string };
type Answer = { question: string; answer: string };

type Stage =
  | "welcome"
  | "interview"
  | "numbers_confirm"
  | "numbers_fix"
  | "margin_warning"
  | "profile"
  | "profile_confirm"
  | "profile_fixing"
  | "offer"
  | "offer_confirm"
  | "offer_adjusting"
  | "ads"
  | "image"
  | "results"
  | "error";

const THIN_ANSWERS_THRESHOLD = 180; // if all answers together are shorter than this, ask the optional question too

export default function Chat({ questions }: { questions: Question[] }) {
  const [stage, setStage] = useState<Stage>("welcome");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [reasked, setReasked] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [retryStage, setRetryStage] = useState<Stage | null>(null);

  // The finished pieces, kept for the results screen
  const [profile, setProfile] = useState("");
  const [profileClean, setProfileClean] = useState("");
  const [pendingAnswers, setPendingAnswers] = useState<Answer[] | null>(null);
  const [offer, setOffer] = useState("");
  const [ads, setAds] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const required = questions.filter((q) => !q.optional);
  const optional = questions.find((q) => q.optional);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, stage]);

  function addApp(text: string) {
    setMessages((m) => [...m, { role: "app", text }]);
  }
  function addUser(text: string) {
    setMessages((m) => [...m, { role: "user", text }]);
  }

  function start() {
    setStage("interview");
    setMessages([
      {
        role: "app",
        text: "Lekker, let's do this. A few quick questions about your business. Answer in your own words, short is fine.",
      },
      { role: "app", text: required[0].text },
    ]);
    setQIndex(0);
    setReasked(false);
  }

  const [fixWhich, setFixWhich] = useState<"price" | "cost">("price");

  async function afterNumbers(list: Answer[]) {
    const warning = marginWarning(list);
    if (warning) {
      addApp(warning);
      setPendingAnswers(list);
      setStage("margin_warning");
      return;
    }
    addApp("Thanks. Give us a moment to pull that together...");
    await runProfile(list);
  }

  function understoodNumbers(list: Answer[]): string | null {
    const priceA = list.find((a) => /What do you charge/i.test(a.question));
    const costA = list.find((a) => /cost you/i.test(a.question));
    if (!priceA || !costA) return null;
    const price = parseNumber(priceA.answer, "money");
    const cost = parseNumber(costA.answer, "money");
    if (price === null && cost === null) return null;
    return (
      "Here is what we understood: price " +
      (price === null ? "not clear" : rand(price)) +
      ", cost per job " +
      (cost === null ? "not clear" : rand(cost)) +
      ". Is that right? Numbers can be read wrongly, so please check."
    );
  }

  // Price minus the owner's own costs. Warn when little or nothing is left before their time.
  function marginWarning(list: Answer[]): string | null {
    const num = (t: string) => parseNumber(t, "money");
    const sum = num;
    const priceA = list.find((a) => /What do you charge/i.test(a.question));
    const costA = list.find((a) => /cost you/i.test(a.question));
    if (!priceA || !costA) return null;
    const price = num(priceA.answer);
    const cost = sum(costA.answer);
    if (price === null || cost === null || price <= 0) return null;
    const left = price - cost;
    const share = left / price;
    if (left > 0 && share >= 0.5) return null;
    const fmt = rand;
    const line =
      left <= 0
        ? `Before we write ads, one honest check. You charge about ${fmt(price)} and said one job costs you about ${fmt(cost)}. That leaves ${left < 0 ? "a loss of " + fmt(-left) : "nothing"} before your own time. Ads will bring more of these jobs, so the price needs a look first.`
        : `Before we write ads, one honest check. You charge about ${fmt(price)} and said one job costs you about ${fmt(cost)}. That leaves ${fmt(left)} before your own time, which is ${Math.round(share * 100)}% of the price, and your own time still has to come out of that. Ads will bring more of these jobs, so it is worth checking the price first.`;
    return line + " You can carry on with the ads anyway, or review your pricing first. " + AI_NUMBERS_CAUTION;
  }

  function looksLikeNonsense(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (t.length < 3) return true;
    return ["idk", "dunno", "no idea", "nothing", "?", "??", "???", "lol"].includes(t);
  }

  async function callApi(
    stageName: "profile" | "profile_fix" | "offer" | "offer_adjust" | "ads" | "ads_fix" | "image",
    currentAnswers: Answer[],
    extra: { profile?: string; offer?: string; note?: string } = {}
  ): Promise<string | null> {
    const data = await callApiFull(stageName, currentAnswers, extra);
    return data ? data.text : null;
  }

  async function callApiFull(
    stageName: "profile" | "profile_fix" | "offer" | "offer_adjust" | "ads" | "ads_fix" | "image",
    currentAnswers: Answer[],
    extra: { profile?: string; offer?: string; note?: string; ads?: string; problems?: string } = {}
  ): Promise<{ text: string; note?: string; problems?: string; clean?: string } | null> {
    setLoading(true);
    setErrorText("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: stageName, answers: currentAnswers, ...extra }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorText(data.error || "Something went wrong. Tap Try again.");
        return null;
      }
      return data as { text: string; note?: string; problems?: string; clean?: string };
    } catch {
      setErrorText("Couldn't reach the server. Check your connection and tap Try again.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function runProfile(currentAnswers: Answer[]) {
    setStage("profile");
    setRetryStage("profile");
    const data = await callApiFull("profile", currentAnswers);
    if (data) {
      setProfile(data.text);
      setProfileClean(data.clean || data.text);
      addApp(data.text);
      setStage("profile_confirm");
    } else {
      setStage("error");
    }
  }

  async function runOffer() {
    setStage("offer");
    setRetryStage("offer");
    addApp("Great. Now let's sharpen your offer into one sentence...");
    const data = await callApiFull("offer", answers, { profile });
    if (data) {
      setOffer(data.text);
      addApp(data.text);
      if (data.note) addApp(data.note);
      setStage("offer_confirm");
    } else {
      setStage("error");
    }
  }

  async function runAdsAndImage() {
    setStage("ads");
    setRetryStage("ads");
    addApp("Locked in. Writing your three ads now. This takes a few seconds...");
    const first = await callApiFull("ads", answers, { profile, offer });
    if (!first) {
      setStage("error");
      return;
    }
    let adsText = first.text;
    if (first.problems) {
      addApp("Checking the ads against what you told us... fixing a few details so nothing promises more than you do.");
      const fixed = await callApiFull("ads_fix", answers, { profile, offer, ads: first.text, problems: first.problems });
      if (fixed) adsText = fixed.text;
    }
    setAds(adsText);
    addApp(adsText);

    setStage("image");
    setRetryStage("image");
    addApp("Last step: your ready-made image prompt for Meta AI...");
    const imgText = await callApi("image", answers, { profile, offer });
    if (!imgText) {
      setStage("error");
      return;
    }
    setImagePrompt(imgText);
    addApp(imgText);
    addApp("That's everything. Scroll down for your results with copy buttons.");
    setStage("results");
  }

  async function retry() {
    if (retryStage === "profile") await runProfile(answers);
    else if (retryStage === "offer") await runOffer();
    else if (retryStage === "ads" || retryStage === "image") {
      // Re-run from ads onwards; if ads already succeeded, only redo the image.
      if (!ads) await runAdsAndImage();
      else {
        setStage("image");
        const imgText = await callApi("image", answers, { profile, offer });
        if (imgText) {
          setImagePrompt(imgText);
          addApp(imgText);
          addApp("That's everything. Scroll down for your results with copy buttons.");
          setStage("results");
        } else {
          setStage("error");
        }
      }
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    addUser(text);

    if (stage === "interview") {
      const currentQ = qIndex < required.length ? required[qIndex] : optional!;

      if (looksLikeNonsense(text) && !reasked) {
        setReasked(true);
        addApp(
          "No stress, even a rough answer helps. Here is that question again, more simply: " +
            currentQ.text +
            " A few words is fine."
        );
        return;
      }

      const newAnswers = [...answers, { question: currentQ.text, answer: text }];
      setAnswers(newAnswers);
      setReasked(false);

      const nextIndex = qIndex + 1;
      if (nextIndex < required.length) {
        setQIndex(nextIndex);
        addApp(required[nextIndex].text);
        return;
      }

      // Required questions done. Ask the optional one only if answers are thin.
      const totalLength = newAnswers.reduce((n, a) => n + a.answer.length, 0);
      const alreadyAskedOptional = newAnswers.length > required.length;
      if (optional && totalLength < THIN_ANSWERS_THRESHOLD && !alreadyAskedOptional) {
        setQIndex(nextIndex);
        addApp(optional.text);
        return;
      }

      const understood = understoodNumbers(newAnswers);
      if (understood) {
        addApp(understood);
        setPendingAnswers(newAnswers);
        setStage("numbers_confirm");
        return;
      }
      await afterNumbers(newAnswers);
      return;
    }

    if (stage === "numbers_fix" && pendingAnswers) {
      // The owner retyped a number: "price 100" or "cost 60", or just a number for the one we asked.
      const which = fixWhich;
      const updated = pendingAnswers.map((a) =>
        (which === "price" && /What do you charge/i.test(a.question)) ||
        (which === "cost" && /cost you/i.test(a.question))
          ? { ...a, answer: text }
          : a
      );
      setPendingAnswers(updated);
      setAnswers(updated);
      const again = understoodNumbers(updated);
      if (again) addApp(again);
      setStage("numbers_confirm");
      return;
    }

    if (stage === "profile_fixing") {
      setRetryStage("profile");
      const data2 = await callApiFull("profile_fix", answers, { profile, note: text });
      if (data2) {
        setProfile(data2.text);
        setProfileClean(data2.clean || data2.text);
        addApp(data2.text);
        setStage("profile_confirm");
      } else {
        setStage("error");
      }
      return;
    }

    if (stage === "offer_adjusting") {
      setRetryStage("offer");
      const data2 = await callApiFull("offer_adjust", answers, { profile, offer, note: text });
      if (data2) {
        setOffer(data2.text);
        addApp(data2.text);
        if (data2.note) addApp(data2.note);
        setStage("offer_confirm");
      } else {
        setStage("error");
      }
      return;
    }
  }

  function goBack() {
    if (answers.length === 0 || loading) return;
    const prevIndex = answers.length - 1;
    const prevQ = prevIndex < required.length ? required[prevIndex] : optional!;
    if (prevIndex >= required.length) return; // optional question is the last step, nothing to go back from
    setAnswers(answers.slice(0, -1));
    setQIndex(prevIndex);
    setReasked(false);
    addApp("No problem. Here is that question again: " + prevQ.text);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function startOver() {
    setStage("welcome");
    setMessages([]);
    setAnswers([]);
    setQIndex(0);
    setReasked(false);
    setInput("");
    setProfile("");
    setOffer("");
    setAds("");
    setImagePrompt("");
    setErrorText("");
    setRetryStage(null);
  }

  const showInput =
    stage === "interview" || stage === "profile_fixing" || stage === "offer_adjusting" || stage === "numbers_fix";

  return (
    <div className="shell">
      <TopBar />

      {stage === "welcome" ? (
        <main className="welcome">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/image.png" alt="IndabaAI logo" className="welcome-logo" />
          <h1>
            From your business to something you can <em>post today</em>.
          </h1>
          <p>
            Answer a few questions in your own words. IndabaAI turns them into a sharp
            offer, three Meta ad drafts you can edit and post, and an image prompt for
            Meta AI. About 5 minutes.
          </p>
          <button className="btn primary big" onClick={start}>
            Start
          </button>
          <Link href="/" className="btn ghost">
            Back to home
          </Link>
          <p className="fineprint">
            No sign-up. Please do not share ID numbers, bank details or client names.
            We will never ask for them.
          </p>
        </main>
      ) : (
        <main className="chat">
          {stage === "interview" && (
            <div className="progress">
              Question {Math.min(qIndex + 1, required.length)} of {required.length}
            </div>
          )}
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.text}
              </div>
            ))}

            {stage === "interview" && !loading && answers.length > 0 && answers.length < required.length && (
              <div className="chips">
                <button className="chip muted" onClick={goBack}>
                  Change my last answer
                </button>
              </div>
            )}

            {loading && (
              <div className="bubble app typing">
                IndabaAI is typing
                <span className="dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </div>
            )}

            {stage === "error" && !loading && (
              <div className="error-box">
                <p>{errorText || "Something went wrong."}</p>
                <button className="btn primary" onClick={retry}>
                  Try again
                </button>
              </div>
            )}

            {stage === "numbers_confirm" && !loading && (
              <div className="choices">
                <button className="btn primary" onClick={() => afterNumbers(pendingAnswers || answers)}>
                  Looks right
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setFixWhich("price");
                    setStage("numbers_fix");
                    addApp("Type the price for one job or sale, as a plain number.");
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                >
                  Fix the price
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setFixWhich("cost");
                    setStage("numbers_fix");
                    addApp("Type what one job or sale costs you, as a plain number.");
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                >
                  Fix the cost
                </button>
              </div>
            )}

            {stage === "margin_warning" && !loading && (
              <div className="choices">
                <Link href="/tools/prices" className="btn primary">
                  Review my pricing first
                </Link>
                <button
                  className="btn ghost"
                  onClick={async () => {
                    addApp("Thanks. Give us a moment to pull that together...");
                    await runProfile(pendingAnswers || answers);
                  }}
                >
                  Carry on with the ads
                </button>
              </div>
            )}

            {stage === "profile_confirm" && !loading && (
              <div className="choices">
                <button className="btn primary" onClick={runOffer}>
                  Looks right ✓
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setStage("profile_fixing");
                    addApp("No problem. What should we fix?");
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                >
                  Fix something
                </button>
              </div>
            )}

            {stage === "offer_confirm" && !loading && (
              <div className="choices">
                <button className="btn primary" onClick={runAdsAndImage}>
                  Lock it in and write my ads
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setStage("offer_adjusting");
                    addApp("Sure. What would you like to change?");
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                >
                  Adjust something
                </button>
              </div>
            )}

            {stage === "results" && (
              <Results
                profile={profileClean || profile}
                offer={offer}
                ads={ads}
                imagePrompt={imagePrompt}
                onStartOver={startOver}
              />
            )}

            <div ref={bottomRef} />
          </div>

          {showInput && (
            <div className="inputbar">
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                placeholder="Type your answer..."
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={loading}
              />
              <button className="btn primary send" onClick={send} disabled={loading}>
                Send
              </button>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

function Results({
  profile,
  offer,
  ads,
  imagePrompt,
  onStartOver,
}: {
  profile: string;
  offer: string;
  ads: string;
  imagePrompt: string;
  onStartOver: () => void;
}) {
  return (
    <div className="results">
      <h2>Your results</h2>
      <ResultBlock title="Your business profile" text={profile} />
      <ResultBlock title="Your offer" text={offer} />
      {splitAds(ads).map((ad, i) => (
        <ResultBlock key={i} title={ad.title} text={ad.body} />
      ))}
      <ResultBlock title="Your Meta AI image prompt" text={imagePrompt} />
      <div className="choices">
        <button className="btn ghost" onClick={onStartOver}>
          Start over
        </button>
        <Link href="/" className="btn primary">
          Back to home
        </Link>
      </div>
    </div>
  );
}

function splitAds(ads: string): { title: string; body: string }[] {
  const parts = ads.split(/\n(?=AD \d)/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [{ title: "Your three Meta ads", body: ads }];
  return parts.map((p) => {
    const firstLine = p.split("\n")[0].trim();
    const body = p.slice(firstLine.length).trim();
    const label = firstLine.replace(/^AD\s*(\d)\s*[-:]\s*/i, "Ad $1: ");
    return { title: label.charAt(0) + label.slice(1).toLowerCase().replace(/^ad (\d): (\w)/, (m, n, c) => `ad ${n}: ${c.toUpperCase()}`), body };
  });
}

function ResultBlock({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers: fall back to a temporary textarea
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  const waHref = "https://wa.me/?text=" + encodeURIComponent(text);

  return (
    <div className="result-block">
      <div className="result-head">
        <h3>{title}</h3>
        <div className="result-actions">
          <a className="btn small" href={waHref} target="_blank" rel="noopener noreferrer">
            Send to my WhatsApp
          </a>
          <button className="btn small" onClick={copy}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>
      <pre>{text}</pre>
    </div>
  );
}
