"use client";

import { useState } from "react";
import { EMAIL_MAX_LENGTH } from "@/lib/validations/email";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/api-client";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/Toast";
import { createAgentSchema, updateAgentSchema } from "../../validations/agent.schema";
import { errorMessage } from "../../hooks/use-admin-agents";
import { fieldCls } from "../shared";

export interface EditableAgent {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** When set the modal edits this agent; otherwise it creates a new one. */
  agent?: EditableAgent | null;
  onSaved?: () => void;
}

export function AgentFormModal({ open, onClose, agent, onSaved }: Props) {
  if (!open) return null;
  // Keyed remount resets the form state each time the modal opens for a different agent.
  return <Form key={agent?.id ?? "new"} onClose={onClose} agent={agent} onSaved={onSaved} />;
}

function Form({ onClose, agent, onSaved }: Omit<Props, "open">) {
  const qc = useQueryClient();
  const editing = Boolean(agent);
  const [name, setName] = useState(agent?.name ?? "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(agent?.phone ?? "");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState(agent?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    let payload: Record<string, unknown>;
    if (editing) {
      // Only send what actually changed.
      payload = {};
      if (name.trim() !== agent!.name) payload.name = name.trim();
      if ((phone.trim() || null) !== (agent!.phone ?? null)) payload.phone = phone.trim() || null;
      if ((notes.trim() || null) !== (agent!.notes ?? null)) payload.notes = notes.trim() || null;
      if (password) payload.password = password;
      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }
    } else {
      payload = { name, email, phone: phone || undefined, password, notes: notes || undefined };
    }

    const parsed = (editing ? updateAgentSchema : createAgentSchema).safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? "form")] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});

    setBusy(true);
    try {
      if (editing) await apiClient.put(`/api/admin/agents/${agent!.id}`, parsed.data);
      else await apiClient.post("/api/admin/agents", parsed.data);
      toast.success(editing ? "Sales Partner updated" : "Sales Partner created");
      await qc.invalidateQueries({ queryKey: ["agents-admin"] });
      onSaved?.();
      onClose();
    } catch (err) {
      setBanner(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const err = (k: string) => errors[k] && <span className="font-normal text-red-600">{errors[k]}</span>;

  return (
    <Modal open onClose={onClose} title={editing ? "Edit Sales Partner" : "Create Sales Partner"} description={editing ? undefined : "The Sales Partner ID and referral code are generated automatically."}>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        {banner && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{banner}</p>}
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Full name
          <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} />
          {err("name")}
        </label>
        {!editing && (
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            Email (used to sign in)
            <input className={fieldCls} type="email" maxLength={EMAIL_MAX_LENGTH} value={email} onChange={(e) => setEmail(e.target.value)} />
            {err("email")}
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Phone (optional)
          <input className={fieldCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
          {err("phone")}
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          {editing ? "Reset password (leave blank to keep)" : "Temporary password"}
          <input className={fieldCls} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {err("password")}
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Internal notes (optional)
          <textarea className={`${fieldCls} h-20 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          {err("notes")}
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-neutral-200 px-4 text-sm font-medium hover:bg-neutral-50">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Create Sales Partner"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
