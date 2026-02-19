"use client";

import { useState } from "react";

interface SecretDisplayProps {
  secret: string;
}

export function SecretDisplay({ secret }: SecretDisplayProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const masked = secret.slice(0, 8) + "\u2022".repeat(24) + secret.slice(-4);

  async function handleCopy() {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 rounded-of bg-of-neutral-100 px-3 py-2 text-sm font-mono text-of-neutral-700 break-all">
        {revealed ? secret : masked}
      </code>

      <button
        type="button"
        onClick={() => setRevealed(!revealed)}
        className="rounded-of border border-of-neutral-300 px-3 py-2 text-sm text-of-neutral-600 hover:bg-of-neutral-100"
      >
        {revealed ? "Hide" : "Reveal"}
      </button>

      <button
        type="button"
        onClick={handleCopy}
        className="rounded-of border border-of-neutral-300 px-3 py-2 text-sm text-of-neutral-600 hover:bg-of-neutral-100"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
