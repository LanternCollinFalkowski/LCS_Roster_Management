import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

export function Avatar({ name, color, size = 32, className, style }: { name: string; color?: string | null; size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full text-center font-heading font-bold leading-none text-white", className)}
      // Caller's style last, so a layout tweak that depends on `size` — the
      // overlap in a stack of viewers, say — can be passed in without this
      // component growing a prop for it.
      style={{ width: size, height: size, backgroundColor: color || "#2c3453", fontSize: size * 0.4, ...style }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
