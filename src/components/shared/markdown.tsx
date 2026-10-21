import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";

import { cn } from "@/lib/utils";

// Admin-written Markdown (Terms, Privacy policy). Raw HTML is never rendered (`skipHtml`), and only
// http(s)/mailto/tel links and relative paths are kept (react-markdown's default URL transform).
// Styled with the site's tokens instead of a typography plugin.

const components: ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: (p) => <h2 className="mt-12 text-display-sm text-ink first:mt-0" {...stripNode(p)} />,
  h2: (p) => <h2 className="mt-12 text-display-sm text-ink first:mt-0" {...stripNode(p)} />,
  h3: (p) => <h3 className="mt-8 text-lg font-medium text-ink" {...stripNode(p)} />,
  h4: (p) => <h4 className="mt-6 font-medium text-ink" {...stripNode(p)} />,
  p: (p) => <p className="mt-4 leading-relaxed text-ink" {...stripNode(p)} />,
  ul: (p) => (
    <ul
      className="mt-4 list-disc space-y-2 pl-6 text-ink marker:text-ink-muted"
      {...stripNode(p)}
    />
  ),
  ol: (p) => (
    <ol
      className="mt-4 list-decimal space-y-2 pl-6 text-ink marker:text-ink-muted"
      {...stripNode(p)}
    />
  ),
  a: (p) => (
    <a
      className="text-brand underline underline-offset-4 hover:text-brand-deep"
      {...stripNode(p)}
    />
  ),
  strong: (p) => <strong className="font-medium text-ink" {...stripNode(p)} />,
  blockquote: (p) => (
    <blockquote className="mt-4 border-l-2 border-line pl-4 text-ink-muted" {...stripNode(p)} />
  ),
  hr: () => <hr className="my-10 border-line" />,
  table: (p) => (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm" {...stripNode(p)} />
    </div>
  ),
  th: (p) => <th className="border-b border-line py-2 pr-4 font-medium" {...stripNode(p)} />,
  td: (p) => <td className="border-b border-line py-2 pr-4" {...stripNode(p)} />,
  img: () => null,
};

/** react-markdown passes its AST `node` to every component; keep it off the DOM element. */
function stripNode<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("max-w-[70ch]", className)}>
      <ReactMarkdown skipHtml components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
