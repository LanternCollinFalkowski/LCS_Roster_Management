import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../http.js";
import { requireAuth, requirePermission } from "../auth/middleware.js";
import { attentionHours } from "../services/settings.js";
import { cutoff } from "../services/roster.js";
import { sitesInScope } from "../services/siteScope.js";

export const activityRouter = Router();
activityRouter.use(requireAuth);

/** Audit log, newest first, keyset-paged with ?before=<iso>. */
activityRouter.get(
  "/audit",
  requirePermission("roster.view"),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
    const where: Prisma.AuditEventWhereInput = {};
    const asked = typeof req.query.site === "string" && req.query.site.trim() !== "";
    // Admins with no selection also see org-level events (people, keys) that
    // belong to no site; everyone else sees only their sites' events.
    if (asked || req.user!.siteIds) where.siteId = { in: (await sitesInScope(req, req.query.site)).map((s) => s.id) };
    // Non-roster events (people, keys, settings) are admin business.
    if (!req.user!.permissions.includes("audit.view")) where.action = { startsWith: "tenant." };
    if (typeof req.query.action === "string" && req.query.action) where.action = req.query.action;
    if (typeof req.query.before === "string") where.createdAt = { lt: new Date(req.query.before) };

    const rows = await prisma.auditEvent.findMany({ where, orderBy: { createdAt: "desc" }, take: limit });
    res.json({
      items: rows.map((r) => ({ ...r, changes: r.changes ? JSON.parse(r.changes) : null })),
      nextBefore: rows.length === limit ? rows[rows.length - 1].createdAt : null,
    });
  })
);

/** Everything the Dashboard needs in one round trip. */
activityRouter.get(
  "/dashboard",
  requirePermission("roster.view"),
  asyncHandler(async (req, res) => {
    const sites = await sitesInScope(req, req.query.site);
    const siteIds = sites.map((s) => s.id);
    const siteWhere = { siteId: { in: siteIds } };
    const weekAgo = new Date(Date.now() - 7 * 86400_000);
    const orgHours = await attentionHours();

    const [active, addedWeek, removedWeek, attentionPerSite, recent] = await Promise.all([
      prisma.tenant.count({ where: { ...siteWhere, status: "active" } }),
      prisma.tenant.count({ where: { ...siteWhere, createdAt: { gte: weekAgo } } }),
      prisma.tenant.count({ where: { ...siteWhere, status: "archived", archivedAt: { gte: weekAgo } } }),
      Promise.all(
        sites.map(async (s) => {
          const [activeCount, attention, added, removed] = await Promise.all([
            prisma.tenant.count({ where: { siteId: s.id, status: "active" } }),
            prisma.tenant.count({
              where: { siteId: s.id, status: "active", attentionClockAt: { lt: cutoff(s.attentionHours ?? orgHours) } },
            }),
            prisma.tenant.count({ where: { siteId: s.id, createdAt: { gte: weekAgo } } }),
            prisma.tenant.count({ where: { siteId: s.id, status: "archived", archivedAt: { gte: weekAgo } } }),
          ]);
          return { ...s, activeCount, attentionCount: attention, addedWeek: added, removedWeek: removed };
        })
      ),
      prisma.auditEvent.findMany({
        where: { siteId: { in: siteIds }, action: { startsWith: "tenant." } },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    ]);

    res.json({
      totals: {
        active,
        attention: attentionPerSite.reduce((n, s) => n + s.attentionCount, 0),
        addedWeek,
        removedWeek,
      },
      attentionHours: orgHours,
      sites: attentionPerSite,
      recent,
    });
  })
);
