/**
 * Query Engine - Smart retrieval-augmented query pipeline
 * Phase 3: Track A
 */

import * as queries from '../db/queries.js';
import crypto from 'crypto';

/**
 * Intent types for query classification
 */
const INTENT_TYPES = {
  DEAL_STRATEGY: 'deal_strategy',
  KNOWLEDGE_RETRIEVAL: 'knowledge_retrieval',
  PEOPLE_INTEL: 'people_intel',
  COACHING: 'coaching',
  COMPETITIVE: 'competitive',
  OBJECTION: 'objection',
  GENERAL: 'general'
};

/**
 * Rule-based intent detection — replaces AI call for instant classification.
 * Matches against known entities in the database for high-precision entity extraction.
 */
function detectIntent(query) {
  const q = query.toLowerCase().trim();
  const entities = { companies: [], people: [], meddpicc_letters: [], knowledge_types: [], time_range: null };

  // --- Entity extraction from DB (fast: SQLite lookups are <1ms) ---
  try {
    const allDeals = queries.getAllDeals();
    for (const deal of allDeals) {
      if (deal.company_name && q.includes(deal.company_name.toLowerCase())) {
        entities.companies.push(deal.company_name);
      }
    }
    const allPeople = queries.getAllPeople();
    for (const person of allPeople) {
      if (person.name && q.includes(person.name.toLowerCase())) {
        entities.people.push(person.name);
      }
    }
  } catch (err) {
    console.error('Entity extraction error:', err.message);
  }

  // --- MEDDPICC letter extraction ---
  const meddpiccPatterns = [
    { letter: 'M', pattern: /\bmetrics?\b/ },
    { letter: 'E', pattern: /\beconomic buyer\b/ },
    { letter: 'D1', pattern: /\bdecision criteria\b/ },
    { letter: 'D2', pattern: /\bdecision process\b/ },
    { letter: 'P', pattern: /\bpaper process\b/ },
    { letter: 'I', pattern: /\bidentified pain\b|\bpain\b/ },
    { letter: 'C1', pattern: /\bchampion\b/ },
    { letter: 'C2', pattern: /\bcompetition\b|\bcompetitor\b/ }
  ];
  for (const { letter, pattern } of meddpiccPatterns) {
    if (pattern.test(q)) entities.meddpicc_letters.push(letter);
  }
  if (/\bmeddpicc\b/i.test(q)) {
    entities.meddpicc_letters = ['M', 'E', 'D1', 'D2', 'P', 'I', 'C1', 'C2'];
  }

  // --- Intent classification by keyword matching ---
  // Order matters: more specific intents first

  // People intent — if a known person name was found, or people-related keywords
  if (entities.people.length > 0 || /\bwho\b|contacts?|stakeholders?|relationship|person|people\b/.test(q)) {
    return { intent: INTENT_TYPES.PEOPLE_INTEL, confidence: 0.85, entities };
  }

  // Objection handling
  if (/\bobjections?|pushback|concerns?|overcome|handle|pricing objection\b/.test(q)) {
    return { intent: INTENT_TYPES.OBJECTION, confidence: 0.85, entities };
  }

  // Competitive intelligence
  if (/\bcompetitors?|competitive|versus\b|\bvs\.?\b|\bcompete\b/.test(q)) {
    return { intent: INTENT_TYPES.COMPETITIVE, confidence: 0.85, entities };
  }

  // Coaching / performance
  if (/\btalk ratio|coaching|patterns?|performance|improve|trending|my calls\b/.test(q)) {
    return { intent: INTENT_TYPES.COACHING, confidence: 0.85, entities };
  }

  // Deal strategy — if a known company was found, or deal-related keywords
  if (entities.companies.length > 0 || /\bdeal|strategy|pipeline|close|qualify|meddpicc|forecast|stage\b/.test(q)) {
    return { intent: INTENT_TYPES.DEAL_STRATEGY, confidence: 0.85, entities };
  }

  // Knowledge retrieval
  if (/\bhow does|how do|feature|product|pricing|integration|sso|api\b/.test(q)) {
    return { intent: INTENT_TYPES.KNOWLEDGE_RETRIEVAL, confidence: 0.80, entities };
  }

  // Default: general
  return { intent: INTENT_TYPES.GENERAL, confidence: 0.6, entities };
}

/**
 * Retrieve relevant context based on intent
 */
function retrieveContext(intent, entities) {
  const context = {
    deals: [],
    people: [],
    segments: [],
    transcripts: [],
    patterns: [],
    prospects: [],
    meddpicc: null
  };

  const sources = [];

  try {
    switch (intent.intent) {
      case INTENT_TYPES.DEAL_STRATEGY: {
        // Get specific deal if mentioned
        if (entities.companies && entities.companies.length > 0) {
          for (const company of entities.companies) {
            const deal = queries.getDealByCompany(company);
            if (deal) {
              context.deals.push(deal);
              context.meddpicc = queries.getDealMeddpicc(deal.id);
              const dealSegments = queries.getSegmentsForDeal(deal.id);
              context.segments.push(...dealSegments.slice(0, 10));
              sources.push({ type: 'deal', id: deal.id, name: deal.company_name, relevance: 0.95 });
            }
          }
        }
        // If no specific deal, get all active deals
        if (context.deals.length === 0) {
          const allDeals = queries.getAllDeals();
          context.deals = allDeals.slice(0, 5);
          for (const deal of context.deals) {
            sources.push({ type: 'deal', id: deal.id, name: deal.company_name, relevance: 0.7 });
          }
        }
        break;
      }

      case INTENT_TYPES.KNOWLEDGE_RETRIEVAL: {
        // Search segments by knowledge type
        const productSegments = queries.getSegmentsByKnowledgeType('product_knowledge');
        context.segments = productSegments.slice(0, 15);

        // If specific keywords, search segments
        if (entities.knowledge_types && entities.knowledge_types.length > 0) {
          for (const kt of entities.knowledge_types) {
            const ktSegments = queries.getSegmentsByKnowledgeType(kt);
            context.segments.push(...ktSegments.slice(0, 5));
          }
        }

        for (const seg of context.segments) {
          sources.push({
            type: 'segment',
            id: seg.id,
            transcriptFilename: seg.transcript_filename,
            snippet: seg.content?.substring(0, 100),
            relevance: seg.confidence || 0.8
          });
        }
        break;
      }

      case INTENT_TYPES.PEOPLE_INTEL: {
        // Get specific person if mentioned
        if (entities.people && entities.people.length > 0) {
          for (const personName of entities.people) {
            const person = queries.getPersonByName(personName);
            if (person) {
              context.people.push(person);
              const personSegments = queries.getSegmentsForPerson(person.id);
              context.segments.push(...personSegments.slice(0, 10));
              sources.push({ type: 'person', id: person.id, name: person.name, relevance: 0.95 });
            }
          }
        }
        // Get all contacts if no specific person
        if (context.people.length === 0) {
          context.people = queries.getAllPeople().slice(0, 10);
          for (const p of context.people) {
            sources.push({ type: 'person', id: p.id, name: p.name, relevance: 0.6 });
          }
        }
        break;
      }

      case INTENT_TYPES.COACHING: {
        // Get transcripts with metrics
        context.transcripts = queries.getTranscriptsWithMetrics();
        // Get computed patterns
        context.patterns = queries.getComputedPatterns();

        for (const t of context.transcripts.slice(0, 10)) {
          sources.push({
            type: 'transcript',
            id: t.id,
            name: t.filename,
            relevance: 0.8
          });
        }
        break;
      }

      case INTENT_TYPES.COMPETITIVE: {
        // Search for competitive intel segments
        const compSegments = queries.getSegmentsByKnowledgeType('competitive_intel');
        context.segments = compSegments.slice(0, 15);

        // Also search by company name if provided
        if (entities.companies && entities.companies.length > 0) {
          for (const company of entities.companies) {
            const searchResults = queries.searchSegments(company);
            context.segments.push(...searchResults.slice(0, 5));
          }
        }

        for (const seg of context.segments) {
          sources.push({
            type: 'segment',
            id: seg.id,
            transcriptFilename: seg.transcript_filename,
            snippet: seg.content?.substring(0, 100),
            relevance: seg.confidence || 0.8
          });
        }
        break;
      }

      case INTENT_TYPES.OBJECTION: {
        // Search segments with objection tags
        const objectionSegments = queries.getSegmentsByTag('objection');
        context.segments = objectionSegments.slice(0, 15);

        // Also get sales insight segments
        const salesInsights = queries.getSegmentsByKnowledgeType('sales_insight');
        context.segments.push(...salesInsights.slice(0, 10));

        for (const seg of context.segments) {
          sources.push({
            type: 'segment',
            id: seg.id,
            transcriptFilename: seg.transcript_filename,
            snippet: seg.content?.substring(0, 100),
            relevance: seg.confidence || 0.75
          });
        }
        break;
      }

      default: {
        // General query - get a sample of everything
        context.deals = queries.getAllDeals().slice(0, 5);
        context.people = queries.getAllPeople().slice(0, 5);
        const allProspects = queries.getAllProspects ? queries.getAllProspects({ limit: 5 }) : [];
        context.prospects = allProspects;
        context.transcripts = queries.getAllTranscripts().slice(0, 5);

        const stats = queries.getStats();
        sources.push({ type: 'stats', relevance: 0.7, summary: `${stats.totalDeals} deals, ${stats.totalPeople} contacts` });
        break;
      }
    }
  } catch (err) {
    console.error('Context retrieval error:', err.message);
  }

  // De-duplicate sources by id
  const uniqueSources = [];
  const seenIds = new Set();
  for (const source of sources) {
    if (source.id && !seenIds.has(source.id)) {
      seenIds.add(source.id);
      uniqueSources.push(source);
    } else if (!source.id) {
      uniqueSources.push(source);
    }
  }

  return { context, sources: uniqueSources.slice(0, 20) };
}

/**
 * Build the synthesis prompt based on context
 */
function buildSynthesisPrompt(query, intent, context, sources) {
  let contextText = '';

  // Add deals context
  if (context.deals.length > 0) {
    contextText += '\n## Active Deals\n';
    for (const deal of context.deals) {
      contextText += `- **${deal.company_name}**: $${deal.value_amount || 'TBD'}, Status: ${deal.status}, Contact: ${deal.contact_name || 'Unknown'}\n`;
    }
  }

  // Add MEDDPICC context
  if (context.meddpicc && context.meddpicc.length > 0) {
    contextText += '\n## MEDDPICC Scorecard\n';
    const letterNames = {
      'M': 'Metrics', 'E': 'Economic Buyer', 'D1': 'Decision Criteria',
      'D2': 'Decision Process', 'P': 'Paper Process', 'I': 'Identified Pain',
      'C1': 'Champion', 'C2': 'Competition'
    };
    for (const m of context.meddpicc) {
      const status = m.status === 'identified' ? 'Identified' : m.status === 'partial' ? 'Partial' : 'Unknown';
      contextText += `- **${m.letter} (${letterNames[m.letter]})**: ${status}${m.evidence ? ` - ${m.evidence.substring(0, 100)}` : ''}\n`;
    }
  }

  // Add people context
  if (context.people.length > 0) {
    contextText += '\n## Key Contacts\n';
    for (const person of context.people) {
      contextText += `- **${person.name}** (${person.relationship_type || 'contact'}): ${person.role || ''} at ${person.company || 'Unknown'}${person.notes ? ` - ${person.notes.substring(0, 100)}` : ''}\n`;
    }
  }

  // Add segments context
  if (context.segments.length > 0) {
    contextText += '\n## Relevant Knowledge\n';
    for (const seg of context.segments.slice(0, 5)) {
      const source = seg.transcript_filename || 'Unknown source';
      contextText += `- [Source: ${source}] ${seg.summary || seg.content?.substring(0, 100) || 'No content'}\n`;
    }
  }

  // Add transcripts/metrics context for coaching
  if (context.transcripts.length > 0 && intent.intent === INTENT_TYPES.COACHING) {
    contextText += '\n## Call Metrics\n';
    for (const t of context.transcripts.slice(0, 5)) {
      if (t.talk_ratio !== null && t.talk_ratio !== undefined) {
        contextText += `- **${t.filename}**: Talk ratio: ${Math.round(t.talk_ratio * 100)}%`;
        if (t.strong_moments && t.strong_moments.length > 0) {
          contextText += `, Strengths: ${t.strong_moments.slice(0, 2).join(', ')}`;
        }
        contextText += '\n';
      }
    }
  }

  // Add patterns context
  if (context.patterns.length > 0) {
    contextText += '\n## Detected Patterns\n';
    for (const pattern of context.patterns.slice(0, 5)) {
      const data = pattern.pattern_data;
      contextText += `- **${pattern.pattern_type}**: ${typeof data === 'string' ? data : JSON.stringify(data).substring(0, 100)}\n`;
    }
  }

  // Add prospects context
  if (context.prospects.length > 0) {
    contextText += '\n## Prospects\n';
    for (const p of context.prospects) {
      contextText += `- **${p.company_name}**: Tier ${p.tier || 3}, Score: ${p.score || 0}\n`;
    }
  }

  // Smart context truncation — prioritize structured data, trim segments if needed
  const MAX_CONTEXT_CHARS = 12000;
  if (contextText.length > MAX_CONTEXT_CHARS) {
    // Split context into structured (deals, MEDDPICC, people) and bulk (segments, transcripts, patterns)
    const sections = contextText.split(/\n## /);
    const header = sections[0] || '';
    const structured = [];
    const bulk = [];

    for (let i = 1; i < sections.length; i++) {
      const section = '## ' + sections[i];
      if (section.startsWith('## Active Deals') || section.startsWith('## MEDDPICC') || section.startsWith('## Key Contacts') || section.startsWith('## Prospects')) {
        structured.push(section);
      } else {
        bulk.push(section);
      }
    }

    // Always keep structured sections in full
    let result = header + '\n' + structured.join('\n');
    let remaining = MAX_CONTEXT_CHARS - result.length;

    // Distribute remaining budget across bulk sections
    for (const section of bulk) {
      if (remaining <= 0) {
        result += '\n...[additional context truncated for length]';
        break;
      }
      if (section.length <= remaining) {
        result += '\n' + section;
        remaining -= section.length;
      } else {
        result += '\n' + section.substring(0, remaining) + '\n...[section truncated]';
        remaining = 0;
      }
    }

    contextText = result;
  }

  const intentInstructions = {
    [INTENT_TYPES.DEAL_STRATEGY]: `For deal strategy queries:
- Structure your response with MEDDPICC gaps, next steps, and risks
- Be specific about what's missing and what needs to happen next
- Reference specific sources using [Source: filename, segment_id] notation`,

    [INTENT_TYPES.COACHING]: `For coaching queries:
- Include specific call references and trends
- Be constructive and actionable
- Reference specific metrics and patterns`,

    [INTENT_TYPES.GENERAL]: `For general queries:
- Answer naturally and concisely
- Reference specific sources when available`
  };

  const instruction = intentInstructions[intent.intent] || intentInstructions[INTENT_TYPES.GENERAL];

  return `You are Prism, a personal sales intelligence assistant. Answer the user's question based ONLY on the following context from their sales data. Be concise and actionable.

${instruction}

If you don't have enough information to answer fully, say so honestly and suggest what data would help.

${contextText}

User Question: ${query}

Provide a clear, actionable answer:`;
}

/**
 * Generate follow-up question suggestions
 */
function generateFollowUps(intent, context) {
  const followUps = [];

  if (intent.intent === INTENT_TYPES.DEAL_STRATEGY && context.deals.length > 0) {
    const deal = context.deals[0];
    followUps.push(`What's the paper process for ${deal.company_name}?`);
    followUps.push(`Who else should I be talking to at ${deal.company_name}?`);
    followUps.push(`What competitive threats exist for this deal?`);
  }

  if (intent.intent === INTENT_TYPES.PEOPLE_INTEL && context.people.length > 0) {
    const person = context.people[0];
    followUps.push(`When was my last interaction with ${person.name}?`);
    followUps.push(`What deals is ${person.name} involved in?`);
  }

  if (intent.intent === INTENT_TYPES.COACHING) {
    followUps.push(`What questions should I be asking more?`);
    followUps.push(`Show me my best performing calls`);
    followUps.push(`What patterns lead to won deals?`);
  }

  // Generic fallbacks
  if (followUps.length === 0) {
    followUps.push(`What are my top deals this quarter?`);
    followUps.push(`Who should I follow up with today?`);
    followUps.push(`What objections am I hearing most?`);
  }

  return followUps.slice(0, 3);
}

/**
 * Extract visualizations and structured data to include in response.
 * The frontend uses these to render rich answer components instead of plain markdown.
 */
function extractVisualizations(intent, context) {
  const visualizations = [];

  // MEDDPICC scorecard — when deal context exists
  if (context.meddpicc && context.deals.length > 0) {
    visualizations.push({
      type: 'meddpicc_scorecard',
      dealId: context.deals[0].id,
      dealName: context.deals[0].company_name
    });
  }

  // Deal summary card — for deal-related intents with a matched deal
  if (
    (intent.intent === 'deal_strategy' || intent.intent === 'general') &&
    context.deals.length > 0
  ) {
    const deal = context.deals[0];
    visualizations.push({
      type: 'deal_summary',
      deal: {
        id: deal.id,
        company_name: deal.company_name,
        contact_name: deal.contact_name || null,
        contact_role: deal.contact_role || null,
        status: deal.status || 'unknown',
        value_amount: deal.value_amount || null,
        stage: deal.stage || null,
        last_activity_at: deal.last_activity_at || deal.updated_at || null,
        close_date: deal.close_date || null
      },
      meddpiccSummary: context.meddpicc
        ? context.meddpicc.map(m => ({ letter: m.letter, status: m.status, confidence: m.confidence }))
        : []
    });
  }

  // People cards — for people-related intents with matched people
  if (intent.intent === 'people_intel' && context.people.length > 0) {
    const topPeople = context.people.slice(0, 3);
    for (const person of topPeople) {
      visualizations.push({
        type: 'person_card',
        person: {
          id: person.id,
          name: person.name,
          role: person.role || null,
          company: person.company || null,
          relationship_type: person.relationship_type || 'other',
          updated_at: person.updated_at || null
        }
      });
    }
  }

  // Coaching metrics chart — for coaching queries with transcript metrics
  if (intent.intent === 'coaching' && context.transcripts.length > 0) {
    const metricsData = context.transcripts
      .filter(t => t.talk_ratio != null)
      .slice(0, 10)
      .map(t => ({
        label: t.filename ? t.filename.replace(/\.[^.]+$/, '').substring(0, 15) : 'Call',
        talk_ratio: Math.round((t.talk_ratio || 0) * 100),
        strong_moments: Array.isArray(t.strong_moments) ? t.strong_moments.length : (t.strong_moments || 0)
      }));

    if (metricsData.length >= 2) {
      visualizations.push({
        type: 'metrics_chart',
        metrics: metricsData,
        chartType: 'bar',
        title: 'Call Performance'
      });
    }
  }

  return visualizations;
}

/**
 * Main query pipeline
 */
export async function processQuery(query, callAI) {
  const startTime = Date.now();

  try {
    // Step 1: Detect intent (rule-based, instant)
    const intent = detectIntent(query);

    // Step 2: Retrieve relevant context
    const { context, sources } = retrieveContext(intent, intent.entities || {});

    // Step 3: Build and send synthesis prompt
    const synthesisPrompt = buildSynthesisPrompt(query, intent, context, sources);
    const answer = await callAI(synthesisPrompt, { maxTokens: 4096, temperature: 0.7 });

    // Step 4: Generate follow-ups and extract visualizations
    const followUpQuestions = generateFollowUps(intent, context);
    const visualizations = extractVisualizations(intent, context);

    const responseTimeMs = Date.now() - startTime;

    // Save to query history
    const historyId = queries.createQueryHistory({
      query,
      intent: intent.intent,
      response: answer,
      sources,
      responseTimeMs
    });

    return {
      id: historyId,
      answer,
      intent: intent.intent,
      intentConfidence: intent.confidence,
      sources,
      followUpQuestions,
      visualizations,
      responseTimeMs
    };

  } catch (err) {
    console.error('Query processing failed:', err);
    const responseTimeMs = Date.now() - startTime;

    // Save failed query to history
    queries.createQueryHistory({
      query,
      intent: 'error',
      response: `I encountered an error processing your question: ${err.message}`,
      sources: [],
      responseTimeMs
    });

    throw err;
  }
}

/**
 * Get query history
 */
export function getQueryHistory(options = {}) {
  return queries.getQueryHistory(options);
}

/**
 * Update query feedback
 */
export function submitQueryFeedback(queryId, feedback) {
  queries.updateQueryFeedback(queryId, feedback);
  return { success: true };
}

/**
 * Streaming query pipeline — yields SSE events as tokens arrive.
 * Intent detection is rule-based (instant). Synthesis is streamed from Ollama.
 */
export async function* processQueryStream(query, callAI, streamAI) {
  const startTime = Date.now();

  try {
    // Step 1: Instant rule-based intent detection
    const intent = detectIntent(query);

    // Step 2: Retrieve context (all sync DB calls, <5ms)
    const { context, sources } = retrieveContext(intent, intent.entities || {});

    // Step 3: Send metadata immediately so UI can render sources + intent before tokens arrive
    yield {
      type: 'meta',
      intent: intent.intent,
      intentConfidence: intent.confidence,
      sources: sources,
      followUpQuestions: generateFollowUps(intent, context),
      visualizations: extractVisualizations(intent, context)
    };

    // Step 4: Build synthesis prompt and stream the response
    const synthesisPrompt = buildSynthesisPrompt(query, intent, context, sources);
    let fullAnswer = '';

    for await (const token of streamAI(synthesisPrompt, { maxTokens: 4096, temperature: 0.7 })) {
      fullAnswer += token;
      yield { type: 'token', token };
    }

    const responseTimeMs = Date.now() - startTime;

    // Step 5: Save to history after streaming completes
    const historyId = queries.createQueryHistory({
      query,
      intent: intent.intent,
      response: fullAnswer,
      sources,
      responseTimeMs
    });

    yield { type: 'done', id: historyId, responseTimeMs };

  } catch (err) {
    console.error('Stream query failed:', err);
    const responseTimeMs = Date.now() - startTime;
    queries.createQueryHistory({
      query, intent: 'error',
      response: `Error: ${err.message}`,
      sources: [],
      responseTimeMs
    });
    yield { type: 'error', error: err.message };
  }
}

export default {
  processQuery,
  processQueryStream,
  getQueryHistory,
  submitQueryFeedback,
  INTENT_TYPES
};
