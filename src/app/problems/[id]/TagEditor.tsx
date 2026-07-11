"use client";

import { useActionState, useState } from "react";
import {
  addTagAction,
  createTagAction,
  removeTagFromProblem,
  type TagActionState,
} from "./actions";

interface Tag {
  id: string;
  name: string;
}

interface TagEditorProps {
  problemId: string;
  tags: Tag[];
  available: Tag[];
}

const INITIAL: TagActionState = { error: null };
const CONTROL =
  "rounded-lg border border-line bg-card px-2.5 py-1 text-sm shadow-soft focus:border-brand";

export function TagEditor({ problemId, tags, available }: TagEditorProps) {
  const [open, setOpen] = useState(false);
  const [addState, addAction] = useActionState(
    addTagAction.bind(null, problemId),
    INITIAL,
  );
  const [createState, createAction] = useActionState(
    createTagAction.bind(null, problemId),
    INITIAL,
  );

  const atCap = tags.length >= 3;
  const error = addState.error ?? createState.error;

  // Curation tooling, collapsed by default; admin-only once auth exists.
  if (!open) {
    return (
      <div className="text-right">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-faint underline-offset-2 hover:text-ink hover:underline"
        >
          Gestionare tipuri (administrare)
        </button>
      </div>
    );
  }

  return (
    <div className="card space-y-2.5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          Tipuri (administrare)
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto text-xs text-faint hover:text-ink"
          aria-label="Închide gestionarea tipurilor"
        >
          închide ×
        </button>
        {tags.length === 0 && (
          <span className="text-xs text-faint">neclasificat</span>
        )}
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700"
          >
            {tag.name}
            <form action={removeTagFromProblem.bind(null, problemId, tag.id)}>
              <button
                type="submit"
                className="text-brand/60 hover:text-brand-700"
                title={`Scoate „${tag.name}”`}
                aria-label={`Scoate ${tag.name}`}
              >
                ×
              </button>
            </form>
          </span>
        ))}
      </div>

      {!atCap && (
        <div className="flex flex-wrap items-center gap-3">
          {available.length > 0 && (
            <form action={addAction} className="flex items-center gap-1">
              <select name="tagId" defaultValue="" className={CONTROL}>
                <option value="" disabled>
                  Alege tip…
                </option>
                {available.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg border border-line px-2.5 py-1 text-sm font-semibold text-muted transition-colors hover:bg-surface hover:text-ink"
              >
                Adaugă
              </button>
            </form>
          )}
          <form action={createAction} className="flex items-center gap-1">
            <input name="name" type="text" maxLength={60} placeholder="Tip nou" className={CONTROL} />
            <button
              type="submit"
              className="rounded-lg bg-brand px-2.5 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Creează
            </button>
          </form>
        </div>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
