import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsDown, Search, Undo2, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { cn, tintFor } from "@/lib/utils";
import type { Tenant } from "@/lib/types";
import { SignaturePrompt } from "./SignaturePrompt";

type Choice = { status: "here"; signature: string | null } | { status: "not-here" };
type Decision = { tenantId: string; before?: Choice; skippedBefore: string[]; jumpBefore: string | null };
export type PresentEntry = { tenantId: string; signature?: string };

function status(choice: Choice | undefined, skipped: boolean) {
  if (choice?.status === "here") return choice.signature ? "Here · signed" : "Here";
  if (choice?.status === "not-here") return "Not here";
  return skipped ? "Skipped" : "To decide";
}

/** Local decisions stay in memory until the parent saves one attendance entry. */
export function RollCall({ roster, saving, onSave }: { roster: Tenant[]; saving: boolean; onSave: (entries: PresentEntry[]) => Promise<void> }) {
  const [choices, setChoices] = useState<Map<string, Choice>>(new Map());
  const [skipped, setSkipped] = useState<string[]>([]);
  const [history, setHistory] = useState<Decision[]>([]);
  const [jumpId, setJumpId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [promptId, setPromptId] = useState<string | null>(null);
  const [promptCreated, setPromptCreated] = useState(false);
  const byId = useMemo(() => new Map(roster.map((tenant) => [tenant.id, tenant])), [roster]);
  const skipRank = useMemo(() => new Map(skipped.map((id, index) => [id, index])), [skipped]);
  const queue = useMemo(() => roster.filter((tenant) => !choices.has(tenant.id)).sort((a, b) => {
    const aRank = skipRank.has(a.id) ? 1 + skipRank.get(a.id)! : 0;
    const bRank = skipRank.has(b.id) ? 1 + skipRank.get(b.id)! : 0;
    return aRank - bRank;
  }), [roster, choices, skipRank]);
  const active = jumpId ? byId.get(jumpId) ?? null : queue[0] ?? null;
  const presentCount = [...choices.values()].filter((choice) => choice.status === "here").length;
  const signedCount = [...choices.values()].filter((choice) => choice.status === "here" && choice.signature).length;
  const promptChoice = promptId ? choices.get(promptId) : undefined;
  const searchResults = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return [];
    return roster.filter((tenant) => [tenant.displayName, tenant.firstName, tenant.lastName, tenant.preferredName, tenant.unit]
      .some((value) => value?.toLowerCase().includes(needle))).slice(0, 40);
  }, [roster, search]);

  function remember(tenantId: string) {
    setHistory((items) => [...items, { tenantId, before: choices.get(tenantId), skippedBefore: skipped, jumpBefore: jumpId }]);
  }
  function here(id: string) {
    const previous = choices.get(id);
    if (previous?.status !== "here") {
      remember(id);
      setChoices((items) => new Map(items).set(id, { status: "here", signature: null }));
      setSkipped((items) => items.filter((entry) => entry !== id));
      setPromptCreated(true);
    } else setPromptCreated(false);
    setPromptId(id);
  }
  function notHere(id: string) {
    if (choices.get(id)?.status !== "not-here") {
      remember(id);
      setChoices((items) => new Map(items).set(id, { status: "not-here" }));
      setSkipped((items) => items.filter((entry) => entry !== id));
    }
    setJumpId(null);
  }
  function skip(id: string) {
    if (queue.length <= 1 && !jumpId) return;
    remember(id);
    setChoices((items) => { const next = new Map(items); next.delete(id); return next; });
    setSkipped((items) => [...items.filter((entry) => entry !== id), id]);
    setJumpId(null);
  }
  function closePrompt() { setPromptId(null); setJumpId(null); }
  function commit(signature: string | null) {
    if (!promptId) return;
    const previous = choices.get(promptId);
    if (!promptCreated && previous?.status === "here" && previous.signature !== signature) remember(promptId);
    setChoices((items) => new Map(items).set(promptId, { status: "here", signature }));
    closePrompt();
  }
  function removeFromAttendance() {
    if (!promptId) return;
    if (promptCreated) {
      const previous = history[history.length - 1];
      setHistory((items) => items.slice(0, -1));
      setChoices((items) => {
        const next = new Map(items);
        if (previous?.before) next.set(promptId, previous.before);
        else next.delete(promptId);
        return next;
      });
      if (previous) setSkipped(previous.skippedBefore);
    } else {
      remember(promptId);
      setChoices((items) => { const next = new Map(items); next.delete(promptId); return next; });
    }
    closePrompt();
  }
  function undo() {
    const last = history[history.length - 1];
    if (!last || promptId) return;
    setHistory((items) => items.slice(0, -1));
    setChoices((items) => {
      const next = new Map(items);
      if (last.before) next.set(last.tenantId, last.before);
      else next.delete(last.tenantId);
      return next;
    });
    setSkipped(last.skippedBefore);
    setJumpId(last.jumpBefore);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (promptId || searchOpen || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); }
      else if (active && event.key === "ArrowRight") here(active.id);
      else if (active && event.key === "ArrowLeft") notHere(active.id);
      else if (active && event.key === "ArrowDown") { event.preventDefault(); skip(active.id); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const save = () => onSave([...choices.entries()].flatMap(([tenantId, choice]) =>
    choice.status === "here" ? [{ tenantId, signature: choice.signature ?? undefined }] : []));

  return (
    <>
      <div className="mb-1 flex items-center justify-between gap-3 md:mb-3">
        <p className="text-[13px] text-muted"><strong className="tabular text-ink">{choices.size}</strong> of {roster.length} decided · {presentCount} here · {signedCount} signed</p>
        <Button variant="secondary" size="sm" onClick={undo} disabled={!history.length || Boolean(promptId)} className="min-h-[40px] shrink-0"><Undo2 className="h-4 w-4" /> Undo</Button>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-pill bg-subtle2 md:mb-5" role="progressbar" aria-valuenow={choices.size} aria-valuemin={0} aria-valuemax={roster.length} aria-label="Roll call progress">
        <div className="h-full rounded-pill bg-status-greenDot transition-[width]" style={{ width: `${roster.length ? choices.size / roster.length * 100 : 100}%` }} />
      </div>

      <div className="mb-2 md:mb-4">
        <Button variant="secondary" className="min-h-[44px] w-full justify-start text-muted" onClick={() => setSearchOpen((open) => !open)} aria-expanded={searchOpen}><Search className="h-4 w-4" /> Find someone by name or unit</Button>
        {searchOpen && <Card className="mt-2 overflow-hidden">
          <div className="border-b border-hairline p-3"><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Type a name or unit" className="min-h-[44px]" autoFocus /></div>
          {search.trim() ? <ul className="max-h-[45vh] overflow-y-auto scroll-thin">
            {searchResults.map((tenant) => <li key={tenant.id} className="border-b border-hairline last:border-0">
              <button type="button" className="flex min-h-[54px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-rowhover" onClick={() => { setJumpId(tenant.id); setSearchOpen(false); setSearch(""); }}>
                <Avatar name={tenant.displayName} color={tintFor(tenant.id)} size={30} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-ink">{tenant.displayName}</span><span className="block text-[12px] text-muted">{tenant.unit ? `Unit ${tenant.unit}` : "No unit"}</span></span>
                <span className="shrink-0 text-[12px] font-semibold text-muted">{status(choices.get(tenant.id), skipped.includes(tenant.id))}</span>
              </button>
            </li>)}
            {!searchResults.length && <li className="px-4 py-6 text-center text-[13px] text-muted">No matching residents.</li>}
          </ul> : <p className="px-4 py-3 text-[12px] text-muted">Search across this site's active roster.</p>}
        </Card>}
      </div>

      {active ? <div className="mx-auto max-w-[500px]">
        {jumpId && <div className="mb-2 flex items-center justify-between text-[12px] text-muted"><span>Search result · roll call resumes afterward</span><button type="button" onClick={() => setJumpId(null)} className="min-h-[36px] px-2 font-semibold text-accent">Back to roll call</button></div>}
        <AttendanceCard key={active.id} tenant={active} choice={choices.get(active.id)} onHere={() => here(active.id)} onNotHere={() => notHere(active.id)} onSkip={() => skip(active.id)} />
        <div className="mt-2 grid grid-cols-3 gap-2 md:mt-4">
          <Button variant="outlineDanger" className="min-h-[48px] px-2 md:min-h-[52px]" onClick={() => notHere(active.id)}><X className="h-4 w-4" /> Not here</Button>
          <Button variant="secondary" className="min-h-[48px] px-2 md:min-h-[52px]" onClick={() => skip(active.id)} disabled={queue.length <= 1 && !jumpId}><ChevronsDown className="h-4 w-4" /> Skip</Button>
          <Button variant="success" className="min-h-[48px] px-2 md:min-h-[52px]" onClick={() => here(active.id)}><Check className="h-4 w-4" /> Here</Button>
        </div>
        <p className="mt-3 hidden text-center text-[12px] text-muted md:block">Swipe left: Not here · down: Skip · right: Here</p>
      </div> : <Card className="mx-auto max-w-[500px]"><EmptyState title={roster.length ? "Roll call complete" : "Nobody on this roster"} hint={roster.length ? "Search to correct a choice, or save this attendance." : "You can still save an empty attendance entry."} /></Card>}

      <div className="sticky bottom-0 z-10 mt-3 flex items-center justify-between gap-3 border-t border-hairline bg-surface px-3 py-2 pb-safe-bottom md:mt-6 md:px-4 md:py-3">
        <span className="text-[13px] font-semibold text-ink">{presentCount} here</span>
        <Button onClick={() => void save()} disabled={saving || Boolean(promptId)} className="min-h-[48px] flex-1 max-w-[240px]">{saving ? "Saving…" : "Save attendance"}</Button>
      </div>

      <SignaturePrompt key={promptId ?? "closed"} tenantName={promptId ? byId.get(promptId)?.displayName ?? null : null} alreadyPresent={!promptCreated} alreadySigned={promptChoice?.status === "here" && Boolean(promptChoice.signature)} onClose={closePrompt} onSign={commit} onSkip={() => commit(null)} onRemove={removeFromAttendance} />
    </>
  );
}

function AttendanceCard({ tenant, choice, onHere, onNotHere, onSkip }: { tenant: Tenant; choice?: Choice; onHere: () => void; onNotHere: () => void; onSkip: () => void }) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const start = useRef<{ x: number; y: number; pointerId: number; axis?: "x" | "y" } | null>(null);
  function down(event: React.PointerEvent<HTMLDivElement>) {
    start.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Best effort. */ }
  }
  function move(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = start.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const x = event.clientX - gesture.x;
    const y = event.clientY - gesture.y;
    if (!gesture.axis) { if (Math.hypot(x, y) < 10) return; gesture.axis = Math.abs(y) > Math.abs(x) ? "y" : "x"; }
    setDrag(gesture.axis === "x" ? { x, y: 0 } : { x: 0, y: Math.max(0, y) });
  }
  function up(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = start.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    start.current = null;
    const x = event.clientX - gesture.x;
    const y = event.clientY - gesture.y;
    setDrag({ x: 0, y: 0 });
    if (gesture.axis === "x" && x > 100) onHere();
    else if (gesture.axis === "x" && x < -100) onNotHere();
    else if (gesture.axis === "y" && y > 85) onSkip();
  }
  return <Card className="relative flex min-h-[220px] select-none flex-col items-center justify-center overflow-hidden px-4 py-4 text-center shadow-panel md:min-h-[350px] md:px-5 md:py-7"
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { start.current = null; setDrag({ x: 0, y: 0 }); }}
    style={{ transform: `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${drag.x / 22}deg)`, transition: start.current ? "none" : "transform 180ms ease-out", touchAction: "none" }}>
    <span className="pointer-events-none absolute left-5 top-5 rotate-[-10deg] rounded-input border-2 border-status-greenDot px-2 py-1 text-[16px] font-extrabold text-status-greenText" style={{ opacity: Math.min(1, Math.max(0, drag.x / 100)) }}>HERE</span>
    <span className="pointer-events-none absolute right-5 top-5 rotate-[10deg] rounded-input border-2 border-status-redDot px-2 py-1 text-[16px] font-extrabold text-status-redText" style={{ opacity: Math.min(1, Math.max(0, -drag.x / 100)) }}>NOT HERE</span>
    <span className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-input border-2 border-status-blueDot px-2 py-1 text-[16px] font-extrabold text-status-blueText" style={{ opacity: Math.min(1, drag.y / 85) }}>SKIP</span>
    <Avatar name={tenant.displayName} color={tintFor(tenant.id)} size={60} />
    <h2 className="mt-2 max-w-full text-[22px] font-heading font-extrabold leading-tight text-ink md:mt-4 md:text-[25px]">{tenant.displayName}</h2>
    {tenant.preferredName && <p className="mt-1 text-[13px] text-muted">{tenant.firstName} {tenant.lastName}</p>}
    <p className="mt-1 text-[15px] font-semibold text-ink md:mt-3 md:text-[16px]">{tenant.unit ? `Unit ${tenant.unit}` : "No unit"}</p>
    <p className={cn("mt-3 rounded-pill px-3 py-1 text-[12px] font-semibold md:mt-5", choice?.status === "here" ? "bg-status-greenBg text-status-greenText" : choice?.status === "not-here" ? "bg-status-redBg text-status-redText" : "bg-subtle text-muted")}>{status(choice, false)}</p>
  </Card>;
}
