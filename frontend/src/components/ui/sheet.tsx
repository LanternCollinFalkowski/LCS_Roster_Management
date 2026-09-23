import * as DialogPrimitive from "@radix-ui/react-dialog";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet — the phone form of a side rail or a wide dialog.
 *
 * Same Radix dialog underneath as `<Dialog>`, so focus trapping, Escape and the
 * scroll lock behave identically; only the geometry differs. It rises from the
 * bottom edge, caps at 88% of the viewport, and reserves the home-indicator
 * strip in its footer, so the primary action is never under the gesture bar.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export const SheetContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="sheet-overlay fixed inset-0 z-50 bg-[rgba(35,42,58,0.5)]" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "sheet-panel fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col",
        "rounded-t-[16px] bg-surface shadow-modal focus:outline-none",
        className
      )}
      {...props}
    >
      {/* Grab handle. Presentational — the sheet is dismissed by the overlay,
          Escape or its own Cancel button, not by dragging. */}
      <div className="flex flex-none justify-center pt-[9px]" aria-hidden="true">
        <span className="h-[5px] w-11 rounded-pill bg-strongline" />
      </div>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

export function SheetHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-none items-center gap-2 border-b border-hairline px-4 pb-3 pt-2">
      <DialogPrimitive.Title className="text-[19px] font-heading font-extrabold text-ink">{title}</DialogPrimitive.Title>
      <span className="flex-1" />
      {action}
    </div>
  );
}

export function SheetBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto scroll-thin px-4 py-3.5", className)}>{children}</div>;
}

/**
 * Sticky footer. `pb-safe-bottom` adds the home-indicator inset on top of its
 * own padding, so the buttons clear the gesture bar on a notched phone and stay
 * at 12px on a device without one.
 */
export function SheetFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-none items-center gap-2.5 border-t border-hairline px-4 pb-safe-bottom pt-3", className)}>
      {children}
    </div>
  );
}
