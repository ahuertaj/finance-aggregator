"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Acct = { id: string; isMonitored: boolean };

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
    <label className={`text-xs inline-flex items-center gap-1 ${busy ? "opacity-50" : ""}`}>
      <input
        type="checkbox"
        checked={account.isMonitored}
        onChange={(e) => patch({ isMonitored: e.target.checked })}
      />
      monitored
    </label>
  );
}
