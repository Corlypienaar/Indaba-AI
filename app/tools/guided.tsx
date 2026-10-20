"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import TopBar from "../topbar";
import CopyBlock from "../copyblock";
import { MENU } from "@/lib/menu";
import { parseNumber, rand, AI_NUMBERS_CAUTION } from "@/lib/numbers";
import {
  getCard,
  type Answers,
  type Calc,
  TOUGH_LEAD_IN,
  HELP_LEAD_IN,
  CLOSING_LINE,
} from "@/lib/cards";

// The shared engine for every guided card. Same chat feel as the ad flow:
// IndabaAI asks one question at a time, the owner types or taps an answer,
// the app works out the numbers, and Llama answers as the expert for that card.

type Msg = { role: "app" | "user" | "note"; text: string };
type Stage = "intro" | "asking" | "confirm" | "fixing" | "thinking" | "result" | "error";

export default function Guided({ slug }: { slug: string }) {
  const card = getCard(slug)!;
  const [stage, setStage] = useState<Stage>("intro");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [skipped, setSkipped] = useState<string[]>([]);
  const [helpShown, setHelpShown] = useState(false);
  const [multi, setMulti] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [result, setResult] = useState("");
  const [calc, setCalc] = useState<Calc>({});
  const [finalAnswers, setFinalAnswers] = useState<Answers>({});
  const [finalSkipped, setFinalSkipped] = useState<string[]>([]);
  const [fixId, setFixId] = useState<string>("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const q = card.questions[qIndex];
  const total = card.questions.length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, stage, helpShown, multi]);

  const add = (role: Msg["role"], text: string) =>
    setMessages((m) => [...m, { role, text }]);

  function askQuestion(i: number) {
    const next = card.questions[i];
    if (next.tough) add("note", TOUGH_LEAD_IN);
    add("app", (next.optional ? "(Optional) " : "") + next.text + (next.why ? "\n\n" + next.why : ""));
    setHelpShown(false);
    setMulti([]);
    if (next.type === "text" || next.type === "number") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function goBack() {
    if (qIndex === 0) return;
    const prev = qIndex - 1;
    const prevQ = card.questions[prev];
    const rest = { ...answers };
    delete rest[prevQ.id];
    setAnswers(rest);
    setSkipped(skipped.filter((t) => t !== prevQ.text));
    setQIndex(prev);
    add("app", "No problem. Here is that question again.");
    askQuestion(prev);
  }

  function start() {
    setStage("asking");
    setMessages([]);
    card.intro.forEach((t) => add("app", t));
    setQIndex(0);
    askQuestion(0);
  }

  function answer(value: string, wasSkipped = false) {
    const id = q.id;
    const newAnswers = { ...answers, [id]: wasSkipped ? "" : value };
    const newSkipped = wasSkipped ? [...skipped, q.text] : skipped;
    setAnswers(newAnswers);
    setSkipped(newSkipped);
    add("user", wasSkipped ? "Skip this one" : value);

    const next = qIndex + 1;
    if (next < total) {
      setQIndex(next);
      askQuestion(next);
      return;
    }
    finish(newAnswers, newSkipped);
  }

  async function finish(finalAnswers: Answers, finalSkipped: string[]) {
    const required = card.questions.filter((x) => !x.optional).length;
    const skippedRequired = card.questions.filter(
      (x) => !x.optional && finalSkipped.includes(x.text)
    ).length;

    if (skippedRequired > required / 2) {
      // The "I do not know" journey: too little to work with.
      add("app", "No problem. Let's start from the beginning. The lessons card walks you through the basics one step at a time, and this prompt asks your own AI tool to guide you through these questions one at a time.");
      setCalc({});
      setResult("");
      setStage("result");
      return;
    }

    setFinalAnswers(finalAnswers);
    setFinalSkipped(finalSkipped);

    const numberQs = card.questions.filter((q) => q.type === "number" && finalAnswers[q.id]);
    if (numberQs.length) {
      add("app", "Here is what we understood from your answers:\n" + understoodLines(finalAnswers) + "\n\nIs that right? Numbers can be read wrongly, so please check before we work anything out.");
      setStage("confirm");
      return;
    }
    await calculateAndRun(finalAnswers, finalSkipped);
  }

  function understoodLines(a: Answers): string {
    return card.questions
      .filter((q) => q.type === "number" && a[q.id])
      .map((q) => {
        const v = parseNumber(a[q.id], q.kind || "money");
        const shown = v === null ? "not understood, please fix" : q.kind === "money" || !q.kind ? rand(v) : String(v);
        return `${shortLabel(q)}: ${shown}`;
      })
      .join("\n");
  }

  function shortLabel(q: { id: string; text: string }): string {
    const first = q.text.split("?")[0].replace(/^\(Optional\)\s*/i, "");
    return first.length > 70 ? first.slice(0, 67) + "..." : first;
  }

  async function calculateAndRun(a: Answers, s: string[]) {
    const c = card.calculate(a);
    setCalc(c);
    if (Object.keys(c).length) {
      add("app", "Your numbers, worked out by the app:\n" + Object.entries(c).map(([k, v]) => `${k}: ${v}`).join("\n"));
      add("note", AI_NUMBERS_CAUTION);
    }
    add("app", "Thanks. Give us a moment to look at this properly...");
    await run(a, c, s);
  }

  function startFix() {
    setStage("fixing");
    add("app", "Which one should we fix? Tap it, then type the right number.");
  }

  function fixAnswer(value: string) {
    const updated = { ...finalAnswers, [fixId]: value };
    setFinalAnswers(updated);
    setAnswers(updated);
    add("user", value);
    setFixId("");
    add("app", "Here is what we understood now:\n" + understoodLines(updated) + "\n\nIs that right?");
    setStage("confirm");
  }

  async function run(a: Answers, c: Calc, s: string[]) {
    setStage("thinking");
    setLoading(true);
    setErrorText("");
    try {
      const res = await fetch("/api/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, answers: a, calc: c, skipped: s }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorText(data.error || "Something went wrong. Tap Try again.");
        setStage("error");
        return;
      }
      setResult(data.text as string);
      add("app", data.text as string);
      if (s.length) {
        add("app", "Questions worth finding out:\n" + s.map((x) => "- " + x).join("\n"));
      }
      add("note", CLOSING_LINE);
      setStage("result");
    } catch {
      setErrorText("Couldn't reach the server. Check your connection and tap Try again.");
      setStage("error");
    } finally {
      setLoading(false);
    }
  }

  function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    if (stage === "fixing" && fixId) {
      fixAnswer(text);
      return;
    }
    answer(text);
  }

  function showHelp() {
    add("note", HELP_LEAD_IN + "\n\n" + q.help);
    setHelpShown(true);
  }

  const next = card.nextSlug ? MENU.find((m) => m.href === "/tools/" + card.nextSlug) : undefined;
  const deeperText =
    stage === "result" && result === ""
      ? blankPrompt(card.title)
      : card.deeper(answers, calc);

  return (
    <div className="shell">
      <TopBar />

      {stage === "intro" ? (
        <main className="welcome">
          <h1>{card.title}</h1>
          {card.intro.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
          <p className="fineprint">About {card.minutes} minutes. Short answers are fine.</p>
          <button className="btn primary big" onClick={start}>
            Let&apos;s start
          </button>
          <Link href="/" className="btn ghost">
            Back to home
          </Link>
        </main>
      ) : (
        <main className="chat">
          {stage === "asking" && (
            <div className="progress">
              Question {qIndex + 1} of {total}
            </div>
          )}
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.text}
              </div>
            ))}

            {stage === "asking" && !loading && (
              <>
                {q.type === "choice" && (
                  <div className="chips">
                    {q.options!.map((o) => (
                      <button key={o} className="chip" onClick={() => answer(o)}>
                        {o}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === "multi" && (
                  <div className="chips">
                    {q.options!.map((o) => (
                      <button
                        key={o}
                        className={`chip${multi.includes(o) ? " selected" : ""}`}
                        onClick={() =>
                          setMulti((m) => (m.includes(o) ? m.filter((x) => x !== o) : [...m, o]))
                        }
                      >
                        {o}
                      </button>
                    ))}
                    <button
                      className="btn primary"
                      disabled={multi.length === 0}
                      onClick={() => answer(multi.join(", "))}
                    >
                      Done
                    </button>
                  </div>
                )}
                <div className="chips">
                  {!helpShown && (
                    <button className="chip muted" onClick={showHelp}>
                      I am not sure what this means
                    </button>
                  )}
                  <button className="chip muted" onClick={() => answer("", true)}>
                    Skip this question
                  </button>
                  {qIndex > 0 && (
                    <button className="chip muted" onClick={goBack}>
                      Change my last answer
                    </button>
                  )}
                </div>
              </>
            )}

            {stage === "confirm" && !loading && (
              <div className="chips">
                <button className="btn primary" onClick={() => calculateAndRun(finalAnswers, finalSkipped)}>
                  Yes, work it out
                </button>
                <button className="chip" onClick={startFix}>
                  Fix a number
                </button>
              </div>
            )}

            {stage === "fixing" && !loading && !fixId && (
              <div className="chips">
                {card.questions
                  .filter((q) => q.type === "number")
                  .map((q) => (
                    <button
                      key={q.id}
                      className="chip"
                      onClick={() => {
                        setFixId(q.id);
                        add("app", shortLabel(q) + "? Type the number.");
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                    >
                      {shortLabel(q)}
                    </button>
                  ))}
              </div>
            )}

            {loading && (
              <div className="bubble app typing">
                IndabaAI is thinking
                <span className="dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </div>
            )}

            {stage === "error" && !loading && (
              <div className="error-box">
                <p>{errorText}</p>
                <button className="btn primary" onClick={() => run(answers, calc, skipped)}>
                  Try again
                </button>
              </div>
            )}

            {stage === "result" && (
              <div className="results">
                {result && <CopyBlock title="Your result" text={result} />}
                {result && Object.keys(calc).length > 0 && (
                  <p className="fineprint">{AI_NUMBERS_CAUTION}</p>
                )}
                <div className="result-block deeper">
                  <p>
                    Want more detail? Copy this prompt, add any extra information, and paste it
                    into Meta AI on WhatsApp or your favourite AI tool to carry on from here.
                  </p>
                  <CopyBlock title="Your prompt" text={deeperText} bare />
                </div>
                <div className="choices">
                  <Link href="/" className="btn ghost">
                    Back to home
                  </Link>
                  {result === "" && (
                    <Link href="/learn" className="btn primary">
                      New to AI? Start here
                    </Link>
                  )}
                  {result !== "" && next && (
                    <Link href={next.href} className="btn primary">
                      Next: {next.title}
                    </Link>
                  )}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {((stage === "asking" && (q.type === "text" || q.type === "number")) || (stage === "fixing" && fixId)) && (
            <div className="inputbar">
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                inputMode={q.type === "number" || stage === "fixing" ? "decimal" : "text"}
                placeholder={q.type === "number" || stage === "fixing" ? "Type a number..." : "Type your answer..."}
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

function blankPrompt(title: string): string {
  return `Act as an honest, practical advisor for small businesses. I want help with this: "${title}". I am not sure of the answers yet, so please guide me through it step by step. Ask me one simple question at a time, explain why you are asking it and how I can find the answer, and wait for my reply before the next one. When you have enough, tell me what is working, two or three things worth a closer look, and one practical thing to do this month. Use plain English and do not just agree with me.`;
}
