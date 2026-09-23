import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { PhoneHeader } from "@/components/shell/PhoneHeader";
import { Page } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyState, LoadingState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { RollCall, type PresentEntry } from "@/components/attendance/RollCall";
import { attendanceApi, useAttendanceMutation, useSites, useTenants } from "@/lib/queries";
import { useAuth } from "@/lib/auth";

/** A brief setup followed by a one-person-at-a-time roll call. */
export function TakeAttendancePage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const { data: sites } = useSites();
  const [siteCode, setSiteCode] = useState(() => params.get("site") ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [started, setStarted] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const create = useAttendanceMutation((body: Record<string, unknown>) => attendanceApi.create(body));

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const effectiveCode = siteCode || (sites?.length === 1 ? sites[0].code : "");
  const site = sites?.find((item) => item.code === effectiveCode);
  const { data, isLoading, isPlaceholderData, isError, error } = useTenants(site?.code, "active", Boolean(site));
  const roster = isPlaceholderData ? [] : data?.items ?? [];

  if (!can("roster.edit")) return <Navigate to="/attendance" replace />;

  function start() {
    if (!site) return toast("Choose a site.", "error");
    if (!title.trim()) return toast("Title is required.", "error");
    if (!description.trim()) return toast("Description is required.", "error");
    setStarted(true);
  }

  async function save(entries: PresentEntry[]) {
    if (!site || !started) return;
    if (!title.trim() || !description.trim()) return toast("Title and description are required.", "error");
    try {
      const event = await create.mutateAsync({ site: site.code, title: title.trim(), description: description.trim(), entries });
      toast(`Saved — ${event.entries.length} present.`);
      navigate(`/attendance/${event.id}`, { replace: true });
    } catch (failure) {
      toast(failure instanceof Error ? failure.message : "Could not save attendance.", "error");
    }
  }

  const localTime = clock.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

  return <div className="flex min-h-full flex-col">
    <PhoneHeader title="Take attendance" back={{ to: "/attendance", label: "Attendance" }} />
    <Page className="w-full max-w-[900px] flex-1 pb-6">
      <Link to="/attendance" className="-ml-2 mb-2 hidden min-h-[36px] items-center gap-1 px-2 text-[13px] font-semibold text-accent dark:text-white md:inline-flex">
        <ChevronLeft className="h-4 w-4" /> Attendance
      </Link>
      <h1 className="mb-5 hidden text-[24px] font-heading font-extrabold text-ink md:block">Take attendance</h1>

      {!started || editingDetails ? <Card className="mb-4 space-y-3 p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Title *"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Tuesday tenant meeting" className="min-h-[44px]" maxLength={160} autoFocus={!started} /></Field>
          <Field label="Site *">{started ? <p className="flex min-h-[44px] items-center text-[14px] font-semibold text-ink">{site?.name}</p> : (
            <Select value={effectiveCode} onChange={(event) => setSiteCode(event.target.value)} options={(sites ?? []).map((item) => ({ value: item.code, label: item.name }))} placeholder="Choose a site" className="min-h-[44px] font-semibold" />
          )}</Field>
        </div>
        <Field label="Description *"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is this attendance for?" maxLength={2000} /></Field>
        <p className="text-[12px] text-muted">Date and time: {localTime} (your local time)</p>
        {started ? <Button variant="secondary" onClick={() => setEditingDetails(false)}>Done editing</Button> : <Button className="min-h-[48px] w-full md:w-auto" onClick={start} disabled={!site || isLoading || isPlaceholderData || isError}>Start roll call</Button>}
      </Card> : <Card className="mb-3 flex items-start gap-2 px-3 py-2.5 md:mb-4 md:gap-3 md:p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-ink md:text-[15px]">{title}</p>
          <p className="truncate text-[11px] text-muted md:text-[12px]">{site?.name} · {localTime}</p>
          <p className="mt-1 hidden text-[13px] text-muted md:line-clamp-2">{description}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditingDetails(true)}>Edit</Button>
      </Card>}

      {!started ? isLoading || isPlaceholderData ? <LoadingState label="Loading roster…" /> : isError ? (
        <EmptyState title="Could not load this roster" hint={error instanceof Error ? error.message : "Try again in a moment."} />
      ) : <p className="px-1 text-[13px] text-muted">Choose the site and describe this attendance to begin.</p> : isLoading || isPlaceholderData ? (
        <LoadingState label="Loading roster…" />
      ) : isError ? (
        <EmptyState title="Could not load this roster" hint={error instanceof Error ? error.message : "Try again in a moment."} />
      ) : <RollCall roster={roster} saving={create.isPending} onSave={save} />}
    </Page>
  </div>;
}
