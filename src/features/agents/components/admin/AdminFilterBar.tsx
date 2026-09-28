"use client";

import { useState } from "react";
import { useAgentOptions } from "../../hooks/use-admin-agents";
import { fieldCls } from "../shared";

export interface FilterField {
  name: string;
  label: string;
  type: "text" | "date" | "select" | "agent";
  options?: { value: string; label: string }[];
}

interface Props {
  fields: FilterField[];
  values: Record<string, string>;
  onApply: (values: Record<string, string>) => void;
}

/** Filters are staged locally and only applied on submit, so typing never fires a request per keystroke. */
export function AdminFilterBar({ fields, values, onApply }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>(values);
  const { data: agents } = useAgentOptions();

  const set = (name: string, value: string) => setDraft((d) => ({ ...d, [name]: value }));

  return (
    <form
      className="flex flex-wrap items-end gap-3 px-4 py-3 sm:px-5"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
      }}
    >
      {fields.map((f) => (
        <label key={f.name} className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs font-medium text-neutral-600 sm:flex-none">
          {f.label}
          {f.type === "select" || f.type === "agent" ? (
            <select className={fieldCls} value={draft[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}>
              <option value="">All</option>
              {f.type === "agent"
                ? agents?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.agentCode ? ` (${a.agentCode})` : ""}
                    </option>
                  ))
                : f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
            </select>
          ) : (
            <input
              className={fieldCls}
              type={f.type}
              value={draft[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
            />
          )}
        </label>
      ))}
      <div className="flex gap-2">
        <button type="submit" className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800">
          Apply
        </button>
        <button
          type="button"
          className="h-10 rounded-xl border border-neutral-200 px-4 text-sm font-medium hover:bg-neutral-50"
          onClick={() => {
            setDraft({});
            onApply({});
          }}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
