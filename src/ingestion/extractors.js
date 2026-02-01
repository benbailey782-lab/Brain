import fs from 'fs';

/**
 * Extract text from PDF file
 */
export async function extractPdfText(filePath) {
  const pdfParse = (await import('pdf-parse')).default;
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

/**
 * Extract text from DOCX file
 */
export async function extractDocxText(filePath) {
  const mammoth = (await import('mammoth')).default;
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}
