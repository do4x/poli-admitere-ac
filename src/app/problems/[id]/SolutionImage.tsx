"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SolutionImageProps {
  src: string;
  alt: string;
  /** Inline preview height cap. Wider surfaces (/revizuire) pass a taller one. */
  heightClass?: string;
}

/**
 * Inline solution photo that opens a full-screen lightbox on click. Many
 * uploads are phone screenshots — unreadable at card width — so the lightbox
 * supports zoom (click a spot / wheel / pinch on trackpads via wheel) and
 * drag-to-pan. No dependencies; Escape or backdrop closes.
 */
export function SolutionImage({
  src,
  alt,
  heightClass = "max-h-[36rem]",
}: SolutionImageProps) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  );
  const moved = useRef(false);

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    // Lock the page scroll while the lightbox is up.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  const zoomAt = (clientX: number, clientY: number, nextScale: number) => {
    const clamped = Math.min(6, Math.max(1, nextScale));
    if (clamped === 1) {
      reset();
      return;
    }
    // Keep the point under the cursor fixed while the scale changes.
    const cx = clientX - window.innerWidth / 2;
    const cy = clientY - window.innerHeight / 2;
    const ratio = clamped / scale;
    setTx(cx - ratio * (cx - tx));
    setTy(cy - ratio * (cy - ty));
    setScale(clamped);
  };

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived Storage URL behind a redirect; next/image can't cache it */}
      <img
        src={src}
        alt={alt}
        onClick={() => setOpen(true)}
        className={`${heightClass} w-full cursor-zoom-in rounded-xl border border-line object-contain`}
      />
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/85"
          onClick={() => {
            if (!moved.current) close();
          }}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              close();
            }}
            aria-label="Închide"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg font-bold text-white transition-colors hover:bg-white/30"
          >
            ×
          </button>
          <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white/80">
            click = zoom · scroll = apropie/departează · trage = mută
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- same signed URL as the inline preview */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            onClick={(event) => {
              event.stopPropagation();
              if (moved.current) return;
              zoomAt(event.clientX, event.clientY, scale === 1 ? 2.5 : 1);
            }}
            onWheel={(event) => {
              zoomAt(
                event.clientX,
                event.clientY,
                scale * (event.deltaY < 0 ? 1.2 : 1 / 1.2),
              );
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              moved.current = false;
              drag.current = { x: event.clientX, y: event.clientY, tx, ty };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              const dx = event.clientX - drag.current.x;
              const dy = event.clientY - drag.current.y;
              if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
              if (scale > 1) {
                setTx(drag.current.tx + dx);
                setTy(drag.current.ty + dy);
              }
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            style={{
              transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
              cursor: scale > 1 ? "grab" : "zoom-in",
              touchAction: "none",
            }}
            className="max-h-[92vh] max-w-[94vw] select-none object-contain transition-transform duration-75"
          />
        </div>
      )}
    </>
  );
}
