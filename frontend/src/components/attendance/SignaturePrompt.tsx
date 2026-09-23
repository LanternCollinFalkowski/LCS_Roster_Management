import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";

/**
 * Full-screen "sign here" prompt — opened the moment someone is marked
 * present. Built directly on the Radix dialog primitive rather than the boxed
 * `Sheet`/`Dialog` wrappers: the canvas needs the whole screen, not a sheet's
 * rounded corners and drag handle eating into it.
 */
export function SignaturePrompt({
  tenantName,
  alreadyPresent,
  alreadySigned,
  onClose,
  onSign,
  onSkip,
  onRemove,
}: {
  tenantName: string | null;
  /** Reopening an existing entry (to redo/clear/remove) vs. the first "just marked present" prompt. */
  alreadyPresent: boolean;
  alreadySigned: boolean;
  onClose: () => void;
  onSign: (signature: string) => void;
  onSkip: () => void;
  onRemove: () => void;
}) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [empty, setEmpty] = useState(true);
  const open = tenantName !== null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(35,42,58,0.5)]" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col bg-surface focus:outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
          aria-describedby={undefined}
        >
          <div className="flex flex-none items-start gap-2 border-b border-hairline px-4 pb-3 pt-safe-top">
            <div className="min-w-0 flex-1 pt-2">
              <DialogPrimitive.Title className="truncate text-[19px] font-heading font-extrabold text-ink">{tenantName}</DialogPrimitive.Title>
              <p className="mt-0.5 text-[13px] text-muted">
                {alreadySigned ? "Already signed — sign again to replace it." : "Sign here to confirm they're present."}
              </p>
            </div>
            <DialogPrimitive.Close className="mt-1 rounded-input p-2 text-muted hover:bg-rowhover" aria-label="Close">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 p-4">
            <SignaturePad ref={padRef} onChangeEmpty={setEmpty} className="h-full w-full" />
          </div>

          <div className="flex flex-none flex-col gap-2 border-t border-hairline px-4 pb-safe-bottom pt-3">
            <div className="flex gap-2">
              <Button variant="secondary" className="min-h-[48px] flex-1" onClick={() => padRef.current?.clear()}>
                Clear
              </Button>
              <Button
                className="min-h-[48px] flex-1"
                disabled={empty}
                onClick={() => {
                  const data = padRef.current?.toDataURL();
                  if (data) onSign(data);
                }}
              >
                Sign & save
              </Button>
            </div>
            <Button variant="ghost" className="min-h-[44px]" onClick={onSkip}>
              {alreadySigned ? "Remove signature — keep marked present" : "Skip signature — just mark present"}
            </Button>
            {alreadyPresent && (
              <Button variant="outlineDanger" className="min-h-[44px]" onClick={onRemove}>
                Remove from attendance
              </Button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
