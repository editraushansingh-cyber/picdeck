import Link from "next/link";
import type { ModuleKey, PlanTier } from "@/lib/modules";
import { MODULE_LABELS, TIER_LABELS, UPGRADE_TIER } from "@/lib/modules";

/** Shown instead of a module page when the studio's plan does not include it. */
export function PlanGate({ module, tier }: { module: ModuleKey; tier: PlanTier }) {
  const needed = UPGRADE_TIER[module];
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">Locked</p>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">{MODULE_LABELS[module]}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        {needed === "free"
          ? "This module is included in every plan. Check your subscription below."
          : `${MODULE_LABELS[module]} is part of the ${TIER_LABELS[needed]} plan or the All-Access bundle. You are currently on ${TIER_LABELS[tier]}.`}
      </p>
      <Link
        href="/plans"
        className="mt-6 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand/90"
      >
        See plans
      </Link>
    </div>
  );
}

/** Small header block reused across the module pages. */
export function ModuleHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
