import { File } from "expo-file-system";
import * as Print from "expo-print";

/** Renders the HTML to a PDF and moves it to outUri (inside cache/export/); returns outUri. */
export async function renderPdf(html: string, outUri: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html });
  const out = new File(outUri);
  const parent = out.parentDirectory;
  if (!parent.exists) parent.create({ intermediates: true, idempotent: true });
  if (out.exists) out.delete();
  new File(uri).move(out);
  return outUri;
}
