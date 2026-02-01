import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { initDatabase, getDbPath } from './db/schema.js';
import * as queries from './db/queries.js';
import { startWatcher, restartWatcher } from './ingestion/watcher.js';
import { initAI, getAIStatus, processTranscript, getCallAI, streamAI } from './processing/processor.js';

// Phase 2 imports
import prospectRoutes from './api/prospects.js';
import outreachRoutes from './api/outreach.js';
import insightRoutes from './api/insights.js';
import learningRoutes from './api/learning.js';
import { initAnalysisJobs } from './learning/analysisJobs.js';
import { getMeddpiccSummary } from './processing/meddpiccExtractor.js';
import { getSegmentsForPerson, getSegmentsForDeal } from './db/queries.js';

// Phase 3 imports
import uploadRoutes from './api/upload.js';
import { processQuery, getQueryHistory, submitQueryFeedback } from './processing/queryEngine.js';
import { getLivingSection, getAllSections, regenerateAllSections } from './processing/livingSections.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const WATCH_FOLDER = process.env.WATCH_FOLDER || './transcripts';
const EMAIL_FOLDER = process.env.EMAIL_FOLDER || '';

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initDatabase();

// Initialize AI provider (Ollama by default, or Anthropic if key is set)
let aiInitialized = false;
(async () => {
  aiInitialized = await initAI({
    provider: process.env.AI_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'ollama'),
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseUrl: process.env.OLLAMA_BASE_URL,
    model: process.env.OLLAMA_MODEL || process.env.AI_MODEL
  });

  // Initialize learning engine analysis jobs
  if (aiInitialized) {
    const callAI = getCallAI();
    if (callAI) {
      initAnalysisJobs(callAI);
    }
  }
})();

// Ensure transcripts folder exists
if (!fs.existsSync(WATCH_FOLDER)) {
  fs.mkdirSync(WATCH_FOLDER, { recursive: true });
}

// Start transcript file watcher
const watcher = startWatcher(WATCH_FOLDER, {
  processImmediately: false,
  onNewFile: ({ transcriptId, filepath }) => {
    console.log(`API: New transcript ingested: ${transcriptId}`);
  }
});

// Start email folder watcher (if configured)
let emailWatcher = null;
if (EMAIL_FOLDER && EMAIL_FOLDER.trim() !== '') {
  if (!fs.existsSync(EMAIL_FOLDER)) {
    fs.mkdirSync(EMAIL_FOLDER, { recursive: true });
  }
  emailWatcher = startWatcher(EMAIL_FOLDER, {
    processImmediately: false,
    onNewFile: ({ transcriptId, filepath }) => {
      console.log(`API: New email ingested: ${transcriptId}`);
    }
  });
  console.log(`Email watcher active: ${EMAIL_FOLDER}`);
}

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  const aiStatus = getAIStatus();

  // Check watch folder status
  let watchFolderExists = false;
  let watchFolderFileCount = 0;
  try {
    watchFolderExists = fs.existsSync(WATCH_FOLDER);
    if (watchFolderExists) {
      const files = fs.readdirSync(WATCH_FOLDER);
      watchFolderFileCount = files.filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ['.txt', '.md', '.json', '.srt', '.pdf', '.docx', '.eml'].includes(ext);
      }).length;
    }
  } catch (e) { /* folder access error */ }

  // Check email folder status
  const currentEmailFolder = process.env.EMAIL_FOLDER || EMAIL_FOLDER || '';
  let emailFolderExists = false;
  let emailFolderFileCount = 0;
  if (currentEmailFolder) {
    try {
      emailFolderExists = fs.existsSync(currentEmailFolder);
      if (emailFolderExists) {
        const files = fs.readdirSync(currentEmailFolder);
        emailFolderFileCount = files.filter(f =>
          path.extname(f).toLowerCase() === '.eml'
        ).length;
      }
    } catch (e) { /* folder access error */ }
  }

  res.json({
    status: 'ok',
    aiEnabled: aiStatus.enabled,
    aiProvider: aiStatus.provider,
    aiModel: aiStatus.model,
    watchFolder: WATCH_FOLDER,
    watchFolderExists,
    watchFolderFileCount,
    emailFolder: currentEmailFolder,
    emailFolderExists,
    emailFolderFileCount
  });
});

// Get stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = queries.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detailed database info for Settings
app.get('/api/data/info', (req, res) => {
  try {
    const info = queries.getDbInfo();
    const dbFilePath = getDbPath();

    let dbSizeBytes = 0;
    try {
      dbSizeBytes = fs.statSync(dbFilePath).size;
    } catch (e) { /* db file may not exist yet */ }

    res.json({
      ...info,
      dbPath: dbFilePath,
      dbSizeBytes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset all data (destructive — requires confirmation token)
app.post('/api/data/reset', (req, res) => {
  try {
    const { confirm } = req.body;
    if (confirm !== 'RESET_ALL_DATA') {
      return res.status(400).json({
        error: 'Confirmation required. Send { "confirm": "RESET_ALL_DATA" }'
      });
    }

    const result = queries.resetDatabase();
    console.log('DATABASE RESET: All data cleared by user request');

    res.json({
      success: true,
      message: 'All data has been cleared. Files in the watch folders will be re-imported on next detection.'
    });
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// TRANSCRIPT ROUTES
// ============================================

// List all transcripts
app.get('/api/transcripts', (req, res) => {
  try {
    const transcripts = queries.getAllTranscripts();
    res.json(transcripts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single transcript
app.get('/api/transcripts/:id', (req, res) => {
  try {
    const transcript = queries.getTranscript(req.params.id);
    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }
    res.json(transcript);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get transcript segments
app.get('/api/transcripts/:id/segments', (req, res) => {
  try {
    const segments = queries.getSegmentsByTranscript(req.params.id);
    res.json(segments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get transcript metrics
app.get('/api/transcripts/:id/metrics', (req, res) => {
  try {
    const metrics = queries.getTranscriptMetrics(req.params.id);
    res.json(metrics || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reprocess a transcript
app.post('/api/transcripts/:id/process', async (req, res) => {
  try {
    const aiStatus = getAIStatus();
    if (!aiStatus.enabled) {
      return res.status(400).json({
        error: 'AI processing not available',
        suggestion: 'Start Ollama with: ollama serve'
      });
    }

    const result = await processTranscript(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a transcript
app.delete('/api/transcripts/:id', (req, res) => {
  try {
    const transcript = queries.getTranscript(req.params.id);
    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }
    queries.deleteTranscript(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SEGMENT ROUTES
// ============================================

// List all segments
app.get('/api/segments', (req, res) => {
  try {
    const { knowledgeType, tag } = req.query;
    
    let segments;
    if (knowledgeType) {
      segments = queries.getSegmentsByKnowledgeType(knowledgeType);
    } else if (tag) {
      segments = queries.getSegmentsByTag(tag);
    } else {
      segments = queries.getAllSegments();
    }
    
    res.json(segments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get segment tags
app.get('/api/segments/:id/tags', (req, res) => {
  try {
    const tags = queries.getSegmentTags(req.params.id);
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single segment
app.get('/api/segments/:id', (req, res) => {
  try {
    const segment = queries.getSegment(req.params.id);
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }
    const tags = queries.getSegmentTags(req.params.id);
    res.json({ ...segment, tags });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search segments
app.get('/api/segments/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }
    const segments = queries.searchSegments(q);
    res.json(segments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PEOPLE ROUTES
// ============================================

app.get('/api/people', (req, res) => {
  try {
    const { relationship_type } = req.query;
    const people = queries.getAllPeople(relationship_type);
    res.json(people);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/people', (req, res) => {
  try {
    const id = queries.createPerson(req.body);
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/people/:id', (req, res) => {
  try {
    const person = queries.getPerson(req.params.id);
    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/people/:id', (req, res) => {
  try {
    queries.updatePerson(req.params.id, req.body);
    const updated = queries.getPerson(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// DEAL ROUTES
// ============================================

app.get('/api/deals', (req, res) => {
  try {
    const deals = queries.getAllDeals();
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/deals', (req, res) => {
  try {
    const id = queries.createDeal(req.body);
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/deals/:id', (req, res) => {
  try {
    const deal = queries.getDeal(req.params.id);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    const meddpicc = queries.getDealMeddpicc(req.params.id);
    res.json({ ...deal, meddpicc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/deals/:id', (req, res) => {
  try {
    queries.updateDeal(req.params.id, req.body);
    const updated = queries.getDeal(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/deals/:id/meddpicc', (req, res) => {
  try {
    const meddpicc = queries.getDealMeddpicc(req.params.id);
    res.json(meddpicc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/deals/:id/meddpicc/:letter', (req, res) => {
  try {
    const { id, letter } = req.params;
    queries.updateDealMeddpicc(id, letter, req.body);
    const meddpicc = queries.getDealMeddpicc(id);
    res.json(meddpicc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get MEDDPICC summary for a deal
app.get('/api/deals/:id/meddpicc/summary', (req, res) => {
  try {
    const summary = getMeddpiccSummary(req.params.id);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get segments linked to a deal
app.get('/api/deals/:id/segments', (req, res) => {
  try {
    const segments = getSegmentsForDeal(req.params.id);
    res.json(segments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get segments linked to a person
app.get('/api/people/:id/segments', (req, res) => {
  try {
    const segments = getSegmentsForPerson(req.params.id);
    res.json(segments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ASK (Natural Language Query) - Phase 3 Smart Query Engine
// ============================================

app.post('/api/ask', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const aiStatus = getAIStatus();
    if (!aiStatus.enabled) {
      return res.status(400).json({
        error: 'AI not available. Please start Ollama or configure Anthropic API key.'
      });
    }

    const callAI = getCallAI();
    if (!callAI) {
      return res.status(500).json({ error: 'AI not initialized' });
    }

    // Use the smart query engine
    const result = await processQuery(query, callAI);

    res.json(result);
  } catch (err) {
    console.error('Ask error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Streaming ask endpoint (SSE) — preferred by frontend for real-time responses
app.get('/api/ask/stream', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }

    const aiStatus = getAIStatus();
    if (!aiStatus.enabled) {
      return res.status(400).json({ error: 'AI not available' });
    }

    // Import processQueryStream from queryEngine
    const { processQueryStream } = await import('./processing/queryEngine.js');

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    // Stream the query response
    const callAI = getCallAI();
    for await (const event of processQueryStream(query, callAI, streamAI)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Stream ask error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    }
  }
});

// Query history endpoints
app.get('/api/ask/history', (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const history = getQueryHistory({ limit: parseInt(limit), offset: parseInt(offset) });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ask/:id/feedback', (req, res) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;

    if (!feedback || !['helpful', 'not_helpful'].includes(feedback)) {
      return res.status(400).json({ error: 'Feedback must be "helpful" or "not_helpful"' });
    }

    const result = submitQueryFeedback(id, feedback);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// LIVING SECTIONS (AI-Generated Profiles) - Phase 3
// ============================================

// Get living section for an entity
app.get('/api/living-sections/:entityType/:entityId/:sectionType', async (req, res) => {
  try {
    const { entityType, entityId, sectionType } = req.params;

    const callAI = getCallAI();
    if (!callAI) {
      return res.status(400).json({ error: 'AI not available' });
    }

    const section = await getLivingSection(entityType, entityId, sectionType, callAI);
    res.json(section);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all sections for an entity
app.get('/api/living-sections/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    const callAI = getCallAI();
    if (!callAI) {
      return res.status(400).json({ error: 'AI not available' });
    }

    const sections = await getAllSections(entityType, entityId, callAI);
    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Force regeneration of all sections for an entity
app.post('/api/living-sections/:entityType/:entityId/regenerate', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    const callAI = getCallAI();
    if (!callAI) {
      return res.status(400).json({ error: 'AI not available' });
    }

    const sections = await regenerateAllSections(entityType, entityId, callAI);
    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PHASE 2 & 3: MOUNT NEW ROUTES
// ============================================

app.use('/api/prospects', prospectRoutes);
app.use('/api/outreach', outreachRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/learning', learningRoutes);

// Phase 3: Upload routes
app.use('/api', uploadRoutes);

// ============================================
// CONFIG ROUTES (for Electron)
// ============================================

// Get current watch folder
app.get('/api/config/watch-folder', (req, res) => {
  res.json({ watchFolder: WATCH_FOLDER });
});

// Update watch folder at runtime
app.put('/api/config/watch-folder', (req, res) => {
  try {
    const { watchFolder: newFolder } = req.body;
    if (!newFolder) {
      return res.status(400).json({ error: 'watchFolder is required' });
    }

    // Validate path exists
    if (!fs.existsSync(newFolder)) {
      return res.status(400).json({ error: 'Folder does not exist' });
    }

    // Restart watcher with new folder
    restartWatcher(newFolder, {
      processImmediately: false,
      onNewFile: ({ transcriptId, filepath }) => {
        console.log(`API: New transcript ingested: ${transcriptId}`);
      }
    });

    res.json({ success: true, watchFolder: newFolder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current email folder
app.get('/api/config/email-folder', (req, res) => {
  res.json({ emailFolder: process.env.EMAIL_FOLDER || EMAIL_FOLDER || '' });
});

// Update email folder at runtime
app.put('/api/config/email-folder', (req, res) => {
  try {
    const { emailFolder: newFolder } = req.body;
    if (!newFolder) {
      return res.status(400).json({ error: 'emailFolder is required' });
    }

    // Validate path exists
    if (!fs.existsSync(newFolder)) {
      return res.status(400).json({ error: 'Folder does not exist' });
    }

    // Close existing email watcher if running
    if (emailWatcher) {
      emailWatcher.close().catch(err => {
        console.error('Error closing email watcher:', err);
      });
    }

    // Start new email watcher
    emailWatcher = startWatcher(newFolder, {
      processImmediately: false,
      onNewFile: ({ transcriptId, filepath }) => {
        console.log(`API: New email ingested: ${transcriptId}`);
      }
    });

    // Update the module-level variable for health endpoint
    // Note: This is a runtime-only change. For persistence across restarts,
    // Electron saves it to config.json and sets EMAIL_FOLDER env var on boot.
    process.env.EMAIL_FOLDER = newFolder;

    res.json({ success: true, emailFolder: newFolder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ELECTRON STATIC FILE SERVING
// ============================================

// In production (Electron), serve the built frontend
if (process.env.ELECTRON === 'true') {
  const uiDistPath = path.join(__dirname, 'ui', 'dist');
  if (fs.existsSync(uiDistPath)) {
    app.use(express.static(uiDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(uiDistPath, 'index.html'));
    });
  }
}

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  const aiStatus = getAIStatus();
  const isElectron = process.env.ELECTRON === 'true';
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                         PRISM                             ║
║                   Intelligence Engine                     ║
║                                                           ║
║  API Server:     http://localhost:${PORT}                   ║
║  Watch Folder:   ${WATCH_FOLDER.padEnd(36)}  ║
║  Email Folder:   ${(process.env.EMAIL_FOLDER || EMAIL_FOLDER || 'Not configured').padEnd(36)}  ║
║  AI Provider:    ${(aiStatus.provider || 'none').padEnd(36)}  ║
║  AI Model:       ${(aiStatus.model || 'n/a').padEnd(36)}  ║
║  Mode:           ${(isElectron ? 'Electron' : 'Development').padEnd(36)}  ║
║                                                           ║
║  Drop transcripts in the watch folder to begin.           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
