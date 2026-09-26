/**
 * `MidweekSeed`, the fairness seal (§44.8 commit and reveal). Steel and small,
 * never brass: it is there to be checked, not to be noticed. `seedMatches` is
 * computed on the server once the seed is published (PR 8's complete week).
 */
export function MidweekSeed({
  seedHash,
  seed = null,
  seedMatches = false,
  defaultOpen = false,
}: {
  seedHash: string;
  seed?: string | null;
  seedMatches?: boolean;
  defaultOpen?: boolean;
}) {
  const short = `${seedHash.slice(0, 8)}…${seedHash.slice(-8)}`;
  return (
    <details className="group text-xs text-steel" open={defaultOpen || undefined}>
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 font-extrabold tracking-[0.02em] [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="grid h-3.5 w-3.5 flex-none place-items-center rounded border-[1.5px] border-current text-[10px] leading-none"
        >
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">&minus;</span>
        </span>
        Fairness seal <code className="font-mono text-[11.5px] text-ink-dim">{short}</code>
      </summary>
      <p className="mt-1.5 max-w-xl leading-relaxed text-ink-faint">
        This week&rsquo;s draws were fixed before anyone picked. The seal is a fingerprint (SHA-256)
        of a secret seed; the seed is published once the final is shown, so anyone can check the
        fingerprint matches and nobody, admins included, could have re-rolled the week.
      </p>
      <code className="mt-1.5 block font-mono text-[11.5px] break-all text-ink-dim">
        seal {seedHash}
      </code>
      {seed && (
        <>
          <code className="mt-1.5 block font-mono text-[11.5px] break-all text-ink-dim">
            seed {seed}
          </code>
          {seedMatches && (
            <p className="mt-1.5 text-ink-faint">
              <span className="font-extrabold text-moss">&#10003; Matches the seal.</span> SHA-256
              of the seed is the seal above.
            </p>
          )}
        </>
      )}
    </details>
  );
}
