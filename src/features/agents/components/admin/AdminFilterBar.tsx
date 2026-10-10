"use client";

import { useState, useEffect } from "react";
import { useAgentOptions } from "../../hooks/use-admin-agents";
import { fieldCls } from "../shared";
import { Select } from "@/components/ui/select";

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

  useEffect(() => {
    setDraft(values);
  }, [values]);

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
        <div key={f.name} className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-medium text-neutral-600 sm:flex-none">
          <span>{f.label}</span>
          {f.type === "select" || f.type === "agent" ? (
            <div className="w-52">
              <Select
                className="h-10 rounded-xl"
                value={draft[f.name] ?? ""}
                onValueChange={(val) => set(f.name, val)}
                searchable={f.type === "agent"}
                portal={true}
                options={[
                  { value: "", label: "All" },
                  ...(f.type === "agent"
                    ? (agents ?? []).map((a) => ({
                        value: a.id,
                        label: `${a.name}${a.agentCode ? ` (${a.agentCode})` : ""}`,
                      }))
                    : (f.options ?? [])),
                ]}
                aria-label={f.label}
              />
            </div>
          ) : (
            <input
              className={fieldCls}
              type={f.type}
              value={draft[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
            />
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <button type="submit" className="h-10 rounded-xl bg-gradient-to-b from-[var(--color-primary-400)] to-[var(--color-primary-600)] shadow-[0_6px_16px_-6px_rgba(37,99,235,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all px-4 text-sm font-semibold text-white hover:-translate-y-px hover:shadow-[0_10px_20px_-8px_rgba(37,99,235,0.5),inset_0_1px_0_rgba(255,255,255,0.18)] active:translate-y-0">
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
