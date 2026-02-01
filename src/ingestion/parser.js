import fs from 'fs';
import path from 'path';

/**
 * Parse a transcript file and extract content + metadata
 * Supports: .txt, .md, .json, .srt
 */
export function parseTranscript(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  const filename = path.basename(filepath);
  const content = fs.readFileSync(filepath, 'utf-8');

  let parsed = {
    filename,
    filepath,
    rawContent: content,
    durationMinutes: null,
    callDate: null,
    context: null,
    speakers: [],
    lines: []
  };

  switch (ext) {
    case '.txt':
    case '.md':
      parsed = parseTextTranscript(parsed, content);
      break;
    case '.json':
      parsed = parseJsonTranscript(parsed, content);
      break;
    case '.srt':
      parsed = parseSrtTranscript(parsed, content);
      break;
    default:
      // Treat as plain text
      parsed = parseTextTranscript(parsed, content);
  }

  return parsed;
}

/**
 * Parse plain text transcript
 * Attempts to detect speaker labels and timestamps
 */
function parseTextTranscript(parsed, content) {
  const lines = content.split('\n');
  const speakerPattern = /^([A-Za-z\s]+?)[\s]*(\d{1,2}:\d{2}(?::\d{2})?)?[\s]*[:\-]?\s*(.*)$/;
  const timestampPattern = /(\d{1,2}):(\d{2})(?::(\d{2}))?/;
  
  const speakers = new Set();
  const parsedLines = [];
  
  let currentSpeaker = null;
  let currentTimestamp = null;
  let currentContent = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Try to match speaker pattern
    const match = trimmed.match(speakerPattern);
    
    if (match && match[1] && match[1].length < 30) {
      // Save previous segment
      if (currentSpeaker && currentContent.length > 0) {
        parsedLines.push({
          speaker: currentSpeaker,
          timestamp: currentTimestamp,
          content: currentContent.join(' ')
        });
      }
      
      currentSpeaker = match[1].trim();
      speakers.add(currentSpeaker);
      
      // Extract timestamp if present
      if (match[2]) {
        const tsMatch = match[2].match(timestampPattern);
        if (tsMatch) {
          const hours = tsMatch[3] ? parseInt(tsMatch[1]) : 0;
          const minutes = tsMatch[3] ? parseInt(tsMatch[2]) : parseInt(tsMatch[1]);
          const seconds = tsMatch[3] ? parseInt(tsMatch[3]) : parseInt(tsMatch[2]);
          currentTimestamp = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
      }
      
      currentContent = match[3] ? [match[3]] : [];
    } else {
      // Continuation of previous speaker
      currentContent.push(trimmed);
    }
  }
  
  // Don't forget the last segment
  if (currentSpeaker && currentContent.length > 0) {
    parsedLines.push({
      speaker: currentSpeaker,
      timestamp: currentTimestamp,
      content: currentContent.join(' ')
    });
  }
  
  // If no speakers detected, treat whole content as one block
  if (parsedLines.length === 0) {
    parsedLines.push({
      speaker: 'Unknown',
      timestamp: null,
      content: content
    });
  }
  
  // Estimate duration from last timestamp
  if (parsedLines.length > 0) {
    const lastLine = parsedLines[parsedLines.length - 1];
    if (lastLine.timestamp) {
      const parts = lastLine.timestamp.split(':').map(Number);
      parsed.durationMinutes = parts[0] * 60 + parts[1] + Math.ceil(parts[2] / 60);
    }
  }
  
  parsed.speakers = Array.from(speakers);
  parsed.lines = parsedLines;
  
  return parsed;
}

/**
 * Parse JSON transcript (e.g., from Plaud export or other tools)
 */
function parseJsonTranscript(parsed, content) {
  try {
    const data = JSON.parse(content);
    
    // Handle various JSON formats
    if (data.transcript) {
      // Format: { transcript: "...", metadata: {...} }
      parsed.rawContent = data.transcript;
      if (data.metadata) {
        parsed.durationMinutes = data.metadata.duration_minutes || data.metadata.duration;
        parsed.callDate = data.metadata.date || data.metadata.call_date;
        parsed.context = data.metadata.context || data.metadata.title;
      }
    } else if (data.segments || data.lines) {
      // Format: { segments: [{ speaker, content, timestamp }] }
      const segments = data.segments || data.lines;
      const speakers = new Set();
      
      parsed.lines = segments.map(seg => {
        if (seg.speaker) speakers.add(seg.speaker);
        return {
          speaker: seg.speaker || 'Unknown',
          timestamp: seg.timestamp || seg.start_time || null,
          content: seg.content || seg.text || ''
        };
      });
      
      parsed.speakers = Array.from(speakers);
      parsed.rawContent = parsed.lines.map(l => `${l.speaker}: ${l.content}`).join('\n');
    } else if (typeof data === 'string') {
      // Just a string wrapped in JSON
      return parseTextTranscript(parsed, data);
    }
    
    return parsed;
  } catch (e) {
    console.error('Error parsing JSON transcript:', e);
    // Fall back to text parsing
    return parseTextTranscript(parsed, content);
  }
}

/**
 * Parse SRT subtitle file into transcript format
 * SRT format: sequence number, timestamp range, text content, blank line
 */
function parseSrtTranscript(parsed, content) {
  const blocks = content.trim().split(/\n\n+/);
  const speakers = new Set();
  const parsedLines = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;

    // Line 1: sequence number (skip it)
    // Line 2: timestamp range "00:00:01,000 --> 00:00:04,500"
    const timestampLine = lines[1];
    const tsMatch = timestampLine.match(
      /(\d{2}:\d{2}:\d{2}),\d{3}\s*-->\s*(\d{2}:\d{2}:\d{2}),\d{3}/
    );
    if (!tsMatch) continue;

    const startTime = tsMatch[1];
    const endTime = tsMatch[2];

    // Line 3+: text content (may span multiple lines)
    const textContent = lines.slice(2).join(' ').trim();
    if (!textContent) continue;

    // Try to extract speaker label (e.g., "Speaker 1: Hello")
    const speakerMatch = textContent.match(/^([^:]{1,30}):\s*(.+)$/);
    let speaker = 'Unknown';
    let spokenContent = textContent;

    if (speakerMatch) {
      speaker = speakerMatch[1].trim();
      spokenContent = speakerMatch[2].trim();
      speakers.add(speaker);
    }

    parsedLines.push({
      speaker,
      timestamp: startTime,
      endTime,
      content: spokenContent
    });
  }

  // Estimate duration from last block's end timestamp
  if (parsedLines.length > 0) {
    const lastLine = parsedLines[parsedLines.length - 1];
    const ts = lastLine.endTime || lastLine.timestamp;
    if (ts) {
      const parts = ts.split(':').map(Number);
      parsed.durationMinutes = parts[0] * 60 + parts[1] + Math.ceil(parts[2] / 60);
    }
  }

  parsed.speakers = Array.from(speakers);
  parsed.lines = parsedLines;
  parsed.rawContent = parsedLines
    .map(l => `${l.speaker}: ${l.content}`)
    .join('\n');

  return parsed;
}

/**
 * Extract metadata hints from filename
 * e.g., "2024-01-15_Acme_Corp_Discovery_Call.txt"
 */
export function parseFilenameMetadata(filename) {
  const metadata = {
    date: null,
    company: null,
    callType: null
  };
  
  // Try to extract date (YYYY-MM-DD or similar)
  const dateMatch = filename.match(/(\d{4}[-_]\d{2}[-_]\d{2})/);
  if (dateMatch) {
    metadata.date = dateMatch[1].replace(/_/g, '-');
  }
  
  // Common call type keywords
  const callTypes = ['discovery', 'demo', 'follow-up', 'followup', 'intro', 'closing', 'negotiation', 'onboarding', '1-1', '1on1', 'one-on-one'];
  const lowerFilename = filename.toLowerCase();
  
  for (const type of callTypes) {
    if (lowerFilename.includes(type)) {
      metadata.callType = type;
      break;
    }
  }
  
  return metadata;
}

export default {
  parseTranscript,
  parseFilenameMetadata
};
