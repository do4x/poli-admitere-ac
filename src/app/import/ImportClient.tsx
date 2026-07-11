"use client";

import Link from "next/link";
import { useState, type DragEvent } from "react";
import {
  commitImport,
  dryRunImport,
  type CommitResult,
  type DryRunResult,
} from "./actions";

const ACTION_LABEL = {
  create: { text: "nouă", className: "bg-green-100 text-green-700" },
  update: { text: "se actualizează", className: "bg-orange-100 text-orange-700" },
  skip: { text: "neschimbată", className: "bg-surface text-muted" },
} as const;

export function ImportClient() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState<string | null>(null);
  const [preview, setPreview] = useState<DryRunResult | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function loadFile(file: File) {
    setBusy(true);
    setResult(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      setJsonText(text);
      setPreview(await dryRunImport(text));
    } catch (error) {
      setPreview({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) await loadFile(file);
  }

  async function handleConfirm() {
    if (!jsonText) return;
    setBusy(true);
    try {
      const committed = await commitImport(jsonText);
      setResult(committed);
      if (committed.ok) {
        setPreview(null);
        setJsonText(null);
        setFileName(null);
      }
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm transition-colors ${
          dragging
            ? "border-brand bg-brand-50 text-brand-700"
            : "border-line bg-card text-muted hover:border-brand/40"
        }`}
      >
        <span className="font-semibold text-ink">
          Trage un fișier JSON aici sau apasă pentru a alege
        </span>
        <span className="text-xs">formatul de import descris în claude.md</span>
        <input
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) await loadFile(file);
            event.target.value = "";
          }}
        />
      </label>

      {busy && <p className="text-sm text-muted">Se procesează…</p>}

      {preview && !preview.ok && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">{fileName}: fișier invalid</p>
          <p className="mt-1 whitespace-pre-wrap">{preview.error}</p>
        </div>
      )}

      {preview && preview.ok && (
        <div className="card space-y-3 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">{preview.examLabel}</h2>
            <span className="text-xs text-muted">
              {preview.examExists ? "examen existent" : "examen nou"}
            </span>
          </div>
          <p className="text-sm text-muted">
            {preview.counts.created} de creat, {preview.counts.updated} de
            actualizat, {preview.counts.skipped} neschimbate — nimic nu a fost
            scris încă.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <th className="py-1.5 pr-3">Nr.</th>
                <th className="py-1.5 pr-3">Departajare</th>
                <th className="py-1.5">Acțiune</th>
              </tr>
            </thead>
            <tbody>
              {preview.problems.map((problem) => {
                const label = ACTION_LABEL[problem.action];
                return (
                  <tr
                    key={problem.number}
                    className="border-b border-line/60 last:border-0"
                  >
                    <td className="py-1.5 pr-3 font-medium">{problem.number}</td>
                    <td className="py-1.5 pr-3">
                      {problem.departajareChange ? (
                        <span
                          className="rounded-full border border-rose-400 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"
                          title="Fișierul suprascrie starea setată în aplicație"
                        >
                          {problem.departajareChange.from ? "da" : "nu"} →{" "}
                          {problem.departajareChange.to ? "da" : "nu"}
                        </span>
                      ) : problem.isDepartajare ? (
                        <span className="rounded-full border border-amber-500 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          da
                        </span>
                      ) : (
                        <span className="text-faint">nu</span>
                      )}
                    </td>
                    <td className="py-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${label.className}`}
                      >
                        {label.text}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            Importă
          </button>
        </div>
      )}

      {result && !result.ok && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Import eșuat: {result.error}
        </div>
      )}

      {result && result.ok && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Import reușit: {result.counts.created} create,{" "}
          {result.counts.updated} actualizate, {result.counts.skipped} sărite.{" "}
          <Link href={`/exams/${result.examId}`} className="font-medium underline">
            Vezi examenul →
          </Link>
        </div>
      )}
    </div>
  );
}
