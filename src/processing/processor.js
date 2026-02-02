import { getTranscript, createSegment, addSegmentTag, updateTranscript, saveTranscriptMetrics, getAllPeople, getAllDeals, deleteSegmentsForTranscript } from '../db/queries.js';

// Phase 2 processing imports
import { classifySegment } from './classifier.js';
import { extractEntities } from './entityExtractor.js';
import { linkEntities } from './entityLinker.js';
import { extractMeddpicc, updateDealMeddpiccFromFindings } from './meddpiccExtractor.js';
import { analyzeMetrics, saveComprehensiveMetrics } from './metricsAnalyzer.js';

// AI Provider configuration
let aiProvider = null;
let aiConfig = {};

/**
 * Initialize the AI provider
 * Supports: 'ollama' (free, local) or 'anthropic' (paid API)
 */
export async function initAI(config = {}) {
  const provider = config.provider || process.env.AI_PROVIDER || 'ollama';
  
  if (provider === 'anthropic') {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('Anthropic provider selected but no API key found');
      return false;
    }
    
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      aiProvider = 'anthropic';
      aiConfig = { 
        client: new Anthropic({ apiKey }),
        model: config.model || 'claude-sonnet-4-20250514'
      };
      console.log('✓ Anthropic client initialized');
      return true;
    } catch (err) {
      console.warn('Could not initialize Anthropic client:', err.message);
      return false;
    }
  } 
  
  if (provider === 'ollama') {
    const baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = config.model || process.env.OLLAMA_MODEL || 'llama3.1:8b';
    
    // Test connection to Ollama
    try {
      const response = await fetch(`${baseUrl}/api/tags`);
      if (!response.ok) throw new Error('Ollama not responding');
      
      const data = await response.json();
      const models = data.models?.map(m => m.name) || [];
      
      aiProvider = 'ollama';
      aiConfig = { baseUrl, model, availableModels: models };
      
      if (!models.some(m => m.startsWith(model.split(':')[0]))) {
        console.warn(`⚠ Model "${model}" not found. Available: ${models.join(', ')}`);
        console.warn(`  Run: ollama pull ${model}`);
      }
      
      console.log(`✓ Ollama initialized (${baseUrl})`);
      console.log(`  Model: ${model}`);
      return true;
    } catch (err) {
      console.warn('Could not connect to Ollama:', err.message);
      console.warn('  Is Ollama running? Start with: ollama serve');
      return false;
    }
  }
  
  console.warn(`Unknown AI provider: ${provider}`);
  return false;
}

/**
 * Get current AI provider status
 */
export function getAIStatus() {
  return {
    provider: aiProvider,
    enabled: !!aiProvider,
    model: aiConfig.model || null,
    availableModels: aiConfig.availableModels || []
  };
}

/**
 * Get the callAI function for use in other modules
 * @returns {function|null} The callAI function or null if not initialized
 */
export function getCallAI() {
  if (!aiProvider) return null;
  return callAI;
}

/**
 * Call the configured AI provider
 */
export async function callAI(prompt, options = {}) {
  if (!aiProvider) {
    throw new Error('AI not initialized');
  }
  
  if (aiProvider === 'anthropic') {
    const response = await aiConfig.client.messages.create({
      model: aiConfig.model,
      max_tokens: options.maxTokens || 4096,
      messages: [{ role: 'user', content: prompt }]
    });
    return response.content[0].text;
  }
  
  if (aiProvider === 'ollama') {
    const response = await fetch(`${aiConfig.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: aiConfig.model,
        prompt: prompt,
        stream: false,
        options: {
          num_predict: options.maxTokens || 4096,
          temperature: options.temperature || 0.3
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama error: ${error}`);
    }
    
    const data = await response.json();
    return data.response;
  }
  
  throw new Error(`Unknown provider: ${aiProvider}`);
}

/**
 * Stream AI response as an async generator (for SSE)
 * Only supports Ollama provider (Anthropic streaming is different and can be added later)
 */
export async function* streamAI(prompt, options = {}) {
  if (!aiProvider) {
    throw new Error('AI not initialized');
  }

  if (aiProvider === 'ollama') {
    const response = await fetch(`${aiConfig.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: aiConfig.model,
        prompt: prompt,
        stream: true,
        options: {
          num_predict: options.maxTokens || 1500,
          temperature: options.temperature || 0.7
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama error: ${error}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              yield data.response;
            }
          } catch (e) {
            // Skip malformed JSON lines
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer);
        if (data.response) {
          yield data.response;
        }
      } catch (e) {}
    }
  } else if (aiProvider === 'anthropic') {
    // Fallback: non-streaming for Anthropic (can add streaming later)
    const response = await aiConfig.client.messages.create({
      model: aiConfig.model,
      max_tokens: options.maxTokens || 1500,
      messages: [{ role: 'user', content: prompt }]
    });
    yield response.content[0].text;
  }
}

/**
 * Process a transcript - segment it, tag segments, extract entities
 * This is the main AI processing pipeline (Phase 2 Enhanced)
 */
export async function processTranscript(transcriptId, options = {}) {
  const transcript = getTranscript(transcriptId);
  if (!transcript) {
    throw new Error(`Transcript not found: ${transcriptId}`);
  }

  console.log(`Processing transcript: ${transcript.filename}`);

  // If no AI provider, use stub processing
  if (!aiProvider) {
    console.log('No AI provider - using stub processing');
    return stubProcessTranscript(transcript);
  }

  try {
    const result = {
      segments: [],
      metrics: null,
      entities: null,
      meddpicc: null,
      linkedEntities: null
    };

    // Step 0: Clear existing segments (critical for reprocessing)
    const deletedCount = deleteSegmentsForTranscript(transcript.id);
    if (deletedCount > 0) {
      console.log(`Cleared ${deletedCount} existing segments for reprocessing`);
    }

    // Step 1: Segment the transcript
    const segments = await segmentTranscript(transcript);
    const segmentIds = [];

    // Step 2: Save segments and tags with enhanced classification
    for (const segment of segments) {
      // Enhanced classification for each segment (Phase 2)
      let classification = { knowledgeType: segment.knowledgeType, confidence: 0.7 };
      if (options.enhancedClassification !== false) {
        try {
          classification = await classifySegment(segment.content, {
            source: transcript.filename,
            speakers: [segment.speaker]
          }, callAI);
        } catch (err) {
          console.warn('Enhanced classification failed, using basic:', err.message);
        }
      }

      const segmentId = createSegment({
        transcriptId: transcript.id,
        content: segment.content,
        startTime: segment.startTime,
        endTime: segment.endTime,
        speaker: segment.speaker,
        knowledgeType: classification.knowledgeType || segment.knowledgeType,
        summary: classification.summary || segment.summary,
        confidence: classification.confidence
      });

      segmentIds.push(segmentId);

      // Add tags
      const tags = [...(segment.tags || []), ...(classification.tags || [])];
      const uniqueTags = [...new Set(tags)];
      for (const tag of uniqueTags) {
        addSegmentTag(segmentId, tag);
      }

      result.segments.push({ id: segmentId, ...segment, ...classification });
    }

    // Step 3: Extract entities (Phase 2)
    if (options.extractEntities !== false) {
      try {
        result.entities = await extractEntities(transcript, callAI);
        console.log(`Extracted ${result.entities.people?.length || 0} people, ${result.entities.companies?.length || 0} companies`);

        // Step 4: Link entities to database records
        result.linkedEntities = await linkEntities(result.entities, transcript.id, segmentIds);
        console.log(`Linked ${result.linkedEntities.people?.length || 0} people, ${result.linkedEntities.deals?.length || 0} deals`);
      } catch (err) {
        console.warn('Entity extraction/linking failed:', err.message);
      }
    }

    // Step 5: Extract MEDDPICC signals if deal context exists (Phase 2)
    if (options.extractMeddpicc !== false && result.entities?.dealContext?.existingDealMatch) {
      try {
        const deal = { id: result.entities.dealContext.existingDealMatch, company_name: result.entities.dealContext.companyName };
        result.meddpicc = await extractMeddpicc(transcript, deal, callAI);

        // Update MEDDPICC scorecard
        if (result.meddpicc.findings?.length > 0) {
          await updateDealMeddpiccFromFindings(deal.id, result.meddpicc, segmentIds[0]);
          console.log(`Updated MEDDPICC with ${result.meddpicc.findings.length} findings`);
        }
      } catch (err) {
        console.warn('MEDDPICC extraction failed:', err.message);
      }
    }

    // Step 6: Generate comprehensive metrics (Phase 2 enhanced)
    if (options.analyzeMetrics !== false) {
      try {
        result.metrics = await analyzeMetrics(transcript, callAI);
        saveComprehensiveMetrics(transcript.id, result.metrics);
      } catch (err) {
        console.warn('Enhanced metrics failed, using basic:', err.message);
        result.metrics = await analyzeTranscriptBasic(transcript);
        saveTranscriptMetrics(transcript.id, result.metrics);
      }
    } else {
      result.metrics = await analyzeTranscriptBasic(transcript);
      saveTranscriptMetrics(transcript.id, result.metrics);
    }

    // Step 7: Update transcript with summary
    updateTranscript(transcript.id, {
      summary: result.metrics.summary || result.metrics.topPriority,
      processed_at: new Date().toISOString()
    });

    console.log(`Processed transcript: ${transcript.filename} - ${segments.length} segments (Phase 2 enhanced)`);

    return result;

  } catch (err) {
    console.error(`AI processing failed for ${transcript.filename}:`, err);
    // Fall back to stub processing
    return stubProcessTranscript(transcript);
  }
}

/**
 * Use AI to segment a transcript into logical chunks
 */
async function segmentTranscript(transcript) {
  const prompt = `Analyze this transcript and break it into logical segments based on topic shifts.

For each segment, identify:
1. The content (exact text from the transcript)
2. Start and end timestamps if present
3. Speaker(s) involved
4. Knowledge type - one of:
   - product_knowledge: Information about features, capabilities, how things work
   - process_knowledge: Company procedures, how things are done internally
   - people_context: Information about people, roles, relationships
   - sales_insight: Prospect information, objections, deal-related discussion
   - advice_received: Direct guidance or recommendations from others
   - decision_rationale: Explanations for why decisions were made
   - competitive_intel: Information about competitors
   - small_talk: Casual conversation, greetings, off-topic
   - unknown: Cannot be categorized
5. A brief summary of the segment
6. Relevant tags (topics, people mentioned, companies, etc.)

Transcript:
${transcript.raw_content}

Respond ONLY with valid JSON, no other text:
{
  "segments": [
    {
      "content": "...",
      "startTime": "00:00:00",
      "endTime": "00:05:30",
      "speaker": "Name",
      "knowledgeType": "product_knowledge",
      "summary": "Discussion about API rate limiting",
      "tags": ["api", "rate-limiting", "technical"]
    }
  ]
}`;

  const text = await callAI(prompt);
  
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = text;
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  } else {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
  }
  
  try {
    const result = JSON.parse(jsonStr);
    return result.segments || [];
  } catch (err) {
    console.error('Failed to parse segmentation response:', err.message);
    console.error('Raw response:', text.substring(0, 500));
    throw new Error('Could not parse segmentation response');
  }
}

/**
 * Analyze transcript for metrics and summary (basic version)
 */
async function analyzeTranscriptBasic(transcript) {
  const prompt = `Analyze this sales/work transcript and provide:

1. Overall summary (2-3 sentences)
2. Talk ratio estimate (what percentage of talking was done by the main speaker vs others)
3. Strong moments (things done well)
4. Improvement areas (things that could be better)
5. Questions asked by the main speaker (discovery questions, clarifying questions)

Transcript:
${transcript.raw_content}

Respond ONLY with valid JSON, no other text:
{
  "summary": "...",
  "talkRatio": 0.65,
  "strongMoments": ["Good discovery question about timeline", "Handled pricing objection well"],
  "improvementAreas": ["Could have asked more about decision process", "Talked over the prospect at 5:30"],
  "questionsAsked": ["What's your timeline for this project?", "Who else is involved in this decision?"]
}`;

  const text = await callAI(prompt, { maxTokens: 2048 });
  
  // Extract JSON from response
  let jsonStr = text;
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  } else {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
  }
  
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Failed to parse analysis response:', err.message);
    return {
      summary: 'Analysis failed - could not parse AI response',
      talkRatio: null,
      strongMoments: [],
      improvementAreas: [],
      questionsAsked: []
    };
  }
}

/**
 * Stub processing when AI is not available
 * Creates basic segments based on speaker changes or paragraph breaks
 */
function stubProcessTranscript(transcript) {
  console.log('Using stub processing (no AI)');

  // Clear existing segments before stub processing
  deleteSegmentsForTranscript(transcript.id);

  const content = transcript.raw_content;
  const lines = content.split('\n').filter(l => l.trim());
  
  // Simple segmentation: group consecutive lines by speaker or create chunks
  const segments = [];
  let currentChunk = [];
  let chunkCount = 0;
  
  for (const line of lines) {
    currentChunk.push(line);
    
    // Create a new segment every ~500 characters or on apparent speaker change
    const chunkText = currentChunk.join('\n');
    const speakerChange = line.match(/^[A-Za-z\s]+:/);
    
    if (chunkText.length > 500 || speakerChange) {
      if (currentChunk.length > 0) {
        const segmentId = createSegment({
          transcriptId: transcript.id,
          content: chunkText,
          startTime: null,
          endTime: null,
          speaker: null,
          knowledgeType: 'unknown',
          summary: null
        });
        
        segments.push({ id: segmentId, content: chunkText });
        chunkCount++;
        currentChunk = speakerChange ? [line] : [];
      }
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    const chunkText = currentChunk.join('\n');
    const segmentId = createSegment({
      transcriptId: transcript.id,
      content: chunkText,
      startTime: null,
      endTime: null,
      speaker: null,
      knowledgeType: 'unknown',
      summary: null
    });
    segments.push({ id: segmentId, content: chunkText });
  }
  
  // Update transcript as processed
  updateTranscript(transcript.id, {
    processed_at: new Date().toISOString()
  });
  
  console.log(`Stub processed: ${segments.length} segments`);
  
  return {
    segments,
    metrics: {
      summary: 'Transcript imported (AI processing pending)',
      talkRatio: null,
      strongMoments: [],
      improvementAreas: [],
      questionsAsked: []
    }
  };
}

export default {
  initAI,
  getAIStatus,
  getCallAI,
  callAI,
  streamAI,
  processTranscript
};
