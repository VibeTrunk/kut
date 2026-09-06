"use client";

import { useState } from "react";

export function CopyMessageButton({ owner, card }: { owner: string; card: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "fallback">("idle");
  const message = `Hi ${owner}, I saw you're open to trading your ${card} card on KUT. Shall we agree a trade?`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setStatus("copied");
    } catch {
      setStatus("fallback");
    }
  }

  return (
    <div className="space-y-2">
      <button className="min-h-11 rounded-xl border border-brass/50 px-4 text-sm font-black text-brass" onClick={copy} type="button">Copy message</button>
      {status === "copied" && <p className="text-xs font-bold text-moss" role="status">Copied. Send it to the owner.</p>}
      {status === "fallback" && <p className="select-all rounded-lg bg-board p-3 text-xs text-ink-dim" role="status">{message}</p>}
    </div>
  );
}
