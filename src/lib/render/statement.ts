import katex from "katex";
import { codeToHtml } from "shiki";

/**
 * Render a problem statement (LaTeX + light markdown + ```cpp fences) to HTML.
 * Pipeline: split out code fences → Shiki; in the remaining text replace
 * $$…$$ / $…$ with KaTeX HTML via placeholders, escape everything else,
 * split paragraphs on blank lines.
 */

const FENCE = /```(\w*(?:\+\+)?)\r?\n([\s\S]*?)```/g;
const MATH = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
// NUL sentinel: renderMathText strips NUL from its input first (JSON can
// smuggle one in as \u0000-escape), so collisions are impossible.
const PLACEHOLDER = /\u0000(\d+)\u0000/g;

const KNOWN_LANGS = new Set(["cpp", "c", "pascal"]);

function normalizeLang(raw: string): string {
  const lang = raw.toLowerCase().replace("++", "pp");
  if (lang === "") return "cpp";
  return KNOWN_LANGS.has(lang) ? lang : "text";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMathText(text: string): string {
  const rendered: string[] = [];
  const withPlaceholders = text.replaceAll("\u0000", "").replace(MATH, (_match, display, inline) => {
    const source = (display ?? inline) as string;
    const html = katex.renderToString(source, {
      displayMode: display !== undefined,
      throwOnError: false,
    });
    rendered.push(html);
    return "\u0000" + (rendered.length - 1) + "\u0000";
  });

  return withPlaceholders
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p>${escapeHtml(paragraph).replace(/\r?\n/g, "<br />")}</p>`,
    )
    .join("")
    .replace(PLACEHOLDER, (_match, index: string) => rendered[Number(index)]);
}

export async function renderStatementHtml(latex: string): Promise<string> {
  const parts: string[] = [];
  let last = 0;
  for (const match of latex.matchAll(FENCE)) {
    const [full, lang, code] = match;
    if (match.index > last) {
      parts.push(renderMathText(latex.slice(last, match.index)));
    }
    parts.push(
      await codeToHtml(code.replace(/\r?\n$/, ""), {
        lang: normalizeLang(lang),
        theme: "github-light",
      }),
    );
    last = match.index + full.length;
  }
  if (last < latex.length) {
    parts.push(renderMathText(latex.slice(last)));
  }
  return parts.join("");
}
