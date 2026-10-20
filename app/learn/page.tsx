"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import TopBar from "../topbar";
import CopyBlock from "../copyblock";
import { LESSONS, finishPrompt, suggestCard } from "@/lib/lessons";

// "New to AI? Start here": seven short lessons in the same chat feel.
// Fixed text, quick checks as tap buttons, and a prompt to copy after each one.
// No AI calls, so this card can never fail.

type Msg = { role: "app" | "user" | "note"; text: string };
type Stage = "intro" | "level" | "biz" | "lesson" | "checked" | "finish" | "done";

const LEVELS = [
  "I have never used it",
  "I have tried it, and it did not give me much",
  "I use it sometimes and want to get better",
];

export default function Learn() {
  const [stage, setStage] = useState<Stage>("intro");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [level, setLevel] = useState("");
  const [biz, setBiz] = useState("");
  const [input, setInput] = useState("");
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [missed, setMissed] = useState<string[]>([]);
  const [task, setTask] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const business = biz.trim() || "small business";
  const lesson = LESSONS[current];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stage]);

  const add = (role: Msg["role"], text: string) => setMessages((m) => [...m, { role, text }]);

  function start() {
    setStage("level");
    setMessages([
      { role: "app", text: "Most people are just starting. In about 15 minutes you will know what AI is, how to ask it for help, and how to stay safe while you use it. Take your time. We will go one step at a time." },
      { role: "app", text: "Where are you with AI today?" },
    ]);
  }

  function pickLevel(l: string) {
    setLevel(l);
    add("user", l);
    add("app", "What kind of business do you run, or want to run? For example \"hair salon\". This only helps us fill in your prompts. You can leave it blank.");
    setStage("biz");
  }

  function submitBiz() {
    const b = input.trim();
    setBiz(b);
    setInput("");
    add("user", b || "(blank)");
    const startAt = level === LEVELS[0] ? 0 : 3;
    openLesson(startAt);
  }

  function openLesson(i: number) {
    setCurrent(i);
    setStage("lesson");
    const l = LESSONS[i];
    setMessages((m) => [...m, { role: "note", text: l.title }, ...l.text.map((t) => ({ role: "app" as const, text: t })), { role: "app", text: l.check }]);
  }

  function pickAnswer(idx: number) {
    add("user", lesson.options[idx]);
    const right = lesson.correct === null || idx === lesson.correct;
    if (!right) setMissed((m) => [...m, lesson.title]);
    add("app", (right ? "That is right. " : "Not quite. ") + lesson.answer);
    add("note", lesson.encouragement);
    setDone((d) => (d.includes(current) ? d : [...d, current]));
    setStage("checked");
  }

  function nextLesson() {
    if (current + 1 < LESSONS.length) openLesson(current + 1);
    else {
      setStage("finish");
      add("note", "Now try one thing.");
      add("app", "What is one repeat task in your business that eats your time? For example: answering the same WhatsApp questions, writing posts, sending quotes, chasing payments.");
    }
  }

  function submitTask() {
    const t = input.trim();
    setTask(t);
    setInput("");
    add("user", t || "(blank)");
    add("app", "You started. That is the part most people never get to. Keep your tool open, try one thing today, and come back whenever you want the next step. We are here.");
    setStage("done");
  }

  const suggestion = suggestCard(task);

  return (
    <div className="shell">
      <TopBar />
      {stage === "intro" ? (
        <main className="welcome">
          <h1>
            You are not behind. <em>You are exactly on time.</em>
          </h1>
          <p>Seven short lessons. No jargon. In about 15 minutes you will know what AI is, how to ask it for help, and how to stay safe while you use it.</p>
          <button className="btn primary big" onClick={start}>
            Let&apos;s start
          </button>
          <Link href="/" className="btn ghost">
            Back to home
          </Link>
        </main>
      ) : (
        <main className="chat">
          {(stage === "lesson" || stage === "checked") && (
            <div className="progress">Lesson {current + 1} of {LESSONS.length}</div>
          )}
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.text}
              </div>
            ))}

            {stage === "level" && (
              <div className="chips">
                {LEVELS.map((l) => (
                  <button key={l} className="chip" onClick={() => pickLevel(l)}>
                    {l}
                  </button>
                ))}
              </div>
            )}

            {stage === "lesson" && (
              <div className="chips">
                {lesson.options.map((o, i) => (
                  <button key={o} className="chip" onClick={() => pickAnswer(i)}>
                    {o}
                  </button>
                ))}
              </div>
            )}

            {stage === "checked" && (
              <div className="results">
                <div className="result-block deeper">
                  <p>Want to go deeper on this lesson? Copy this prompt into Meta AI on WhatsApp or your favourite AI tool.</p>
                  <CopyBlock title="Your prompt" text={lesson.prompt(business)} bare />
                </div>
                <div className="choices">
                  <button className="btn primary" onClick={nextLesson}>
                    {current + 1 < LESSONS.length ? "Next lesson" : "Finish"}
                  </button>
                </div>
                <details>
                  <summary className="fineprint">Jump to another lesson</summary>
                  <div className="lesson-list">
                    {LESSONS.map((l, i) => (
                      <button key={l.title} className={done.includes(i) ? "done" : ""} onClick={() => openLesson(i)}>
                        {l.title}
                        {done.includes(i) ? " ✓" : ""}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {stage === "done" && (
              <div className="results">
                <div className="result-block deeper">
                  <p>Take this with you. Copy it into Meta AI on WhatsApp or your favourite AI tool and it will carry on teaching you from where you are now.</p>
                  <CopyBlock title="Your prompt" text={finishPrompt(business, level, done, missed, task)} bare />
                </div>
                <div className="choices">
                  <Link href={suggestion.href} className="btn primary">
                    Try: {suggestion.title}
                  </Link>
                  <Link href="/" className="btn ghost">
                    Back to home
                  </Link>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {(stage === "biz" || stage === "finish") && (
            <div className="inputbar">
              <textarea
                value={input}
                rows={1}
                placeholder={stage === "biz" ? "For example: hair salon" : "Type your answer..."}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    stage === "biz" ? submitBiz() : submitTask();
                  }
                }}
              />
              <button className="btn primary send" onClick={stage === "biz" ? submitBiz : submitTask}>
                {input.trim() ? "Send" : "Skip"}
              </button>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
