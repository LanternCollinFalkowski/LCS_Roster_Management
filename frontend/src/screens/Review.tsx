import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CheckCircle2, ChevronRight, Clock3, Undo2, X } from "lucide-react";
import { Page, PageHeader } from "@/components/shell/AppShell";
import { PhoneHeader } from "@/components/shell/PhoneHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, LoadingState } from "@/components/ui/misc";
import { RemoveDialog } from "@/components/roster/RemoveDialog";
import { useRosterActions } from "@/components/roster/useRosterActions";
import { useReviewQueue } from "@/lib/queries";
import { SitePicker, useSiteSelection } from "@/lib/site";
import { useAuth } from "@/lib/auth";
import { cn, formatDate, quietFor, relativeTime, tintFor } from "@/lib/utils";
import type { Tenant } from "@/lib/types";

/** How far a card must travel before letting go commits the swipe. */
const THRESHOLD = 110;

/**
 * The 48-hour review queue.
 *
 * Everyone whose attention clock — the latest of "added", "appeared on a
 * form", "a person confirmed they're here" — is older than the threshold. One
 * card at a time: swipe right (or →) to keep, which restarts their clock; swipe
 * left (or ←) to remove, which always asks for a reason first. Buttons do the
 * same for anyone who can't or won't swipe.
 *
 * Cards leave optimistically: the swipe animates immediately and the request
 * follows. A failure puts the card back and says so.
 */
export function ReviewPage() {
  const { can } = useAuth();
  const { codes, setCodes, selected, param } = useSiteSelection();
  const { data, isLoading } = useReviewQueue(param);
  const multiSite = selected.length > 1;
  const { keep, remove } = useRosterActions();

  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<string[]>([]);
  const [exit, setExit] = useState<{ id: string; dir: "left" | "right" } | null>(null);
  const [confirming, setConfirming] = useState<Tenant | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  // New selection, new queue.
  useEffect(() => {
    setHandled(new Set());
    setSkipped([]);
    setDone(0);
  }, [param]);

  const queue = useMemo(() => {
    const items = (data?.items ?? []).filter((t) => !handled.has(t.id));
    // Skipped cards go to the back, in the order they were skipped.
    const rank = (t: Tenant) => (skipped.includes(t.id) ? 1 + skipped.indexOf(t.id) : 0);
    return [...items].sort((a, b) => rank(a) - rank(b));
  }, [data, handled, skipped]);

  const top = queue[0];
  const canAct = can("roster.edit");
  const canRemove = can("roster.archive");
  const hours = data?.attentionHours ?? 48;

  const markHandled = (id: string, yes: boolean) =>
    setHandled((h) => {
      const next = new Set(h);
      if (yes) next.add(id);
      else next.delete(id);
      return next;
    });

  /**
   * Fly the top card off, then drop it from the queue. The timer lives here,
   * not in the card: the refetch that follows a decision can remove the person
   * from the data before the animation ends, unmounting the card — a timer
   * inside it would be cancelled and leave the queue locked.
   */
  const leave = (id: string, dir: "left" | "right") => {
    setExit({ id, dir });
    setTimeout(() => {
      markHandled(id, true);
      setExit(null);
    }, 300);
  };

  const doKeep = useCallback(
    async (t: Tenant) => {
      if (!canAct || exit) return;
      // Only the top card is on screen to animate; list rows just drop out.
      if (t.id === queue[0]?.id) leave(t.id, "right");
      else markHandled(t.id, true);
      const ok = await keep(t);
      if (ok) setDone((n) => n + 1);
      // After the exit animation has marked it handled — put the card back.
      else setTimeout(() => markHandled(t.id, false), 400);
    },
    [canAct, exit, keep, queue]
  );

  const askRemove = useCallback(
    (t: Tenant) => {
      if (!canRemove || exit) return;
      setConfirming(t);
    },
    [canRemove, exit]
  );

  async function confirmRemove(reason: string, note: string) {
    const t = confirming;
    if (!t) return;
    setBusy(true);
    setConfirming(null);
    if (t.id === queue[0]?.id) leave(t.id, "left");
    else markHandled(t.id, true);
    const ok = await remove(t, reason, note);
    setBusy(false);
    if (ok) setDone((n) => n + 1);
    else setTimeout(() => markHandled(t.id, false), 400);
  }

  function skip(t: Tenant) {
    setSkipped((s) => [...s.filter((id) => id !== t.id), t.id]);
  }

  // Keyboard: ← remove, → keep, S skip — only while no dialog is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!top || confirming || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowRight") void doKeep(top);
      else if (e.key === "ArrowLeft") askRemove(top);
      else if (e.key.toLowerCase() === "s") skip(top);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top, confirming, doKeep, askRemove]);

  const subtitle = `Not on any form or confirmed in ${hours}+ hours`;

  return (
    <div className="flex min-h-full flex-col">
      <PhoneHeader title="Review" subtitle={subtitle}>
        <SitePicker codes={codes} onChange={setCodes} className="mt-3" />
      </PhoneHeader>

      <Page className="w-full max-w-[980px] flex-1">
        <div className="hidden md:block">
          <PageHeader
            title="Review"
            subtitle={`${subtitle}. Swipe or use ← → to decide.`}
            actions={<SitePicker codes={codes} onChange={setCodes} className="w-[260px]" />}
          />
        </div>

        {isLoading ? (
          <LoadingState label="Loading the queue…" />
        ) : !top ? (
          <Card className="page-list-item-enter">
            <EmptyState
              icon={<CheckCircle2 className="h-10 w-10 text-status-greenDot" />}
              title={done ? `All caught up — ${done} reviewed` : "All caught up"}
              hint={
                selected.length === 0
                  ? "You aren't assigned to any sites yet. Ask an administrator to add you to one."
                  : `Everyone ${multiSite ? `across ${selected.length} sites ` : "here "}has been on a form or confirmed in the last ${hours} hours.`
              }
            />
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(0,420px)_1fr] md:items-start">
            <div>
              <div className="mb-3 flex items-center justify-between text-[13px] text-muted">
                <span>
                  <strong className="tabular text-ink">{queue.length}</strong> to review
                  {done > 0 && <> · {done} done</>}
                </span>
                <button onClick={() => skip(top)} className="inline-flex min-h-[40px] items-center gap-1 font-semibold text-accent dark:text-white">
                  <Undo2 className="h-3.5 w-3.5" /> Later
                </button>
              </div>

              <div className="relative mx-auto h-[392px] w-full max-w-[420px] select-none">
                {queue.slice(0, 3).reverse().map((t) => {
                  const depth = queue.indexOf(t);
                  return (
                    <SwipeCard
                      key={t.id}
                      tenant={t}
                      depth={depth}
                      hours={hours}
                      showSite={multiSite}
                      exit={exit?.id === t.id ? exit.dir : null}
                      canKeep={canAct}
                      canRemove={canRemove}
                      onSwipeRight={() => void doKeep(t)}
                      onSwipeLeft={() => askRemove(t)}
                    />
                  );
                })}
              </div>

              {(canAct || canRemove) && (
                <div className="mt-5 flex items-center justify-center gap-8">
                  <RoundAction label="Remove" tone="red" disabled={!canRemove || Boolean(exit)} onClick={() => askRemove(top)}>
                    <X className="h-7 w-7" strokeWidth={2.6} />
                  </RoundAction>
                  <RoundAction label="Keep" tone="green" disabled={!canAct || Boolean(exit)} onClick={() => void doKeep(top)}>
                    <Check className="h-7 w-7" strokeWidth={2.6} />
                  </RoundAction>
                </div>
              )}
              <p className="mt-3 text-center text-micro text-muted">
                Swipe left to remove · right if they're still here
              </p>
            </div>

            {/* Desktop: the rest of the queue, actionable in place. */}
            <Card className="hidden md:block">
              <p className="kicker border-b border-hairline px-4 py-3">Up next</p>
              <ul className="max-h-[520px] overflow-y-auto scroll-thin">
                {queue.slice(1, 40).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 border-b border-hairline px-4 py-2.5 last:border-0">
                    <Avatar name={t.displayName} color={tintFor(t.id)} size={30} />
                    <Link to={`/tenants/${t.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{t.displayName}</p>
                      <p className="truncate text-micro text-muted">
                        {[t.unit && `Unit ${t.unit}`, multiSite && t.site?.name, `quiet ${quietFor(t.hoursQuiet)}`].filter(Boolean).join(" · ")}
                      </p>
                    </Link>
                    {canRemove && (
                      <Button size="sm" variant="secondary" onClick={() => askRemove(t)} title="Remove">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canAct && (
                      <Button size="sm" variant="secondary" onClick={() => void doKeep(t)} title="Keep">
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
                {queue.length === 1 && <li className="px-4 py-6 text-center text-[13px] text-muted">This is the last one.</li>}
              </ul>
            </Card>
          </div>
        )}
      </Page>

      <RemoveDialog tenant={confirming} busy={busy} onCancel={() => setConfirming(null)} onConfirm={confirmRemove} />
    </div>
  );
}

function RoundAction({
  label, tone, disabled, onClick, children,
}: { label: string; tone: "red" | "green"; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex flex-col items-center gap-1.5 disabled:opacity-40"
    >
      <span
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full border-2 bg-surface shadow-card transition-transform active:scale-95",
          tone === "red" ? "border-status-redDot text-status-redText" : "border-status-greenDot text-status-greenText"
        )}
      >
        {children}
      </span>
      <span className="text-[12px] font-bold text-muted">{label}</span>
    </button>
  );
}

function SwipeCard({
  tenant: t, depth, hours, showSite, exit, canKeep, canRemove, onSwipeLeft, onSwipeRight,
}: {
  tenant: Tenant;
  depth: number;
  hours: number;
  showSite: boolean;
  exit: "left" | "right" | null;
  canKeep: boolean;
  canRemove: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const isTop = depth === 0;

  function down(e: React.PointerEvent) {
    if (!isTop || exit) return;
    if ((e.target as HTMLElement).closest("a,button")) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }
  function move(e: React.PointerEvent) {
    if (!dragging || !start.current) return;
    let next = e.clientX - start.current.x;
    // Resist in a direction the person isn't allowed to commit.
    if (next > 0 && !canKeep) next = next / 4;
    if (next < 0 && !canRemove) next = next / 4;
    setDx(next);
  }
  function up() {
    if (!dragging) return;
    setDragging(false);
    start.current = null;
    if (dx > THRESHOLD && canKeep) onSwipeRight();
    else if (dx < -THRESHOLD && canRemove) onSwipeLeft();
    setDx(0);
  }

  const offset = exit ? (exit === "right" ? 640 : -640) : dx;
  const rotate = offset / 18;
  const scale = isTop ? 1 : 1 - depth * 0.04;
  const lift = isTop ? 0 : depth * 12;
  const keepOpacity = Math.min(1, Math.max(0, dx / THRESHOLD));
  const removeOpacity = Math.min(1, Math.max(0, -dx / THRESHOLD));

  const lastSeen = t.lastActivityAt
    ? { label: `Last on a form ${relativeTime(t.lastActivityAt)}`, detail: t.lastActivitySource }
    : t.lastKeptAt
      ? { label: `Last confirmed ${relativeTime(t.lastKeptAt)}`, detail: null }
      : { label: "No form activity on record", detail: `on roster since ${formatDate(t.createdAt)}` };

  return (
    <div
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className={cn(
        "absolute inset-0 rounded-[16px] border border-hairline bg-surface shadow-panel",
        isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
        !dragging && "transition-transform duration-300 ease-out"
      )}
      style={{
        transform: `translate3d(${offset}px, ${lift}px, 0) rotate(${rotate}deg) scale(${scale})`,
        touchAction: "pan-y",
        opacity: exit ? 0 : 1,
        transition: dragging ? "none" : "transform 300ms ease-out, opacity 300ms ease-out",
        zIndex: 10 - depth,
      }}
      aria-hidden={!isTop}
    >
      {/* Stamps that fade in as the card travels. */}
      <span
        className="pointer-events-none absolute left-5 top-5 rotate-[-12deg] rounded-input border-[3px] border-status-greenDot px-2.5 py-1 font-heading text-[20px] font-extrabold tracking-wide text-status-greenText"
        style={{ opacity: keepOpacity }}
      >
        KEEP
      </span>
      <span
        className="pointer-events-none absolute right-5 top-5 rotate-[12deg] rounded-input border-[3px] border-status-redDot px-2.5 py-1 font-heading text-[20px] font-extrabold tracking-wide text-status-redText"
        style={{ opacity: removeOpacity }}
      >
        REMOVE
      </span>

      <div className="flex h-full flex-col items-center px-6 pb-5 pt-10 text-center">
        <Avatar name={t.displayName} color={tintFor(t.id)} size={84} />
        <h2 className="mt-4 text-[24px] font-heading font-extrabold leading-tight text-ink">{t.displayName}</h2>
        {t.preferredName && (
          <p className="mt-0.5 text-[13px] text-muted">
            {t.firstName} {t.lastName}
          </p>
        )}
        <p className="mt-2 text-[15px] font-semibold text-ink">
          {[t.unit ? `Unit ${t.unit}` : "No unit", showSite && t.site?.name].filter(Boolean).join(" · ")}
        </p>

        <div className="mt-5 w-full rounded-card bg-status-amberBg px-4 py-3 text-left">
          <p className="flex items-center gap-2 text-[14px] font-bold text-status-amberText">
            <Clock3 className="h-4 w-4" /> Quiet for {quietFor(t.hoursQuiet)}
          </p>
          <p className="mt-1 text-[12.5px] text-status-amberText/90">
            {lastSeen.label}
            {lastSeen.detail ? ` · ${lastSeen.detail}` : ""}
          </p>
        </div>

        <span className="flex-1" />
        <Link
          to={`/tenants/${t.id}`}
          className="inline-flex min-h-[40px] items-center gap-1 text-[13px] font-semibold text-accent dark:text-white"
        >
          Open profile <ChevronRight className="h-4 w-4" />
        </Link>
        <p className="text-micro text-muted">Threshold {hours}h{t.moveInDate ? ` · moved in ${formatDate(t.moveInDate)}` : ""}</p>
      </div>
    </div>
  );
}
