import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToneBadge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useSites } from "@/lib/queries";
import type { Site } from "@/lib/types";

type Draft = { id?: string; name: string; code: string; entityName: string; siteType: string; address: string; attentionHours: string; active: boolean };
const empty: Draft = { name: "", code: "", entityName: "", siteType: "supportive", address: "", attentionHours: "", active: true };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function AdminSites() {
  const { data: sites, isLoading } = useSites(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const qc = useQueryClient();
  const toast = useToast();

  async function save() {
    if (!draft) return;
    const body = {
      name: draft.name,
      code: draft.code,
      entityName: draft.entityName || null,
      siteType: draft.siteType,
      address: draft.address || null,
      attentionHours: draft.attentionHours ? Number(draft.attentionHours) : null,
      active: draft.active,
    };
    try {
      if (draft.id) await api.patch(`/sites/${draft.id}`, body);
      else await api.post("/sites", body);
      toast(draft.id ? "Site updated." : "Site created.");
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["roster"] });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    }
  }

  const edit = (s: Site) =>
    setDraft({
      id: s.id, name: s.name, code: s.code, entityName: s.entityName ?? "", siteType: s.siteType,
      address: s.address ?? "", attentionHours: s.attentionHours ? String(s.attentionHours) : "", active: s.active,
    });

  return (
    <Page>
      <PageHeader
        title="Sites"
        subtitle="Every Lantern property or shelter with a roster. The code is what WordPress and the API use — keep it stable."
        actions={<Button onClick={() => setDraft({ ...empty })}><Plus className="h-4 w-4" /> New site</Button>}
      />
      {isLoading ? <LoadingState /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13.5px]">
            <thead>
              <tr className="border-b border-hairline text-left text-micro font-bold uppercase tracking-[0.04em] text-muted">
                <th className="px-4 py-2.5">Site</th><th className="px-4 py-2.5">Code</th><th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5 text-right">Roster</th><th className="px-4 py-2.5 text-right">Review</th><th className="px-4 py-2.5">Threshold</th><th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sites?.map((s) => (
                <tr key={s.id} onClick={() => edit(s)} className="cursor-pointer border-b border-hairline last:border-0 hover:bg-rowhover">
                  <td className="px-4 py-2.5"><p className="font-semibold text-ink">{s.name}</p>{s.entityName && <p className="text-micro text-muted">{s.entityName}</p>}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-muted">{s.code}</td>
                  <td className="px-4 py-2.5 capitalize text-muted">{s.siteType}</td>
                  <td className="px-4 py-2.5 text-right tabular">{s.activeCount}</td>
                  <td className="px-4 py-2.5 text-right tabular">{s.attentionCount || "—"}</td>
                  <td className="px-4 py-2.5 text-muted">{s.effectiveAttentionHours}h{s.attentionHours ? "" : " (default)"}</td>
                  <td className="px-4 py-2.5">{!s.active && <ToneBadge tone="neutral">Inactive</ToneBadge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={Boolean(draft)} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader title={draft?.id ? `Edit ${draft.name}` : "New site"} />
          {draft && (
            <DialogBody className="grid grid-cols-2 gap-3">
              <Field label="Name" className="col-span-2">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value, code: draft.id ? draft.code : slug(e.target.value) })} />
              </Field>
              <Field label="Code" hint={draft.id ? "Changing this breaks integrations that use the old code." : "Used in URLs and the API."}>
                <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: slug(e.target.value) })} className="font-mono" />
              </Field>
              <Field label="Type">
                <Select value={draft.siteType} onChange={(e) => setDraft({ ...draft, siteType: e.target.value })}
                  options={[{ value: "supportive", label: "Supportive housing" }, { value: "shelter", label: "Shelter (high turnover)" }, { value: "other", label: "Other" }]} />
              </Field>
              <Field label="Entity name" hint="As it appears in the property-management export, e.g. “Amber Hall LP”.">
                <Input value={draft.entityName} onChange={(e) => setDraft({ ...draft, entityName: e.target.value })} />
              </Field>
              <Field label="Review threshold (hours)" hint="Blank = org default.">
                <Input type="number" min={1} value={draft.attentionHours} onChange={(e) => setDraft({ ...draft, attentionHours: e.target.value })} placeholder="48" />
              </Field>
              <Field label="Address" className="col-span-2"><Input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></Field>
              <label className="col-span-2 flex items-center justify-between rounded-input border border-hairline px-3 py-2">
                <span className="text-[13.5px] text-ink">Active — shown in rosters, forms and the API</span>
                <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
              </label>
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={save} disabled={!draft?.name || !draft?.code}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
