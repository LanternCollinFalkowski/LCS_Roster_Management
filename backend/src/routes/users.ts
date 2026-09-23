import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncHandler, badRequest, notFound } from "../http.js";
import { requireAuth, requirePermission } from "../auth/middleware.js";
import { actorOf, audit } from "../services/audit.js";
import { isRoleKey, roleFor } from "../services/permissions.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

const LANDING = ["/dashboard", "/roster", "/review"] as const;

/** The signed-in person's own preferences — the Profile screen. */
usersRouter.patch(
  "/me/profile",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        avatarColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
        defaultLandingPage: z.enum(LANDING).optional(),
        defaultSiteCode: z.string().nullable().optional(),
      })
      .parse(req.body);
    const user = await prisma.user.update({ where: { id: req.user!.userId }, data: body });
    res.json({ ok: true, id: user.id });
  })
);

function shape(u: { roleKey: string; sites: { site: { id: string; code: string; name: string } }[] } & Record<string, unknown>) {
  const role = roleFor(u.roleKey);
  return { ...u, sites: u.sites.map((s) => s.site), role: { key: role.key, name: role.name, allSites: role.allSites } };
}

const SITES_INCLUDE = { sites: { include: { site: { select: { id: true, code: true, name: true } } } } } as const;

usersRouter.get(
  "/",
  requirePermission("users.manage"),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ include: SITES_INCLUDE, orderBy: [{ status: "asc" }, { name: "asc" }] });
    res.json(users.map(shape));
  })
);

const userBody = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  roleKey: z.string().refine(isRoleKey, "Unknown role"),
  siteIds: z.array(z.string()).default([]),
  title: z.string().trim().max(120).nullable().optional(),
});

/**
 * Pre-create (invite) a person. Their first sign-in — Microsoft or a Google
 * Workspace account federated through Entra — activates the account. This is
 * how partner-org staff get in without their whole domain being admitted.
 */
usersRouter.post(
  "/",
  requirePermission("users.manage"),
  asyncHandler(async (req, res) => {
    const body = userBody.parse(req.body);
    if (await prisma.user.findUnique({ where: { email: body.email } })) throw badRequest("Someone with that email already exists.");
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        roleKey: body.roleKey,
        title: body.title ?? null,
        status: "invited",
        sites: { create: body.siteIds.map((siteId) => ({ siteId })) },
      },
      include: SITES_INCLUDE,
    });
    await audit({ actor: actorOf(req), action: "user.invited", summary: `Invited ${user.name} (${user.email}) as ${roleFor(user.roleKey).name}` });
    res.status(201).json(shape(user));
  })
);

usersRouter.patch(
  "/:id",
  requirePermission("users.manage"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        roleKey: z.string().refine(isRoleKey, "Unknown role").optional(),
        status: z.enum(["active", "invited", "denied", "deactivated"]).optional(),
        siteIds: z.array(z.string()).optional(),
        name: z.string().trim().min(1).max(120).optional(),
      })
      .parse(req.body);
    const before = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!before) throw notFound();

    // Lockout guard: the last active admin cannot demote or disable themselves.
    const losingAdmin =
      before.roleKey === "admin" &&
      ((body.roleKey && body.roleKey !== "admin") || (body.status && body.status !== "active"));
    if (losingAdmin) {
      const admins = await prisma.user.count({ where: { roleKey: "admin", status: "active" } });
      if (admins <= 1) throw badRequest("This is the only active administrator. Make someone else an admin first.");
    }

    const user = await prisma.$transaction(async (tx) => {
      if (body.siteIds) {
        await tx.userSite.deleteMany({ where: { userId: before.id } });
        if (body.siteIds.length) await tx.userSite.createMany({ data: body.siteIds.map((siteId) => ({ userId: before.id, siteId })) });
      }
      return tx.user.update({
        where: { id: before.id },
        data: { roleKey: body.roleKey, status: body.status, name: body.name },
        include: SITES_INCLUDE,
      });
    });
    const bits = [
      body.roleKey && body.roleKey !== before.roleKey ? `role → ${roleFor(body.roleKey).name}` : null,
      body.status && body.status !== before.status ? `status → ${body.status}` : null,
      body.siteIds ? `sites → ${body.siteIds.length || "none"}` : null,
    ].filter(Boolean);
    await audit({ actor: actorOf(req), action: "user.updated", summary: `Updated ${user.name}${bits.length ? `: ${bits.join(", ")}` : ""}` });
    res.json(shape(user));
  })
);
