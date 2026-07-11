"use client";

import { useActionState } from "react";
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
  /** Tags of the problem's subject that are not already attached. */
  available: Tag[];
}

const INITIAL: TagActionState = { error: null };

export function TagEditor({ problemId, tags, available }: TagEditorProps) {
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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Tipuri
        </span>
        {tags.length === 0 && (
          <span className="text-xs text-stone-400">neclasificat</span>
        )}
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded border border-amber-600 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"
          >
            {tag.name}
            <form action={removeTagFromProblem.bind(null, problemId, tag.id)}>
              <button
                type="submit"
                className="text-amber-600 hover:text-amber-900"
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
              <select
                name="tagId"
                defaultValue=""
                className="rounded border border-stone-300 px-2 py-1 text-sm"
              >
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
                className="rounded border border-stone-300 px-2 py-1 text-sm font-semibold text-stone-600 hover:bg-stone-100"
              >
                Adaugă
              </button>
            </form>
          )}
          <form action={createAction} className="flex items-center gap-1">
            <input
              name="name"
              type="text"
              maxLength={60}
              placeholder="Tip nou"
              className="rounded border border-stone-300 px-2 py-1 text-sm"
            />
            <button
              type="submit"
              className="rounded border border-stone-300 px-2 py-1 text-sm font-semibold text-stone-600 hover:bg-stone-100"
            >
              Creează
            </button>
          </form>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
