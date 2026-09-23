export type PermissionKey =
  | "roster.view"
  | "roster.edit"
  | "roster.archive"
  | "roster.restore"
  | "audit.view"
  | "sites.manage"
  | "users.manage"
  | "integrations.manage"
  | "settings.manage";

export type UserStatus = "active" | "invited" | "requested" | "denied" | "deactivated";
export type LandingPage = "/dashboard" | "/roster" | "/review";

export interface SiteRef {
  id: string;
  code: string;
  name: string;
}

export interface RoleSummary {
  key: string;
  name: string;
  description?: string;
  allSites: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  title?: string | null;
  avatarColor?: string | null;
  status: UserStatus;
  roleKey: string;
  role: RoleSummary;
  permissions: PermissionKey[];
  identityProvider?: string | null;
  defaultLandingPage: LandingPage;
  defaultSiteCode?: string | null;
  sites: SiteRef[];
  allSites: boolean;
  lastSignInAt?: string | null;
}

export interface Site extends SiteRef {
  entityName?: string | null;
  siteType: "supportive" | "shelter" | "other";
  address?: string | null;
  active: boolean;
  attentionHours?: number | null;
  activeCount: number;
  attentionCount: number;
  effectiveAttentionHours: number;
}

export interface Tenant {
  id: string;
  siteId: string;
  site?: SiteRef;
  unit: string | null;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  displayName: string;
  status: "active" | "archived";
  moveInDate: string | null;
  moveOutDate: string | null;
  notes: string | null;
  externalId: string | null;
  lastActivityAt: string | null;
  lastActivitySource: string | null;
  lastKeptAt: string | null;
  attentionClockAt: string;
  hoursQuiet: number;
  needsAttention: boolean;
  archivedAt: string | null;
  archiveReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TenantActivity {
  id: string;
  source: string;
  label: string | null;
  externalRef: string | null;
  occurredAt: string;
  recordedBy: string | null;
}

export interface AuditEvent {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  tenantId: string | null;
  siteId: string | null;
  summary: string;
  changes: Record<string, [unknown, unknown]> | Record<string, unknown> | null;
  createdAt: string;
}

export interface TenantDetail extends Tenant {
  activities: TenantActivity[];
  history: AuditEvent[];
}

export interface DashboardData {
  totals: { active: number; attention: number; addedWeek: number; removedWeek: number };
  attentionHours: number;
  sites: (SiteRef & { siteType: string; activeCount: number; attentionCount: number; addedWeek: number; removedWeek: number })[];
  recent: AuditEvent[];
}

export interface AttendanceEvent {
  id: string;
  siteId: string;
  site: SiteRef;
  title: string;
  description: string;
  occurredAt: string;
  createdByName: string;
  presentCount: number;
  signedCount: number;
}

export interface AttendanceEntry {
  id: string;
  tenantId: string;
  tenantName: string;
  signature: string | null;
  signedAt: string | null;
}

export interface AttendanceDetail {
  id: string;
  site: SiteRef;
  title: string;
  description: string;
  occurredAt: string;
  createdByName: string;
  entries: AttendanceEntry[];
}

export interface ManagedUser extends Omit<User, "permissions" | "allSites" | "role"> {
  role: RoleSummary;
  createdAt: string;
}

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string;
  siteId: string | null;
  site: { name: string } | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface WebhookRow {
  id: string;
  name: string;
  url: string;
  events: string;
  active: boolean;
  secretHint: string;
  lastDeliveryAt: string | null;
  lastStatus: number | null;
  lastError: string | null;
  deliveries: { id: string; event: string; statusCode: number | null; error: string | null; durationMs: number | null; createdAt: string }[];
}

export interface Settings {
  attentionHours: string;
  guestDomains: string;
  undoSeconds: string;
}

export interface ImportSummary {
  committed: boolean;
  rows: number;
  skippedBlank: number;
  sitesCreated: string[];
  added: number;
  alreadyPresent: number;
  bySite: { site: string; added: number; alreadyPresent: number }[];
  samples: { site: string; unit: string; raw: string; parsed: { firstName: string; lastName: string; preferredName: string | null } }[];
}
