import { eventLabel, type MessageTarget, type UserNotification } from "@/lib/messages";
import { presentNotification } from "@/lib/notification-copy";

/**
 * `MessageRow` (design/ux-review/HANDOFF.md "Messages", ADR-114): one compact
 * row per message. The whole row is one link through `/messages/{id}/open`,
 * which marks it read and goes to its subject; the link label ("Bracket →")
 * and the arrow say where. A message without a subject has no arrow: unread,
 * opening it only marks it read; read, it is no link at all. Unread rows carry
 * a filled dot and the word `New`, so colour is never the only signal. Server
 * wording passes through the FLUT presentation adapter (ADR-137); the stored
 * row is never changed.
 */
export function MessageRow({
  message,
  time,
  target,
}: {
  message: UserNotification;
  time: string;
  target: MessageTarget | null;
}) {
  const unread = !message.read_at;
  const { title, body: text } = presentNotification(message);
  const body = (
    <>
      <span
        aria-hidden="true"
        className={`row-span-3 mt-[5px] h-2.5 w-2.5 rounded-full border-[1.5px] ${unread ? "border-brass bg-brass" : "border-line"}`}
      />
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[0.65rem] font-extrabold tracking-[0.14em] text-brass uppercase">
        {eventLabel(message.event_type)}
        {unread && <span className="text-ink">New</span>}
      </span>
      <span className="row-span-3 grid justify-items-end gap-1 text-xs font-bold text-ink-faint tabular-nums">
        <time dateTime={message.created_at}>{time}</time>
        {target && (
          <span aria-hidden="true" className="text-lg leading-none text-brass">
            &rsaquo;
          </span>
        )}
      </span>
      <span className="block min-w-0 text-[15px] leading-snug font-extrabold [overflow-wrap:anywhere]">
        {title}
      </span>
      <span className="block min-w-0 text-[13.5px] leading-normal text-ink-dim [overflow-wrap:anywhere]">
        {text}
        {target && (
          <>
            {" "}
            <span className="font-extrabold whitespace-nowrap text-brass">
              {target.label} &rarr;
            </span>
          </>
        )}
      </span>
    </>
  );
  const box = `grid grid-cols-[14px_minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-0.5 rounded-xl border p-3 ${
    unread ? "border-[#5c4419]/70 bg-brass-bg/25" : "border-transparent"
  }`;
  if (!target && !unread) {
    return <div className={box}>{body}</div>;
  }
  return (
    // A plain <a>, not <Link>: opening marks the message read, so it must never be prefetched.
    <a
      className={`${box} outline-offset-2 outline-brass hover:bg-panel/60 focus-visible:outline-2`}
      href={`/messages/${message.id}/open`}
    >
      {body}
    </a>
  );
}
