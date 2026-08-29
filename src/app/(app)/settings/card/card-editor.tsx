"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ARCHETYPES, ARCHETYPE_LABELS, type Archetype } from "@/game/archetypes";
import { createClient } from "@/lib/supabase/client";
import { PLAYER_PHOTO_BUCKET, playerPhotoPath } from "@/lib/player-photos";
import { clearPlayerPhoto, savePlayerArchetype, savePlayerPhoto, type CardActionState } from "./actions";

const VIEWPORT = 256; // px; square crop window
const OUTPUT = 512; // px; saved image is OUTPUT x OUTPUT
const MAX_BYTES = 5 * 1024 * 1024;

type CardEditorProps = {
  playerId: string;
  displayName: string;
  currentArchetype: Archetype;
  currentPhotoUrl: string | null;
};

function Feedback({ state }: { state: CardActionState }) {
  if (!state) return null;
  return state.ok ? (
    <p className="rounded-xl bg-moss-bg p-3 text-sm font-bold text-moss">{state.message}</p>
  ) : (
    <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>
  );
}

export function CardEditor({ playerId, displayName, currentArchetype, currentPhotoUrl }: CardEditorProps) {
  const [archetypeState, archetypeAction, archetypePending] = useActionState(savePlayerArchetype, null);
  const [photoState, photoAction] = useActionState(savePlayerPhoto, null);
  const [removeState, removeAction, removePending] = useActionState(clearPlayerPhoto, null);
  const [isSubmittingPhoto, startPhotoSubmit] = useTransition();

  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Base scale that makes the image exactly "cover" the square viewport at scale 1.
  const baseScale = natural ? Math.max(VIEWPORT / natural.w, VIEWPORT / natural.h) : 1;
  const dispW = natural ? natural.w * baseScale * scale : VIEWPORT;
  const dispH = natural ? natural.h * baseScale * scale : VIEWPORT;
  const maxOffX = Math.max(0, (dispW - VIEWPORT) / 2);
  const maxOffY = Math.max(0, (dispH - VIEWPORT) / 2);

  const clampOffset = useCallback(
    (x: number, y: number) => ({
      x: Math.min(maxOffX, Math.max(-maxOffX, x)),
      y: Math.min(maxOffY, Math.max(-maxOffY, y)),
    }),
    [maxOffX, maxOffY],
  );

  // Apply the transform via CSSOM (not a JSX style attribute) so it never needs
  // an inline-style CSP allowance and never renders during SSR.
  useEffect(() => {
    const el = imgRef.current;
    if (!el || !natural) return;
    el.style.width = `${dispW}px`;
    el.style.height = `${dispH}px`;
    el.style.transform = `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`;
  }, [dispW, dispH, offset, natural]);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setUploadError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError("That image is over 5 MB. Choose a smaller one.");
      return;
    }
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setNatural(null);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setFileUrl(URL.createObjectURL(file));
  }

  function onImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const el = event.currentTarget;
    setNatural({ w: el.naturalWidth, h: el.naturalHeight });
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!natural) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: offset.x,
      baseY: offset.y,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset(clampOffset(drag.baseX + (event.clientX - drag.startX), drag.baseY + (event.clientY - drag.startY)));
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // pointer already released
      }
      dragRef.current = null;
    }
  }

  function onScaleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setScale(Number(event.target.value));
    setOffset((current) => clampOffset(current.x, current.y));
  }

  async function toSquareBlob(): Promise<{ blob: Blob; contentType: string }> {
    const img = imgRef.current;
    if (!img || !natural) throw new Error("no image");
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");

    const factor = baseScale * scale;
    const vpLeft = VIEWPORT / 2 - dispW / 2 + offset.x;
    const vpTop = VIEWPORT / 2 - dispH / 2 + offset.y;
    const sx = -vpLeft / factor;
    const sy = -vpTop / factor;
    const sSize = VIEWPORT / factor;
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT);

    const webpOk = canvas.toDataURL("image/webp").startsWith("data:image/webp");
    const contentType = webpOk ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, contentType, 0.85));
    if (!blob) throw new Error("could not encode image");
    return { blob, contentType };
  }

  async function onSavePhoto() {
    setUploadError(null);
    setIsUploading(true);
    try {
      const { blob, contentType } = await toSquareBlob();
      const path = playerPhotoPath(playerId);
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(PLAYER_PHOTO_BUCKET)
        .upload(path, blob, { upsert: true, contentType });
      if (error) {
        setUploadError("Upload failed. Check the image and try again.");
        setIsUploading(false);
        return;
      }
      const formData = new FormData();
      formData.set("photo_path", path);
      startPhotoSubmit(() => photoAction(formData));
    } catch {
      setUploadError("Could not process that image. Try another one.");
    } finally {
      setIsUploading(false);
    }
  }

  async function onRemovePhoto() {
    // Best-effort object delete; the RPC below is what actually clears the card.
    try {
      await createClient().storage.from(PLAYER_PHOTO_BUCKET).remove([playerPhotoPath(playerId)]);
    } catch {
      // ignore — clearing photo_path is the source of truth
    }
    startPhotoSubmit(() => removeAction());
  }

  const fieldClass = "min-h-12 w-full rounded-xl border border-line bg-board px-4";

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-2xl border border-line bg-panel p-5">
        <div>
          <h2 className="text-lg font-black">Archetype</h2>
          <p className="mt-1 text-sm text-ink-faint">
            This reshapes the six stats on your <strong>{displayName}</strong> card. It does not change your OVR.
            Saving recalculates every stat.
          </p>
        </div>
        <form action={archetypeAction} className="space-y-3">
          <select className={fieldClass} defaultValue={currentArchetype} name="archetype">
            {ARCHETYPES.map((value) => (
              <option key={value} value={value}>
                {ARCHETYPE_LABELS[value]}
              </option>
            ))}
          </select>
          <button
            className="min-h-12 w-full rounded-xl bg-brass px-4 py-3 font-bold text-ink-on-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint"
            disabled={archetypePending}
            type="submit"
          >
            {archetypePending ? "Saving…" : "Save archetype"}
          </button>
          <Feedback state={archetypeState} />
        </form>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-panel p-5">
        <div>
          <h2 className="text-lg font-black">Card photo</h2>
          <p className="mt-1 text-sm text-ink-faint">
            Upload a photo, then drag to reposition and use the slider to zoom. It&rsquo;s saved as a square.
          </p>
        </div>

        <input accept="image/*" className={fieldClass} onChange={onFileChange} type="file" />

        {fileUrl && (
          <div className="space-y-3">
            <div
              className="relative mx-auto aspect-square w-64 max-w-full touch-none overflow-hidden rounded-xl border border-line bg-board"
              onPointerCancel={endDrag}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                onLoad={onImageLoad}
                ref={imgRef}
                src={fileUrl}
              />
            </div>
            <label className="block text-sm font-semibold">
              Zoom
              <input
                className="mt-1 w-full"
                max={3}
                min={1}
                onChange={onScaleChange}
                step={0.01}
                type="range"
                value={scale}
              />
            </label>
            <button
              className="min-h-12 w-full rounded-xl bg-brass px-4 py-3 font-bold text-ink-on-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint"
              disabled={!natural || isUploading || isSubmittingPhoto}
              onClick={onSavePhoto}
              type="button"
            >
              {isUploading || isSubmittingPhoto ? "Saving…" : "Save photo"}
            </button>
          </div>
        )}

        {uploadError && <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick">{uploadError}</p>}
        <Feedback state={photoState} />

        {currentPhotoUrl && !fileUrl && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink-faint">Current photo</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`${displayName}'s current card photo`}
              className="h-32 w-32 rounded-xl border border-line object-cover"
              src={currentPhotoUrl}
            />
            <button
              className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold text-ink-dim hover:border-brick hover:text-brick disabled:text-ink-faint"
              disabled={removePending || isSubmittingPhoto}
              onClick={onRemovePhoto}
              type="button"
            >
              {removePending ? "Removing…" : "Remove photo"}
            </button>
            <Feedback state={removeState} />
          </div>
        )}
      </section>
    </div>
  );
}
