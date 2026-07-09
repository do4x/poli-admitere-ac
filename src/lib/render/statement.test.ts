import { describe, expect, it } from "vitest";
import { renderStatementHtml } from "./statement";

describe("renderStatementHtml", () => {
  it("renders inline math with KaTeX", async () => {
    const html = await renderStatementHtml("Fie $x^2=4$ o ecuație.");
    expect(html).toContain("katex");
    expect(html).toContain("<p>");
  });

  it("renders display math in display mode", async () => {
    const html = await renderStatementHtml("Avem:\n\n$$\\int_0^1 x\\,dx$$");
    expect(html).toContain("katex-display");
  });

  it("escapes HTML in plain text", async () => {
    const html = await renderStatementHtml("a < b și <script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("splits paragraphs on blank lines", async () => {
    const html = await renderStatementHtml("Primul.\n\nAl doilea.");
    expect(html.match(/<p>/g)).toHaveLength(2);
  });

  it("does not corrupt digits adjacent to math (placeholder safety)", async () => {
    const html = await renderStatementHtml("a) 49 ; b) $x$ ; c) 56");
    expect(html).toContain("49");
    expect(html).toContain("56");
  });

  it("renders cpp fences with Shiki and leaves math outside intact", async () => {
    const source =
      "Ce afișează?\n\n```cpp\nint main() { return 0; }\n```\n\nPentru $n=5$.";
    const html = await renderStatementHtml(source);
    expect(html).toContain("shiki");
    expect(html).toContain("katex");
    expect(html).not.toContain("```");
  });

  it("preserves backslash commands through KaTeX", async () => {
    const html = await renderStatementHtml("Fie $\\mathbb{R}$.");
    expect(html).toContain("katex");
    expect(html).not.toContain("ParseError");
  });

  it("strips NUL characters so forged placeholders cannot inject content", async () => {
    const nul = String.fromCharCode(0);
    const forged = `Fie $x$ fals: ${nul}0${nul} si ${nul}99${nul}.`;
    const html = await renderStatementHtml(forged);
    expect(html).not.toContain("undefined");
    // Exactly one KaTeX span: the real $x$, not a duplicate via  0 .
    expect(html.match(/class="katex"/g)).toHaveLength(1);
  });
});
