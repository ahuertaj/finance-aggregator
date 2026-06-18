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
