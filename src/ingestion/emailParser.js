/**
 * Email Parser — Extracts structured content from .eml files
 *
 * Parses RFC 2822 email files and returns:
 * - Metadata: from, to, cc, subject, date
 * - Body: plain text (preferred) or stripped HTML
 * - Attachments: array of { filename, contentType, content (Buffer) }
 *
 * The email body becomes a transcript record.
 * Each attachment becomes its own linked transcript record.
 */

import fs from 'fs';
import path from 'path';
import { simpleParser } from 'mailparser';

/**
 * Parse a .eml file and return structured email data
 * @param {string} filepath - Path to the .eml file
 * @returns {Promise<Object>} Parsed email with metadata, body, and attachments
 */
export async function parseEmail(filepath) {
  const raw = fs.readFileSync(filepath);
  const parsed = await simpleParser(raw);

  // Build a clean text body
  // Prefer plaintext; fall back to stripped HTML
  let bodyText = '';
  if (parsed.text) {
    bodyText = parsed.text.trim();
  } else if (parsed.html) {
    // Strip HTML tags for a plain text version
    bodyText = parsed.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Build structured header block for context
  const from = parsed.from?.text || 'Unknown Sender';
  const to = (parsed.to?.text || '').split(',').map(s => s.trim()).filter(Boolean);
  const cc = (parsed.cc?.text || '').split(',').map(s => s.trim()).filter(Boolean);
  const subject = parsed.subject || '(No Subject)';
  const date = parsed.date || null;
  const messageId = parsed.messageId || null;
  const inReplyTo = parsed.inReplyTo || null;

  // Format the full content that gets stored as raw_content
  // This preserves email context so the AI can understand it's an email
  const headerBlock = [
    `From: ${from}`,
    `To: ${to.join(', ')}`,
    cc.length > 0 ? `CC: ${cc.join(', ')}` : null,
    `Subject: ${subject}`,
    `Date: ${date ? date.toISOString() : 'Unknown'}`,
    '---',
    ''
  ].filter(Boolean).join('\n');

  const fullContent = headerBlock + bodyText;

  // Extract attachments (skip inline images under 10KB — usually signatures/logos)
  const attachments = (parsed.attachments || [])
    .filter(att => {
      // Skip tiny inline images (email signatures, tracking pixels)
      if (att.contentDisposition === 'inline' && att.size < 10240) return false;
      // Skip if no useful filename
      if (!att.filename) return false;
      return true;
    })
    .map(att => ({
      filename: att.filename,
      contentType: att.contentType,
      size: att.size,
      content: att.content // Buffer
    }));

  return {
    filepath,
    filename: path.basename(filepath),
    from,
    to,
    cc,
    subject,
    date,
    messageId,
    inReplyTo,
    bodyText,
    fullContent,
    attachments,
    hasAttachments: attachments.length > 0
  };
}

/**
 * Save email attachments to a temporary directory for processing
 * @param {Array} attachments - Parsed attachment objects
 * @param {string} outputDir - Directory to save extracted files
 * @returns {Array<{filename, filepath, contentType, size}>}
 */
export function saveAttachments(attachments, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const saved = [];
  for (const att of attachments) {
    // Sanitize filename: remove path separators, limit length
    const safeName = att.filename
      .replace(/[/\\:*?"<>|]/g, '_')
      .substring(0, 200);

    const filepath = path.join(outputDir, safeName);

    // Handle duplicate filenames by appending counter
    let finalPath = filepath;
    let counter = 1;
    while (fs.existsSync(finalPath)) {
      const ext = path.extname(safeName);
      const base = path.basename(safeName, ext);
      finalPath = path.join(outputDir, `${base}_${counter}${ext}`);
      counter++;
    }

    fs.writeFileSync(finalPath, att.content);
    saved.push({
      filename: path.basename(finalPath),
      filepath: finalPath,
      contentType: att.contentType,
      size: att.size
    });
  }

  return saved;
}

export default { parseEmail, saveAttachments };
