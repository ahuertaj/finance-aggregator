"use client";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useRouter } from "next/navigation";

type Player = { id: number; label: string; name: string };

const ENTITIES = ["personal", "business"];

/** Connect a new institution (credential set) and tag it with a player + entity. */
export function LinkAccount({ players }: { players: Player[] }) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState<number>(players[0]?.id ?? 0);
  const [entity, setEntity] = useState("personal");
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSuccess = useCallback(
    async (publicToken: string) => {
      setBusy(true);
      const res = await fetch("/api/plaid/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicToken, playerId, entity }),
      });
      if (!res.ok) setError("Failed to save connection");
      setLinkToken(null);
      setBusy(false);
      router.refresh();
    },
    [playerId, entity, router],
  );

  const { open, ready } = usePlaidLink({ token: linkToken ?? "", onSuccess });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

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
      <label className="text-sm">
        Entity
        <select
          className="block border rounded px-2 py-1 bg-transparent"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
        >
          {ENTITIES.map((x) => (
            <option key={x} value={x}>
              {x}
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

  const { open, ready } = usePlaidLink({ token: linkToken ?? "", onSuccess });
  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

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
    <button onClick={start} className="rounded border px-2 py-1 text-xs">
      Re-authenticate
    </button>
  );
}
