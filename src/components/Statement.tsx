import { renderStatementHtml } from "@/lib/render/statement";

export async function Statement({ latex }: { latex: string }) {
  const html = await renderStatementHtml(latex);
  return (
    <div
      className="statement space-y-3 leading-relaxed [&_p]:my-2"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
