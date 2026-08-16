import Link from "next/link";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { MarkAllMessagesReadForm, MarkMessageReadForm } from "./message-read-forms";

type UserNotification = { id: string; event_type: "market_sale" | "market_purchase"; title: string; body: string; read_at: string | null; created_at: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function MessagesPage() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").from("user_notifications")
    .select("id, event_type, title, body, read_at, created_at").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("Could not load your messages.");
  const messages = (data ?? []) as UserNotification[];
  const unreadCount = messages.filter((message) => !message.read_at).length;

  return <main className="min-h-screen bg-slate-950 p-5 text-slate-50 sm:p-10"><section className="mx-auto max-w-3xl space-y-8">
    <nav className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold"><Link className="text-amber-400 hover:text-amber-300" href="/club">← My Club</Link><Link className="text-slate-400 hover:text-slate-200" href="/market">Transfer market</Link></nav>
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">KUT inbox</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Messages</h1><p className="mt-3 text-slate-300">Private updates about your club and card economy.</p></div>{unreadCount > 0 && <MarkAllMessagesReadForm />}</header>
    {messages.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center"><h2 className="text-xl font-black">Your inbox is clear</h2><p className="mt-2 text-slate-300">Market sale and purchase messages will appear here.</p></div> : <ol className="space-y-3">{messages.map((message) => <li className={`rounded-2xl border p-5 ${message.read_at ? "border-slate-800 bg-slate-900/50" : "border-amber-400/50 bg-amber-400/10"}`} key={message.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-amber-300">{message.event_type === "market_sale" ? "Market sale" : "Market purchase"}</p><h2 className="mt-1 text-xl font-black">{message.title}</h2></div><time className="text-xs font-semibold text-slate-400" dateTime={message.created_at}>{formatDate(message.created_at)}</time></div><p className="mt-3 text-slate-200">{message.body}</p><div className="mt-4 flex items-center justify-between gap-3">{message.read_at ? <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Read</span> : <span className="text-xs font-bold uppercase tracking-[0.12em] text-amber-300">New</span>}{!message.read_at && <MarkMessageReadForm notificationId={message.id} />}</div></li>)}</ol>}
  </section></main>;
}
