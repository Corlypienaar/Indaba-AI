"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import TopBar from "./topbar";
import { AI_NUMBERS_CAUTION } from "@/lib/numbers";
import type { Question } from "@/lib/content";
import { Ad, Issue, LaunchLine, CheckItem, CONCEPT_LABEL, LIMITS, noUrgency } from "@/lib/adspec";

type Msg = { role: "app" | "user"; text: string };
type Answers = Record<string, string>;

type Stage = "welcome" | "interview" | "contact_detail" | "confirm" | "fixing" | "writing" | "results" | "error";

const VAGUE = /^(very |really |so )?(good|great|nice|lekker|quality|affordable|friendly|cheap|professional|reliable|the best|excellent|fast|clean)( (service|quality|work|prices?|people|staff))?[.!]?$/i;

export default function Chat({ questions }: { questions: Question[] }) {
  const [stage, setStage] = useState<Stage>("welcome");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [qIndex, setQIndex] = useState(0);
  const [reasked, setReasked] = useState(false);
  const [vagueAsked, setVagueAsked] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [helpShown, setHelpShown] = useState(false);
  const [fixKey, setFixKey] = useState<string>("");
  const [contactMethod, setContactMethod] = useState("");

  // The finished pieces
  const [ads, setAds] = useState<Ad[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [launch, setLaunch] = useState<LaunchLine[]>([]);
  const [checklist, setChecklist] = useState<CheckItem[]>([]);
  const [whatsappDigits, setWhatsappDigits] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentQ = questions[qIndex];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, stage]);

  function addApp(text: string) {
    setMessages((m) => [...m, { role: "app", text }]);
  }
  function addUser(text: string) {
    setMessages((m) => [...m, { role: "user", text }]);
  }

  function askQuestion(i: number, intro?: string) {
    const q = questions[i];
    addApp((intro ? intro + " " : "") + q.text);
    setQIndex(i);
    setReasked(false);
    setVagueAsked(false);
    setHelpShown(false);
  }

  function start() {
    setStage("interview");
    setMessages([
      {
        role: "app",
        text: "Lekker, let's do this. Nine quick questions. Answer in your own words, and use real numbers and your customers' own words where you can. Tap \"Show me an example\" under any question if you are not sure.",
      },
    ]);
    askQuestion(0);
  }

  function showHelp() {
    if (!currentQ) return;
    addApp(currentQ.hint ? `For example, ${currentQ.hint}. A rough answer in your own words is fine.` : "A rough answer in your own words is enough.");
    setHelpShown(true);
  }

  function looksLikeNonsense(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (t.length < 2) return true;
    return ["idk", "dunno", "no idea", "?", "??", "???", "lol"].includes(t);
  }

  function goConfirm() {
    addApp("Thanks. Here is what goes into your ads. Check it, fix anything that is off, then we write.");
    setStage("confirm");
  }

  function recordAnswer(key: string, value: string) {
    const a = { ...answers, [key]: value };
    setAnswers(a);
    const nextIndex = qIndex + 1;
    if (nextIndex < questions.length) askQuestion(nextIndex);
    else goConfirm();
  }

  function chooseOption(choice: string) {
    if (loading || !currentQ) return;
    addUser(choice);
    if (currentQ.key === "contact") {
      setContactMethod(choice);
      addApp(
        /whatsapp|call/i.test(choice)
          ? "Give the number, and say how fast you reply. For example: \"072 123 4567, we reply within 10 minutes\"."
          : /visit/i.test(choice)
            ? "Give the address and your hours. For example: \"12 Church Street, Centurion, Mon to Sat 8 to 5\"."
            : /shop/i.test(choice)
              ? "Give the shop link, and say how fast you deliver. For example: \"kasicandles.co.za, delivered in 2 to 3 days\"."
              : "Give the booking link, and say how fast you confirm. For example: \"mysite.co.za/book, confirmed within the hour\"."
      );
      setStage("contact_detail");
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    recordAnswer(currentQ.key, choice);
  }

  function skipQuestion() {
    if (loading || !currentQ) return;
    setInput("");
    addUser("Skip this one");
    recordAnswer(currentQ.key, currentQ.key === "urgency" ? "none" : "");
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setHelpShown(false);
    addUser(text);

    if (stage === "interview" && currentQ) {
      if (looksLikeNonsense(text) && !reasked) {
        setReasked(true);
        addApp("No stress, even a rough answer helps. " + currentQ.text + (currentQ.hint ? ` For example: "${currentQ.hint}".` : "") + (currentQ.required ? "" : " Or tap Skip."));
        return;
      }
      // One follow-up on a vague answer where specifics matter most.
      const wantsSpecific = ["proof", "problem", "myth"].includes(currentQ.key);
      if (wantsSpecific && !vagueAsked && text.length < 45 && VAGUE.test(text)) {
        setVagueAsked(true);
        addApp(
          currentQ.key === "proof"
            ? "Can you give something people can check? A rating and number of reviews, years in business, jobs done, or a customer's exact words."
            : "What exactly do they say? One specific detail beats any adjective."
        );
        return;
      }
      recordAnswer(currentQ.key, text);
      return;
    }

    if (stage === "contact_detail") {
      const a = { ...answers, contact: `${contactMethod}: ${text}` };
      setAnswers(a);
      setStage("interview");
      const nextIndex = qIndex + 1;
      if (nextIndex < questions.length) askQuestion(nextIndex);
      else goConfirm();
      return;
    }

    if (stage === "fixing" && fixKey) {
      const a = { ...answers, [fixKey]: fixKey === "contact" && contactMethod && !/^(whatsapp|call|book online|shop online|visit us)/i.test(text) ? `${contactMethod}: ${text}` : text };
      setAnswers(a);
      setFixKey("");
      addApp("Updated. Anything else to fix?");
      setStage("confirm");
      return;
    }
  }

  function goBack() {
    if (loading || qIndex === 0) return;
    const prev = qIndex - 1;
    const a = { ...answers };
    delete a[questions[prev].key];
    setAnswers(a);
    askQuestion(prev, "No problem. Here is that question again:");
  }

  async function writeAds(isRetry = false) {
    setStage("writing");
    setLoading(true);
    setErrorText("");
    if (!isRetry) addApp("Writing your three ads now, each opening a different way, and checking every line against what you told us. This takes about half a minute...");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "write", answers }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorText(data.error || "Something went wrong. Tap Try again.");
        setStage("error");
        return;
      }
      setAds(data.ads || []);
      setIssues(data.issues || []);
      setLaunch(data.launch || []);
      setChecklist(data.checklist || []);
      setWhatsappDigits(data.whatsappDigits || "");
      addApp("Done. Scroll down for your three ads, the image prompts, how to post them and the checklist. Every field has its own copy button.");
      setStage("results");
    } catch {
      setErrorText("Couldn't reach the server. Check your connection and tap Try again.");
      setStage("error");
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    setStage("welcome");
    setMessages([]);
    setAnswers({});
    setQIndex(0);
    setReasked(false);
    setVagueAsked(false);
    setInput("");
    setAds([]);
    setIssues([]);
    setLaunch([]);
    setChecklist([]);
    setErrorText("");
    setContactMethod("");
  }

  const showInput = (stage === "interview" && currentQ && currentQ.choices.length === 0) || stage === "contact_detail" || stage === "fixing";

  return (
    <div className="shell">
      <TopBar />

      {stage === "welcome" ? (
        <main className="welcome">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/image.png" alt="IndabaAI logo" className="welcome-logo" />
          <h1>
            Let&apos;s build ads that <em>stop the scroll</em>.
          </h1>
          <p>
            The best Facebook and Instagram ads grab attention in 3 seconds and tell people who it&apos;s for, what it
            is, why you, what it costs, how to get it and why now. We&apos;ll write three ads for you, each opening a
            different way: your customer&apos;s problem, your proof, and a surprising fact. Answer 9 quick questions
            using real numbers and your customers&apos; own words. The more specific you are, the better your ads will
            be.
          </p>
          <button className="btn primary big" onClick={start}>
            Start
          </button>
          <Link href="/" className="btn ghost">
            Back to home
          </Link>
          <p className="fineprint">
            No sign-up. Please do not share ID numbers, bank details or client names. We will never ask for them.
          </p>
        </main>
      ) : (
        <main className="chat">
          {(stage === "interview" || stage === "contact_detail") && currentQ && (
            <div className="progress">
              Question {qIndex + 1} of {questions.length}
            </div>
          )}
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.text}
              </div>
            ))}

            {stage === "interview" && !loading && currentQ && (
              <div className="chips">
                {currentQ.choices.map((c) => (
                  <button key={c} className="chip" onClick={() => chooseOption(c)}>
                    {c}
                  </button>
                ))}
                {!helpShown && currentQ.choices.length === 0 && currentQ.hint && (
                  <button className="chip muted" onClick={showHelp}>
                    Show me an example
                  </button>
                )}
                {!currentQ.required && (
                  <button className="chip muted" onClick={skipQuestion}>
                    {currentQ.key === "urgency" ? "No real reason, skip" : "Skip this question"}
                  </button>
                )}
                {qIndex > 0 && (
                  <button className="chip muted" onClick={goBack}>
                    Change my last answer
                  </button>
                )}
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
                <button className="btn primary" onClick={() => writeAds(true)}>
                  Try again
                </button>
              </div>
            )}

            {(stage === "confirm" || stage === "fixing") && !loading && (
              <ConfirmCard
                questions={questions}
                answers={answers}
                fixing={stage === "fixing" ? fixKey : ""}
                onFix={(key) => {
                  setFixKey(key);
                  setStage("fixing");
                  const q = questions.find((x) => x.key === key);
                  addApp(`Type the new answer for: ${q ? q.text : key}`);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                onYes={() => writeAds()}
              />
            )}

            {stage === "results" && ads.length > 0 && (
              <Results
                ads={ads}
                issues={issues}
                launch={launch}
                checklist={checklist}
                whatsappDigits={whatsappDigits}
                onRetry={() => writeAds(true)}
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
                placeholder={currentQ && stage === "interview" && currentQ.hint ? `e.g. ${currentQ.hint.replace(/^Service: /, "").split(" · ")[0]}` : "Type your answer..."}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={loading}
              />
              <button className="btn primary send" onClick={() => send()} disabled={loading}>
                Send
              </button>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

// ---------- Confirm card ----------

const CONFIRM_LABELS: Record<string, string> = {
  business: "Business and what you are advertising",
  customers: "Customers and area",
  problem: "Their problem, in their words",
  proof: "Proof people can check",
  myth: "What you wish customers knew",
  offer: "Price or offer",
  objection: "Worry that stops people",
  contact: "How to contact or buy",
  urgency: "Reason to act now",
};

function tidyForCard(key: string, value: string): string {
  let v = (value || "").trim();
  if (!v) return "";
  v = v.replace(/whats\s?app/gi, "WhatsApp").replace(/\bR\s+(\d)/g, "R$1").replace(/\br(\d{2,})\b/g, "R$1");
  if (key === "urgency" && noUrgency(v)) return "None, and that is fine. We will not invent one.";
  return v;
}

function ConfirmCard({
  questions,
  answers,
  fixing,
  onFix,
  onYes,
}: {
  questions: Question[];
  answers: Answers;
  fixing: string;
  onFix: (key: string) => void;
  onYes: () => void;
}) {
  const missing = questions.filter((q) => q.required && !(answers[q.key] || "").trim());
  return (
    <div className="result-block confirm">
      <div className="result-head">
        <h3>What goes into your ads</h3>
      </div>
      <div className="confirm-rows">
        {questions.map((q) => {
          const value = tidyForCard(q.key, answers[q.key] || "");
          return (
            <div key={q.key} className={`confirm-row${fixing === q.key ? " fixing" : ""}`}>
              <div>
                <b>{CONFIRM_LABELS[q.key] || q.key}</b>
                <span className={value ? "" : "empty"}>{value || "Skipped"}</span>
              </div>
              <button className="btn small" onClick={() => onFix(q.key)} disabled={!!fixing}>
                {value ? "Fix" : "Add"}
              </button>
            </div>
          );
        })}
      </div>
      {missing.length > 0 && <p className="confirm-note">We still need: {missing.map((q) => CONFIRM_LABELS[q.key]).join(", ")}. Tap Add.</p>}
      <div className="choices">
        <button className="btn primary" onClick={onYes} disabled={!!fixing || missing.length > 0}>
          Yes, write my ads
        </button>
      </div>
    </div>
  );
}

// ---------- Results ----------

function Results({
  ads,
  issues,
  launch,
  checklist,
  whatsappDigits,
  onRetry,
  onStartOver,
}: {
  ads: Ad[];
  issues: Issue[];
  launch: LaunchLine[];
  checklist: CheckItem[];
  whatsappDigits: string;
  onRetry: () => void;
  onStartOver: () => void;
}) {
  return (
    <div className="results">
      <h2>Your three ads</h2>
      <p className="results-intro">
        Three ads, three different openings, the same offer and button in each. That is how Meta finds out which opening
        your customers respond to. Copy each field into Ads Manager. The counters show Meta&apos;s limits.
      </p>
      {ads.map((ad) => (
        <AdCard key={ad.id} ad={ad} issues={issues.filter((i) => i.adId === ad.id)} whatsappDigits={whatsappDigits} />
      ))}

      {launch.length > 0 && (
        <div className="result-block">
          <div className="result-head">
            <h3>How to post them</h3>
          </div>
          <div className="launch">
            {launch.map((l) => (
              <div key={l.title}>
                <b>{l.title}</b>
                <p>{l.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {checklist.length > 0 && (
        <div className="result-block">
          <div className="result-head">
            <h3>Before you launch: the best-practice checklist</h3>
          </div>
          <ul className="checklist">
            {checklist.map((c) => (
              <li key={c.label} className={c.ok ? "ok" : "todo"}>
                <span>{c.ok ? "✓" : "☐"}</span>
                <div>
                  <b>{c.label}</b>
                  {!c.ok && c.fix && <small>{c.fix}</small>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="fineprint">{AI_NUMBERS_CAUTION} Read every ad against your own facts before you post it.</p>

      <div className="choices">
        <button className="btn ghost" onClick={onRetry}>
          Write them again
        </button>
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

function adAsText(ad: Ad): string {
  return [
    `Ad ${ad.id}: ${CONCEPT_LABEL[ad.concept]}`,
    `Primary text: ${ad.primary}`,
    `Reels primary text: ${ad.reels}`,
    `Headline: ${ad.headline}`,
    `Description: ${ad.description}`,
    `CTA button: ${ad.cta}`,
    `On-screen text: ${ad.onScreen}`,
    `Offer badge: ${ad.badge}`,
    "",
    `Image prompt: ${ad.imagePrompt}`,
    "",
    ad.addAfterwards,
    ad.cropAndCheck,
  ].join("\n");
}

function AdCard({ ad, issues, whatsappDigits }: { ad: Ad; issues: Issue[]; whatsappDigits: string }) {
  const shareHref = "https://wa.me/?text=" + encodeURIComponent(adAsText(ad));
  const opening =
    ad.concept === "problem"
      ? "Opens with your customer's problem, then the fix."
      : ad.concept === "proof"
        ? "Opens with your proof or result, then how."
        : "Opens with a surprising fact or common mistake, then pays it off.";
  return (
    <div className="result-block ad-card">
      <div className="result-head">
        <h3>
          Ad {ad.id}: {CONCEPT_LABEL[ad.concept]}
        </h3>
        <div className="result-actions">
          <a className="btn small" href={shareHref} target="_blank" rel="noopener noreferrer" title="Choose yourself to save it">
            Share on WhatsApp
          </a>
        </div>
      </div>
      <p className="ad-meta">{opening}</p>
      {issues.length > 0 && (
        <div className="ad-check">
          <b>Worth a look before you post:</b>
          {issues.map((i, n) => (
            <div key={n}>
              {i.field}: {i.reason}.
            </div>
          ))}
        </div>
      )}
      <Field label="Primary text" value={ad.primary} limit={LIMITS.primaryMax} keyLimit={LIMITS.primaryKey} />
      <Field label="Reels primary text" value={ad.reels} limit={LIMITS.reels} />
      <Field label="Headline" value={ad.headline} limit={LIMITS.headline} />
      <Field label="Description" value={ad.description} limit={LIMITS.description} />
      <Field label="CTA button" value={ad.cta} noCopy />
      <Field label="On-screen text" value={ad.onScreen} wordLimit={LIMITS.onScreenMax} />
      <Field label="Offer badge" value={ad.badge} />

      <div className="creative">
        <b>Your picture</b>
        <Field label="Image prompt (copy and paste into Meta AI, ChatGPT, Gemini or Canva)" value={ad.imagePrompt} />
        {ad.addAfterwards && <p className="ad-meta">{ad.addAfterwards}</p>}
        {ad.cropAndCheck && <p className="ad-meta">{ad.cropAndCheck}</p>}
      </div>

      {ad.whatsappGreeting && (
        <div className="creative">
          <b>When they message you</b>
          <Field label="Your first WhatsApp reply (save it as a quick reply)" value={ad.whatsappGreeting} />
          {whatsappDigits && <p className="ad-meta">The ad&apos;s button opens a chat with +{whatsappDigits}.</p>}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  limit,
  keyLimit,
  wordLimit,
  noCopy,
}: {
  label: string;
  value: string;
  limit?: number;
  keyLimit?: number;
  wordLimit?: number;
  noCopy?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const over = (limit !== undefined && value.length > limit) || (wordLimit !== undefined && words > wordLimit);
  const overKey = keyLimit !== undefined && value.length > keyLimit;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!value) return null;
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">
          {label}{" "}
          {limit !== undefined && (
            <span className={`counter${over ? " over" : ""}`}>
              {value.length}/{limit}
              {overKey ? " (first 125 shown on mobile)" : ""}
            </span>
          )}
          {wordLimit !== undefined && (
            <span className={`counter${over ? " over" : ""}`}>
              {words}/{wordLimit} words
            </span>
          )}
        </span>
        {!noCopy && (
          <button className="btn small" onClick={copy}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        )}
      </div>
      <pre>{value}</pre>
    </div>
  );
}
