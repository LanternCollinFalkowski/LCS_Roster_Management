import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { attentionHours } from "./settings.js";
import { cutoff, serializeTenant, type TenantDTO } from "./roster.js";
import { sitesInScope, type ScopedSite } from "./siteScope.js";

export type RosterStatus = "active" | "attention" | "archived";

const SITE_SELECT = { id: true, code: true, name: true, attentionHours: true } as const;
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
export const ROSTER_CAP = 5000;

/**
 * The roster as a screen (or an export) sees it: the caller's selected sites,
 * one status tab, an optional search. Shared by the list endpoint and every
 * export format so a download always matches what was on screen.
 */
export async function loadRoster(
  req: Request,
  opts: { site?: unknown; status?: unknown; q?: unknown }
): Promise<{ sites: ScopedSite[]; status: RosterStatus; q: string; items: TenantDTO[]; hours: number; truncated: boolean }> {
  const sites = await sitesInScope(req, opts.site);
  const status: RosterStatus = opts.status === "archived" || opts.status === "attention" ? opts.status : "active";
  const q = typeof opts.q === "string" ? opts.q.trim() : "";
  const hours = await attentionHours();

  const where: Prisma.TenantWhereInput = {
    siteId: { in: sites.map((s) => s.id) },
    status: status === "archived" ? "archived" : "active",
  };
  const and: Prisma.TenantWhereInput[] = [];
  if (status === "attention") {
    // Per-site thresholds, so one clause per site.
    and.push({ OR: sites.map((s) => ({ siteId: s.id, attentionClockAt: { lt: cutoff(s.attentionHours ?? hours) } })) });
  }
  if (q) {
    and.push({
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { preferredName: { contains: q } },
        { unit: { contains: q } },
        ...(sites.length > 1 ? [{ site: { name: { contains: q } } }] : []),
      ],
    });
  }
  if (and.length) where.AND = and;

  const rows = await prisma.tenant.findMany({
    where,
    include: { site: { select: SITE_SELECT } },
    orderBy: status === "archived" ? { archivedAt: "desc" } : undefined,
    take: ROSTER_CAP,
  });
  const items = rows.map((t) => serializeTenant(t, hours));
  if (status !== "archived") {
    items.sort(
      (a, b) =>
        collator.compare(a.site?.name ?? "", b.site?.name ?? "") ||
        collator.compare(a.unit ?? "~", b.unit ?? "~") ||
        collator.compare(a.displayName, b.displayName)
    );
  }
  return { sites, status, q, items, hours, truncated: rows.length === ROSTER_CAP };
}
