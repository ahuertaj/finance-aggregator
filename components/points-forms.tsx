"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Player = { id: number; label: string };
const inputCls = "border rounded px-2 py-1 text-sm bg-transparent";

async function post(body: unknown) {
  await fetch("/api/points", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function AddProgram({ players }: { players: Player[] }) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState(players[0]?.id ?? 0);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await post({ kind: "program", playerId, name });
    setBusy(false);
    setName("");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <select className={inputCls} value={playerId} onChange={(e) => setPlayerId(Number(e.target.value))}>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <input
        className={inputCls}
        placeholder="program (e.g. Amex MR)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <button disabled={busy} className="rounded bg-foreground text-background px-3 py-1.5 text-sm disabled:opacity-50">
        + Program
      </button>
    </form>
  );
}

/** Inline updater for a program's balance and valuation. */
export function ProgramUpdater({ programId }: { programId: string }) {
  const router = useRouter();
  const [balance, setBalance] = useState("");
  const [cpp, setCpp] = useState("");
  const [busy, setBusy] = useState(false);

  const saveBalance = async () => {
    if (!balance) return;
    setBusy(true);
    await post({ kind: "balance", programId, balance });
    setBusy(false);
    setBalance("");
    router.refresh();
  };
  const saveValuation = async () => {
    if (!cpp) return;
    setBusy(true);
    await post({ kind: "valuation", programId, centsPerPoint: cpp });
    setBusy(false);
    setCpp("");
    router.refresh();
  };

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${busy ? "opacity-50" : ""}`}>
      <input
        className={`${inputCls} w-28`}
        type="number"
        step="1"
        placeholder="balance"
        value={balance}
        onChange={(e) => setBalance(e.target.value)}
      />
      <button onClick={saveBalance} className="rounded border px-2 py-1 text-xs">
        set balance
      </button>
      <input
        className={`${inputCls} w-24`}
        type="number"
        step="0.01"
        placeholder="¢/pt"
        value={cpp}
        onChange={(e) => setCpp(e.target.value)}
      />
      <button onClick={saveValuation} className="rounded border px-2 py-1 text-xs">
        set value
      </button>
    </span>
  );
}
