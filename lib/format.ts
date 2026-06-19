export function money(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

/** Strip ®/™/℠ marks and collapse whitespace from an institution or account name. */
export function cleanName(s: string | null | undefined): string {
  return (s ?? "").replace(/[®™℠]/g, "").replace(/\s{2,}/g, " ").trim();
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function daysUntil(d: Date | string): number {
  const date = typeof d === "string" ? new Date(d) : d;
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}
