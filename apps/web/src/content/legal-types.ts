/**
 * Legal documents are data. Strings may use three inline marks, and nothing else:
 *   **bold**   `code`   [label](href)
 * `href` is an absolute https URL, a mailto: address or a site path such as /privacy.
 */
export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

export type LegalSection = {
  /** Anchor id, unique in the document, kebab-case. */
  id: string;
  heading: string;
  blocks: LegalBlock[];
};

export type LegalDoc = {
  title: string;
  /** One-sentence summary for the slip and the meta description. */
  summary: string;
  /** ISO date, YYYY-MM-DD. */
  effectiveDate: string;
  intro: LegalBlock[];
  sections: LegalSection[];
};
