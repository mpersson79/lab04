import { useMemo } from "react";

/**
 * A deliberately tiny Markdown renderer for model output.
 *
 * Everything is HTML-escaped before any formatting is applied, so model text
 * can never inject markup. It covers what agents actually emit - headings,
 * lists, bold, inline code, fenced code, links - and leaves anything more
 * exotic as plain text rather than pulling in a parser.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code class="rounded bg-hover px-1 py-0.5 font-mono text-[0.9em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer noopener" class="text-accent underline underline-offset-2">$1</a>',
    )
    .replace(
      /(^|[\s])(https?:\/\/[^\s<]+)/g,
      '$1<a href="$2" target="_blank" rel="noreferrer noopener" class="text-accent underline underline-offset-2">$2</a>',
    );
}

function toHtml(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let inCode = false;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      closeList();
      out.push(
        inCode
          ? "</code></pre>"
          : '<pre class="my-2 overflow-x-auto rounded-lg border border-line bg-ground p-3"><code class="font-mono text-[12px] leading-relaxed">',
      );
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      out.push(`${escapeHtml(line)}\n`);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1]!.length;
      const sizes = ["text-[17px]", "text-[15px]", "text-[14px]", "text-[13px]"];
      out.push(
        `<h${level} class="mt-4 mb-1.5 font-semibold text-ink ${sizes[level - 1]}">${inline(heading[2] ?? "")}</h${level}>`,
      );
      continue;
    }

    if (/^\s*([-*+])\s+/.test(line)) {
      if (listType !== "ul") {
        closeList();
        out.push('<ul class="my-1.5 ml-4 list-disc space-y-1">');
        listType = "ul";
      }
      out.push(`<li>${inline(line.replace(/^\s*[-*+]\s+/, ""))}</li>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (listType !== "ol") {
        closeList();
        out.push('<ol class="my-1.5 ml-4 list-decimal space-y-1">');
        listType = "ol";
      }
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ""))}</li>`);
      continue;
    }

    closeList();
    if (/^\s*---+\s*$/.test(line)) {
      out.push('<hr class="my-3 border-line" />');
    } else if (line.trim() === "") {
      out.push("");
    } else if (/^\s*>\s?/.test(line)) {
      out.push(
        `<blockquote class="my-2 border-l-2 border-line pl-3 text-ink-muted">${inline(line.replace(/^\s*>\s?/, ""))}</blockquote>`,
      );
    } else {
      out.push(`<p class="my-1.5 leading-relaxed">${inline(line)}</p>`);
    }
  }

  if (inCode) out.push("</code></pre>");
  closeList();
  return out.join("");
}

export default function Markdown({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => toHtml(source), [source]);
  return (
    <div
      className={className}
      // Safe: `toHtml` escapes every character of the source before adding markup.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
