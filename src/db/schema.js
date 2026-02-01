import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists
const dataDir = join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || join(dataDir, 'prism.db');

export function initDatabase() {
  const db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // ============================================
  // CORE TABLES
  // ============================================
  
  // Transcripts - the raw source files
  db.exec(`
    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      raw_content TEXT NOT NULL,
      content_hash TEXT UNIQUE,
      duration_minutes INTEGER,
      call_date DATETIME,
      context TEXT,
      summary TEXT,
      processed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Segments - chunks of transcripts tagged by knowledge type
  db.exec(`
    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY,
      transcript_id TEXT NOT NULL,
      content TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      speaker TEXT,
      knowledge_type TEXT CHECK(knowledge_type IN (
        'product_knowledge',
        'process_knowledge',
        'people_context',
        'sales_insight',
        'advice_received',
        'decision_rationale',
        'competitive_intel',
        'small_talk',
        'unknown'
      )),
      summary TEXT,
      confidence REAL DEFAULT 1.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE CASCADE
    )
  `);
  
  // Segment tags - multiple tags per segment
  db.exec(`
    CREATE TABLE IF NOT EXISTS segment_tags (
      id TEXT PRIMARY KEY,
      segment_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE
    )
  `);
  
  // ============================================
  // ENTITY TABLES
  // ============================================
  
  // People - colleagues, prospects, anyone mentioned
  db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT,
      company TEXT,
      relationship_type TEXT CHECK(relationship_type IN (
        'colleague',
        'manager',
        'prospect',
        'customer',
        'competitor_contact',
        'mentor',
        'other'
      )),
      email TEXT,
      phone TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Deals - tracked opportunities
  db.exec(`
    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      contact_name TEXT,
      contact_role TEXT,
      status TEXT DEFAULT 'active',
      value_amount REAL,
      value_currency TEXT DEFAULT 'USD',
      expected_close_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity_at DATETIME
    )
  `);
  
  // MEDDPICC tracking for deals
  db.exec(`
    CREATE TABLE IF NOT EXISTS deal_meddpicc (
      id TEXT PRIMARY KEY,
      deal_id TEXT NOT NULL,
      letter TEXT CHECK(letter IN ('M', 'E', 'D1', 'D2', 'P', 'I', 'C1', 'C2')),
      status TEXT CHECK(status IN ('unknown', 'partial', 'identified')) DEFAULT 'unknown',
      evidence TEXT,
      source_segment_id TEXT,
      confidence REAL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
      FOREIGN KEY (source_segment_id) REFERENCES segments(id) ON DELETE SET NULL,
      UNIQUE(deal_id, letter)
    )
  `);
  
  // Products/Features - knowledge about your product
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_knowledge (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      category TEXT,
      content TEXT NOT NULL,
      source_segment_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_segment_id) REFERENCES segments(id) ON DELETE SET NULL
    )
  `);
  
  // Objections - library of objections encountered
  db.exec(`
    CREATE TABLE IF NOT EXISTS objections (
      id TEXT PRIMARY KEY,
      objection_text TEXT NOT NULL,
      category TEXT,
      frequency INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Objection responses - how you've handled each objection
  db.exec(`
    CREATE TABLE IF NOT EXISTS objection_responses (
      id TEXT PRIMARY KEY,
      objection_id TEXT NOT NULL,
      response_text TEXT NOT NULL,
      effectiveness TEXT CHECK(effectiveness IN ('unknown', 'poor', 'okay', 'good', 'excellent')),
      source_segment_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (objection_id) REFERENCES objections(id) ON DELETE CASCADE,
      FOREIGN KEY (source_segment_id) REFERENCES segments(id) ON DELETE SET NULL
    )
  `);
  
  // ============================================
  // RELATIONSHIP TABLES
  // ============================================
  
  // Link segments to people mentioned in them
  db.exec(`
    CREATE TABLE IF NOT EXISTS segment_people (
      segment_id TEXT NOT NULL,
      person_id TEXT NOT NULL,
      role_in_segment TEXT,
      PRIMARY KEY (segment_id, person_id),
      FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    )
  `);
  
  // Link segments to deals
  db.exec(`
    CREATE TABLE IF NOT EXISTS segment_deals (
      segment_id TEXT NOT NULL,
      deal_id TEXT NOT NULL,
      PRIMARY KEY (segment_id, deal_id),
      FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
    )
  `);
  
  // ============================================
  // PRECOMPUTED METRICS
  // ============================================
  
  // Self-coaching metrics per transcript
  db.exec(`
    CREATE TABLE IF NOT EXISTS transcript_metrics (
      id TEXT PRIMARY KEY,
      transcript_id TEXT NOT NULL UNIQUE,
      talk_ratio REAL,
      strong_moments TEXT,
      improvement_areas TEXT,
      questions_asked TEXT,
      computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE CASCADE
    )
  `);
  
  // Aggregated patterns (rebuilt periodically)
  db.exec(`
    CREATE TABLE IF NOT EXISTS computed_patterns (
      id TEXT PRIMARY KEY,
      pattern_type TEXT NOT NULL,
      pattern_data TEXT NOT NULL,
      computed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ============================================
  // PHASE 2: PROSPECTING TABLES
  // ============================================

  // Prospect accounts (pre-deal pipeline)
  db.exec(`
    CREATE TABLE IF NOT EXISTS prospects (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      website TEXT,
      industry TEXT,
      employee_count INTEGER,
      employee_range TEXT,
      estimated_revenue TEXT,
      location TEXT,
      tech_stack TEXT,
      tier INTEGER DEFAULT 3 CHECK(tier IN (1, 2, 3)),
      score INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'nurture', 'converted', 'disqualified', 'archived')),
      converted_deal_id TEXT,
      notes TEXT,
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (converted_deal_id) REFERENCES deals(id)
    )
  `);

  // Buying signals for prospects
  db.exec(`
    CREATE TABLE IF NOT EXISTS prospect_signals (
      id TEXT PRIMARY KEY,
      prospect_id TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      signal_value TEXT,
      weight INTEGER DEFAULT 10,
      detected_at DATETIME,
      source TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
    )
  `);

  // Contacts at prospect accounts
  db.exec(`
    CREATE TABLE IF NOT EXISTS prospect_contacts (
      id TEXT PRIMARY KEY,
      prospect_id TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT,
      email TEXT,
      linkedin_url TEXT,
      phone TEXT,
      persona TEXT CHECK(persona IN ('decision_maker', 'champion', 'influencer', 'blocker', 'user', 'unknown')),
      is_primary INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
    )
  `);

  // Outreach activity log
  db.exec(`
    CREATE TABLE IF NOT EXISTS outreach_log (
      id TEXT PRIMARY KEY,
      prospect_id TEXT NOT NULL,
      contact_id TEXT,
      outreach_date DATE NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('email', 'linkedin', 'call', 'text', 'video', 'in_person', 'other')),
      direction TEXT DEFAULT 'outbound' CHECK(direction IN ('outbound', 'inbound')),
      subject TEXT,
      content_summary TEXT,
      outcome TEXT DEFAULT 'pending' CHECK(outcome IN ('pending', 'no_response', 'positive', 'negative', 'meeting_booked', 'replied', 'bounced')),
      next_action TEXT,
      next_followup_date DATE,
      sequence_step INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES prospect_contacts(id) ON DELETE SET NULL
    )
  `);

  // ============================================
  // PHASE 2: LEARNING ENGINE TABLES
  // ============================================

  // System-generated insights
  db.exec(`
    CREATE TABLE IF NOT EXISTS insights (
      id TEXT PRIMARY KEY,
      insight_type TEXT NOT NULL,
      category TEXT,
      title TEXT NOT NULL,
      hypothesis TEXT NOT NULL,
      confidence REAL DEFAULT 0.5,
      evidence TEXT,
      sample_size INTEGER,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'validated', 'invalidated', 'superseded')),
      superseded_by TEXT,
      user_feedback TEXT CHECK(user_feedback IN ('helpful', 'not_helpful', 'incorrect', NULL)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (superseded_by) REFERENCES insights(id)
    )
  `);

  // Insight history for tracking evolution
  db.exec(`
    CREATE TABLE IF NOT EXISTS insight_history (
      id TEXT PRIMARY KEY,
      insight_id TEXT NOT NULL,
      confidence REAL,
      evidence TEXT,
      sample_size INTEGER,
      snapshot_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (insight_id) REFERENCES insights(id) ON DELETE CASCADE
    )
  `);

  // Outcome tracking for learning
  db.exec(`
    CREATE TABLE IF NOT EXISTS outcomes (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('deal', 'prospect', 'outreach', 'call')),
      entity_id TEXT NOT NULL,
      outcome_type TEXT NOT NULL,
      outcome_date DATE,
      outcome_value REAL,
      context TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Learned signal weights (system-adjusted)
  db.exec(`
    CREATE TABLE IF NOT EXISTS learned_weights (
      id TEXT PRIMARY KEY,
      signal_type TEXT NOT NULL UNIQUE,
      default_weight INTEGER DEFAULT 10,
      learned_weight REAL,
      confidence REAL DEFAULT 0.5,
      sample_size INTEGER DEFAULT 0,
      last_calibrated_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ============================================
  // PHASE 2: CONFIGURATION TABLES
  // ============================================

  // User-configurable settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      category TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Cadence templates
  db.exec(`
    CREATE TABLE IF NOT EXISTS cadence_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tier INTEGER,
      steps TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ============================================
  // PHASE 3: QUERY ENGINE TABLES
  // ============================================

  // Query history for the Ask feature
  db.exec(`
    CREATE TABLE IF NOT EXISTS query_history (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      intent TEXT,
      response TEXT NOT NULL,
      sources TEXT,
      response_time_ms INTEGER,
      feedback TEXT CHECK(feedback IN ('helpful', 'not_helpful', NULL)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Living sections - cached AI-generated profiles
  db.exec(`
    CREATE TABLE IF NOT EXISTS living_sections (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('deal', 'person', 'product', 'global_insights')),
      entity_id TEXT,
      section_type TEXT NOT NULL,
      content TEXT NOT NULL,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      data_hash TEXT,
      is_stale INTEGER DEFAULT 0,
      UNIQUE(entity_type, entity_id, section_type)
    )
  `);

  // ============================================
  // INDEXES
  // ============================================
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_segments_transcript ON segments(transcript_id);
    CREATE INDEX IF NOT EXISTS idx_segments_knowledge_type ON segments(knowledge_type);
    CREATE INDEX IF NOT EXISTS idx_segment_tags_segment ON segment_tags(segment_id);
    CREATE INDEX IF NOT EXISTS idx_segment_tags_tag ON segment_tags(tag);
    CREATE INDEX IF NOT EXISTS idx_segment_people_segment ON segment_people(segment_id);
    CREATE INDEX IF NOT EXISTS idx_segment_people_person ON segment_people(person_id);
    CREATE INDEX IF NOT EXISTS idx_segment_deals_segment ON segment_deals(segment_id);
    CREATE INDEX IF NOT EXISTS idx_segment_deals_deal ON segment_deals(deal_id);
    CREATE INDEX IF NOT EXISTS idx_deal_meddpicc_deal ON deal_meddpicc(deal_id);
    CREATE INDEX IF NOT EXISTS idx_transcripts_date ON transcripts(call_date);
    CREATE INDEX IF NOT EXISTS idx_transcripts_content_hash ON transcripts(content_hash);
  `);

  // ============================================
  // PHASE 2 INDEXES
  // ============================================

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prospects_tier ON prospects(tier);
    CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
    CREATE INDEX IF NOT EXISTS idx_prospects_score ON prospects(score DESC);
    CREATE INDEX IF NOT EXISTS idx_prospect_signals_prospect ON prospect_signals(prospect_id);
    CREATE INDEX IF NOT EXISTS idx_prospect_contacts_prospect ON prospect_contacts(prospect_id);
    CREATE INDEX IF NOT EXISTS idx_outreach_log_prospect ON outreach_log(prospect_id);
    CREATE INDEX IF NOT EXISTS idx_outreach_log_date ON outreach_log(outreach_date DESC);
    CREATE INDEX IF NOT EXISTS idx_outreach_log_followup ON outreach_log(next_followup_date);
    CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(insight_type);
    CREATE INDEX IF NOT EXISTS idx_insights_status ON insights(status);
    CREATE INDEX IF NOT EXISTS idx_outcomes_entity ON outcomes(entity_type, entity_id);
  `);

  // ============================================
  // PHASE 3 INDEXES
  // ============================================

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_query_history_created ON query_history(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_living_sections_entity ON living_sections(entity_type, entity_id);
  `);

  // Seed defaults after table creation
  seedDefaults(db);

  console.log('Database initialized successfully');
  return db;
}

// ============================================
// SEED DEFAULTS
// ============================================

function seedDefaults(db) {
  // Default signal weights
  const defaultWeights = [
    { signal_type: 'recent_funding', default_weight: 20 },
    { signal_type: 'hiring_signals', default_weight: 15 },
    { signal_type: 'tech_stack_fit', default_weight: 10 },
    { signal_type: 'industry_fit', default_weight: 10 },
    { signal_type: 'company_size_fit', default_weight: 10 },
    { signal_type: 'social_engagement', default_weight: 10 },
    { signal_type: 'competitor_customer', default_weight: 15 },
    { signal_type: 'inbound_signal', default_weight: 25 },
    { signal_type: 'previous_relationship', default_weight: 15 },
    { signal_type: 'recent_news', default_weight: 10 },
    { signal_type: 'growth_indicators', default_weight: 12 },
    { signal_type: 'pain_indicators', default_weight: 18 },
  ];

  const weightStmt = db.prepare(`
    INSERT OR IGNORE INTO learned_weights (id, signal_type, default_weight, learned_weight)
    VALUES (?, ?, ?, ?)
  `);

  for (const w of defaultWeights) {
    weightStmt.run(uuidv4(), w.signal_type, w.default_weight, w.default_weight);
  }

  // Default cadence templates
  const cadences = [
    {
      name: 'Tier 1 - High Touch',
      tier: 1,
      steps: JSON.stringify([
        { day: 0, method: 'email', note: 'Personalized intro' },
        { day: 2, method: 'linkedin', note: 'Connection request' },
        { day: 5, method: 'email', note: 'Follow-up with value' },
        { day: 8, method: 'call', note: 'Direct dial attempt' },
        { day: 12, method: 'email', note: 'Case study share' },
        { day: 16, method: 'linkedin', note: 'Engage with content' },
        { day: 21, method: 'call', note: 'Second call attempt' },
        { day: 28, method: 'email', note: 'Breakup email' },
      ]),
      is_default: 1
    },
    {
      name: 'Tier 2 - Standard',
      tier: 2,
      steps: JSON.stringify([
        { day: 0, method: 'email', note: 'Intro email' },
        { day: 4, method: 'linkedin', note: 'Connection request' },
        { day: 10, method: 'email', note: 'Follow-up' },
        { day: 18, method: 'email', note: 'Value add' },
        { day: 28, method: 'email', note: 'Breakup email' },
      ]),
      is_default: 1
    },
    {
      name: 'Tier 3 - Light Touch',
      tier: 3,
      steps: JSON.stringify([
        { day: 0, method: 'email', note: 'Intro email' },
        { day: 14, method: 'email', note: 'Follow-up' },
        { day: 30, method: 'email', note: 'Final attempt' },
      ]),
      is_default: 1
    }
  ];

  const cadenceStmt = db.prepare(`
    INSERT OR IGNORE INTO cadence_templates (id, name, tier, steps, is_default)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Check if cadences already exist
  const existingCadences = db.prepare('SELECT COUNT(*) as count FROM cadence_templates').get();
  if (existingCadences.count === 0) {
    for (const c of cadences) {
      cadenceStmt.run(uuidv4(), c.name, c.tier, c.steps, c.is_default);
    }
  }

  // Default tier thresholds config
  const configs = [
    { key: 'tier1_threshold', value: '70', category: 'scoring' },
    { key: 'tier2_threshold', value: '40', category: 'scoring' },
    { key: 'followup_overdue_days', value: '7', category: 'cadence' },
    { key: 'target_talk_ratio_min', value: '0.35', category: 'coaching' },
    { key: 'target_talk_ratio_max', value: '0.50', category: 'coaching' },
  ];

  const configStmt = db.prepare(`
    INSERT OR IGNORE INTO config (key, value, category)
    VALUES (?, ?, ?)
  `);

  for (const c of configs) {
    configStmt.run(c.key, c.value, c.category);
  }
}

export function getDatabase() {
  return new Database(dbPath);
}

export function getDbPath() {
  return dbPath;
}

export default { initDatabase, getDatabase, getDbPath };
