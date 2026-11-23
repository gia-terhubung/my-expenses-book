/** Topics with an (i) explanation. Text: info.<topic>.title / .summary / .body (paragraphs split on a blank line). */
export type InfoTopic = "payCycle" | "taxYear" | "homeCurrency" | "lockAfter" | "unconverted" | "pace";

export const infoKey = (topic: InfoTopic, part: "title" | "summary" | "body") => `info.${topic}.${part}`;

export const paragraphs = (text: string) => text.split("\n\n").filter((p) => p.trim() !== "");
