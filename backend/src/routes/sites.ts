import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncHandler, badRequest, notFound } from "../http.js";
import { requireAuth, requirePermission } from "../auth/middleware.js";
import { actorOf, audit, diff } from "../services/audit.js";
import { attentionHours } from "../services/settings.js";
import { cutoff } from "../services/roster.js";

export const sitesRouter = Router();
sitesRouter.use(requireAuth);

/**
 * Sites the caller can see, each with live roster counts. Every screen loads
 * this before it can show anything (the site picker gates Roster, Review,
 * Dashboard…), so it has to stay to two grouped queries total, not one per
 * site — a per-site `count()` loop here once meant 30+ serial round-trips
 * before the roster could even start rendering.
 */
sitesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.all === "1" && req.user!.permissions.includes("sites.manage");
    const sites = await prisma.site.findMany({
      where: {
        ...(includeInactive ? {} : { active: true }),
        ...(req.user!.siteIds ? { id: { in: req.user!.siteIds } } : {}),
      },
      orderBy: { name: "asc" },
    });
    const orgHours = await attentionHours();
    const ids = sites.map((s) => s.id);
    const active = await prisma.tenant.groupBy({
      by: ["siteId"],
      where: { siteId: { in: ids }, status: "active" },
      _count: { _all: true },
    });
    // One query for every site's attention count: each has its own threshold,
    // so it's an OR of per-site conditions rather than a single groupBy WHERE.
    const attentionRows = ids.length
      ? await prisma.$queryRaw<{ siteId: string; cnt: bigint | number }[]>`
          SELECT siteId, COUNT(*) as cnt FROM Tenant
          WHERE status = 'active' AND (${Prisma.join(
            sites.map((s) => Prisma.sql`(siteId = ${s.id} AND attentionClockAt < ${cutoff(s.attentionHours ?? orgHours)})`),
            " OR "
          )})
          GROUP BY siteId`
      : [];
    const activeBy = new Map(active.map((a) => [a.siteId, a._count._all]));
    const attentionBy = new Map(attentionRows.map((a) => [a.siteId, Number(a.cnt)]));
    res.json(
      sites.map((s) => ({
        ...s,
        activeCount: activeBy.get(s.id) ?? 0,
        attentionCount: attentionBy.get(s.id) ?? 0,
        effectiveAttentionHours: s.attentionHours ?? orgHours,
      }))
    );
  })
);

const siteBody = z.object({
  name: z.string().trim().min(1).max(120),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes")
    .max(60),
  entityName: z.string().trim().max(160).nullable().optional(),
  siteType: z.enum(["supportive", "shelter", "other"]).default("supportive"),
  address: z.string().trim().max(240).nullable().optional(),
  attentionHours: z.number().int().min(1).max(24 * 60).nullable().optional(),
  active: z.boolean().optional(),
});

sitesRouter.post(
  "/",
  requirePermission("sites.manage"),
  asyncHandler(async (req, res) => {
    const data = siteBody.parse(req.body);
    if (await prisma.site.findUnique({ where: { code: data.code } })) throw badRequest("That site code is already in use.");
    const site = await prisma.site.create({ data: { ...data, entityName: data.entityName || null } });
    await audit({ actor: actorOf(req), action: "site.created", siteId: site.id, summary: `Created site ${site.name}` });
    res.status(201).json(site);
  })
);

sitesRouter.patch(
  "/:id",
  requirePermission("sites.manage"),
  asyncHandler(async (req, res) => {
    const data = siteBody.partial().parse(req.body);
    const before = await prisma.site.findUnique({ where: { id: req.params.id } });
    if (!before) throw notFound();
    if (data.code && data.code !== before.code) {
      if (await prisma.site.findUnique({ where: { code: data.code } })) throw badRequest("That site code is already in use.");
    }
    const site = await prisma.site.update({ where: { id: before.id }, data });
    const changes = diff(before as unknown as Record<string, unknown>, data, Object.keys(data) as never[]);
    await audit({
      actor: actorOf(req),
      action: "site.updated",
      siteId: site.id,
      summary: `Updated site ${site.name}`,
      changes,
    });
    res.json(site);
  })
);
