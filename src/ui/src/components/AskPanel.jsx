import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, User, Loader2, Sparkles, Mic, Plus,
  FileText, Target, Users, Lightbulb, AlertCircle, History,
  ThumbsUp, ThumbsDown, ExternalLink, ChevronRight, X, RefreshCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GlassCard from './shared/GlassCard';

// Prism Logo Mark SVG component
const PrismLogo = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 280 199" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse opacity="0.85" cx="140" cy="139" rx="140" ry="60" fill="url(#paint0_linear_ask)"/>
    <ellipse opacity="0.85" cx="139.5" cy="100.5" rx="137.5" ry="57.5" fill="url(#paint1_linear_ask)"/>
    <ellipse opacity="0.85" cx="140" cy="60" rx="140" ry="60" fill="url(#paint2_linear_ask)"/>
    <defs>
      <linearGradient id="paint0_linear_ask" x1="0" y1="139" x2="280" y2="139" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4AA8D8"/>
        <stop offset="1" stopColor="#C888B0"/>
      </linearGradient>
      <linearGradient id="paint1_linear_ask" x1="2" y1="100" x2="277" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6078C8"/>
        <stop offset="1" stopColor="#9878C0"/>
      </linearGradient>
      <linearGradient id="paint2_linear_ask" x1="0" y1="59.52" x2="280" y2="59.52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7B8EC8"/>
        <stop offset="1" stopColor="#9890C8"/>
      </linearGradient>
    </defs>
  </svg>
);

// Compact suggestion chips for the home screen
const SUGGESTION_CHIPS = [
  { icon: Target, text: "Deal strategy", fullQuery: "What's the status of my active deals?" },
  { icon: Users, text: "Key contacts", fullQuery: "Who are my key contacts at each account?" },
  { icon: Lightbulb, text: "Call patterns", fullQuery: "What patterns do you see in my calls?" },
];

export default function AskPanel({ onOpenCapture, onNavigate, onSelectItem }) {
  const [query, setQuery] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState(null); // { question, content, sources, intent, ... }
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef(null);
  const answerRef = useRef(null);
  const abortRef = useRef(null);

  // Load query history
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/ask/history?limit=10');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  // Auto-scroll as tokens stream in
  useEffect(() => {
    if (isStreaming && answerRef.current) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight;
    }
  }, [currentAnswer?.content, isStreaming]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q || isStreaming) return;

    setQuery('');
    setError(null);
    setCurrentAnswer({ question: q, content: '', sources: [], intent: null, followUpQuestions: [], visualizations: [], responseTimeMs: null, id: null });
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/ask/stream?q=${encodeURIComponent(q)}`, {
        signal: controller.signal
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to get response');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;

            try {
              const event = JSON.parse(payload);

              if (event.type === 'meta') {
                setCurrentAnswer(prev => ({
                  ...prev,
                  sources: event.sources || [],
                  intent: event.intent,
                  followUpQuestions: event.followUpQuestions || [],
                  visualizations: event.visualizations || []
                }));
              } else if (event.type === 'token') {
                setCurrentAnswer(prev => ({
                  ...prev,
                  content: prev.content + event.token
                }));
              } else if (event.type === 'done') {
                setCurrentAnswer(prev => ({
                  ...prev,
                  id: event.id,
                  responseTimeMs: event.responseTimeMs
                }));
              } else if (event.type === 'error') {
                throw new Error(event.error);
              }
            } catch (parseErr) {
              if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr;
            }
          }
        }
      }

      loadHistory();
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Stream error:', err);
      setError(err.message);
      // Fallback to non-streaming endpoint
      try {
        const fallbackRes = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q })
        });
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          setCurrentAnswer({
            question: q,
            content: data.answer,
            sources: data.sources || [],
            intent: data.intent,
            followUpQuestions: data.followUpQuestions || [],
            visualizations: data.visualizations || [],
            responseTimeMs: data.responseTimeMs,
            id: data.id
          });
          setError(null);
          loadHistory();
        }
      } catch (fallbackErr) {
        setError(fallbackErr.message);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleChipClick = (fullQuery) => {
    setQuery(fullQuery);
    inputRef.current?.focus();
  };

  const handleFollowUpClick = (question) => {
    setQuery(question);
    setTimeout(() => handleSubmit(), 50);
  };

  const handleHistoryClick = (item) => {
    setQuery(item.query);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  const handleFeedback = async (messageId, feedback) => {
    if (!messageId) return;
    try {
      await fetch(`/api/ask/${messageId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback })
      });
      setCurrentAnswer(prev => prev ? { ...prev, feedback } : prev);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  const handleNewQuestion = () => {
    setCurrentAnswer(null);
    setError(null);
    inputRef.current?.focus();
  };

  const handleSourceClick = async (source) => {
    if (!onNavigate || !onSelectItem) return;
    try {
      if (source.type === 'deal' && source.id) {
        const res = await fetch(`/api/deals/${source.id}`);
        if (res.ok) {
          const deal = await res.json();
          onNavigate('deals');
          onSelectItem(deal);
        }
      } else if (source.type === 'person' && source.id) {
        const res = await fetch(`/api/people/${source.id}`);
        if (res.ok) {
          const person = await res.json();
          onNavigate('people');
          onSelectItem(person);
        }
      } else if (source.type === 'transcript' && source.id) {
        // Transcript source — id is the transcript ID directly
        const res = await fetch(`/api/transcripts/${source.id}`);
        if (res.ok) {
          const transcript = await res.json();
          onNavigate('transcripts');
          onSelectItem(transcript);
        }
      } else if (source.type === 'segment' && source.id) {
        // Segment source — look up the segment to get its parent transcript_id
        const segRes = await fetch(`/api/segments/${source.id}`);
        if (segRes.ok) {
          const segment = await segRes.json();
          if (segment.transcript_id) {
            const txRes = await fetch(`/api/transcripts/${segment.transcript_id}`);
            if (txRes.ok) {
              const transcript = await txRes.json();
              onNavigate('transcripts');
              onSelectItem(transcript);
            }
          }
        }
      }
    } catch (err) {
      console.error('Source navigation error:', err);
    }
  };

  const showEmptyState = !currentAnswer && !isStreaming;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Ask Prism</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Ask questions about your deals, contacts, and sales insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentAnswer && !isStreaming && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleNewQuestion}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-prism-blue bg-prism-blue/10 hover:bg-prism-blue/20 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New question
            </motion.button>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-xl transition-colors ${
              showHistory ? 'bg-prism-blue/10 text-prism-blue' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
            title="Query history"
          >
            <History className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Answer / Empty state area */}
        <div ref={answerRef} className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {showEmptyState ? (
              /* ---- EMPTY STATE ---- */
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center h-full text-center"
              >
                {/* Hero icon with glow */}
                <div className="relative mb-6">
                  <motion.div
                    animate={{ opacity: [0.4, 0.75, 0.4], scale: [1, 1.15, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -inset-10 blur-2xl pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at center, rgba(74, 168, 216, 0.35) 0%, rgba(96, 120, 200, 0.25) 35%, rgba(152, 120, 192, 0.15) 60%, transparent 85%)' }}
                  />
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <PrismLogo className="w-14 h-10" />
                  </div>
                </div>
                <h2 className="text-lg font-medium text-white mb-2">
                  Ask anything about your sales world
                </h2>
                <p className="text-sm text-zinc-400 max-w-md mb-6">
                  Deals, contacts, coaching insights, competitive intel, and more.
                </p>
              </motion.div>
            ) : (
              /* ---- ANSWER VIEW ---- */
              <motion.div
                key="answer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4 pb-4"
              >
                {/* User's question */}
                <div className="flex gap-3 justify-end">
                  <div className="max-w-[80%]">
                    <div className="rounded-xl p-4 bg-prism-500/10 border border-prism-500/20">
                      <p className="text-sm leading-relaxed text-prism-100">{currentAnswer?.question}</p>
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-zinc-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-zinc-400" />
                  </div>
                </div>

                {/* AI response */}
                <div className="flex gap-3 justify-start">
                  <div className="w-9 h-9 rounded-xl bg-prism-blue/10 glow-prism flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-prism-blue" />
                  </div>
                  <div className="max-w-[80%] flex-1">
                    {/* Response content with markdown */}
                    <div className="rounded-xl p-4 glass-card-static">
                      {currentAnswer?.content ? (
                        <div className="prose prose-invert prose-sm max-w-none
                          prose-headings:text-zinc-100 prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
                          prose-p:text-zinc-200 prose-p:leading-relaxed prose-p:my-1.5
                          prose-strong:text-zinc-100
                          prose-ul:my-2 prose-li:text-zinc-200 prose-li:my-0.5
                          prose-code:text-prism-blue prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                          prose-a:text-prism-blue prose-a:no-underline hover:prose-a:underline
                        ">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {currentAnswer.content}
                          </ReactMarkdown>
                          {isStreaming && <span className="typing-cursor" />}
                        </div>
                      ) : isStreaming ? (
                        <div className="flex items-center gap-3 py-2">
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.2 }} className="w-2 h-2 rounded-full bg-prism-blue" />
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.2, delay: 0.15 }} className="w-2 h-2 rounded-full bg-prism-blue" />
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.2, delay: 0.3 }} className="w-2 h-2 rounded-full bg-prism-blue" />
                          <span className="text-sm text-zinc-400 ml-1">Thinking...</span>
                        </div>
                      ) : null}

                      {/* Intent badge + response time */}
                      {currentAnswer?.intent && !isStreaming && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 uppercase tracking-wide">
                            {currentAnswer.intent.replace('_', ' ')}
                          </span>
                          {currentAnswer.responseTimeMs && (
                            <span className="text-[10px] text-zinc-600 ml-2">
                              {currentAnswer.responseTimeMs}ms
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Sources — clickable */}
                    {currentAnswer?.sources?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-zinc-500 mb-2">Sources:</p>
                        <div className="flex flex-wrap gap-2">
                          {currentAnswer.sources.map((source, idx) => (
                            <SourceBadge key={idx} source={source} onClick={() => handleSourceClick(source)} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* MEDDPICC mini visualization */}
                    {currentAnswer?.visualizations?.some(v => v.type === 'meddpicc_scorecard') && (
                      <div className="mt-4">
                        <MeddpiccMini visualization={currentAnswer.visualizations.find(v => v.type === 'meddpicc_scorecard')} />
                      </div>
                    )}

                    {/* Follow-up questions */}
                    {currentAnswer?.followUpQuestions?.length > 0 && !isStreaming && (
                      <div className="mt-4">
                        <p className="text-xs text-zinc-500 mb-2">Follow-up questions:</p>
                        <div className="flex flex-wrap gap-2">
                          {currentAnswer.followUpQuestions.map((q, idx) => (
                            <motion.button
                              key={idx}
                              onClick={() => handleFollowUpClick(q)}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="px-3 py-1.5 rounded-lg bg-prism-blue/10 text-prism-blue text-xs hover:bg-prism-blue/20 transition-colors"
                            >
                              {q}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Feedback buttons */}
                    {!isStreaming && currentAnswer?.id && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => handleFeedback(currentAnswer.id, 'helpful')}
                          className={`p-1.5 rounded-lg transition-colors ${
                            currentAnswer.feedback === 'helpful' ? 'bg-prism-blue/20 text-prism-blue' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                          }`}
                          title="Helpful"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleFeedback(currentAnswer.id, 'not_helpful')}
                          className={`p-1.5 rounded-lg transition-colors ${
                            currentAnswer.feedback === 'not_helpful' ? 'bg-red-500/20 text-red-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                          }`}
                          title="Not helpful"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* History sidebar */}
        <AnimatePresence>
          {showHistory && history.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 280 }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              className="overflow-hidden"
            >
              <GlassCard variant="static" padding="p-4" className="h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-white">Recent Queries</h3>
                  <button onClick={() => setShowHistory(false)} className="p-1 text-zinc-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2 overflow-y-auto max-h-[calc(100%-3rem)]">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleHistoryClick(item)}
                      className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <p className="text-sm text-zinc-300 line-clamp-2">{item.query}</p>
                      <p className="text-xs text-zinc-500 mt-1">{new Date(item.created_at).toLocaleDateString()}</p>
                    </button>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="my-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-400 flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="mt-3">
        <div
          className="flex items-center gap-2 p-2 rounded-xl transition-colors"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}
        >
          {onOpenCapture && (
            <motion.button
              type="button"
              onClick={onOpenCapture}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2.5 rounded-xl text-zinc-400 hover:text-prism-blue hover:bg-prism-blue/10 transition-colors"
              title="Add transcript, note, or voice memo"
            >
              <Plus className="w-5 h-5" />
            </motion.button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about your sales data..."
            className="flex-1 bg-transparent px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none"
            disabled={isStreaming}
          />
          {/* Mic button — disabled until Whisper integration in Phase 5 */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2.5 rounded-xl text-zinc-500 cursor-not-allowed opacity-50"
            disabled={true}
            title="Voice input coming soon"
          >
            <Mic className="w-5 h-5" />
          </motion.button>
          <motion.button
            type="submit"
            disabled={!query.trim() || isStreaming}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2.5 bg-prism-500 hover:bg-prism-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl transition-colors"
          >
            {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </motion.button>
        </div>
        {/* Suggestion chips — only show on empty state */}
        {showEmptyState && (
          <div className="flex items-center justify-center gap-2 mt-3">
            {SUGGESTION_CHIPS.map((chip, idx) => {
              const Icon = chip.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleChipClick(chip.fullQuery)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-colors"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {chip.text}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-xs text-zinc-600 mt-2 text-center">
          Powered by AI · Responses are based on your sales data
        </p>
      </form>
    </div>
  );
}

// ---- Source citation badge (CLICKABLE) ----
function SourceBadge({ source, onClick }) {
  const typeColors = {
    segment: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    deal: 'bg-prism-500/10 text-prism-400 border-prism-500/20',
    person: 'bg-prism-lavender/10 text-prism-lavender border-prism-lavender/20',
    transcript: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    stats: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
  };
  const colors = typeColors[source.type] || typeColors.stats;
  const isNavigable = (source.type === 'deal' || source.type === 'person' || source.type === 'transcript' || source.type === 'segment') && source.id;

  return (
    <button
      onClick={isNavigable ? onClick : undefined}
      className={`text-xs px-2 py-1 rounded-lg border ${colors} transition-opacity flex items-center gap-1 ${
        isNavigable ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
      }`}
    >
      <span className="capitalize">{source.type}</span>
      {(source.name || source.transcriptFilename) && (
        <span className="text-zinc-500">: {source.name || source.transcriptFilename}</span>
      )}
      {isNavigable && <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />}
    </button>
  );
}

// ---- Mini MEDDPICC scorecard ----
function MeddpiccMini({ visualization }) {
  const [scorecard, setScorecard] = useState(null);

  useEffect(() => {
    if (visualization.dealId) {
      fetch(`/api/deals/${visualization.dealId}/meddpicc`)
        .then(res => res.json())
        .then(data => setScorecard(data))
        .catch(err => console.error('Failed to load MEDDPICC:', err));
    }
  }, [visualization.dealId]);

  if (!scorecard) return null;

  const letters = ['M', 'E', 'D1', 'D2', 'P', 'I', 'C1', 'C2'];

  return (
    <div className="glass-card-static p-3 rounded-xl">
      <p className="text-xs text-zinc-500 mb-2">{visualization.dealName} — MEDDPICC</p>
      <div className="flex gap-1">
        {letters.map(letter => {
          const item = scorecard.find(s => s.letter === letter);
          const status = item?.status || 'unknown';
          const statusColors = {
            identified: 'bg-prism-blue/20 text-prism-blue glow-prism',
            partial: 'bg-amber-500/20 text-amber-400 glow-amber',
            unknown: 'bg-zinc-700/50 text-zinc-500'
          };
          return (
            <div key={letter} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${statusColors[status]}`} title={`${letter}: ${status}`}>
              {letter}
            </div>
          );
        })}
      </div>
    </div>
  );
}
