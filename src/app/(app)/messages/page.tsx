import { requireUser } from "@/lib/auth/user";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { MarkAllMessagesReadForm, MarkMessageReadForm } from "./message-read-forms";

type NotificationEventType =
  | "market_sale"
  | "market_purchase"
  | "attendance_reward"
  | "bibs_bonus"
  | "pack_opened"
  | "admin_notice"
  | "trade_offer"
  | "trade_response";
type UserNotification = { id: string; event_type: NotificationEventType; title: string; body: string; read_at: string | null; created_at: string };

// Kicker shown above each message title. Falls back to "Club notice" for any
// event type added server-side before this map is updated.
const EVENT_LABELS: Record<NotificationEventType, string> = {
  market_sale: "Market sale",
  market_purchase: "Market purchase",
  attendance_reward: "Attendance reward",
  bibs_bonus: "Bibs bonus",
  pack_opened: "Pack opened",
  admin_notice: "Club notice",
  trade_offer: "Trade offer",
  trade_response: "Trade update",
};

export default async function MessagesPage() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").from("user_notifications")
    .select("id, event_type, title, body, read_at, created_at").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("Could not load your messages.");
  const messages = (data ?? []) as UserNotification[];
  const unreadCount = messages.filter((message) => !message.read_at).length;

  return <main className="min-h-screen bg-board p-5 text-ink sm:p-10"><section className="mx-auto max-w-3xl space-y-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-brass">KUT inbox</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Messages</h1><p className="mt-3 text-ink-dim">Private updates about your club and card economy.</p></div>{unreadCount > 0 && <MarkAllMessagesReadForm />}</header>
    {messages.length === 0 ? <div className="rounded-3xl border border-dashed border-line bg-panel/60 p-8 text-center"><h2 className="text-xl font-black">Your inbox is clear</h2><p className="mt-2 text-ink-dim">Club and market updates will appear here.</p></div> : <ol className="space-y-3">{messages.map((message) => <li className={`rounded-2xl border p-5 ${message.read_at ? "border-panel-2 bg-panel/50" : "border-brass/50 bg-brass/10"}`} key={message.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-brass">{EVENT_LABELS[message.event_type] ?? "Club notice"}</p><h2 className="mt-1 text-xl font-black">{message.title}</h2></div><time className="text-xs font-semibold text-ink-faint" dateTime={message.created_at}>{formatDate(message.created_at)}</time></div><p className="mt-3 text-ink-dim">{message.body}</p><div className="mt-4 flex items-center justify-between gap-3">{message.read_at ? <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Read</span> : <span className="text-xs font-bold uppercase tracking-[0.12em] text-brass">New</span>}{!message.read_at && <MarkMessageReadForm notificationId={message.id} />}</div></li>)}</ol>}
  </section></main>;
}
