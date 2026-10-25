import { cn } from "@/lib/utils";

/** Admin-written plain text: a blank line starts a new paragraph. Rendered as text, never HTML. */
export function Paragraphs({ text, className }: { text: string; className?: string }) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}
