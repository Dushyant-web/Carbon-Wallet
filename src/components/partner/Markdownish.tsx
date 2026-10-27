import React from "react";

/*
 * The little bit of Markdown Partner writes (paragraphs, **bold**, *italic*, `code`, lists, headings and pipe
 * tables), turned into React elements. No HTML is ever injected, so answers can't carry markup.
 */

function inline(text: string, keyBase: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) parts.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) parts.push(<code key={k} className="rounded bg-canvas-subtle px-1 font-mono text-[12.5px]">{tok.slice(1, -1)}</code>);
    else parts.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdownish({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) {
      i++;
      continue;
    }
    // table: header row, --- row, body rows
    if (l.trim().startsWith("|") && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      const head = cells(l);
      const body: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) body.push(cells(lines[i++]));
      blocks.push(
        <div key={key++} className="my-1 overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left">
                {head.map((h, j) => (
                  <th key={j} className="py-1 pr-3 font-semibold">
                    {inline(h, `h${key}${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="border-b border-border/60">
                  {r.map((c, j) => (
                    <td key={j} className="py-1 pr-3 align-top">
                      {inline(c, `c${key}${ri}${j}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/;
    const numbered = /^\s*\d+[.)]\s+(.*)$/;
    if (bullet.test(l) || numbered.test(l)) {
      const ordered = numbered.test(l);
      const re = ordered ? numbered : bullet;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) items.push(re.exec(lines[i++])![1]);
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key++} className={`my-1 flex flex-col gap-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `l${key}${j}`)}</li>
          ))}
        </List>,
      );
      continue;
    }
    const heading = /^#{1,4}\s+(.*)$/.exec(l);
    if (heading) {
      blocks.push(
        <p key={key++} className="mt-1 font-semibold">
          {inline(heading[1], `t${key}`)}
        </p>,
      );
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !bullet.test(lines[i]) && !numbered.test(lines[i]) && !lines[i].trim().startsWith("|") && !/^#{1,4}\s/.test(lines[i])) para.push(lines[i++]);
    blocks.push(
      <p key={key++} className="my-1">
        {para.flatMap((p, j) => (j ? [<br key={`b${j}`} />, ...inline(p, `p${key}${j}`)] : inline(p, `p${key}${j}`)))}
      </p>,
    );
  }
  return <div className="flex flex-col">{blocks}</div>;
}
