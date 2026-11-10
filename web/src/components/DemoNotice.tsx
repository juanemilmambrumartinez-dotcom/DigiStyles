import { brand } from "@/config/brand.config";

export function DemoNotice() {
  if (!brand.demo.enabled) return null;

  return (
    <aside
      role="note"
      className="border-[var(--brand-border-width)] border-foreground bg-accent p-3 font-bold text-background"
    >
      {brand.demo.notice}
    </aside>
  );
}