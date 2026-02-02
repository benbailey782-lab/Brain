/**
 * Upload API - Handle file uploads and quick notes
 * Phase 3: Track D
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

import * as queries from '../db/queries.js';
import { getAIStatus, processTranscript, getCallAI } from '../processing/processor.js';
import { extractPdfText, extractDocxText } from '../ingestion/extractors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Ensure uploads directory exists
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.md', '.json', '.csv', '.srt'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed. Allowed types: ${allowedExtensions.join(', ')}`));
    }
  }
});

/**
 * Extract text based on file type
 */
async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  switch (ext) {
    case '.pdf':
      return await extractPdfText(filePath);
    case '.docx':
      return await extractDocxText(filePath);
    case '.txt':
    case '.md':
      return fs.readFileSync(filePath, 'utf-8');
    case '.json':
      // For JSON, try to extract text or stringify
      const jsonContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (jsonContent.text) return jsonContent.text;
      if (jsonContent.content) return jsonContent.content;
      if (jsonContent.transcript) return jsonContent.transcript;
      return JSON.stringify(jsonContent, null, 2);
    case '.csv':
      return fs.readFileSync(filePath, 'utf-8');
    case '.srt':
      return fs.readFileSync(filePath, 'utf-8');
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

/**
 * POST /upload - Upload a file
 * Accepts multipart/form-data with a 'file' field
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, path: filePath, filename } = req.file;

    // Extract text from file
    let extractedText;
    try {
      extractedText = await extractText(filePath, originalname);
    } catch (err) {
      // Clean up uploaded file on extraction failure
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: err.message });
    }

    // Validate that we got some text
    if (!extractedText || extractedText.trim().length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'File appears to be empty or could not extract text' });
    }

    // Create transcript record
    const transcriptId = queries.createTranscript({
      filename: originalname,
      filepath: filePath,
      rawContent: extractedText,
      durationMinutes: null,
      callDate: new Date().toISOString(),
      context: `Uploaded file: ${originalname}`
    });

    // Check if we should process immediately
    const aiStatus = getAIStatus();
    let processingStatus = 'queued';
    let processingResult = null;

    if (aiStatus.enabled) {
      try {
        processingStatus = 'processing';
        const tracker = req.trackProcessing?.(transcriptId, originalname);
        processTranscript(transcriptId)
          .then(() => {
            console.log(`Upload processed: ${originalname}`);
            tracker?.complete();
          })
          .catch(err => {
            console.error(`Upload processing failed: ${err.message}`);
            tracker?.fail(err);
          });
      } catch (err) {
        console.error('Processing error:', err.message);
        processingStatus = 'pending';
      }
    } else {
      processingStatus = 'pending';
    }

    res.json({
      success: true,
      transcriptId,
      filename: originalname,
      textLength: extractedText.length,
      processingStatus,
      message: processingStatus === 'processing'
        ? 'File uploaded and processing started'
        : 'File uploaded successfully. Processing will begin when AI is available.'
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /notes - Quick text note capture
 * Accepts JSON body: { title, content, context }
 */
router.post('/notes', async (req, res) => {
  try {
    const { title, content, context } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Generate a filename for the note
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = title
      ? `${title.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}.txt`
      : `note-${timestamp}.txt`;

    // Create transcript record
    const transcriptId = queries.createTranscript({
      filename,
      filepath: `notes/${filename}`,
      rawContent: content,
      durationMinutes: null,
      callDate: new Date().toISOString(),
      context: context || 'Quick note'
    });

    // Check if we should process immediately
    const aiStatus = getAIStatus();
    let processingStatus = 'queued';

    if (aiStatus.enabled) {
      try {
        processingStatus = 'processing';
        const tracker = req.trackProcessing?.(transcriptId, filename);
        processTranscript(transcriptId)
          .then(() => {
            console.log(`Note processed: ${filename}`);
            tracker?.complete();
          })
          .catch(err => {
            console.error(`Note processing failed: ${err.message}`);
            tracker?.fail(err);
          });
      } catch (err) {
        console.error('Processing error:', err.message);
        processingStatus = 'pending';
      }
    } else {
      processingStatus = 'pending';
    }

    res.json({
      success: true,
      transcriptId,
      filename,
      processingStatus,
      message: processingStatus === 'processing'
        ? 'Note saved and processing started'
        : 'Note saved successfully. Processing will begin when AI is available.'
    });

  } catch (err) {
    console.error('Note creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /paste - Paste raw transcript text
 * Accepts JSON body: { content, filename }
 */
router.post('/paste', async (req, res) => {
  try {
    const { content, filename: userFilename } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Generate a filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = userFilename
      ? `${userFilename.replace(/[^a-zA-Z0-9.-]/g, '-')}`
      : `pasted-transcript-${timestamp}.txt`;

    // Create transcript record
    const transcriptId = queries.createTranscript({
      filename,
      filepath: `pasted/${filename}`,
      rawContent: content,
      durationMinutes: null,
      callDate: new Date().toISOString(),
      context: 'Pasted transcript'
    });

    // Check if we should process immediately
    const aiStatus = getAIStatus();
    let processingStatus = 'queued';

    if (aiStatus.enabled) {
      try {
        processingStatus = 'processing';
        const tracker = req.trackProcessing?.(transcriptId, filename);
        processTranscript(transcriptId)
          .then(() => {
            console.log(`Pasted transcript processed: ${filename}`);
            tracker?.complete();
          })
          .catch(err => {
            console.error(`Pasted transcript processing failed: ${err.message}`);
            tracker?.fail(err);
          });
      } catch (err) {
        console.error('Processing error:', err.message);
        processingStatus = 'pending';
      }
    } else {
      processingStatus = 'pending';
    }

    res.json({
      success: true,
      transcriptId,
      filename,
      textLength: content.length,
      processingStatus,
      message: processingStatus === 'processing'
        ? 'Transcript saved and processing started'
        : 'Transcript saved successfully. Processing will begin when AI is available.'
    });

  } catch (err) {
    console.error('Paste error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
