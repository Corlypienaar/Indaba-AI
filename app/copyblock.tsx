"use client";

import { useState } from "react";

// A block of text with a Copy button. Used for results and prompts.

export default function CopyBlock({
  title,
  text,
  bare,
}: {
  title: string;
  text: string;
  bare?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
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

  // Opens WhatsApp with the text ready to send; the owner picks who gets it.
  const waHref = "https://wa.me/?text=" + encodeURIComponent(text);

  const inner = (
    <>
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
    </>
  );

  return bare ? <div>{inner}</div> : <div className="result-block">{inner}</div>;
}
