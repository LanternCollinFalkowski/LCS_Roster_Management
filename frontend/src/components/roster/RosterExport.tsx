import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, MoreHorizontal, Printer, Sheet as SheetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { API_BASE, ApiError } from "@/lib/api";

export type ExportFormat = "csv" | "xlsx" | "pdf";

/** What's on screen: the site selection, the tab, and the search box. */
export interface RosterView {
  site?: string;
  status: "active" | "attention" | "archived";
  q: string;
}

function exportUrl(view: RosterView, format: ExportFormat, inline = false) {
  const p = new URLSearchParams({ format, status: view.status });
  if (view.site) p.set("site", view.site);
  if (view.q.trim()) p.set("q", view.q.trim());
  if (inline) p.set("inline", "1");
  return `${API_BASE}/tenants/export?${p}`;
}

async function fetchFile(url: string): Promise<{ blob: Blob; name: string }> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, msg);
  }
  const name = /filename="?([^"]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "roster";
  return { blob: await res.blob(), name };
}

/**
 * iOS and iPadOS can't print a PDF from a hidden frame, and Android's viewer is
 * similar — there, the PDF opens in its own tab, whose share sheet has Print.
 */
const mobileBrowser = () =>
  /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Download (CSV / Excel / PDF) and Print for the current roster view.
 * Everything comes from the server, so the file matches the screen and the
 * export is audited there.
 */
export function useRosterExport(view: RosterView) {
  const toast = useToast();
  const [busy, setBusy] = useState<ExportFormat | "print" | null>(null);

  async function download(format: ExportFormat) {
    setBusy(format);
    try {
      const { blob, name } = await fetchFile(exportUrl(view, format));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function print() {
    if (mobileBrowser()) {
      // Opened synchronously inside the tap, or the popup blocker eats it.
      window.open(exportUrl(view, "pdf", true), "_blank", "noopener");
      return;
    }
    setBusy("print");
    try {
      const { blob } = await fetchFile(exportUrl(view, "pdf", true));
      const url = URL.createObjectURL(blob);
      // Load the PDF into an invisible frame and ask it to print: the browser's
      // own print dialog opens over the app, with the PDF as the document.
      const frame = document.createElement("iframe");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
      frame.src = url;
      frame.onload = () => {
        setTimeout(() => {
          try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
          } catch {
            // Some browsers refuse to script their PDF viewer — show it instead.
            window.open(url, "_blank");
          }
          setBusy(null);
        }, 250);
        // Leave the frame long enough for the dialog; it must outlive print().
        setTimeout(() => {
          frame.remove();
          URL.revokeObjectURL(url);
        }, 60_000);
      };
      document.body.appendChild(frame);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not prepare the printout.", "error");
      setBusy(null);
    }
  }

  return { download, print, busy };
}

function ExportItems({ download, busy }: { download: (f: ExportFormat) => void; busy: string | null }) {
  const item = (format: ExportFormat, Icon: typeof FileText, label: string, hint: string) => (
    <DropdownMenuItem onSelect={() => download(format)} disabled={busy !== null} className="min-h-[44px] md:min-h-0">
      {busy === format ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : <Icon className="h-4 w-4 text-muted" />}
      <span className="flex-1">
        <span className="block">{label}</span>
        <span className="block text-micro text-muted">{hint}</span>
      </span>
    </DropdownMenuItem>
  );
  return (
    <>
      {item("csv", SheetIcon, "CSV", "Plain spreadsheet data")}
      {item("xlsx", FileSpreadsheet, "Excel", "Formatted table with filters")}
      {item("pdf", FileText, "PDF", "Print-ready, grouped by site")}
    </>
  );
}

/** Desktop: a Print button and an Export menu, side by side. */
export function RosterExportButtons({ view, disabled }: { view: RosterView; disabled?: boolean }) {
  const { download, print, busy } = useRosterExport(view);
  return (
    <>
      <Button variant="secondary" onClick={() => void print()} disabled={disabled || busy !== null} title="Print this roster">
        {busy === "print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Print
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" disabled={disabled}>
            {busy && busy !== "print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[240px]">
          <DropdownMenuLabel>Export what's shown</DropdownMenuLabel>
          <ExportItems download={download} busy={busy} />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

/** Phone: one "…" button beside Add, holding Print and the three formats. */
export function RosterExportMenu({ view, disabled }: { view: RosterView; disabled?: boolean }) {
  const { download, print, busy } = useRosterExport(view);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" disabled={disabled} className="min-h-[44px] w-11 px-0" aria-label="Print or export">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <MoreHorizontal className="h-5 w-5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[240px]">
        <DropdownMenuItem onSelect={() => void print()} disabled={busy !== null} className="min-h-[44px]">
          <Printer className="h-4 w-4 text-muted" /> Print
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Export what's shown</DropdownMenuLabel>
        <ExportItems download={download} busy={busy} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
