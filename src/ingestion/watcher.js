import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import { parseTranscript, parseFilenameMetadata } from './parser.js';
import { createTranscript, transcriptExists } from '../db/queries.js';
import { processTranscript } from '../processing/processor.js';
import { extractPdfText, extractDocxText } from './extractors.js';

const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.json', '.srt', '.pdf', '.docx'];

// Files to ignore (especially for Google Drive sync)
const IGNORED_PATTERNS = [
  /(^|[\/\\])\../,  // dotfiles
  /\.tmp$/,          // temp files
  /\.gsheet$/,       // Google Sheets
  /\.gdoc$/,         // Google Docs
  /~\$.*/,           // Office temp files
  /\.crdownload$/,   // Chrome downloads
  /\.part$/          // Partial downloads
];

// Module-level watcher instance for restartWatcher
let currentWatcher = null;

/**
 * Check if a file should be ignored
 */
function shouldIgnore(filepath) {
  const filename = path.basename(filepath);
  return IGNORED_PATTERNS.some(pattern => pattern.test(filename) || pattern.test(filepath));
}

/**
 * Start watching a folder for new transcript files
 */
export function startWatcher(watchFolder, options = {}) {
  const { onNewFile, onError, processImmediately = true } = options;

  // Ensure watch folder exists
  if (!fs.existsSync(watchFolder)) {
    fs.mkdirSync(watchFolder, { recursive: true });
    console.log(`Created watch folder: ${watchFolder}`);
  }

  console.log(`Watching for transcripts in: ${watchFolder}`);

  const watcher = chokidar.watch(watchFolder, {
    ignored: shouldIgnore,
    persistent: true,
    ignoreInitial: false, // Process existing files on startup
    awaitWriteFinish: {
      stabilityThreshold: 5000,  // 5 seconds - longer for Google Drive sync
      pollInterval: 100
    },
    usePolling: false,
    depth: 2  // Watch subdirectories up to 2 levels deep
  });

  watcher.on('add', async (filepath) => {
    const ext = path.extname(filepath).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      console.log(`Skipping unsupported file: ${filepath}`);
      return;
    }

    // Double-check ignore patterns
    if (shouldIgnore(filepath)) {
      console.log(`Skipping ignored file: ${filepath}`);
      return;
    }

    // Check if already processed
    if (transcriptExists(filepath)) {
      console.log(`Already processed: ${filepath}`);
      return;
    }

    console.log(`New transcript detected: ${filepath}`);

    // PDF/DOCX: extract text via dedicated extractors, skip parseTranscript
    if (ext === '.pdf' || ext === '.docx') {
      try {
        let extractedText;
        if (ext === '.pdf') {
          extractedText = await extractPdfText(filepath);
        } else {
          extractedText = await extractDocxText(filepath);
        }

        if (!extractedText || extractedText.trim().length === 0) {
          console.log(`Empty content from ${filepath}, skipping`);
          return;
        }

        const filename = path.basename(filepath);
        const filenameMeta = parseFilenameMetadata(filename);

        const transcriptId = createTranscript({
          filename,
          filepath,
          rawContent: extractedText,
          durationMinutes: null,
          callDate: filenameMeta.date || new Date().toISOString(),
          context: filenameMeta.callType || `Watched file: ${filename}`
        });

        console.log(`PDF/DOCX transcript saved: ${transcriptId}`);

        if (processImmediately) {
          processTranscript(transcriptId).catch(err => {
            console.error(`Processing failed for ${transcriptId}:`, err.message);
          });
        }

        if (onNewFile) {
          onNewFile({ transcriptId, filepath });
        }
        return; // Done — skip the parseTranscript path below
      } catch (err) {
        console.error(`Text extraction failed for ${filepath}:`, err.message);
        if (onError) onError(err, filepath);
        return;
      }
    }

    // Existing parseTranscript path for txt/md/json/srt
    try {
      // Parse the file
      const parsed = parseTranscript(filepath);
      const filenameMeta = parseFilenameMetadata(parsed.filename);

      // Create transcript record
      const transcriptId = createTranscript({
        filename: parsed.filename,
        filepath: filepath,
        rawContent: parsed.rawContent,
        durationMinutes: parsed.durationMinutes,
        callDate: filenameMeta.date || parsed.callDate,
        context: filenameMeta.callType || parsed.context
      });

      console.log(`Transcript saved: ${transcriptId}`);

      // Trigger processing if enabled
      if (processImmediately) {
        console.log(`Queuing for processing: ${transcriptId}`);
        processTranscript(transcriptId).catch(err => {
          console.error(`Processing failed for ${transcriptId}:`, err.message);
        });
      }

      if (onNewFile) {
        onNewFile({ transcriptId, filepath, parsed });
      }

    } catch (err) {
      console.error(`Error processing file ${filepath}:`, err);
      if (onError) {
        onError(err, filepath);
      }
    }
  });

  watcher.on('error', (error) => {
    console.error('Watcher error:', error);
    if (onError) {
      onError(error);
    }
  });

  watcher.on('ready', () => {
    console.log('Initial scan complete. Watching for changes...');
  });

  // Store as current watcher
  currentWatcher = watcher;

  return watcher;
}

/**
 * Restart watcher with a new folder
 */
export function restartWatcher(newFolder, options = {}) {
  console.log(`Restarting watcher with folder: ${newFolder}`);

  // Close existing watcher
  if (currentWatcher) {
    currentWatcher.close().then(() => {
      console.log('Previous watcher closed');
    }).catch(err => {
      console.error('Error closing watcher:', err);
    });
  }

  // Start new watcher
  return startWatcher(newFolder, options);
}

/**
 * Get current watcher instance
 */
export function getWatcher() {
  return currentWatcher;
}

/**
 * Process all existing files in a folder (one-time import)
 */
export async function importFolder(folderPath) {
  const files = fs.readdirSync(folderPath);
  const results = [];

  for (const file of files) {
    const filepath = path.join(folderPath, file);
    const ext = path.extname(file).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;
    if (shouldIgnore(filepath)) continue;
    if (transcriptExists(filepath)) continue;

    try {
      const parsed = parseTranscript(filepath);
      const filenameMeta = parseFilenameMetadata(parsed.filename);

      const transcriptId = createTranscript({
        filename: parsed.filename,
        filepath: filepath,
        rawContent: parsed.rawContent,
        durationMinutes: parsed.durationMinutes,
        callDate: filenameMeta.date || parsed.callDate,
        context: filenameMeta.callType || parsed.context
      });

      results.push({ transcriptId, filepath, success: true });
      console.log(`Imported: ${file}`);

    } catch (err) {
      results.push({ filepath, success: false, error: err.message });
      console.error(`Failed to import ${file}:`, err.message);
    }
  }

  return results;
}

export default {
  startWatcher,
  restartWatcher,
  getWatcher,
  importFolder
};
