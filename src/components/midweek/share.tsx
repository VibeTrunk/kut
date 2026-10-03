"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { ShareImage } from "@/lib/midweek/share";
import { loadShareAssets, renderShareImage } from "@/lib/midweek/share-draw";
import { MidweekSectionHead } from "./page-head";

/** The note under both images (DR3 HANDOFF "Copy", Sharing): what they carry, and where they're made. */
export const SHARE_NOTE =
  "Both show managers’ and Players’ names and Players’ photos. Send them to the club; they’re made on your phone, nothing is uploaded.";

/** A coarse pointer: share on a phone, download elsewhere (by capability, not width). */
const COARSE = "(pointer: coarse)";
function subscribeCoarse(onChange: () => void) {
  const query = window.matchMedia(COARSE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

type Drawn = { blob: Blob; url: string } | "failed" | null;
type Done = "shared" | "downloaded" | "failed" | null;

const ITEMS = {
  poster: { title: "The champion poster" },
  night: { title: "Your night", sub: "Your path, your five and their ratings" },
} as const;

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function ShareItem({
  image,
  drawn,
  phone,
  title,
  sub,
}: {
  image: ShareImage;
  drawn: Drawn;
  phone: boolean;
  title: string;
  sub: string;
}) {
  const [done, setDone] = useState<Done>(null);
  const ready = drawn !== null && drawn !== "failed";

  async function share() {
    if (drawn === null || drawn === "failed") return setDone("failed");
    const file = new File([drawn.blob], image.fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: image.top.replace(" · ", ", ") });
        setDone("shared");
      } catch (error) {
        // Closing the share sheet isn't a failure.
        if ((error as DOMException)?.name !== "AbortError") setDone("failed");
      }
      return;
    }
    download(drawn.blob, image.fileName);
    setDone("downloaded");
  }

  function save() {
    if (drawn === null || drawn === "failed") return setDone("failed");
    download(drawn.blob, image.fileName);
    setDone("downloaded");
  }

  const preview = (
    <div className="grid aspect-[4/5] w-full overflow-hidden rounded-[10px] border border-line/60 bg-board-deep">
      {ready ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`Preview: ${title}`} className="h-full w-full" src={drawn.url} />
      ) : (
        <span className="self-center justify-self-center px-2 text-center text-xs text-ink-faint">
          {drawn === "failed" ? "No preview" : "Drawing…"}
        </span>
      )}
    </div>
  );
  const button =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-black whitespace-nowrap disabled:opacity-55";

  return (
    <li className="grid grid-cols-[110px_minmax(0,1fr)] items-start gap-x-4 gap-y-2 rounded-2xl border border-line/60 bg-panel/55 p-3 sm:w-[190px] sm:grid-cols-1 sm:border-0 sm:bg-transparent sm:p-0">
      <div>{preview}</div>
      <div className="grid content-start gap-2">
        <p className="text-[14.5px] leading-tight">
          <b className="block font-extrabold text-ink">{title}</b>
          <span className="text-[12.5px] text-ink-faint">{sub}</span>
        </p>
        {/* One height for both sets of buttons, so the page doesn't move when
            hydration finds a coarse pointer and swaps Download for Share. */}
        <div className="min-h-[86px]">
          {phone ? (
            <div className="grid justify-items-start gap-1.5">
              <button
                className={`${button} bg-brass text-ink-on-accent hover:brightness-110`}
                disabled={!ready}
                onClick={share}
                type="button"
              >
                <span aria-hidden="true">⇪</span> Share
              </button>
              <button
                className="min-h-9 text-sm font-bold text-brass hover:underline disabled:opacity-55"
                disabled={!ready}
                onClick={save}
                type="button"
              >
                Save image
              </button>
            </div>
          ) : (
            <button
              className={`${button} border border-line bg-panel/70 text-ink hover:border-brass sm:w-full`}
              disabled={!ready}
              onClick={save}
              type="button"
            >
              <span aria-hidden="true">↓</span> {done === "downloaded" ? "Downloaded" : "Download"}
            </button>
          )}
        </div>
        <p aria-live="polite" className="text-[12.5px] leading-snug">
          {done === "downloaded" && (
            <span className="text-moss">
              ✓ {image.fileName} is in your downloads. Drop it into the group chat.
            </span>
          )}
          {done === "failed" || drawn === "failed" ? (
            <span className="text-brick" role="alert">
              Couldn’t make the image. Try again.
            </span>
          ) : null}
        </p>
      </div>
    </li>
  );
}

/**
 * `MidweekShare` (DR3 HANDOFF §3, ADR-120): `Share the night`, with the
 * champion poster and, for a member who entered, "my night". Both are drawn
 * on a canvas in the browser from data the page already has, as previews on
 * mount; a tap shares or saves the same PNG. Phones (a coarse pointer that can
 * share files) get the system share sheet, everything else a download.
 */
export function MidweekShare({
  poster,
  night,
}: {
  poster: ShareImage | null;
  night: ShareImage | null;
}) {
  const images = [poster, night].filter((image): image is ShareImage => image !== null);
  const [drawn, setDrawn] = useState<Drawn[]>(() => images.map(() => null));
  const phone = useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );
  const key = images.map((image) => image.fileName).join("|");

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      try {
        const assets = await loadShareAssets(images);
        const results = await Promise.all(
          images.map(async (image): Promise<Drawn> => {
            try {
              const blob = await renderShareImage(image, assets);
              const url = URL.createObjectURL(blob);
              urls.push(url);
              return { blob, url };
            } catch {
              return "failed";
            }
          }),
        );
        if (!cancelled) setDrawn(results);
      } catch {
        if (!cancelled) setDrawn(images.map(() => "failed"));
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
    // The images are plain data from the server; their file names identify them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (images.length === 0) return null;
  return (
    <section aria-labelledby="share-h" className="grid scroll-mt-24 gap-3.5" id="share">
      <MidweekSectionHead id="share-h" title="Share the night">
        <p className="text-[13px] text-ink-faint">Images for the club&rsquo;s group chat</p>
      </MidweekSectionHead>
      <ul className="grid gap-2.5 sm:flex sm:flex-wrap sm:gap-5">
        {images.map((image, index) => (
          <ShareItem
            drawn={drawn[index] ?? null}
            image={image}
            key={image.fileName}
            phone={phone}
            sub={
              image.kind === "poster"
                ? `${image.champion}, the final and the five`
                : ITEMS.night.sub
            }
            title={image.kind === "poster" ? ITEMS.poster.title : ITEMS.night.title}
          />
        ))}
      </ul>
      <p className="text-[12.5px] leading-normal text-ink-faint">{SHARE_NOTE}</p>
    </section>
  );
}
