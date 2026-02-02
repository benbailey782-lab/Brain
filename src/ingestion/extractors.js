import fs from 'fs';

/**
 * Extract text from PDF file
 * Uses pdf-parse v2 API: PDFParse class with load() + getText()
 */
export async function extractPdfText(filePath) {
  const { PDFParse } = await import('pdf-parse');
  const buffer = fs.readFileSync(filePath);
  const uint8 = new Uint8Array(buffer);
  const parser = new PDFParse(uint8);

  try {
    await parser.load();
    const result = await parser.getText();
    // v2 returns { pages: [{ text: "..." }, ...] }
    const fullText = result.pages.map(p => p.text).join('\n');
    return fullText;
  } finally {
    parser.destroy();
  }
}

/**
 * Extract text from DOCX file
 */
export async function extractDocxText(filePath) {
  const mammoth = (await import('mammoth')).default;
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}
