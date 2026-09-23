import { useQueryClient } from "@tanstack/react-query";
import { rosterApi } from "@/lib/queries";
import { useToast } from "@/components/ui/toast";
import type { Tenant } from "@/lib/types";

/**
 * Remove / keep / restore with the toasts that go with them, shared by the
 * review queue, the roster and a resident's page so all three behave the same.
 * Every removal toast carries Undo.
 */
export function useRosterActions() {
  const qc = useQueryClient();
  const toast = useToast();
  const refresh = () => qc.invalidateQueries({ queryKey: ["roster"] });

  async function restore(t: Tenant, quiet = false) {
    try {
      await rosterApi.restore(t.id);
      if (!quiet) toast(`${t.displayName} is back on the roster.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not restore.", "error");
    } finally {
      await refresh();
    }
  }

  async function remove(t: Tenant, reason: string, note?: string): Promise<boolean> {
    try {
      await rosterApi.archive(t.id, { reason, note: note || undefined });
      toast(`Removed ${t.displayName}.`, "success", {
        action: { label: "Undo", onClick: () => void restore(t, false) },
      });
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove.", "error");
      return false;
    } finally {
      await refresh();
    }
  }

  async function keep(t: Tenant): Promise<boolean> {
    try {
      await rosterApi.keep(t.id);
      toast(`Kept ${t.displayName}.`, "info");
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update.", "error");
      return false;
    } finally {
      await refresh();
    }
  }

  return { remove, keep, restore };
}
