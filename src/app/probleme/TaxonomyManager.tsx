"use client";

import { useActionState, useState } from "react";
import {
  createTag,
  deleteTag,
  renameTag,
  type TaxonomyActionState,
} from "./actions";

export interface ManagedTag {
  id: string;
  name: string;
  subject: "MATE" | "INFO";
  count: number;
}

const INITIAL: TaxonomyActionState = { error: null };
const SUBJECTS: { key: "MATE" | "INFO"; label: string }[] = [
  { key: "MATE", label: "Matematică" },
  { key: "INFO", label: "Informatică" },
];

function TagRow({ tag }: { tag: ManagedTag }) {
  const [state, action] = useActionState(
    renameTag.bind(null, tag.id),
    INITIAL,
  );
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-wrap items-center gap-2 py-1">
      <form action={action} className="flex items-center gap-1">
        <input
          name="name"
          defaultValue={tag.name}
          maxLength={60}
          className="w-44 rounded border border-stone-300 px-2 py-0.5 text-sm"
          aria-label={`Redenumește ${tag.name}`}
        />
        <button
          type="submit"
          className="rounded border border-stone-300 px-2 py-0.5 text-xs font-semibold text-stone-600 hover:bg-stone-100"
        >
          Redenumește
        </button>
      </form>
      <span className="text-xs text-stone-400">{tag.count} probleme</span>

      {confirming && tag.count > 0 ? (
        <span className="flex items-center gap-2 text-xs text-red-600">
          {tag.count} probleme își pierd eticheta.
          <form action={deleteTag.bind(null, tag.id)}>
            <button
              type="submit"
              className="rounded border border-red-500 px-2 py-0.5 font-semibold text-red-600 hover:bg-red-50"
            >
              Confirmă
            </button>
          </form>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-stone-500 hover:text-stone-800"
          >
            Renunță
          </button>
        </span>
      ) : tag.count === 0 ? (
        <form action={deleteTag.bind(null, tag.id)}>
          <button
            type="submit"
            className="rounded border border-stone-300 px-2 py-0.5 text-xs font-semibold text-stone-400 hover:bg-red-50 hover:text-red-600"
          >
            Șterge
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded border border-stone-300 px-2 py-0.5 text-xs font-semibold text-stone-400 hover:bg-red-50 hover:text-red-600"
        >
          Șterge
        </button>
      )}

      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </li>
  );
}

function CreateForm({ subject }: { subject: "MATE" | "INFO" }) {
  const [state, action] = useActionState(createTag, INITIAL);
  return (
    <form action={action} className="mt-2 flex items-center gap-1">
      <input type="hidden" name="subject" value={subject} />
      <input
        name="name"
        maxLength={60}
        placeholder="Tip nou"
        className="w-44 rounded border border-stone-300 px-2 py-0.5 text-sm"
      />
      <button
        type="submit"
        className="rounded border border-stone-300 px-2 py-0.5 text-xs font-semibold text-stone-600 hover:bg-stone-100"
      >
        Adaugă tip
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

export function TaxonomyManager({ tags }: { tags: ManagedTag[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded border border-stone-300 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50"
      >
        Gestionare tipuri
        <span className="text-stone-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="grid gap-6 border-t border-stone-200 p-3 sm:grid-cols-2">
          {SUBJECTS.map(({ key, label }) => (
            <div key={key}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
                {label}
              </h3>
              <ul className="divide-y divide-stone-100">
                {tags
                  .filter((t) => t.subject === key)
                  .map((tag) => (
                    <TagRow key={tag.id} tag={tag} />
                  ))}
              </ul>
              <CreateForm subject={key} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
