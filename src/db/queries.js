import { getDatabase } from './schema.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// ============================================
// TRANSCRIPT QUERIES
// ============================================

function computeContentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function createTranscript({ filename, filepath, rawContent, durationMinutes, callDate, context }) {
  const db = getDatabase();
  const id = uuidv4();
  const contentHash = computeContentHash(rawContent);

  // Check for duplicate content
  const existing = db.prepare('SELECT id FROM transcripts WHERE content_hash = ?').get(contentHash);
  if (existing) {
    db.close();
    return existing.id; // Return existing transcript ID
  }

  const stmt = db.prepare(`
    INSERT INTO transcripts (id, filename, filepath, raw_content, content_hash, duration_minutes, call_date, context)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, filename, filepath, rawContent, contentHash, durationMinutes, callDate, context);
  db.close();

  return id;
}

export function getTranscript(id) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM transcripts WHERE id = ?');
  const result = stmt.get(id);
  db.close();
  return result;
}

export function getAllTranscripts() {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM transcripts ORDER BY created_at DESC');
  const results = stmt.all();
  db.close();
  return results;
}

export function updateTranscript(id, updates) {
  const db = getDatabase();
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  
  const stmt = db.prepare(`UPDATE transcripts SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
  stmt.run(...values, id);
  db.close();
}

export function transcriptExists(filepath) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT id FROM transcripts WHERE filepath = ?');
  const result = stmt.get(filepath);
  db.close();
  return !!result;
}

export function transcriptExistsByHash(content) {
  const db = getDatabase();
  const contentHash = computeContentHash(content);
  const stmt = db.prepare('SELECT id FROM transcripts WHERE content_hash = ?');
  const result = stmt.get(contentHash);
  db.close();
  return result ? result.id : null;
}

export function deleteTranscript(id) {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM transcripts WHERE id = ?');
  stmt.run(id);
  db.close();
}

// ============================================
// SEGMENT QUERIES
// ============================================

export function createSegment({ transcriptId, content, startTime, endTime, speaker, knowledgeType, summary }) {
  const db = getDatabase();
  const id = uuidv4();
  
  const stmt = db.prepare(`
    INSERT INTO segments (id, transcript_id, content, start_time, end_time, speaker, knowledge_type, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, transcriptId, content, startTime, endTime, speaker, knowledgeType, summary);
  db.close();
  
  return id;
}

export function getSegmentsByTranscript(transcriptId) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM segments WHERE transcript_id = ? ORDER BY start_time');
  const results = stmt.all(transcriptId);
  db.close();
  return results;
}

export function deleteSegmentsForTranscript(transcriptId) {
  const db = getDatabase();

  // Delete tags for these segments first (if segment_tags table exists)
  try {
    db.prepare(`
      DELETE FROM segment_tags WHERE segment_id IN (
        SELECT id FROM segments WHERE transcript_id = ?
      )
    `).run(transcriptId);
  } catch (e) { /* segment_tags table may not exist */ }

  // Delete person_segments links
  try {
    db.prepare(`
      DELETE FROM person_segments WHERE segment_id IN (
        SELECT id FROM segments WHERE transcript_id = ?
      )
    `).run(transcriptId);
  } catch (e) { /* table may not exist */ }

  // Delete deal_segments links
  try {
    db.prepare(`
      DELETE FROM deal_segments WHERE segment_id IN (
        SELECT id FROM segments WHERE transcript_id = ?
      )
    `).run(transcriptId);
  } catch (e) { /* table may not exist */ }

  // Delete the segments themselves
  const result = db.prepare('DELETE FROM segments WHERE transcript_id = ?').run(transcriptId);

  db.close();
  return result.changes;
}

export function getSegmentsByKnowledgeType(knowledgeType) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM segments WHERE knowledge_type = ? ORDER BY created_at DESC');
  const results = stmt.all(knowledgeType);
  db.close();
  return results;
}

export function getAllSegments() {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT s.*, t.filename as transcript_filename 
    FROM segments s 
    JOIN transcripts t ON s.transcript_id = t.id 
    ORDER BY s.created_at DESC
  `);
  const results = stmt.all();
  db.close();
  return results;
}

// ============================================
// TAG QUERIES
// ============================================

export function addSegmentTag(segmentId, tag, confidence = 1.0) {
  const db = getDatabase();
  const id = uuidv4();
  
  const stmt = db.prepare(`
    INSERT INTO segment_tags (id, segment_id, tag, confidence)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(id, segmentId, tag, confidence);
  db.close();
  
  return id;
}

export function getSegmentTags(segmentId) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM segment_tags WHERE segment_id = ?');
  const results = stmt.all(segmentId);
  db.close();
  return results;
}

export function getSegmentsByTag(tag) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT s.*, st.tag, st.confidence
    FROM segments s
    JOIN segment_tags st ON s.id = st.segment_id
    WHERE st.tag LIKE ?
    ORDER BY st.confidence DESC
  `);
  const results = stmt.all(`%${tag}%`);
  db.close();
  return results;
}

// ============================================
// PEOPLE QUERIES
// ============================================

export function createPerson({ name, role, company, relationshipType, notes }) {
  const db = getDatabase();
  const id = uuidv4();
  
  const stmt = db.prepare(`
    INSERT INTO people (id, name, role, company, relationship_type, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, name, role, company, relationshipType, notes);
  db.close();
  
  return id;
}

export function getPersonByName(name) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM people WHERE name LIKE ?');
  const result = stmt.get(`%${name}%`);
  db.close();
  return result;
}

export function getAllPeople(relationshipType = null) {
  const db = getDatabase();
  let stmt;
  if (relationshipType) {
    stmt = db.prepare('SELECT * FROM people WHERE relationship_type = ? ORDER BY name');
    const results = stmt.all(relationshipType);
    db.close();
    return results;
  }
  stmt = db.prepare('SELECT * FROM people ORDER BY name');
  const results = stmt.all();
  db.close();
  return results;
}

export function getPerson(id) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM people WHERE id = ?');
  const result = stmt.get(id);
  db.close();
  return result;
}

export function updatePerson(id, updates) {
  const db = getDatabase();
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);

  const stmt = db.prepare(`UPDATE people SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
  stmt.run(...values, id);
  db.close();
}

// ============================================
// DEAL QUERIES
// ============================================

export function createDeal({ companyName, contactName, contactRole, status, notes, valueAmount, valueCurrency, expectedCloseDate }) {
  const db = getDatabase();
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT INTO deals (id, company_name, contact_name, contact_role, status, notes, value_amount, value_currency, expected_close_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, companyName, contactName, contactRole, status || 'active', notes, valueAmount, valueCurrency || 'USD', expectedCloseDate);
  db.close();

  // Initialize MEDDPICC letters
  initializeDealMeddpicc(id);

  return id;
}

function initializeDealMeddpicc(dealId) {
  const db = getDatabase();
  const letters = ['M', 'E', 'D1', 'D2', 'P', 'I', 'C1', 'C2'];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO deal_meddpicc (id, deal_id, letter, status)
    VALUES (?, ?, ?, 'unknown')
  `);

  for (const letter of letters) {
    stmt.run(uuidv4(), dealId, letter);
  }
  db.close();
}

export function getDeal(id) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM deals WHERE id = ?');
  const result = stmt.get(id);
  db.close();
  return result;
}

export function updateDeal(id, updates) {
  const db = getDatabase();
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);

  const stmt = db.prepare(`UPDATE deals SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
  stmt.run(...values, id);
  db.close();
}

export function getDealByCompany(companyName) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM deals WHERE company_name LIKE ?');
  const result = stmt.get(`%${companyName}%`);
  db.close();
  return result;
}

export function getAllDeals() {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM deals ORDER BY updated_at DESC');
  const results = stmt.all();
  db.close();
  return results;
}

export function updateDealMeddpicc(dealId, letter, { status, evidence, sourceSegmentId, confidence }) {
  const db = getDatabase();
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT INTO deal_meddpicc (id, deal_id, letter, status, evidence, source_segment_id, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(deal_id, letter) DO UPDATE SET
      status = excluded.status,
      evidence = excluded.evidence,
      source_segment_id = excluded.source_segment_id,
      confidence = excluded.confidence,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(id, dealId, letter, status, evidence, sourceSegmentId, confidence);
  db.close();
}

export function getDealMeddpicc(dealId) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM deal_meddpicc WHERE deal_id = ?');
  const results = stmt.all(dealId);
  db.close();
  return results;
}

// ============================================
// METRICS QUERIES
// ============================================

export function saveTranscriptMetrics(transcriptId, metrics) {
  const db = getDatabase();
  const id = uuidv4();
  
  const stmt = db.prepare(`
    INSERT INTO transcript_metrics (id, transcript_id, talk_ratio, strong_moments, improvement_areas, questions_asked)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(transcript_id) DO UPDATE SET
      talk_ratio = excluded.talk_ratio,
      strong_moments = excluded.strong_moments,
      improvement_areas = excluded.improvement_areas,
      questions_asked = excluded.questions_asked,
      computed_at = CURRENT_TIMESTAMP
  `);
  
  stmt.run(
    id,
    transcriptId,
    metrics.talkRatio,
    JSON.stringify(metrics.strongMoments || []),
    JSON.stringify(metrics.improvementAreas || []),
    JSON.stringify(metrics.questionsAsked || [])
  );
  db.close();
}

export function getTranscriptMetrics(transcriptId) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM transcript_metrics WHERE transcript_id = ?');
  const result = stmt.get(transcriptId);
  db.close();
  
  if (result) {
    result.strongMoments = JSON.parse(result.strong_moments || '[]');
    result.improvementAreas = JSON.parse(result.improvement_areas || '[]');
    result.questionsAsked = JSON.parse(result.questions_asked || '[]');
  }
  
  return result;
}

// ============================================
// STATS QUERIES
// ============================================

export function getStats() {
  const db = getDatabase();
  
  const transcriptCount = db.prepare('SELECT COUNT(*) as count FROM transcripts').get().count;
  const segmentCount = db.prepare('SELECT COUNT(*) as count FROM segments').get().count;
  const peopleCount = db.prepare('SELECT COUNT(*) as count FROM people').get().count;
  const dealCount = db.prepare('SELECT COUNT(*) as count FROM deals').get().count;
  
  const knowledgeTypes = db.prepare(`
    SELECT knowledge_type, COUNT(*) as count 
    FROM segments 
    WHERE knowledge_type IS NOT NULL
    GROUP BY knowledge_type
  `).all();
  
  // Convert to object format for easier UI consumption
  const segmentsByType = {};
  knowledgeTypes.forEach(row => {
    segmentsByType[row.knowledge_type] = row.count;
  });
  
  // Calculate average talk ratio
  const avgTalkRatioResult = db.prepare(`
    SELECT AVG(talk_ratio) as avg 
    FROM transcript_metrics 
    WHERE talk_ratio IS NOT NULL
  `).get();
  
  db.close();
  
  return {
    totalTranscripts: transcriptCount,
    totalSegments: segmentCount,
    totalPeople: peopleCount,
    totalDeals: dealCount,
    segmentsByType,
    avgTalkRatio: avgTalkRatioResult?.avg || null
  };
}

// ============================================
// PHASE 4.4: DATA MANAGEMENT QUERIES
// ============================================

export function getDbInfo() {
  const db = getDatabase();

  const transcriptCount = db.prepare('SELECT COUNT(*) as count FROM transcripts').get().count;
  const segmentCount = db.prepare('SELECT COUNT(*) as count FROM segments').get().count;
  const peopleCount = db.prepare('SELECT COUNT(*) as count FROM people').get().count;
  const dealCount = db.prepare('SELECT COUNT(*) as count FROM deals').get().count;

  // Date range of ingested content
  const dateRange = db.prepare(`
    SELECT MIN(created_at) as earliest, MAX(created_at) as latest
    FROM transcripts
  `).get();

  // Processed vs pending
  const processedCount = db.prepare(`
    SELECT COUNT(*) as count FROM transcripts WHERE processed_at IS NOT NULL
  `).get().count;

  // Email vs transcript counts (emails have context starting with "Email:")
  const emailCount = db.prepare(`
    SELECT COUNT(*) as count FROM transcripts WHERE context LIKE 'Email:%'
  `).get().count;

  const attachmentCount = db.prepare(`
    SELECT COUNT(*) as count FROM transcripts WHERE context LIKE 'Attachment:%'
  `).get().count;

  // Optional tables — may not exist in all installations
  let prospectCount = 0;
  let queryCount = 0;
  try {
    prospectCount = db.prepare('SELECT COUNT(*) as count FROM prospects').get().count;
  } catch (e) { /* table may not exist */ }
  try {
    queryCount = db.prepare('SELECT COUNT(*) as count FROM query_history').get().count;
  } catch (e) { /* table may not exist */ }

  db.close();

  return {
    transcripts: {
      total: transcriptCount,
      processed: processedCount,
      unprocessed: transcriptCount - processedCount,
      emails: emailCount,
      attachments: attachmentCount,
      files: transcriptCount - emailCount - attachmentCount
    },
    segments: segmentCount,
    people: peopleCount,
    deals: dealCount,
    prospects: prospectCount,
    queries: queryCount,
    dateRange: {
      earliest: dateRange?.earliest || null,
      latest: dateRange?.latest || null
    }
  };
}

export function resetDatabase() {
  const db = getDatabase();

  // Order matters — child tables first, then parents
  const tables = [
    'query_history',
    'outreach_messages',
    'prospect_contacts',
    'transcript_metrics',
    'living_sections',
    'computed_patterns',
    'learning_snapshots',
    'meddpicc_scores',
    'deal_segments',
    'person_segments',
    'segments',
    'prospects',
    'deals',
    'people',
    'transcripts'
  ];

  db.pragma('foreign_keys = OFF');

  for (const table of tables) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch (e) {
      console.log(`Reset: table ${table} skipped (${e.message})`);
    }
  }

  db.pragma('foreign_keys = ON');
  db.close();

  return { success: true, tablesCleared: tables.length };
}

export function getSegment(id) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM segments WHERE id = ?');
  const result = stmt.get(id);
  db.close();
  return result;
}

export function searchSegments(query) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT s.*, t.filename as transcript_filename
    FROM segments s
    JOIN transcripts t ON s.transcript_id = t.id
    WHERE s.content LIKE ? OR s.summary LIKE ?
    ORDER BY s.created_at DESC
  `);
  const results = stmt.all(`%${query}%`, `%${query}%`);
  db.close();
  return results;
}

// ============================================
// PHASE 2: PROSPECT QUERIES
// ============================================

export function createProspect({ companyName, website, industry, employeeCount, employeeRange, estimatedRevenue, location, techStack, tier, status, notes, source }) {
  const db = getDatabase();
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT INTO prospects (id, company_name, website, industry, employee_count, employee_range, estimated_revenue, location, tech_stack, tier, status, notes, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, companyName, website, industry, employeeCount, employeeRange, estimatedRevenue, location, techStack, tier || 3, status || 'active', notes, source);
  db.close();

  return id;
}

export function getProspect(id) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM prospects WHERE id = ?');
  const result = stmt.get(id);
  db.close();
  return result;
}

export function getProspectWithDetails(id) {
  const db = getDatabase();

  const prospect = db.prepare('SELECT * FROM prospects WHERE id = ?').get(id);
  if (!prospect) {
    db.close();
    return null;
  }

  const signals = db.prepare('SELECT * FROM prospect_signals WHERE prospect_id = ? ORDER BY created_at DESC').all(id);
  const contacts = db.prepare('SELECT * FROM prospect_contacts WHERE prospect_id = ? ORDER BY is_primary DESC, name').all(id);
  const outreach = db.prepare('SELECT * FROM outreach_log WHERE prospect_id = ? ORDER BY outreach_date DESC LIMIT 20').all(id);

  // Get last outreach and next followup
  const lastOutreach = db.prepare('SELECT * FROM outreach_log WHERE prospect_id = ? ORDER BY outreach_date DESC LIMIT 1').get(id);
  const nextFollowup = db.prepare('SELECT * FROM outreach_log WHERE prospect_id = ? AND next_followup_date IS NOT NULL ORDER BY next_followup_date ASC LIMIT 1').get(id);

  db.close();

  return {
    ...prospect,
    signals,
    contacts,
    outreach,
    lastOutreach,
    nextFollowup
  };
}

export function getAllProspects({ tier, status, sort, limit, offset } = {}) {
  const db = getDatabase();

  let query = `
    SELECT p.*,
           (SELECT name FROM prospect_contacts WHERE prospect_id = p.id AND is_primary = 1 LIMIT 1) as primary_contact,
           (SELECT MAX(outreach_date) FROM outreach_log WHERE prospect_id = p.id) as last_outreach_date,
           (SELECT MIN(next_followup_date) FROM outreach_log WHERE prospect_id = p.id AND next_followup_date >= date('now')) as next_followup_date
    FROM prospects p
    WHERE 1=1
  `;

  const params = [];

  if (tier && tier !== 'all') {
    query += ' AND p.tier = ?';
    params.push(tier);
  }

  if (status && status !== 'all') {
    query += ' AND p.status = ?';
    params.push(status);
  }

  // Default sort by tier then score
  query += ' ORDER BY p.tier ASC, p.score DESC';

  if (limit) {
    query += ' LIMIT ?';
    params.push(limit);
    if (offset) {
      query += ' OFFSET ?';
      params.push(offset);
    }
  }

  const results = db.prepare(query).all(...params);

  // Get signals for each prospect
  const signalStmt = db.prepare('SELECT * FROM prospect_signals WHERE prospect_id = ?');
  for (const prospect of results) {
    prospect.signals = signalStmt.all(prospect.id);
  }

  db.close();
  return results;
}

export function updateProspect(id, updates) {
  const db = getDatabase();
  const allowedFields = ['company_name', 'website', 'industry', 'employee_count', 'employee_range',
                         'estimated_revenue', 'location', 'tech_stack', 'tier', 'score', 'status',
                         'converted_deal_id', 'notes', 'source'];

  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowedFields.includes(snakeKey)) {
      fields.push(`${snakeKey} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    db.close();
    return;
  }

  const stmt = db.prepare(`UPDATE prospects SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
  stmt.run(...values, id);
  db.close();
}

export function deleteProspect(id) {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM prospects WHERE id = ?');
  stmt.run(id);
  db.close();
}

export function convertProspectToDeal(prospectId, { dealValue, expectedCloseDate, notes }) {
  const db = getDatabase();

  const prospect = db.prepare('SELECT * FROM prospects WHERE id = ?').get(prospectId);
  if (!prospect) {
    db.close();
    throw new Error('Prospect not found');
  }

  // Get primary contact
  const primaryContact = db.prepare('SELECT * FROM prospect_contacts WHERE prospect_id = ? AND is_primary = 1').get(prospectId);

  // Create the deal
  const dealId = uuidv4();
  db.prepare(`
    INSERT INTO deals (id, company_name, contact_name, contact_role, status, value_amount, expected_close_date, notes)
    VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(
    dealId,
    prospect.company_name,
    primaryContact?.name,
    primaryContact?.title,
    dealValue,
    expectedCloseDate,
    notes || prospect.notes
  );

  // Initialize MEDDPICC for the deal
  const letters = ['M', 'E', 'D1', 'D2', 'P', 'I', 'C1', 'C2'];
  const meddpiccStmt = db.prepare(`
    INSERT INTO deal_meddpicc (id, deal_id, letter, status)
    VALUES (?, ?, ?, 'unknown')
  `);
  for (const letter of letters) {
    meddpiccStmt.run(uuidv4(), dealId, letter);
  }

  // Update prospect status
  db.prepare(`
    UPDATE prospects SET status = 'converted', converted_deal_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(dealId, prospectId);

  db.close();
  return dealId;
}

// ============================================
// PHASE 2: PROSPECT SIGNAL QUERIES
// ============================================

export function addProspectSignal(prospectId, { signalType, signalValue, weight, detectedAt, source, notes }) {
  const db = getDatabase();
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT INTO prospect_signals (id, prospect_id, signal_type, signal_value, weight, detected_at, source, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, prospectId, signalType, signalValue, weight || 10, detectedAt || new Date().toISOString(), source, notes);
  db.close();

  return id;
}

export function getProspectSignals(prospectId) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM prospect_signals WHERE prospect_id = ? ORDER BY created_at DESC');
  const results = stmt.all(prospectId);
  db.close();
  return results;
}

export function deleteProspectSignal(signalId) {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM prospect_signals WHERE id = ?');
  stmt.run(signalId);
  db.close();
}

// ============================================
// PHASE 2: PROSPECT CONTACT QUERIES
// ============================================

export function addProspectContact(prospectId, { name, title, email, linkedinUrl, phone, persona, isPrimary, notes }) {
  const db = getDatabase();
  const id = uuidv4();

  // If setting as primary, unset other primaries first
  if (isPrimary) {
    db.prepare('UPDATE prospect_contacts SET is_primary = 0 WHERE prospect_id = ?').run(prospectId);
  }

  const stmt = db.prepare(`
    INSERT INTO prospect_contacts (id, prospect_id, name, title, email, linkedin_url, phone, persona, is_primary, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, prospectId, name, title, email, linkedinUrl, phone, persona || 'unknown', isPrimary ? 1 : 0, notes);
  db.close();

  return id;
}

export function updateProspectContact(contactId, updates) {
  const db = getDatabase();

  const allowedFields = ['name', 'title', 'email', 'linkedin_url', 'phone', 'persona', 'is_primary', 'notes'];
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowedFields.includes(snakeKey)) {
      fields.push(`${snakeKey} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    db.close();
    return;
  }

  // Handle primary contact switching
  if (updates.isPrimary || updates.is_primary) {
    const contact = db.prepare('SELECT prospect_id FROM prospect_contacts WHERE id = ?').get(contactId);
    if (contact) {
      db.prepare('UPDATE prospect_contacts SET is_primary = 0 WHERE prospect_id = ?').run(contact.prospect_id);
    }
  }

  const stmt = db.prepare(`UPDATE prospect_contacts SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
  stmt.run(...values, contactId);
  db.close();
}

export function deleteProspectContact(contactId) {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM prospect_contacts WHERE id = ?');
  stmt.run(contactId);
  db.close();
}

export function getProspectContacts(prospectId) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM prospect_contacts WHERE prospect_id = ? ORDER BY is_primary DESC, name');
  const results = stmt.all(prospectId);
  db.close();
  return results;
}

// ============================================
// PHASE 2: OUTREACH LOG QUERIES
// ============================================

export function createOutreach({ prospectId, contactId, outreachDate, method, direction, subject, contentSummary, outcome, nextAction, nextFollowupDate, sequenceStep }) {
  const db = getDatabase();
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT INTO outreach_log (id, prospect_id, contact_id, outreach_date, method, direction, subject, content_summary, outcome, next_action, next_followup_date, sequence_step)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, prospectId, contactId, outreachDate || new Date().toISOString().split('T')[0], method, direction || 'outbound', subject, contentSummary, outcome || 'pending', nextAction, nextFollowupDate, sequenceStep);
  db.close();

  return id;
}

export function updateOutreach(outreachId, updates) {
  const db = getDatabase();

  const allowedFields = ['outreach_date', 'method', 'direction', 'subject', 'content_summary', 'outcome', 'next_action', 'next_followup_date', 'sequence_step'];
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowedFields.includes(snakeKey)) {
      fields.push(`${snakeKey} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    db.close();
    return;
  }

  const stmt = db.prepare(`UPDATE outreach_log SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values, outreachId);
  db.close();
}

export function getOutreachLog({ prospectId, method, outcome, fromDate, toDate, limit, offset } = {}) {
  const db = getDatabase();

  let query = `
    SELECT o.*, p.company_name as prospect_name, pc.name as contact_name
    FROM outreach_log o
    LEFT JOIN prospects p ON o.prospect_id = p.id
    LEFT JOIN prospect_contacts pc ON o.contact_id = pc.id
    WHERE 1=1
  `;

  const params = [];

  if (prospectId) {
    query += ' AND o.prospect_id = ?';
    params.push(prospectId);
  }

  if (method) {
    query += ' AND o.method = ?';
    params.push(method);
  }

  if (outcome) {
    query += ' AND o.outcome = ?';
    params.push(outcome);
  }

  if (fromDate) {
    query += ' AND o.outreach_date >= ?';
    params.push(fromDate);
  }

  if (toDate) {
    query += ' AND o.outreach_date <= ?';
    params.push(toDate);
  }

  query += ' ORDER BY o.outreach_date DESC';

  if (limit) {
    query += ' LIMIT ?';
    params.push(limit);
    if (offset) {
      query += ' OFFSET ?';
      params.push(offset);
    }
  }

  const results = db.prepare(query).all(...params);
  db.close();
  return results;
}

export function getDueFollowups(days = 7) {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT o.*, p.company_name as prospect_name, p.tier, pc.name as contact_name
    FROM outreach_log o
    JOIN prospects p ON o.prospect_id = p.id
    LEFT JOIN prospect_contacts pc ON o.contact_id = pc.id
    WHERE o.next_followup_date IS NOT NULL
      AND o.next_followup_date <= date('now', '+' || ? || ' days')
      AND o.next_followup_date >= date('now')
      AND p.status = 'active'
    ORDER BY o.next_followup_date ASC
  `);

  const results = stmt.all(days);
  db.close();
  return results;
}

export function getOverdueFollowups() {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT o.*, p.company_name as prospect_name, p.tier, pc.name as contact_name
    FROM outreach_log o
    JOIN prospects p ON o.prospect_id = p.id
    LEFT JOIN prospect_contacts pc ON o.contact_id = pc.id
    WHERE o.next_followup_date IS NOT NULL
      AND o.next_followup_date < date('now')
      AND p.status = 'active'
    ORDER BY o.next_followup_date ASC
  `);

  const results = stmt.all();
  db.close();
  return results;
}

export function getOutreachStats() {
  const db = getDatabase();

  // Total outreach this week
  const thisWeek = db.prepare(`
    SELECT COUNT(*) as count FROM outreach_log
    WHERE outreach_date >= date('now', '-7 days')
  `).get().count;

  // Response rate (positive + replied + meeting_booked / total non-pending)
  const responseData = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN outcome IN ('positive', 'replied', 'meeting_booked') THEN 1 ELSE 0 END) as responses
    FROM outreach_log
    WHERE outcome != 'pending' AND outreach_date >= date('now', '-30 days')
  `).get();

  const responseRate = responseData.total > 0 ? responseData.responses / responseData.total : 0;

  // Meetings booked this week
  const meetingsBooked = db.prepare(`
    SELECT COUNT(*) as count FROM outreach_log
    WHERE outcome = 'meeting_booked' AND outreach_date >= date('now', '-7 days')
  `).get().count;

  // Method breakdown
  const methodBreakdown = db.prepare(`
    SELECT method, COUNT(*) as count
    FROM outreach_log
    WHERE outreach_date >= date('now', '-30 days')
    GROUP BY method
  `).all();

  // Overdue count
  const overdueCount = db.prepare(`
    SELECT COUNT(DISTINCT o.prospect_id) as count
    FROM outreach_log o
    JOIN prospects p ON o.prospect_id = p.id
    WHERE o.next_followup_date < date('now')
      AND p.status = 'active'
  `).get().count;

  // Due today
  const dueToday = db.prepare(`
    SELECT COUNT(*) as count FROM outreach_log
    WHERE next_followup_date = date('now')
  `).get().count;

  db.close();

  return {
    totalThisWeek: thisWeek,
    responseRate,
    meetingsBooked,
    methodBreakdown,
    overdueCount,
    dueToday
  };
}

// ============================================
// PHASE 2: INSIGHT QUERIES
// ============================================

export function createInsight({ insightType, category, title, hypothesis, confidence, evidence, sampleSize, previousInsightId }) {
  const db = getDatabase();
  const id = uuidv4();

  // If there's a previous insight, mark it as superseded
  if (previousInsightId) {
    db.prepare(`UPDATE insights SET status = 'superseded', superseded_by = ? WHERE id = ?`).run(id, previousInsightId);
  }

  const stmt = db.prepare(`
    INSERT INTO insights (id, insight_type, category, title, hypothesis, confidence, evidence, sample_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, insightType, category, title, hypothesis, confidence || 0.5, typeof evidence === 'string' ? evidence : JSON.stringify(evidence), sampleSize);

  // Create history entry
  db.prepare(`
    INSERT INTO insight_history (id, insight_id, confidence, evidence, sample_size)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), id, confidence || 0.5, typeof evidence === 'string' ? evidence : JSON.stringify(evidence), sampleSize);

  db.close();
  return id;
}

export function getInsight(id) {
  const db = getDatabase();
  const insight = db.prepare('SELECT * FROM insights WHERE id = ?').get(id);

  if (insight) {
    insight.history = db.prepare('SELECT * FROM insight_history WHERE insight_id = ? ORDER BY snapshot_at DESC').all(id);
    if (insight.evidence && typeof insight.evidence === 'string') {
      try {
        insight.evidence = JSON.parse(insight.evidence);
      } catch (e) {
        // Keep as string if not valid JSON
      }
    }
  }

  db.close();
  return insight;
}

export function getAllInsights({ type, category, minConfidence, status } = {}) {
  const db = getDatabase();

  let query = 'SELECT * FROM insights WHERE 1=1';
  const params = [];

  if (type) {
    query += ' AND insight_type = ?';
    params.push(type);
  }

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  if (minConfidence) {
    query += ' AND confidence >= ?';
    params.push(minConfidence);
  }

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  } else {
    query += " AND status = 'active'";
  }

  query += ' ORDER BY confidence DESC, updated_at DESC';

  const results = db.prepare(query).all(...params);

  // Parse evidence JSON
  for (const insight of results) {
    if (insight.evidence && typeof insight.evidence === 'string') {
      try {
        insight.evidence = JSON.parse(insight.evidence);
      } catch (e) {
        // Keep as string
      }
    }
  }

  db.close();
  return results;
}

export function getLatestInsight(type) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM insights
    WHERE insight_type = ? AND status = 'active'
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  const result = stmt.get(type);

  if (result && result.evidence && typeof result.evidence === 'string') {
    try {
      result.evidence = JSON.parse(result.evidence);
    } catch (e) {
      // Keep as string
    }
  }

  db.close();
  return result;
}

export function updateInsightFeedback(insightId, feedback) {
  const db = getDatabase();
  db.prepare('UPDATE insights SET user_feedback = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(feedback, insightId);
  db.close();
}

export function updateInsightStatus(insightId, status) {
  const db = getDatabase();
  db.prepare('UPDATE insights SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, insightId);
  db.close();
}

// ============================================
// PHASE 2: OUTCOME QUERIES
// ============================================

export function createOutcome({ entityType, entityId, outcomeType, outcomeDate, outcomeValue, context }) {
  const db = getDatabase();
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT INTO outcomes (id, entity_type, entity_id, outcome_type, outcome_date, outcome_value, context)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, entityType, entityId, outcomeType, outcomeDate || new Date().toISOString().split('T')[0], outcomeValue, context);
  db.close();
  return id;
}

export function getOutcomes({ entityType, outcomeType, fromDate, toDate } = {}) {
  const db = getDatabase();

  let query = 'SELECT * FROM outcomes WHERE 1=1';
  const params = [];

  if (entityType) {
    query += ' AND entity_type = ?';
    params.push(entityType);
  }

  if (outcomeType) {
    query += ' AND outcome_type = ?';
    params.push(outcomeType);
  }

  if (fromDate) {
    query += ' AND outcome_date >= ?';
    params.push(fromDate);
  }

  if (toDate) {
    query += ' AND outcome_date <= ?';
    params.push(toDate);
  }

  query += ' ORDER BY outcome_date DESC';

  const results = db.prepare(query).all(...params);
  db.close();
  return results;
}

export function getRecentOutcomes(days = 30) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM outcomes
    WHERE created_at >= datetime('now', '-' || ? || ' days')
    ORDER BY created_at DESC
  `);
  const results = stmt.all(days);
  db.close();
  return results;
}

// ============================================
// PHASE 2: LEARNING WEIGHT QUERIES
// ============================================

export function getSignalWeights() {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM learned_weights').all();
  db.close();

  const weights = {};
  for (const row of rows) {
    weights[row.signal_type] = row.learned_weight ?? row.default_weight;
  }
  return weights;
}

export function getAllSignalWeights() {
  const db = getDatabase();
  const results = db.prepare('SELECT * FROM learned_weights ORDER BY signal_type').all();
  db.close();
  return results;
}

export function updateSignalWeight(signalType, { learnedWeight, confidence, sampleSize }) {
  const db = getDatabase();

  db.prepare(`
    UPDATE learned_weights
    SET learned_weight = ?, confidence = ?, sample_size = ?, last_calibrated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE signal_type = ?
  `).run(learnedWeight, confidence, sampleSize, signalType);

  db.close();
}

// ============================================
// PHASE 2: CONFIG QUERIES
// ============================================

export function getConfig(key) {
  const db = getDatabase();
  const result = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  db.close();
  return result?.value;
}

export function getAllConfig(category = null) {
  const db = getDatabase();

  let query = 'SELECT * FROM config';
  const params = [];

  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }

  const results = db.prepare(query).all(...params);
  db.close();
  return results;
}

export function setConfig(key, value, category = null) {
  const db = getDatabase();

  db.prepare(`
    INSERT INTO config (key, value, category)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, value, category);

  db.close();
}

// ============================================
// PHASE 2: CADENCE TEMPLATE QUERIES
// ============================================

export function getCadenceTemplates(tier = null) {
  const db = getDatabase();

  let query = 'SELECT * FROM cadence_templates';
  const params = [];

  if (tier) {
    query += ' WHERE tier = ?';
    params.push(tier);
  }

  query += ' ORDER BY tier, name';

  const results = db.prepare(query).all(...params);

  // Parse steps JSON
  for (const template of results) {
    if (template.steps && typeof template.steps === 'string') {
      try {
        template.steps = JSON.parse(template.steps);
      } catch (e) {
        template.steps = [];
      }
    }
  }

  db.close();
  return results;
}

export function getDefaultCadenceForTier(tier) {
  const db = getDatabase();
  const result = db.prepare('SELECT * FROM cadence_templates WHERE tier = ? AND is_default = 1 LIMIT 1').get(tier);

  if (result && result.steps && typeof result.steps === 'string') {
    try {
      result.steps = JSON.parse(result.steps);
    } catch (e) {
      result.steps = [];
    }
  }

  db.close();
  return result;
}

// ============================================
// PHASE 2: DATA FOR LEARNING ENGINE
// ============================================

export function getDealsWithOutcome(outcomeType) {
  const db = getDatabase();

  let statusCondition = '';
  if (outcomeType === 'won') {
    statusCondition = "d.status = 'won'";
  } else if (outcomeType === 'lost') {
    statusCondition = "d.status = 'lost'";
  } else {
    statusCondition = "d.status = ?";
  }

  const query = `
    SELECT d.*,
           o.outcome_value,
           o.context as outcome_context,
           o.outcome_date
    FROM deals d
    LEFT JOIN outcomes o ON o.entity_id = d.id AND o.entity_type = 'deal'
    WHERE ${statusCondition}
    ORDER BY d.updated_at DESC
  `;

  const results = outcomeType === 'won' || outcomeType === 'lost'
    ? db.prepare(query).all()
    : db.prepare(query).all(outcomeType);

  db.close();
  return results;
}

export function getDealsWithStatus(status) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM deals WHERE status = ? ORDER BY updated_at DESC');
  const results = stmt.all(status);
  db.close();
  return results;
}

export function getProspectsWithStatus(statuses) {
  const db = getDatabase();

  const statusList = Array.isArray(statuses) ? statuses : [statuses];
  const placeholders = statusList.map(() => '?').join(',');

  const stmt = db.prepare(`SELECT * FROM prospects WHERE status IN (${placeholders}) ORDER BY updated_at DESC`);
  const results = stmt.all(...statusList);
  db.close();
  return results;
}

export function getRecentTranscripts(days = 7) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM transcripts
    WHERE created_at >= datetime('now', '-' || ? || ' days')
    ORDER BY created_at DESC
  `);
  const results = stmt.all(days);
  db.close();
  return results;
}

export function getTranscriptsWithMetrics() {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT t.*, tm.talk_ratio, tm.strong_moments, tm.improvement_areas, tm.questions_asked
    FROM transcripts t
    LEFT JOIN transcript_metrics tm ON t.id = tm.transcript_id
    WHERE t.processed_at IS NOT NULL
    ORDER BY t.call_date DESC
  `);
  const results = stmt.all();

  // Parse JSON fields
  for (const transcript of results) {
    if (transcript.strong_moments) {
      try { transcript.strong_moments = JSON.parse(transcript.strong_moments); } catch (e) { transcript.strong_moments = []; }
    }
    if (transcript.improvement_areas) {
      try { transcript.improvement_areas = JSON.parse(transcript.improvement_areas); } catch (e) { transcript.improvement_areas = []; }
    }
    if (transcript.questions_asked) {
      try { transcript.questions_asked = JSON.parse(transcript.questions_asked); } catch (e) { transcript.questions_asked = []; }
    }
  }

  db.close();
  return results;
}

export function getSegmentsForPerson(personId) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT s.*, t.filename as transcript_filename, t.call_date
    FROM segments s
    JOIN segment_people sp ON s.id = sp.segment_id
    JOIN transcripts t ON s.transcript_id = t.id
    WHERE sp.person_id = ?
    ORDER BY t.call_date DESC, s.start_time
  `);
  const results = stmt.all(personId);
  db.close();
  return results;
}

export function getSegmentsForDeal(dealId) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT s.*, t.filename as transcript_filename, t.call_date
    FROM segments s
    JOIN segment_deals sd ON s.id = sd.segment_id
    JOIN transcripts t ON s.transcript_id = t.id
    WHERE sd.deal_id = ?
    ORDER BY t.call_date DESC, s.start_time
  `);
  const results = stmt.all(dealId);
  db.close();
  return results;
}

export function linkSegmentToPerson(segmentId, personId, roleInSegment = null) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR IGNORE INTO segment_people (segment_id, person_id, role_in_segment)
    VALUES (?, ?, ?)
  `).run(segmentId, personId, roleInSegment);
  db.close();
}

export function linkSegmentToDeal(segmentId, dealId) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR IGNORE INTO segment_deals (segment_id, deal_id)
    VALUES (?, ?)
  `).run(segmentId, dealId);
  db.close();
}

// ============================================
// PHASE 3: QUERY HISTORY QUERIES
// ============================================

export function createQueryHistory({ query, intent, response, sources, responseTimeMs }) {
  const db = getDatabase();
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT INTO query_history (id, query, intent, response, sources, response_time_ms)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, query, intent, response, typeof sources === 'string' ? sources : JSON.stringify(sources), responseTimeMs);
  db.close();

  return id;
}

export function getQueryHistory({ limit = 20, offset = 0 } = {}) {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT * FROM query_history
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  const results = stmt.all(limit, offset);

  // Parse sources JSON
  for (const row of results) {
    if (row.sources && typeof row.sources === 'string') {
      try {
        row.sources = JSON.parse(row.sources);
      } catch (e) {
        row.sources = [];
      }
    }
  }

  db.close();
  return results;
}

export function getQueryHistoryItem(id) {
  const db = getDatabase();
  const result = db.prepare('SELECT * FROM query_history WHERE id = ?').get(id);

  if (result && result.sources && typeof result.sources === 'string') {
    try {
      result.sources = JSON.parse(result.sources);
    } catch (e) {
      result.sources = [];
    }
  }

  db.close();
  return result;
}

export function updateQueryFeedback(id, feedback) {
  const db = getDatabase();
  db.prepare('UPDATE query_history SET feedback = ? WHERE id = ?').run(feedback, id);
  db.close();
}

// ============================================
// PHASE 3: LIVING SECTIONS QUERIES
// ============================================

export function getLivingSection(entityType, entityId, sectionType) {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT * FROM living_sections
    WHERE entity_type = ? AND (entity_id = ? OR (entity_id IS NULL AND ? IS NULL)) AND section_type = ?
  `);

  const result = stmt.get(entityType, entityId, entityId, sectionType);

  if (result && result.content && typeof result.content === 'string') {
    try {
      result.content = JSON.parse(result.content);
    } catch (e) {
      // Keep as string if not valid JSON
    }
  }

  db.close();
  return result;
}

export function getAllLivingSections(entityType, entityId) {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT * FROM living_sections
    WHERE entity_type = ? AND (entity_id = ? OR (entity_id IS NULL AND ? IS NULL))
    ORDER BY section_type
  `);

  const results = stmt.all(entityType, entityId, entityId);

  // Parse content JSON
  for (const row of results) {
    if (row.content && typeof row.content === 'string') {
      try {
        row.content = JSON.parse(row.content);
      } catch (e) {
        // Keep as string
      }
    }
  }

  db.close();
  return results;
}

export function saveLivingSection({ entityType, entityId, sectionType, content, dataHash }) {
  const db = getDatabase();
  const id = uuidv4();

  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);

  const stmt = db.prepare(`
    INSERT INTO living_sections (id, entity_type, entity_id, section_type, content, data_hash, is_stale)
    VALUES (?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(entity_type, entity_id, section_type) DO UPDATE SET
      content = excluded.content,
      data_hash = excluded.data_hash,
      is_stale = 0,
      generated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(id, entityType, entityId, sectionType, contentStr, dataHash);
  db.close();

  return id;
}

export function markLivingSectionStale(entityType, entityId, sectionType = null) {
  const db = getDatabase();

  if (sectionType) {
    db.prepare(`
      UPDATE living_sections
      SET is_stale = 1
      WHERE entity_type = ? AND (entity_id = ? OR (entity_id IS NULL AND ? IS NULL)) AND section_type = ?
    `).run(entityType, entityId, entityId, sectionType);
  } else {
    db.prepare(`
      UPDATE living_sections
      SET is_stale = 1
      WHERE entity_type = ? AND (entity_id = ? OR (entity_id IS NULL AND ? IS NULL))
    `).run(entityType, entityId, entityId);
  }

  db.close();
}

export function deleteLivingSection(entityType, entityId, sectionType) {
  const db = getDatabase();

  db.prepare(`
    DELETE FROM living_sections
    WHERE entity_type = ? AND (entity_id = ? OR (entity_id IS NULL AND ? IS NULL)) AND section_type = ?
  `).run(entityType, entityId, entityId, sectionType);

  db.close();
}

export function getComputedPatterns() {
  const db = getDatabase();
  const results = db.prepare('SELECT * FROM computed_patterns ORDER BY computed_at DESC').all();

  // Parse pattern_data JSON
  for (const row of results) {
    if (row.pattern_data && typeof row.pattern_data === 'string') {
      try {
        row.pattern_data = JSON.parse(row.pattern_data);
      } catch (e) {
        row.pattern_data = {};
      }
    }
  }

  db.close();
  return results;
}

export default {
  // Transcript queries
  createTranscript,
  getTranscript,
  getAllTranscripts,
  updateTranscript,
  transcriptExists,
  transcriptExistsByHash,
  deleteTranscript,
  getRecentTranscripts,
  getTranscriptsWithMetrics,

  // Segment queries
  createSegment,
  getSegment,
  getSegmentsByTranscript,
  getSegmentsByKnowledgeType,
  getAllSegments,
  searchSegments,
  deleteSegmentsForTranscript,
  addSegmentTag,
  getSegmentTags,
  getSegmentsByTag,
  getSegmentsForPerson,
  getSegmentsForDeal,
  linkSegmentToPerson,
  linkSegmentToDeal,

  // People queries
  createPerson,
  getPerson,
  getPersonByName,
  getAllPeople,
  updatePerson,

  // Deal queries
  createDeal,
  getDeal,
  getDealByCompany,
  getAllDeals,
  updateDeal,
  updateDealMeddpicc,
  getDealMeddpicc,
  getDealsWithOutcome,
  getDealsWithStatus,

  // Metrics & Stats queries
  saveTranscriptMetrics,
  getTranscriptMetrics,
  getStats,

  // Phase 4.4: Data management queries
  getDbInfo,
  resetDatabase,

  // Phase 2: Prospect queries
  createProspect,
  getProspect,
  getProspectWithDetails,
  getAllProspects,
  updateProspect,
  deleteProspect,
  convertProspectToDeal,
  getProspectsWithStatus,

  // Phase 2: Prospect signal queries
  addProspectSignal,
  getProspectSignals,
  deleteProspectSignal,

  // Phase 2: Prospect contact queries
  addProspectContact,
  updateProspectContact,
  deleteProspectContact,
  getProspectContacts,

  // Phase 2: Outreach queries
  createOutreach,
  updateOutreach,
  getOutreachLog,
  getDueFollowups,
  getOverdueFollowups,
  getOutreachStats,

  // Phase 2: Insight queries
  createInsight,
  getInsight,
  getAllInsights,
  getLatestInsight,
  updateInsightFeedback,
  updateInsightStatus,

  // Phase 2: Outcome queries
  createOutcome,
  getOutcomes,
  getRecentOutcomes,

  // Phase 2: Learning weight queries
  getSignalWeights,
  getAllSignalWeights,
  updateSignalWeight,

  // Phase 2: Config queries
  getConfig,
  getAllConfig,
  setConfig,

  // Phase 2: Cadence template queries
  getCadenceTemplates,
  getDefaultCadenceForTier,

  // Phase 3: Query history queries
  createQueryHistory,
  getQueryHistory,
  getQueryHistoryItem,
  updateQueryFeedback,

  // Phase 3: Living sections queries
  getLivingSection,
  getAllLivingSections,
  saveLivingSection,
  markLivingSectionStale,
  deleteLivingSection,
  getComputedPatterns
};
