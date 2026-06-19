"use client";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useRouter } from "next/navigation";

type Player = { id: number; label: string; name: string };

/**
 * Mounts the Plaid Link hook only when a token exists, so the link-initialize.js
 * script is embedded once at most. Rendering usePlaidLink unconditionally in
 * multiple components (or under dev Strict Mode) embeds it more than once.
 */
function PlaidLauncher({
  token,
  onSuccess,
}: {
  token: string;
  onSuccess: (publicToken: string) => void;
}) {
  const { open, ready } = usePlaidLink({ token, onSuccess });
  useEffect(() => {
    if (ready) open();
  }, [ready, open]);
  return null;
}

/** Connect a new institution (credential set) and tag it with a player + entity. */
export function LinkAccount({ players }: { players: Player[] }) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState<number>(players[0]?.id ?? 0);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSuccess = useCallback(
    async (publicToken: string) => {
      setBusy(true);
      const res = await fetch("/api/plaid/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicToken, playerId, entity: "personal" }),
      });
      if (!res.ok) setError("Failed to save connection");
      setLinkToken(null);
      setBusy(false);
      router.refresh();
    },
    [playerId, router],
  );

  const start = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/plaid/link-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.linkToken) setLinkToken(data.linkToken);
    else setError(data.error ? "Plaid not configured (check .env keys)" : "Failed to start");
    setBusy(false);
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      {linkToken && <PlaidLauncher token={linkToken} onSuccess={onSuccess} />}
      <label className="text-sm">
        Player
        <select
          className="block border rounded px-2 py-1 bg-transparent"
          value={playerId}
          onChange={(e) => setPlayerId(Number(e.target.value))}
        >
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} — {p.name}
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={start}
        disabled={busy}
        className="rounded bg-foreground text-background px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {busy ? "…" : "+ Connect institution"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}

/** Re-authenticate an existing connection via Plaid Link update mode. */
export function Reauth({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);

  const onSuccess = useCallback(async () => {
    setLinkToken(null);
    await fetch(`/api/sync/${itemId}`, { method: "POST" });
    router.refresh();
  }, [itemId, router]);

  const start = async () => {
    const res = await fetch("/api/plaid/link-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.linkToken) setLinkToken(data.linkToken);
  };

  return (
    <>
      {linkToken && <PlaidLauncher token={linkToken} onSuccess={onSuccess} />}
      <button onClick={start} className="rounded border px-2 py-1 text-xs">
        Reconnect
      </button>
    </>
  );
}
