"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const ENTITIES = ["personal", "business"];
const RAILS = ["", "visa", "mastercard", "amex", "discover", "ach", "wire", "internal", "other"];

type Acct = { id: string; entity: string; rail: string | null; isMonitored: boolean };

export function AccountEditor({ account }: { account: Acct }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const patch = async (data: Record<string, unknown>) => {
    setBusy(true);
    await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: account.id, ...data }),
    });
    setBusy(false);
    router.refresh();
  };

  return (
    <span className={`inline-flex items-center gap-2 ${busy ? "opacity-50" : ""}`}>
      <select
        className="border rounded px-1 py-0.5 text-xs bg-transparent"
        value={account.entity}
        onChange={(e) => patch({ entity: e.target.value })}
      >
        {ENTITIES.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <select
        className="border rounded px-1 py-0.5 text-xs bg-transparent"
        value={account.rail ?? ""}
        onChange={(e) => patch({ rail: e.target.value || null })}
      >
        {RAILS.map((x) => (
          <option key={x} value={x}>
            {x || "rail…"}
          </option>
        ))}
      </select>
      <label className="text-xs inline-flex items-center gap-1">
        <input
          type="checkbox"
          checked={account.isMonitored}
          onChange={(e) => patch({ isMonitored: e.target.checked })}
        />
        monitored
      </label>
    </span>
  );
}
