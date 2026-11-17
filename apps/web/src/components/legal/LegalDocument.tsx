import type { LegalBlock, LegalDoc } from "@/content/legal-types";
import { renderInline } from "./renderInline";
import styles from "./LegalDocument.module.css";

export function formatEffectiveDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === "p") return <p>{renderInline(block.text)}</p>;
  const items = block.items.map((item, i) => <li key={i}>{renderInline(item)}</li>);
  return block.type === "ul" ? <ul>{items}</ul> : <ol>{items}</ol>;
}

/** Body of a legal page. The page's <h1> is in the `PageSlip` above it. */
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  return (
    <article className={`container ${styles.doc}`}>
      <div className="measure">
        <p className="small muted">Effective {formatEffectiveDate(doc.effectiveDate)}</p>
        {doc.intro.map((block, i) => (
          <Block key={i} block={block} />
        ))}
        {doc.sections.map((s) => (
          <section id={s.id} key={s.id}>
            <h2>{s.heading}</h2>
            {s.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
