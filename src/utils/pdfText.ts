/**
 * PDF text extraction.
 *
 * pdf.js used to be pulled from a CDN by an inline <script> in index.html, which
 * meant PDF imports threw "pdfjsLib is not defined" whenever the CDN was slow,
 * blocked, or the app was running offline as an installed PWA. It is now a local
 * dependency loaded on demand, so it works offline and never blocks first paint.
 */
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url"))
    .default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const pdf = await pdfjs.getDocument({ data }).promise;
  let text = "";
  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      text +=
        content.items
          .map((item: any) => ("str" in item ? item.str : ""))
          .join(" ") + "\n";
    }
  } finally {
    await pdf.cleanup();
  }
  return text;
}
