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
const SUBJECTS: { key: "MATE" | "INFO"; label: string; dot: string }[] = [
  { key: "MATE", label: "Matematică", dot: "bg-blue-500" },
  { key: "INFO", label: "Informatică", dot: "bg-violet-500" },
];

const INPUT =
  "rounded-lg border border-line bg-card px-2.5 py-1 text-sm shadow-soft focus:border-brand";
const BTN =
  "rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface hover:text-ink";

function TagRow({ tag }: { tag: ManagedTag }) {
  const [state, action] = useActionState(renameTag.bind(null, tag.id), INITIAL);
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5">
      <form action={action} className="flex items-center gap-1">
        <input
          name="name"
          defaultValue={tag.name}
          maxLength={60}
          className={`w-44 ${INPUT}`}
          aria-label={`Redenumește ${tag.name}`}
        />
        <button type="submit" className={BTN}>
          Redenumește
        </button>
      </form>
      <span className="text-xs text-faint tabular-nums">{tag.count} probleme</span>

      {confirming && tag.count > 0 ? (
        <span className="flex items-center gap-2 text-xs text-rose-600">
          {tag.count} probleme își pierd eticheta.
          <form action={deleteTag.bind(null, tag.id)}>
            <button
              type="submit"
              className="rounded-lg border border-rose-500 px-2.5 py-1 font-semibold text-rose-600 hover:bg-rose-50"
            >
              Confirmă
            </button>
          </form>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-muted hover:text-ink"
          >
            Renunță
          </button>
        </span>
      ) : tag.count === 0 ? (
        <form action={deleteTag.bind(null, tag.id)}>
          <button
            type="submit"
            className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-faint hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
          >
            Șterge
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-faint hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
        >
          Șterge
        </button>
      )}

      {state.error && <span className="text-xs text-rose-600">{state.error}</span>}
    </li>
  );
}

function CreateForm({ subject }: { subject: "MATE" | "INFO" }) {
  const [state, action] = useActionState(createTag, INITIAL);
  return (
    <form action={action} className="mt-2 flex items-center gap-1">
      <input type="hidden" name="subject" value={subject} />
      <input name="name" maxLength={60} placeholder="Tip nou" className={`w-44 ${INPUT}`} />
      <button
        type="submit"
        className="rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Adaugă tip
      </button>
      {state.error && <span className="text-xs text-rose-600">{state.error}</span>}
    </form>
  );
}

export function TaxonomyManager({ tags }: { tags: ManagedTag[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-muted transition-colors hover:bg-surface"
      >
        Gestionare tipuri
        <span className="text-faint">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="grid gap-6 border-t border-line p-4 sm:grid-cols-2">
          {SUBJECTS.map(({ key, label, dot }) => (
            <div key={key}>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-faint">
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                {label}
              </h3>
              <ul className="divide-y divide-line">
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
