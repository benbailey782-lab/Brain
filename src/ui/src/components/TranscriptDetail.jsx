import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Clock, Calendar, Loader2, RefreshCw, Tag } from 'lucide-react';

const KNOWLEDGE_TYPE_LABELS = {
  product_knowledge: 'Product Knowledge',
  process_knowledge: 'Process Knowledge',
  people_context: 'People & Context',
  sales_insight: 'Sales Insight',
  advice_received: 'Advice Received',
  decision_rationale: 'Decision Rationale',
  small_talk: 'Small Talk',
  unknown: 'Uncategorized'
};

function TranscriptDetail({ transcript, onBack }) {
  const [segments, setSegments] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState(null);
  const [activeTab, setActiveTab] = useState('segments');

  useEffect(() => {
    fetchDetails();
  }, [transcript.id]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const [segmentsRes, metricsRes] = await Promise.all([
        fetch(`/api/transcripts/${transcript.id}/segments`),
        fetch(`/api/transcripts/${transcript.id}/metrics`)
      ]);

      const segmentsData = await segmentsRes.json();
      setSegments(Array.isArray(segmentsData) ? segmentsData : []);
      setMetrics(await metricsRes.json());
    } catch (err) {
      console.error('Error fetching details:', err);
    }
    setLoading(false);
  };

  const handleReprocess = async () => {
    setProcessing(true);
    setProcessError(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      const response = await fetch(`/api/transcripts/${transcript.id}/process`, {
        method: 'POST',
        signal: controller.signal
      });
      clearTimeout(timeout);

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.suggestion || 'Processing failed');
      }
      // Refresh transcript data after successful processing
      await fetchDetails();
    } catch (err) {
      if (err.name === 'AbortError') {
        setProcessError('Processing timed out. Is Ollama running? Check with: ollama serve');
      } else {
        setProcessError(err.message || 'Processing failed. Make sure AI is configured.');
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </button>

        <div className="flex-1">
          <h2 className="text-xl font-semibold text-white mb-1">{transcript.filename}</h2>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            {transcript.duration_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {transcript.duration_minutes} min
              </span>
            )}
            {transcript.call_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(transcript.call_date).toLocaleDateString()}
              </span>
            )}
            {transcript.context && (
              <span className="bg-zinc-800 px-2 py-1 rounded">
                {transcript.context}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleReprocess}
          disabled={processing}
          className="flex items-center gap-2 px-4 py-2 bg-prism-500 hover:bg-prism-blue
                     disabled:bg-zinc-700 disabled:text-zinc-500
                     text-white rounded-lg transition-colors text-sm font-medium"
        >
          {processing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {processing ? 'Processing...' : 'Reprocess'}
        </button>
      </div>

      {/* Process Error Display */}
      {processError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{processError}</p>
        </div>
      )}

      {/* Summary */}
      {transcript.summary && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Summary</h3>
          <p className="text-zinc-200">{transcript.summary}</p>
        </div>
      )}

      {/* Metrics */}
      {metrics && Object.keys(metrics).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.talk_ratio !== null && (
            <MetricCard 
              label="Talk Ratio" 
              value={`${Math.round(metrics.talk_ratio * 100)}%`}
              subtext="Your speaking time"
            />
          )}
          {metrics.strongMoments?.length > 0 && (
            <MetricCard 
              label="Strong Moments" 
              value={metrics.strongMoments.length}
              subtext="Things done well"
            />
          )}
          {metrics.improvementAreas?.length > 0 && (
            <MetricCard 
              label="Improvement Areas" 
              value={metrics.improvementAreas.length}
              subtext="Areas to work on"
            />
          )}
          {metrics.questionsAsked?.length > 0 && (
            <MetricCard 
              label="Questions Asked" 
              value={metrics.questionsAsked.length}
              subtext="Discovery questions"
            />
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-800">
        <div className="flex gap-1">
          <TabButton 
            active={activeTab === 'segments'} 
            onClick={() => setActiveTab('segments')}
          >
            Segments ({segments.length})
          </TabButton>
          <TabButton 
            active={activeTab === 'raw'} 
            onClick={() => setActiveTab('raw')}
          >
            Raw Transcript
          </TabButton>
          {metrics?.strongMoments?.length > 0 && (
            <TabButton 
              active={activeTab === 'coaching'} 
              onClick={() => setActiveTab('coaching')}
            >
              Self-Coaching
            </TabButton>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'segments' && (
            <SegmentsList segments={segments} />
          )}
          {activeTab === 'raw' && (
            <RawTranscript content={transcript.raw_content} />
          )}
          {activeTab === 'coaching' && metrics && (
            <CoachingView metrics={metrics} />
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, subtext }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
      <div className="text-2xl font-semibold text-white mb-1">{value}</div>
      <div className="text-sm font-medium text-zinc-400">{label}</div>
      <div className="text-xs text-zinc-600">{subtext}</div>
    </div>
  );
}

function TabButton({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
        ${active
          ? 'border-prism-blue text-white'
          : 'border-transparent text-zinc-500 hover:text-zinc-300'}
      `}
    >
      {children}
    </button>
  );
}

function SegmentsList({ segments }) {
  if (segments.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        No segments yet. Click "Reprocess" to analyze this transcript.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {segments.map(segment => (
        <div 
          key={segment.id}
          className={`
            border rounded-lg p-4
            knowledge-${segment.knowledge_type || 'unknown'}
          `}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {segment.speaker && (
                <span className="text-xs font-medium opacity-70 mb-1 block">
                  {segment.speaker}
                  {segment.start_time && ` • ${segment.start_time}`}
                </span>
              )}
              <p className="text-sm leading-relaxed">{segment.content}</p>
              {segment.summary && (
                <p className="text-xs opacity-70 mt-2 italic">{segment.summary}</p>
              )}
            </div>
            <span className="text-xs px-2 py-1 bg-black/20 rounded whitespace-nowrap">
              {KNOWLEDGE_TYPE_LABELS[segment.knowledge_type] || 'Unknown'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RawTranscript({ content }) {
  return (
    <pre className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 
                    text-sm text-zinc-300 whitespace-pre-wrap font-mono
                    max-h-[600px] overflow-auto">
      {content}
    </pre>
  );
}

function CoachingView({ metrics }) {
  return (
    <div className="space-y-6">
      {metrics.strongMoments?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-prism-blue mb-3">✓ Strong Moments</h3>
          <ul className="space-y-2">
            {metrics.strongMoments.map((item, i) => (
              <li key={i} className="text-sm text-zinc-300 bg-prism-blue/10 border border-prism-blue/20 rounded-lg p-3">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {metrics.improvementAreas?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-amber-400 mb-3">⚡ Areas to Improve</h3>
          <ul className="space-y-2">
            {metrics.improvementAreas.map((item, i) => (
              <li key={i} className="text-sm text-zinc-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {metrics.questionsAsked?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-blue-400 mb-3">? Questions You Asked</h3>
          <ul className="space-y-2">
            {metrics.questionsAsked.map((item, i) => (
              <li key={i} className="text-sm text-zinc-300 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                "{item}"
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default TranscriptDetail;
