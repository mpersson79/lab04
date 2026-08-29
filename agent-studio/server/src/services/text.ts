import { HttpError } from "../errors.ts";

const BLOCK_TAGS = /<\/(p|div|section|article|li|h[1-6]|tr|td|blockquote|pre)>/gi;

/** Strip a chunk of HTML down to something worth indexing. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(BLOCK_TAGS, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function titleFromHtml(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match?.[1] ? htmlToText(match[1]).trim() || null : null;
}

const BINARY_EXTENSIONS = /\.(png|jpe?g|gif|webp|zip|gz|tar|docx|xlsx|pptx|bin|exe|so|dylib)$/;

/** Decode an uploaded document into plain text, or explain why we cannot. */
export function decodeDocument(
  bytes: Buffer,
  filename: string,
  contentType = "",
): { text: string; title: string | null } {
  const lower = filename.toLowerCase();
  const type = contentType.toLowerCase();

  if (lower.endsWith(".pdf") || type.includes("application/pdf")) {
    throw new HttpError(
      415,
      "PDFs are not parsed yet. Export the pages as text or Markdown and upload that.",
    );
  }
  if (BINARY_EXTENSIONS.test(lower)) {
    throw new HttpError(
      415,
      `${filename} is a binary format. Knowledge bases take text: .txt, .md, .json, .csv, .html and source files.`,
    );
  }

  const raw = bytes.toString("utf8");
  if (raw.includes("\u0000")) {
    throw new HttpError(415, `${filename} does not look like text.`);
  }

  if (lower.endsWith(".html") || lower.endsWith(".htm") || type.includes("text/html")) {
    return { text: htmlToText(raw), title: titleFromHtml(raw) };
  }
  return { text: raw, title: null };
}

/** Fetch a URL and reduce it to text. */
export async function fetchAsText(url: string): Promise<{ text: string; title: string | null }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(400, `"${url}" is not a valid URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new HttpError(400, "Only http and https URLs can be ingested.");
  }

  const response = await fetch(parsed, {
    headers: { "user-agent": "agent-studio/1.0 (+knowledge ingest)" },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new HttpError(502, `${parsed.href} returned ${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (contentType.includes("text/html") || /^\s*<(!doctype|html)/i.test(body)) {
    return { text: htmlToText(body), title: titleFromHtml(body) };
  }
  return { text: body, title: null };
}
