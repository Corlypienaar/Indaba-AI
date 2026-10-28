"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import TopBar from "./topbar";
import { parseNumber, rand, AI_NUMBERS_CAUTION } from "@/lib/numbers";
import type { Question } from "@/lib/content";
import { Ad, Creative, Issue, LaunchLine, CheckItem, CONCEPT_LABEL, LIMITS, noUrgency } from "@/lib/adspec";

type Msg = { role: "app" | "user"; text: string };
type Answers = Record<string, string>;

type Stage =
  | "welcome"
  | "interview"
  | "urgency_detail"
  | "margin_warning"
  | "confirm"
  | "fixing"
  | "writing"
  | "results"
  | "error";

const STEPS = ["Your business", "Your customer", "Why you", "Getting the sale"];
const VAGUE = /^(very |really |so )?(good|great|nice|lekker|quality|affordable|friendly|cheap|professional|reliable|the best|excellent|fast|clean)( (service|quality|work|prices?|people|staff))?[.!]?$/i;
const SKIP = "Skip";

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
  const [retryWhat, setRetryWhat] = useState<"write" | "creative" | null>(null);

  // The finished pieces
  const [ads, setAds] = useState<Ad[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [launch, setLaunch] = useState<LaunchLine[]>([]);
  const [checklist, setChecklist] = useState<CheckItem[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [creativeLoading, setCreativeLoading] = useState(false);
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
    const prevStep = i > 0 ? questions[i - 1].step : "";
    const stepLine = q.step !== prevStep && i > 0 ? `Next: ${q.step.toLowerCase()}. ` : "";
    addApp((intro ? intro + " " : "") + stepLine + q.text);
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
        text: "Lekker, let's do this. Twelve quick questions in four short steps. Answer in your own words, short is fine. Real numbers and your customers' real words make the best ads.",
      },
    ]);
    askQuestion(0, "First, your business.");
  }

  function showHelp() {
    if (!currentQ) return;
    addApp(currentQ.hint ? `For example: "${currentQ.hint}". A rough answer in your own words is fine.` : "A rough answer in your own words is enough.");
    setHelpShown(true);
  }

  function looksLikeNonsense(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (t.length < 2) return true;
    return ["idk", "dunno", "no idea", "?", "??", "???", "lol"].includes(t);
  }

  function marginWarning(a: Answers): string | null {
    const price = a.offer ? parseNumber(a.offer, "money") : null;
    const cost = a.cost ? parseNumber(a.cost, "money") : null;
    if (price === null || cost === null || price <= 0) return null;
    const left = price - cost;
    const share = left / price;
    if (left > 0 && share >= 0.5) return null;
    const line =
      left <= 0
        ? `Before we write ads, one honest check. You charge about ${rand(price)} and said one job costs you about ${rand(cost)}. That leaves ${left < 0 ? "a loss of " + rand(-left) : "nothing"} before your own time. Ads will bring more of these jobs, so the price needs a look first.`
        : `Before we write ads, one honest check. You charge about ${rand(price)} and said one job costs you about ${rand(cost)}. That leaves ${rand(left)} before your own time, which is ${Math.round(share * 100)}% of the price. Ads will bring more of these jobs, so it is worth checking the price first.`;
    return line + " You can carry on with the ads anyway, or review your pricing first. " + AI_NUMBERS_CAUTION;
  }

  function finishInterview(a: Answers) {
    const warning = marginWarning(a);
    if (warning) {
      addApp(warning);
      setStage("margin_warning");
      return;
    }
    goConfirm();
  }

  function goConfirm() {
    addApp("Thanks. Here is what goes into your ads. Check it, fix anything that is off, then we write.");
    setStage("confirm");
  }

  function recordAnswer(key: string, value: string, next: boolean) {
    const a = { ...answers, [key]: value };
    setAnswers(a);
    if (!next) return a;
    const nextIndex = qIndex + 1;
    if (nextIndex < questions.length) {
      askQuestion(nextIndex);
    } else {
      finishInterview(a);
    }
    return a;
  }

  function chooseOption(choice: string) {
    if (loading || !currentQ) return;
    addUser(choice);
    if (currentQ.key === "urgency" && /season|holiday|intro price/i.test(choice)) {
      setAnswers({ ...answers, urgency: choice });
      addApp(/season|holiday/i.test(choice) ? "Which season or holiday, and when does it end?" : "What is the intro price, and until when?");
      setStage("urgency_detail");
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    recordAnswer(currentQ.key, /^no\b/i.test(choice) ? "none" : choice, true);
  }

  function skipQuestion() {
    if (loading || !currentQ) return;
    setInput("");
    addUser("Skip this one");
    recordAnswer(currentQ.key, "", true);
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
        addApp("No stress, even a rough answer helps. " + currentQ.text + (currentQ.hint ? ` For example: "${currentQ.hint}".` : "") + " Or tap Skip.");
        return;
      }
      // One follow-up on a vague answer where specifics matter most.
      const wantsSpecific = ["quote", "proof", "whyyou", "problem"].includes(currentQ.key);
      if (wantsSpecific && !vagueAsked && text.length < 45 && VAGUE.test(text)) {
        setVagueAsked(true);
        const ask =
          currentQ.key === "quote"
            ? "What exactly did they say? Their actual words work best, even a short WhatsApp message."
            : currentQ.key === "proof"
              ? "Can you give a number? Years open, how many clients, a rating, or how many come back."
              : "What exactly do they say about that? One specific detail beats any adjective.";
        addApp(ask);
        return;
      }
      recordAnswer(currentQ.key, text, true);
      return;
    }

    if (stage === "urgency_detail") {
      const a = { ...answers, urgency: `${answers.urgency}: ${text}` };
      setAnswers(a);
      setStage("interview");
      const nextIndex = qIndex + 1;
      if (nextIndex < questions.length) askQuestion(nextIndex);
      else finishInterview(a);
      return;
    }

    if (stage === "fixing" && fixKey) {
      const a = { ...answers, [fixKey]: text };
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

  async function post(body: Record<string, unknown>) {
    setLoading(true);
    setErrorText("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorText(data.error || "Something went wrong. Tap Try again.");
        return null;
      }
      return data;
    } catch {
      setErrorText("Couldn't reach the server. Check your connection and tap Try again.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function writeAds(isRetry = false) {
    setStage("writing");
    setRetryWhat("write");
    if (!isRetry) addApp("Writing your three ads now, each with a different hook, and checking every line against what you told us. This takes about half a minute...");
    const data = await post({ stage: "write", answers });
    if (!data) {
      setStage("error");
      return;
    }
    setAds(data.ads || []);
    setIssues(data.issues || []);
    setLaunch(data.launch || []);
    setChecklist(data.checklist || []);
    setWhatsappDigits(data.whatsappDigits || "");
    addApp("Your ads are ready below. We are now planning the pictures and your WhatsApp replies...");
    setStage("results");
    await planCreative(data.ads || []);
  }

  async function planCreative(list: Ad[]) {
    setRetryWhat("creative");
    setCreativeLoading(true);
    const data = await post({ stage: "creative", answers, ads: list });
    setCreativeLoading(false);
    if (data) {
      setCreatives(data.creatives || []);
      addApp("That's everything. Scroll down for your ads, picture plans and launch plan, each with its own copy button.");
    } else {
      addApp("The ads are done. The picture plans did not come through. Tap Try again below the ads to plan them.");
    }
  }

  async function retry() {
    if (retryWhat === "write" || ads.length === 0) await writeAds(true);
    else {
      setStage("results");
      await planCreative(ads);
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
    setCreatives([]);
    setErrorText("");
    setRetryWhat(null);
  }

  const showInput =
    (stage === "interview" && currentQ && currentQ.choices.length === 0) || stage === "urgency_detail" || stage === "fixing";
  const stepIndex = currentQ ? Math.max(0, STEPS.indexOf(currentQ.step)) : 0;

  return (
    <div className="shell">
      <TopBar />

      {stage === "welcome" ? (
        <main className="welcome">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/image.png" alt="IndabaAI logo" className="welcome-logo" />
          <h1>
            Three Meta ads, written the way <em>Meta says ads should be written</em>.
          </h1>
          <p>
            We are here to help you get this right. Best practice on Meta is to test at least three ads, each with a
            different angle, so Meta can find out what your customers respond to. Answer a few questions about your
            business in your own words, and we give you three ads in Meta&apos;s own format, each with its own hook, a
            picture plan and an image prompt for Meta AI, plus a simple plan for posting them. About 5 minutes.
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
          {(stage === "interview" || stage === "urgency_detail") && currentQ && (
            <div className="progress">
              Step {stepIndex + 1} of {STEPS.length}: {currentQ.step} · Question {qIndex + 1} of {questions.length}
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
                {!helpShown && currentQ.choices.length === 0 && (
                  <button className="chip muted" onClick={showHelp}>
                    Show me an example
                  </button>
                )}
                {!currentQ.required && (
                  <button className="chip muted" onClick={skipQuestion}>
                    {SKIP} this question
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
                <button className="btn primary" onClick={retry}>
                  Try again
                </button>
              </div>
            )}

            {stage === "margin_warning" && !loading && (
              <div className="choices">
                <Link href="/tools/prices" className="btn primary">
                  Review my pricing first
                </Link>
                <button className="btn ghost" onClick={goConfirm}>
                  Carry on with the ads
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
                creatives={creatives}
                creativeLoading={creativeLoading}
                launch={launch}
                checklist={checklist}
                whatsappDigits={whatsappDigits}
                onRetryCreative={() => planCreative(ads)}
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
                placeholder={currentQ && stage === "interview" && currentQ.hint ? `e.g. ${currentQ.hint}` : "Type your answer..."}
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
  business: "Business",
  area: "Area",
  offer: "Offer and price",
  customer: "Best customer",
  problem: "Their problem",
  quote: "Customer quote",
  proof: "Proof",
  whyyou: "Why you",
  myth: "Myth to bust",
  contact: "WhatsApp and rules",
  urgency: "Reason to book now",
  cost: "Cost per job",
};

function tidyForCard(key: string, value: string): string {
  let v = (value || "").trim();
  if (!v) return "";
  v = v.replace(/whats\s?app/gi, "WhatsApp").replace(/hairsalon/gi, "hair salon").replace(/\bR\s+(\d)/g, "R$1").replace(/\br(\d{2,})\b/g, "R$1");
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
                <b>{CONFIRM_LABELS[q.key] || q.step}</b>
                <span className={value ? "" : "empty"}>{value || "Skipped"}</span>
              </div>
              <button className="btn small" onClick={() => onFix(q.key)} disabled={!!fixing}>
                {value ? "Fix" : "Add"}
              </button>
            </div>
          );
        })}
      </div>
      {missing.length > 0 && (
        <p className="confirm-note">We still need: {missing.map((q) => CONFIRM_LABELS[q.key]).join(", ")}. Tap Add.</p>
      )}
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
  creatives,
  creativeLoading,
  launch,
  checklist,
  whatsappDigits,
  onRetryCreative,
  onStartOver,
}: {
  ads: Ad[];
  issues: Issue[];
  creatives: Creative[];
  creativeLoading: boolean;
  launch: LaunchLine[];
  checklist: CheckItem[];
  whatsappDigits: string;
  onRetryCreative: () => void;
  onStartOver: () => void;
}) {
  return (
    <div className="results">
      <h2>Your three ads</h2>
      <p className="results-intro">
        Each ad is a different idea, so Meta can test them against each other. Copy each field into Ads Manager. The
        counters show Meta&apos;s limits.
      </p>
      {ads.map((ad) => (
        <AdCard
          key={ad.id}
          ad={ad}
          issues={issues.filter((i) => i.adId === ad.id)}
          creative={creatives.find((c) => c.id === ad.id)}
          creativeLoading={creativeLoading}
          whatsappDigits={whatsappDigits}
        />
      ))}
      {!creativeLoading && creatives.length === 0 && (
        <div className="choices">
          <button className="btn ghost" onClick={onRetryCreative}>
            Try again: plan the pictures
          </button>
        </div>
      )}

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
            <h3>Before you launch</h3>
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
    `Primary text: ${ad.primary[0] || ""}`,
    `Headline: ${ad.headline}`,
    `Description: ${ad.description}`,
    `Button: ${ad.cta}`,
    `Text on the image: ${ad.onImage}`,
  ].join("\n");
}

function AdCard({
  ad,
  issues,
  creative,
  creativeLoading,
  whatsappDigits,
}: {
  ad: Ad;
  issues: Issue[];
  creative?: Creative;
  creativeLoading: boolean;
  whatsappDigits: string;
}) {
  const shareHref = "https://wa.me/?text=" + encodeURIComponent(adAsText(ad));
  const formatNote = ad.concept === "problem" ? "Suggested format: a 4:5 photo" : ad.concept === "proof" ? "Suggested format: a photo or a short clip of a real customer" : "Suggested format: a 15 second 9:16 video";
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
      <p className="ad-meta">{formatNote}</p>
      {issues.length > 0 && (
        <div className="ad-check">
          {issues.map((i, n) => (
            <div key={n}>
              Check: {i.field} in Ad {ad.id}. {i.reason}.
            </div>
          ))}
        </div>
      )}
      <Field label="Hook (first line and text on the image)" value={ad.hook} wordLimit={LIMITS.hookWords} />
      {ad.primary.map((p, i) => (
        <Field key={i} label={`Primary text ${i + 1}`} value={p} limit={LIMITS.primary} />
      ))}
      <Field label="Headline" value={ad.headline} limit={LIMITS.headline} />
      <Field label="Description" value={ad.description} limit={LIMITS.description} />
      <Field label="Button" value={ad.cta} noCopy />
      <Field label="Text on the image" value={ad.onImage} wordLimit={LIMITS.onImageMax} />

      <div className="creative">
        <b>Picture plan</b>
        {creative ? (
          <>
            <Field label="What to photograph with your phone" value={creative.shotList} />
            <Field label="Meta AI prompt, 4:5 feed image" value={creative.imagePrompt45} />
            <Field label="Meta AI prompt, 9:16 Reels or Stories" value={creative.imagePrompt916} />
            <p className="ad-meta">Add the text on the image afterwards in Canva or in Ads Manager. AI tools often misspell words, so keep text out of the generated picture.</p>
            <Field label="15 second video script" value={creative.videoScript} />
            <Field label="Your WhatsApp reply when they message" value={creative.whatsappGreeting} />
            {whatsappDigits && (
              <p className="ad-meta">The ad&apos;s button opens a chat with +{whatsappDigits}. Save the reply above as a quick reply in WhatsApp Business.</p>
            )}
          </>
        ) : creativeLoading ? (
          <p className="ad-meta">Planning the picture, the video and your WhatsApp reply...</p>
        ) : (
          <p className="ad-meta">Not planned yet.</p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, limit, wordLimit, noCopy }: { label: string; value: string; limit?: number; wordLimit?: number; noCopy?: boolean }) {
  const [copied, setCopied] = useState(false);
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const over = (limit !== undefined && value.length > limit) || (wordLimit !== undefined && words > wordLimit);

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
