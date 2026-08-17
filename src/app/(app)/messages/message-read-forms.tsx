"use client";

import { useActionState } from "react";
import { markMessagesRead, type MessageActionState } from "./actions";

const initialState: MessageActionState = { error: null };

export function MarkAllMessagesReadForm() {
  const [state, formAction, pending] = useActionState(markMessagesRead, initialState);
  return <form action={formAction}><input name="all" type="hidden" value="1" />
    {state.error && <p className="mb-2 text-sm text-brick">{state.error}</p>}
    <button className="min-h-10 rounded-xl border border-brass px-4 text-sm font-black text-brass disabled:border-line disabled:text-ink-faint" disabled={pending} type="submit">{pending ? "Updating..." : "Mark all read"}</button>
  </form>;
}

export function MarkMessageReadForm({ notificationId }: { notificationId: string }) {
  const [state, formAction, pending] = useActionState(markMessagesRead, initialState);
  return <form action={formAction}><input name="notificationId" type="hidden" value={notificationId} />
    {state.error && <p className="text-xs text-brick">{state.error}</p>}
    <button className="min-h-9 text-sm font-bold text-brass hover:text-brass disabled:text-ink-faint" disabled={pending} type="submit">{pending ? "Updating..." : "Mark read"}</button>
  </form>;
}
