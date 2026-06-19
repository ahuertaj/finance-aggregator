"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sync = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sync/${itemId}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Sync failed");
    setBusy(false);
    router.refresh();
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={sync}
        disabled={busy}
        className="rounded border px-2 py-1 text-xs disabled:opacity-50"
      >
        {busy ? "Syncing…" : "Sync"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

/** Generic DELETE button: calls `${endpoint}?id=${id}` then refreshes. */
export function DeleteButton({
  endpoint,
  id,
  label = "Delete",
  confirm: confirmMsg,
}: {
  endpoint: string;
  id: string;
  label?: string;
  confirm?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {label}
    </button>
  );
}

/**
 * Set/clear a custom display name for an account (PATCH displayName), then refreshes.
 * Uses a prompt — the card digits are appended automatically, so just type the name.
 */
export function RenameButton({ id, current }: { id: string; current: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    const next = window.prompt("Custom name (leave blank to clear and use the bank's name):", current);
    if (next === null) return; // cancelled
    setBusy(true);
    await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, displayName: next.trim() || null }),
    });
    setBusy(false);
    router.refresh();
  };
  return (
    <button onClick={onClick} disabled={busy} className="text-xs text-blue-600 hover:underline disabled:opacity-50">
      Rename
    </button>
  );
}

/**
 * Soft-remove / restore an account by PATCHing its isActive flag, then refreshes.
 * Used instead of DELETE for Plaid accounts so a later sync doesn't re-create them.
 */
export function SetActiveButton({
  id,
  active,
  label,
  confirm: confirmMsg,
  className = "text-xs text-red-600 hover:underline disabled:opacity-50",
}: {
  id: string;
  active: boolean;
  label: string;
  confirm?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, isActive: active }),
    });
    setBusy(false);
    router.refresh();
  };
  return (
    <button onClick={onClick} disabled={busy} className={className}>
      {label}
    </button>
  );
}

/** Toggle an account's hiddenFromDashboard flag (stays listed + syncing), then refreshes. */
export function HideButton({ id, hidden }: { id: string; hidden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, hiddenFromDashboard: !hidden }),
    });
    setBusy(false);
    router.refresh();
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="text-xs text-black/50 dark:text-white/50 hover:underline disabled:opacity-50"
    >
      {hidden ? "Show on dashboard" : "Hide from dashboard"}
    </button>
  );
}

/** Sync every connection in one click, then refreshes. */
export function SyncAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/sync", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setMsg(`Synced ${data.count ?? 0}; some failed`);
    router.refresh();
  };
  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={run}
        disabled={busy}
        className="rounded border px-2 py-1 text-xs disabled:opacity-50"
      >
        {busy ? "Syncing all…" : "Sync all"}
      </button>
      {msg && <span className="text-xs text-red-600">{msg}</span>}
    </span>
  );
}
