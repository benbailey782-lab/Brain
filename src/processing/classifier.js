/**
 * Enhanced Knowledge Type Classification with Confidence Scores
 * Phase 2: Provides more nuanced classification of transcript segments
 */

const CLASSIFICATION_PROMPT = `Classify this segment from a sales-related document or conversation.

SEGMENT:
{SEGMENT_CONTENT}

CONTEXT:
Source: {SOURCE_NAME}
Speakers: {SPEAKERS}

Classify the PRIMARY knowledge type. You MUST choose exactly one from this list:

- product_knowledge: Technical details, features, capabilities, how our product works, pricing
- process_knowledge: Internal company procedures, approval processes, how things are done
- people_context: Information about specific people, their roles, preferences, relationships
- sales_insight: Prospect-specific info, buying signals, objections, concerns, timeline, budget, discovery questions
- advice_received: Direct guidance, coaching, or recommendations from colleagues or mentors
- decision_rationale: Explanations for why decisions were made
- competitive_intel: Information specifically about competitors, their products, or positioning
- small_talk: Casual conversation, greetings, rapport building
- unknown: Cannot be categorized into any of the above

IMPORTANT: "sales_insight" covers objections, concerns, questions, and buying signals.
Do NOT return any type not listed above.

Also identify:
1. Sentiment: positive, negative, neutral, mixed
2. Importance: high, medium, low (how valuable is this information?)
3. Actionability: Is there something to do based on this?

Respond ONLY with valid JSON:
{
  "knowledgeType": "sales_insight",
  "confidence": 0.85,
  "summary": "Prospect mentions they're also evaluating Competitor X and need to decide by Q2",
  "sentiment": "neutral",
  "importance": "high",
  "actionable": true,
  "actionSuggestion": "Ask about their evaluation criteria for Competitor X",
  "tags": ["competitor", "timeline", "evaluation"],
  "entities": {
    "people": [],
    "companies": ["Competitor X"],
    "products": []
  }
}`;

/**
 * Classify a segment with enhanced metadata
 * @param {string} content - The segment content
 * @param {object} context - Context about the segment (source, speakers)
 * @param {function} callAI - AI calling function from processor
 * @returns {object} Classification result
 */
export async function classifySegment(content, context, callAI) {
  const prompt = CLASSIFICATION_PROMPT
    .replace('{SEGMENT_CONTENT}', content)
    .replace('{SOURCE_NAME}', context.source || 'Unknown')
    .replace('{SPEAKERS}', context.speakers?.join(', ') || 'Unknown');

  try {
    const response = await callAI(prompt, { maxTokens: 1024 });
    const result = parseJSON(response);

    // Validate required fields
    if (!result.knowledgeType) {
      result.knowledgeType = 'unknown';
    }
    if (!result.confidence || result.confidence < 0 || result.confidence > 1) {
      result.confidence = 0.5;
    }

    // Map any invalid types to valid ones
    const VALID_TYPES = new Set([
      'product_knowledge', 'process_knowledge', 'people_context',
      'sales_insight', 'advice_received', 'decision_rationale',
      'competitive_intel', 'small_talk', 'unknown'
    ]);

    if (!VALID_TYPES.has(result.knowledgeType)) {
      // Map common AI responses to valid types
      const typeMap = {
        'objection': 'sales_insight',
        'question': 'sales_insight',
        'pricing': 'product_knowledge',
        'competition': 'competitive_intel',
        'coaching': 'advice_received',
        'relationship': 'people_context',
        'procedure': 'process_knowledge'
      };
      result.knowledgeType = typeMap[result.knowledgeType] || 'unknown';
    }

    return result;
  } catch (err) {
    console.error('Classification failed:', err.message);
    return {
      knowledgeType: 'unknown',
      confidence: 0.3,
      summary: null,
      sentiment: 'neutral',
      importance: 'medium',
      actionable: false,
      tags: [],
      entities: { people: [], companies: [], products: [] }
    };
  }
}

/**
 * Batch classify multiple segments for efficiency
 * @param {Array} segments - Array of segments with content and context
 * @param {function} callAI - AI calling function
 * @returns {Array} Classified segments
 */
export async function batchClassify(segments, callAI) {
  if (segments.length <= 3) {
    // For small batches, classify individually for accuracy
    const results = [];
    for (const segment of segments) {
      const classification = await classifySegment(segment.content, segment.context || {}, callAI);
      results.push({ ...segment, ...classification });
    }
    return results;
  }

  // For larger batches, use batch prompt
  const batchPrompt = `Classify each of these ${segments.length} segments from a sales-related document or conversation.

SEGMENTS:
${segments.map((s, i) => `[${i + 1}] ${s.content.substring(0, 500)}${s.content.length > 500 ? '...' : ''}`).join('\n\n')}

For each segment, identify:
1. knowledgeType (product_knowledge, process_knowledge, people_context, sales_insight, advice_received, decision_rationale, competitive_intel, small_talk, unknown)
2. confidence (0.0 to 1.0)
3. summary (brief)
4. importance (high, medium, low)
5. tags (relevant topics)

IMPORTANT: "sales_insight" covers objections, concerns, questions, and buying signals.
Do NOT return any type not in the list above.

Respond ONLY with valid JSON:
{
  "classifications": [
    { "index": 1, "knowledgeType": "...", "confidence": 0.85, "summary": "...", "importance": "high", "tags": [...] },
    ...
  ]
}`;

  try {
    const response = await callAI(batchPrompt, { maxTokens: 4096 });
    const result = parseJSON(response);

    const classified = segments.map((segment, i) => {
      const classification = result.classifications?.find(c => c.index === i + 1) || {
        knowledgeType: 'unknown',
        confidence: 0.3,
        summary: null,
        importance: 'medium',
        tags: []
      };

      return {
        ...segment,
        knowledgeType: classification.knowledgeType || 'unknown',
        confidence: classification.confidence || 0.5,
        summary: classification.summary,
        importance: classification.importance || 'medium',
        tags: classification.tags || []
      };
    });

    return classified;
  } catch (err) {
    console.error('Batch classification failed:', err.message);
    return segments.map(s => ({
      ...s,
      knowledgeType: 'unknown',
      confidence: 0.3,
      summary: null,
      importance: 'medium',
      tags: []
    }));
  }
}

/**
 * Parse JSON from AI response, handling code blocks
 * @param {string} text - Raw AI response
 * @returns {object} Parsed JSON
 */
function parseJSON(text) {
  let jsonStr = text;

  // Handle markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  } else {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
  }

  return JSON.parse(jsonStr.trim());
}

export default {
  classifySegment,
  batchClassify
};
