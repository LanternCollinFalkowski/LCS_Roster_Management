/**
 * Roles are defined in code for the prototype. Four is enough to express
 * "look", "work the roster", "run a site" and "run the system"; if Lantern
 * later needs editable roles, this table becomes a Role model the way the AP
 * app did it, and nothing that calls `can()` changes.
 */
export const PERMISSIONS = [
  "roster.view",
  "roster.edit",
  "roster.archive",
  "roster.restore",
  "audit.view",
  "sites.manage",
  "users.manage",
  "integrations.manage",
  "settings.manage",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export interface RoleDef {
  key: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
  /** Sees and acts on every site regardless of UserSite rows. */
  allSites: boolean;
}

export const ROLES: RoleDef[] = [
  {
    key: "viewer",
    name: "Viewer",
    description: "Can look up who is on a roster. Cannot change anything.",
    permissions: ["roster.view"],
    allSites: false,
  },
  {
    key: "staff",
    name: "Site staff",
    description: "Adds, updates and reviews residents at their sites; can move people out.",
    permissions: ["roster.view", "roster.edit", "roster.archive"],
    allSites: false,
  },
  {
    key: "site_manager",
    name: "Site manager",
    description: "Everything staff can do, plus restoring removed residents and the audit history.",
    permissions: ["roster.view", "roster.edit", "roster.archive", "roster.restore", "audit.view"],
    allSites: false,
  },
  {
    key: "admin",
    name: "Administrator",
    description: "Everything, on every site — people, sites, integrations and settings.",
    permissions: [...PERMISSIONS],
    allSites: true,
  },
];

export function roleFor(key: string): RoleDef {
  return ROLES.find((r) => r.key === key) ?? ROLES[0];
}

export function isRoleKey(key: string): boolean {
  return ROLES.some((r) => r.key === key);
}
