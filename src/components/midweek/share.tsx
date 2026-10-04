"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { ShareImage } from "@/lib/midweek/share";
import {
  loadShareAssets,
  releaseShareAssets,
  renderShareImage,
  reportShareFailure,
} from "@/lib/midweek/share-draw";
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

function download(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
}

function ShareItem({
  image,
  phone,
  title,
  sub,
}: {
  image: ShareImage;
  phone: boolean;
  title: string;
  sub: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ image: ShareImage; attempt: number; drawn: Drawn } | null>(
    null,
  );
  const [done, setDone] = useState<Done>(null);
  const [sharing, setSharing] = useState(false);
  const drawn = result?.image === image && result.attempt === attempt ? result.drawn : null;
  const ready = drawn !== null && drawn !== "failed";

  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    (async () => {
      let assets;
      try {
        assets = await loadShareAssets([image], controller.signal);
        const blob = await renderShareImage(image, assets, controller.signal);
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setResult({ image, attempt, drawn: { blob, url } });
      } catch (error) {
        if (!controller.signal.aborted) {
          if (!assets) reportShareFailure("fonts", image.kind, error);
          setResult({ image, attempt, drawn: "failed" });
        }
      } finally {
        if (assets) releaseShareAssets(assets);
      }
    })();
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [image, attempt]);

  function retry() {
    setDone(null);
    setAttempt((value) => value + 1);
  }

  async function share() {
    if (!ready || sharing) return;
    setDone(null);
    setSharing(true);
    try {
      const file = new File([drawn.blob], image.fileName, { type: "image/png" });
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: image.top.replace(" · ", ", ") });
        setDone("shared");
      } else {
        download(drawn.url, image.fileName);
        setDone("downloaded");
      }
    } catch (error) {
      // Closing the share sheet isn't a failure.
      if ((error as DOMException)?.name !== "AbortError") {
        reportShareFailure("share", image.kind, error);
        setDone("failed");
      }
    } finally {
      setSharing(false);
    }
  }

  function save() {
    if (!ready) return;
    try {
      download(drawn.url, image.fileName);
      setDone("downloaded");
    } catch (error) {
      reportShareFailure("download", image.kind, error);
      setDone("failed");
    }
  }

  const preview = (
    <div className="grid aspect-[4/5] w-full overflow-hidden rounded-[10px] border border-line/60 bg-board-deep">
      {ready ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`Preview: ${title}`} className="h-full w-full object-contain" src={drawn.url} />
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
    <li className="grid min-w-0 grid-cols-[110px_minmax(0,1fr)] items-start gap-x-4 gap-y-2 rounded-2xl border border-line/60 bg-panel/55 p-3 sm:row-span-5 sm:w-[190px] sm:grid-cols-1 sm:grid-rows-subgrid sm:border-0 sm:bg-transparent sm:p-0">
      <div className="row-span-4 sm:row-span-1">{preview}</div>
      <p className="col-start-2 text-[14.5px] leading-tight font-extrabold text-ink [overflow-wrap:anywhere] sm:col-start-1">
        {title}
      </p>
      <p className="col-start-2 text-[12.5px] text-ink-faint [overflow-wrap:anywhere] sm:col-start-1">
        {sub}
      </p>
      {/* One height for both sets of buttons, so the page doesn't move when
            hydration finds a coarse pointer and swaps Download for Share. */}
      <div className="col-start-2 grid min-h-[86px] content-start sm:col-start-1">
        {phone ? (
          <div className="grid justify-items-start gap-1.5">
            <button
              className={`${button} bg-brass text-ink-on-accent hover:brightness-110`}
              disabled={!ready || sharing}
              onClick={share}
              type="button"
            >
              <span aria-hidden="true">⇪</span> {sharing ? "Sharing…" : "Share"}
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
        {drawn === "failed" && (
          <button
            className="min-h-11 justify-self-start text-sm font-bold text-brass hover:underline"
            onClick={retry}
            type="button"
          >
            Retry
          </button>
        )}
      </div>
      <p
        aria-live="polite"
        className="col-start-2 text-[12.5px] leading-snug [overflow-wrap:anywhere] sm:col-start-1"
      >
        {done === "shared" && <span className="text-moss">Shared.</span>}
        {done === "downloaded" && (
          <span className="text-moss">
            ✓ {image.fileName} is in your downloads. Drop it into the group chat.
          </span>
        )}
        {done === "failed" || drawn === "failed" ? (
          <span className="text-brick" role="alert">
            {drawn === "failed"
              ? "Couldn’t make the image. Try again."
              : "Couldn’t send the image. Try again or save it."}
          </span>
        ) : null}
      </p>
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
  const phone = useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );

  if (images.length === 0) return null;
  return (
    <section aria-labelledby="share-h" className="grid scroll-mt-24 gap-3.5" id="share">
      <MidweekSectionHead id="share-h" title="Share the night">
        <p className="text-[13px] text-ink-faint">Images for the club&rsquo;s group chat</p>
      </MidweekSectionHead>
      <ul className="grid gap-2.5 sm:auto-cols-[190px] sm:grid-flow-col sm:grid-rows-[repeat(5,auto)] sm:justify-start sm:gap-x-5 sm:gap-y-2">
        {images.map((image) => (
          <ShareItem
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
