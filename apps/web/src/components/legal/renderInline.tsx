import Link from "next/link";
import type { ReactNode } from "react";

const MARKS = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Turns the three inline marks used in legal text into elements:
 * **bold**, `code`, [label](href). Marks do not nest. Site paths use next/link,
 * other hrefs are plain anchors (https links get rel="noopener noreferrer").
 */
export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(MARKS)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    if (m[1] !== undefined) {
      out.push(<strong key={key++}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      out.push(<code key={key++}>{m[2]}</code>);
    } else {
      const label = m[3];
      const href = m[4];
      if (href.startsWith("/")) {
        out.push(
          <Link key={key++} href={href}>
            {label}
          </Link>,
        );
      } else {
        out.push(
          <a key={key++} href={href} rel={href.startsWith("https:") ? "noopener noreferrer" : undefined}>
            {label}
          </a>,
        );
      }
    }
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
