"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountDisplay } from "@/lib/format";

type Player = { id: number; label: string };
type AcctOpt = { id: string; name: string; displayName?: string | null; mask?: string | null; playerId: number };

const inputCls = "border rounded px-2 py-1 text-sm bg-transparent";

export function ManualTxnForm({ players, accounts }: { players: Player[]; accounts: AcctOpt[] }) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState(players[0]?.id ?? 0);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/manual", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId,
        accountId: accountId || null,
        amount,
        date,
        description,
      }),
    });
    setBusy(false);
    setAmount("");
    setDescription("");
    router.refresh();
  };

  const playerAccounts = accounts.filter((a) => a.playerId === playerId);

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <select className={inputCls} value={playerId} onChange={(e) => setPlayerId(Number(e.target.value))}>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        <option value="">(no account)</option>
        {playerAccounts.map((a) => (
          <option key={a.id} value={a.id}>
            {accountDisplay(a)}
          </option>
        ))}
      </select>
      <input
        className={inputCls}
        type="number"
        step="0.01"
        placeholder="amount (+/-)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      <input
        className={inputCls}
        placeholder="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <button
        disabled={busy}
        className="rounded bg-foreground text-background px-3 py-1.5 text-sm disabled:opacity-50"
      >
        Add entry
      </button>
    </form>
  );
}

export function ManualAccountForm({ players }: { players: Player[] }) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState(players[0]?.id ?? 0);
  const [name, setName] = useState("");
  const [isMonitored, setIsMonitored] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId, name, isMonitored }),
    });
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
        placeholder="account name (e.g. Wise, Cash)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <label className="text-sm inline-flex items-center gap-1">
        <input type="checkbox" checked={isMonitored} onChange={(e) => setIsMonitored(e.target.checked)} />
        monitored
      </label>
      <button
        disabled={busy}
        className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
      >
        + Manual account
      </button>
    </form>
  );
}
