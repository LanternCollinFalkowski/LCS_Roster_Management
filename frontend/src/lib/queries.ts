import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  ApiKeyRow, AuditEvent, DashboardData, ManagedUser, RoleSummary, Settings, Site, Tenant, TenantDetail, WebhookRow,
} from "./types";

/**
 * Every server read lives here so cache keys stay consistent. Roster writes
 * invalidate the whole ["roster"] family: a swipe changes the queue, the list,
 * the site counts and the dashboard at once, and refetching a few hundred rows
 * is cheaper than keeping four caches surgically in step.
 */
export const qk = {
  sites: (all = false) => ["roster", "sites", all] as const,
  tenants: (site: string, status: string) => ["roster", "tenants", site, status] as const,
  review: (site: string) => ["roster", "review", site] as const,
  tenant: (id: string) => ["roster", "tenant", id] as const,
  dashboard: (site: string) => ["roster", "dashboard", site] as const,
  audit: (site: string) => ["roster", "audit", site] as const,
};

/** `?site=` for a selection: a comma list of codes, or nothing for all my sites. */
const siteQs = (site: string | undefined) => (site ? `site=${encodeURIComponent(site)}` : "");

export function useSites(all = false) {
  return useQuery({ queryKey: qk.sites(all), queryFn: () => api.get<Site[]>(`/sites${all ? "?all=1" : ""}`) });
}

/** `site`: comma list of site codes, or undefined for all of my sites. */
export function useTenants(site: string | undefined, status: "active" | "archived" | "attention", enabled = true) {
  return useQuery({
    queryKey: qk.tenants(site ?? "all", status),
    queryFn: () =>
      api.get<{ items: Tenant[]; attentionHours: number; truncated: boolean }>(
        `/tenants?${new URLSearchParams({ ...(site ? { site } : {}), status })}`
      ),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useReviewQueue(site: string | undefined) {
  return useQuery({
    queryKey: qk.review(site ?? "all"),
    queryFn: () => api.get<{ items: Tenant[]; attentionHours: number }>(`/tenants/review?${siteQs(site)}`),
  });
}

export function useTenant(id: string | undefined) {
  return useQuery({ queryKey: qk.tenant(id ?? ""), queryFn: () => api.get<TenantDetail>(`/tenants/${id}`), enabled: Boolean(id) });
}

export function useDashboard(site?: string) {
  return useQuery({
    queryKey: qk.dashboard(site ?? "all"),
    queryFn: () => api.get<DashboardData>(`/activity/dashboard?${siteQs(site)}`),
    placeholderData: (prev) => prev,
  });
}

export function useAudit(site: string | undefined) {
  return useQuery({
    queryKey: qk.audit(site ?? "all"),
    queryFn: () => api.get<{ items: AuditEvent[]; nextBefore: string | null }>(`/activity/audit?limit=100&${siteQs(site)}`),
    placeholderData: (prev) => prev,
  });
}

export function useArchiveReasons() {
  return useQuery({ queryKey: ["meta", "reasons"], queryFn: () => api.get<string[]>("/tenants/meta/archive-reasons"), staleTime: Infinity });
}

/** Wraps a roster write so every one invalidates the roster family on success. */
export function useRosterMutation<TVars, TResult = Tenant>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ["roster"] }) });
}

export const rosterApi = {
  create: (body: Record<string, unknown>) => api.post<Tenant>("/tenants", body),
  update: (id: string, body: Record<string, unknown>) => api.patch<Tenant>(`/tenants/${id}`, body),
  archive: (id: string, body: { reason: string; note?: string }) => api.post<Tenant>(`/tenants/${id}/archive`, body),
  restore: (id: string) => api.post<Tenant>(`/tenants/${id}/restore`),
  keep: (id: string) => api.post<Tenant>(`/tenants/${id}/keep`),
};

// ── Admin ────────────────────────────────────────────────────────────────

export function useUsers(enabled = true) {
  return useQuery({ queryKey: ["admin", "users"], queryFn: () => api.get<ManagedUser[]>("/users"), enabled });
}
export function useRoles() {
  return useQuery({ queryKey: ["meta", "roles"], queryFn: () => api.get<(RoleSummary & { permissions: string[] })[]>("/auth/roles"), staleTime: Infinity });
}
export function useSettings(enabled = true) {
  return useQuery({ queryKey: ["admin", "settings"], queryFn: () => api.get<Settings>("/admin/settings"), enabled });
}
export function useApiKeys(enabled = true) {
  return useQuery({ queryKey: ["admin", "api-keys"], queryFn: () => api.get<ApiKeyRow[]>("/admin/api-keys"), enabled });
}
export function useWebhooks(enabled = true) {
  return useQuery({ queryKey: ["admin", "webhooks"], queryFn: () => api.get<{ events: string[]; items: WebhookRow[] }>("/admin/webhooks"), enabled });
}
