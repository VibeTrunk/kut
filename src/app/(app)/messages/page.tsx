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

type UserNotification = {
  id: string;
  event_type: NotificationEventType;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

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
  const { data, error } = await supabase
    .schema("kut")
    .from("user_notifications")
    .select("id, event_type, title, body, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error("Could not load your messages.");
  const messages = (data ?? []) as UserNotification[];
  const unreadCount = messages.filter((message) => !message.read_at).length;

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-3xl space-y-8 py-4 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">KUT inbox</p>
            <h1 className="display text-5xl sm:text-6xl">Messages</h1>
            <p className="text-base text-ink-dim">
              Private updates about your club and card economy.
              {unreadCount > 0 && <span className="ml-2 font-bold text-brass">{unreadCount} unread</span>}
            </p>
          </div>
          {unreadCount > 0 && <MarkAllMessagesReadForm />}
        </header>

        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-panel/60 p-10 text-center">
            <h2 className="display text-3xl">Your inbox is clear</h2>
            <p className="mt-3 text-ink-dim">Club and market updates will appear here.</p>
          </div>
        ) : (
          <ol>
            {messages.map((message) => (
              <li
                className={`border-b border-line/30 py-5 ${message.read_at ? "" : "border-l-2 border-l-brass pl-4"}`}
                key={message.id}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-brass">
                    {EVENT_LABELS[message.event_type] ?? "Club notice"}
                    {!message.read_at && <span className="ml-2 text-ink-faint">New</span>}
                  </p>
                  <time className="text-xs font-bold tabular-nums text-ink-faint" dateTime={message.created_at}>
                    {formatDate(message.created_at)}
                  </time>
                </div>
                <h2 className="mt-2 text-xl font-extrabold">{message.title}</h2>
                <p className="mt-2 leading-relaxed text-ink-dim">{message.body}</p>
                {!message.read_at && (
                  <div className="mt-4">
                    <MarkMessageReadForm notificationId={message.id} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
