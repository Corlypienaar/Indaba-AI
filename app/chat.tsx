"use client";

import { useEffect, useRef, useState } from "react";

type Question = { text: string; optional: boolean };
type Msg = { role: "app" | "user"; text: string };
type Answer = { question: string; answer: string };

type Stage =
  | "welcome"
  | "interview"
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
        text: "Lekker, let's do this. A few quick questions about your business — answer in your own words, short is fine.",
      },
      { role: "app", text: required[0].text },
    ]);
    setQIndex(0);
    setReasked(false);
  }

  function looksLikeNonsense(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (t.length < 3) return true;
    return ["idk", "dunno", "no idea", "nothing", "?", "??", "???", "lol"].includes(t);
  }

  async function callApi(
    stageName: "profile" | "profile_fix" | "offer" | "offer_adjust" | "ads" | "image",
    currentAnswers: Answer[],
    extra: { profile?: string; offer?: string; note?: string } = {}
  ): Promise<string | null> {
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
      return data.text as string;
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
    const text = await callApi("profile", currentAnswers);
    if (text) {
      setProfile(text);
      addApp(text);
      setStage("profile_confirm");
    } else {
      setStage("error");
    }
  }

  async function runOffer() {
    setStage("offer");
    setRetryStage("offer");
    addApp("Great. Now let's sharpen your offer into one sentence...");
    const text = await callApi("offer", answers, { profile });
    if (text) {
      setOffer(text);
      addApp(text);
      setStage("offer_confirm");
    } else {
      setStage("error");
    }
  }

  async function runAdsAndImage() {
    setStage("ads");
    setRetryStage("ads");
    addApp("Locked in. Writing your three ads now — this takes a few seconds...");
    const adsText = await callApi("ads", answers, { profile, offer });
    if (!adsText) {
      setStage("error");
      return;
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
    addApp("That's everything — scroll down for your results with copy buttons.");
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
          addApp("That's everything — scroll down for your results with copy buttons.");
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
          "No stress — even a rough answer helps. Let me ask that again more simply: " +
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

      addApp("Thanks — give me a moment to pull that together...");
      await runProfile(newAnswers);
      return;
    }

    if (stage === "profile_fixing") {
      setRetryStage("profile");
      const text2 = await callApi("profile_fix", answers, { profile, note: text });
      if (text2) {
        setProfile(text2);
        addApp(text2);
        setStage("profile_confirm");
      } else {
        setStage("error");
      }
      return;
    }

    if (stage === "offer_adjusting") {
      setRetryStage("offer");
      const text2 = await callApi("offer_adjust", answers, { profile, offer, note: text });
      if (text2) {
        setOffer(text2);
        addApp(text2);
        setStage("offer_confirm");
      } else {
        setStage("error");
      }
      return;
    }
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
    stage === "interview" || stage === "profile_fixing" || stage === "offer_adjusting";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Indaba</span>
          <span className="brand-ai">AI</span>
        </div>
        <div className="tagline">Powered by Meta Llama</div>
      </header>

      {stage === "welcome" ? (
        <main className="welcome">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/image.png" alt="IndabaAI logo" className="welcome-logo" />
          <h1>
            From your business to something you can <em>post today</em>.
          </h1>
          <p>
            Answer a few questions in plain English. IndabaAI turns them into a sharp
            offer, three ready-to-post Meta ads, and an image prompt for Meta AI —
            built for South African small businesses.
          </p>
          <button className="btn primary big" onClick={start}>
            Start
          </button>
          <p className="fineprint">
            No sign-up. Please don&apos;t share ID numbers, bank details or client names
            — we&apos;ll never ask for them.
          </p>
        </main>
      ) : (
        <main className="chat">
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.text}
              </div>
            ))}

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

            {stage === "profile_confirm" && !loading && (
              <div className="choices">
                <button className="btn primary" onClick={runOffer}>
                  Looks right ✓
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setStage("profile_fixing");
                    addApp("No problem — what should I fix?");
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
                  Lock it in — write my ads
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setStage("offer_adjusting");
                    addApp("Sure — what would you like to change?");
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                >
                  Adjust something
                </button>
              </div>
            )}

            {stage === "results" && (
              <Results
                profile={profile}
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
      <ResultBlock title="Your three Meta ads" text={ads} />
      <ResultBlock title="Your Meta AI image prompt" text={imagePrompt} />
      <button className="btn ghost" onClick={onStartOver}>
        Start over
      </button>
    </div>
  );
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

  return (
    <div className="result-block">
      <div className="result-head">
        <h3>{title}</h3>
        <button className="btn small" onClick={copy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre>{text}</pre>
    </div>
  );
}
