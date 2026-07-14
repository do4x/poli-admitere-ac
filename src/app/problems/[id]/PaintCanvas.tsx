"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { uploadSolution, type UploadState } from "./actions";

const initialState: UploadState = { error: null, uploadedAt: null };
const COLORS = ["#111827", "#2563eb", "#dc2626"]; // cerneală, albastru, roșu
const SIZES = [2, 4, 8];
// Fixed backing resolution; the canvas is displayed responsively via CSS.
const W = 1000;
const H = 700;

/** Decode a data: URL to a File synchronously (stays inside the click event). */
function dataUrlToFile(dataUrl: string, name: string): File {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: mime });
}

/**
 * Web-only drawing pad: draw the solution, then upload it as a PNG through the
 * same server action as file/photo uploads. Hidden on mobile (md:block) — there
 * you take a photo instead.
 */
export function PaintCanvas({ problemId }: { problemId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [eraser, setEraser] = useState(false);
  const [aiAssisted, setAiAssisted] = useState(false);
  const [state, formAction, pending] = useActionState(
    uploadSolution.bind(null, problemId),
    initialState,
  );

  function clear() {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
  }

  // White "paper" on mount, and reset the board after a successful upload.
  useEffect(clear, []);
  useEffect(() => {
    if (state.uploadedAt && !state.error) clear();
  }, [state.uploadedAt, state.error]);

  function pointFrom(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    drawing.current = true;
    last.current = pointFrom(e);
    // Capture keeps strokes going if the pointer leaves the canvas; harmless if it fails.
    try {
      canvasRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // some pointer types / synthetic events can't be captured
    }
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pointFrom(e);
    ctx.strokeStyle = eraser ? "#ffffff" : color;
    ctx.lineWidth = eraser ? size * 6 : size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }
  function onUp() {
    drawing.current = false;
    last.current = null;
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas || pending) return;
    const file = dataUrlToFile(canvas.toDataURL("image/png"), "desen.png");
    const fd = new FormData();
    fd.append("file", file);
    if (aiAssisted) fd.append("aiAssisted", "on");
    formAction(fd);
  }

  return (
    <section className="card hidden space-y-3 p-4 md:block">
      <h2 className="text-sm font-semibold text-ink">
        Desenează soluția (doar pe web)
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setColor(c);
              setEraser(false);
            }}
            aria-label={`Culoare ${c}`}
            className={`h-7 w-7 rounded-full border-2 ${
              !eraser && color === c ? "border-ink" : "border-line"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <button
          type="button"
          onClick={() => setEraser(true)}
          className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
            eraser ? "border-ink text-ink" : "border-line text-muted"
          }`}
        >
          Radieră
        </button>
        <span className="mx-1 h-5 w-px bg-line" />
        {SIZES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSize(s)}
            aria-label={`Grosime ${s}`}
            className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
              size === s ? "border-ink" : "border-line"
            }`}
          >
            <span
              className="rounded-full bg-ink"
              style={{ width: s + 2, height: s + 2 }}
            />
          </button>
        ))}
        <button
          type="button"
          onClick={clear}
          className="ml-auto rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:text-ink"
        >
          Șterge tot
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        style={{ aspectRatio: `${W} / ${H}` }}
        className="w-full touch-none rounded-xl border border-line bg-white"
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={aiAssisted}
          onChange={(e) => setAiAssisted(e.target.checked)}
          className="h-4 w-4 accent-brand"
        />
        Am rezolvat cu ajutorul AI
      </label>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "Se încarcă…" : "Încarcă desenul"}
      </button>
      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}
      {state.uploadedAt !== null && !state.error && (
        <p className="text-sm text-green-700">Desen încărcat.</p>
      )}
    </section>
  );
}
