import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, User, Loader2, Sparkles, MessageSquare, Mic, Plus,
  FileText, Target, Users, Lightbulb, AlertCircle, History,
  ThumbsUp, ThumbsDown, ExternalLink, ChevronRight, X, RefreshCw
} from 'lucide-react';
import GlassCard from './shared/GlassCard';
import { StaggerContainer, StaggerItem } from './shared/PageTransition';

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

// Suggested questions - will be enhanced with contextual suggestions
const DEFAULT_SUGGESTIONS = [
  { icon: Target, text: "What's the status of my active deals?", category: 'deals' },
  { icon: Users, text: "Who are my key contacts at each account?", category: 'people' },
  { icon: Lightbulb, text: "What patterns do you see in my calls?", category: 'coaching' },
  { icon: FileText, text: "What objections am I hearing most?", category: 'objection' },
  { icon: MessageSquare, text: "How's my talk ratio trending?", category: 'coaching' },
  { icon: Target, text: "What are my biggest MEDDPICC gaps?", category: 'deals' },
];

export default function AskPanel({ onOpenCapture }) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const askRecognitionRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  // Load contextual suggestions based on available data
  useEffect(() => {
    loadContextualSuggestions();
  }, []);

  const loadContextualSuggestions = async () => {
    try {
      // Get stats to determine what data exists
      const res = await fetch('/api/stats');
      if (res.ok) {
        const stats = await res.json();
        const contextual = [...DEFAULT_SUGGESTIONS];

        // Add deal-specific suggestion if deals exist
        if (stats.totalDeals > 0) {
          const dealsRes = await fetch('/api/deals');
          if (dealsRes.ok) {
            const deals = await dealsRes.json();
            if (deals.length > 0) {
              contextual.unshift({
                icon: Target,
                text: `Build me a strategy for the ${deals[0].company_name} deal`,
                category: 'deals'
              });
            }
          }
        }

        // Add people-specific suggestion if contacts exist
        if (stats.totalPeople > 0) {
          const peopleRes = await fetch('/api/people');
          if (peopleRes.ok) {
            const people = await peopleRes.json();
            if (people.length > 0) {
              contextual.unshift({
                icon: Users,
                text: `What do I know about ${people[0].name}?`,
                category: 'people'
              });
            }
          }
        }

        setSuggestions(contextual.slice(0, 6));
      }
    } catch (err) {
      console.error('Failed to load contextual suggestions:', err);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!query.trim() || loading) return;

    const userMessage = query.trim();
    setQuery('');
    setError(null);
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to get response');
      }

      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        id: data.id,
        content: data.answer,
        sources: data.sources,
        followUpQuestions: data.followUpQuestions,
        visualizations: data.visualizations,
        intent: data.intent,
        responseTimeMs: data.responseTimeMs
      }]);

      // Refresh history
      loadHistory();
    } catch (err) {
      setError(err.message);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
        error: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    inputRef.current?.focus();
  };

  const handleFollowUpClick = (question) => {
    setQuery(question);
    setTimeout(() => {
      handleSubmit();
    }, 100);
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

      // Update local state to show feedback was received
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, feedback } : msg
      ));
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setError(null);
  };

  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      if (askRecognitionRef.current) {
        askRecognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Single utterance — this is a query, not a memo
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuery(prev => prev ? prev + ' ' + transcript : transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Voice input error:', event.error);
      setIsListening(false);
    };

    askRecognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Ask Prism</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Ask questions about your deals, contacts, and sales insights
          </p>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={clearConversation}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Clear conversation"
            >
              <RefreshCw className="w-5 h-5" />
            </motion.button>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-xl transition-colors ${
              showHistory
                ? 'bg-prism-blue/10 text-prism-blue'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
            title="Query history"
          >
            <History className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto space-y-4">
          <AnimatePresence mode="wait">
            {messages.length === 0 ? (
              <EmptyState
                suggestions={suggestions}
                onSuggestionClick={handleSuggestionClick}
              />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {messages.map((msg, idx) => (
                  <MessageBubble
                    key={idx}
                    message={msg}
                    onFollowUpClick={handleFollowUpClick}
                    onFeedback={handleFeedback}
                  />
                ))}
                {loading && <TypingIndicator />}
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
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
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-1 text-zinc-500 hover:text-white"
                  >
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
                      <p className="text-xs text-zinc-500 mt-1">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
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
            className="my-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-400 flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="mt-4">
        <div
          className="flex items-center gap-2 p-2 rounded-xl transition-colors"
          style={{
            background: 'var(--surface-3)',
            border: '1px solid var(--glass-border)'
          }}
        >
          {/* + Capture button */}
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
            placeholder={isListening ? "Listening..." : "Ask a question about your sales data..."}
            className="flex-1 bg-transparent px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none"
            disabled={loading}
          />
          {/* Mic button */}
          <motion.button
            type="button"
            onClick={toggleVoiceInput}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`p-2.5 rounded-xl transition-colors ${
              isListening
                ? 'bg-red-500/20 text-red-400'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
            disabled={loading}
          >
            {isListening ? (
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Mic className="w-5 h-5" />
              </motion.div>
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </motion.button>
          {/* Send button */}
          <motion.button
            type="submit"
            disabled={!query.trim() || loading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2.5 bg-prism-500 hover:bg-prism-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl transition-colors"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </motion.button>
        </div>
        <p className="text-xs text-zinc-600 mt-2 text-center">
          Powered by AI. Responses are based on your sales data.
        </p>
      </form>
    </div>
  );
}

// Empty state with hero and suggestions
function EmptyState({ suggestions, onSuggestionClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center h-full text-center"
    >
      {/* Hero icon with glow */}
      <div className="relative mb-6">
        {/* Glow layer — must extend beyond logo for blur to be visible */}
        <motion.div
          animate={{
            opacity: [0.4, 0.75, 0.4],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -inset-10 blur-2xl pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(74, 168, 216, 0.35) 0%, rgba(96, 120, 200, 0.25) 35%, rgba(152, 120, 192, 0.15) 60%, transparent 85%)'
          }}
        />
        {/* Actual logo — crisp, not blurred */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <PrismLogo className="w-14 h-10" />
        </div>
      </div>

      <h2 className="text-lg font-medium text-white mb-2">
        Ask anything about your sales world
      </h2>
      <p className="text-sm text-zinc-400 max-w-md mb-8">
        I can help with deal strategy, contact intelligence, coaching insights, and more.
      </p>

      {/* Suggested questions grid */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {suggestions.map((q, idx) => {
          const Icon = q.icon;
          return (
            <StaggerItem key={idx}>
              <motion.button
                onClick={() => onSuggestionClick(q.text)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="w-full glass-card flex items-center gap-3 p-4 text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-prism-blue/10 glow-prism flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-prism-blue" />
                </div>
                <span className="text-sm text-zinc-300 group-hover:text-white transition-colors flex-1">
                  {q.text}
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </motion.button>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </motion.div>
  );
}

// Typing indicator
function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3"
    >
      <div className="w-9 h-9 rounded-xl bg-prism-blue/10 glow-prism flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-5 h-5 text-prism-blue" />
      </div>
      <div className="glass-card-static p-4 rounded-xl">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
            className="w-2 h-2 rounded-full bg-prism-blue"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
            className="w-2 h-2 rounded-full bg-prism-blue"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
            className="w-2 h-2 rounded-full bg-prism-blue"
          />
          <span className="text-sm text-zinc-400 ml-2">Thinking...</span>
        </div>
      </div>
    </motion.div>
  );
}

// Message bubble with rich content
function MessageBubble({ message, onFollowUpClick, onFeedback }) {
  const isUser = message.role === 'user';
  const [expandedSource, setExpandedSource] = useState(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* AI Avatar */}
      {!isUser && (
        <div className="w-9 h-9 rounded-xl bg-prism-blue/10 glow-prism flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-prism-blue" />
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        {/* Message content */}
        <div className={`rounded-xl p-4 ${
          isUser
            ? 'bg-prism-500/10 border border-prism-500/20'
            : message.error
              ? 'bg-red-500/10 border border-red-500/30'
              : 'glass-card-static'
        }`}>
          <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'text-prism-100'
              : message.error
                ? 'text-red-300'
                : 'text-zinc-200'
          }`}>
            {message.content}
          </p>

          {/* Intent badge */}
          {message.intent && !isUser && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 uppercase tracking-wide">
                {message.intent.replace('_', ' ')}
              </span>
              {message.responseTimeMs && (
                <span className="text-[10px] text-zinc-600 ml-2">
                  {message.responseTimeMs}ms
                </span>
              )}
            </div>
          )}
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-zinc-500 mb-2">Sources:</p>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((source, idx) => (
                <SourceBadge
                  key={idx}
                  source={source}
                  isExpanded={expandedSource === idx}
                  onToggle={() => setExpandedSource(expandedSource === idx ? null : idx)}
                />
              ))}
            </div>
          </div>
        )}

        {/* MEDDPICC visualization if available */}
        {message.visualizations?.some(v => v.type === 'meddpicc_scorecard') && (
          <div className="mt-4">
            <MeddpiccMini
              visualization={message.visualizations.find(v => v.type === 'meddpicc_scorecard')}
            />
          </div>
        )}

        {/* Follow-up questions */}
        {message.followUpQuestions && message.followUpQuestions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-zinc-500 mb-2">Follow-up questions:</p>
            <div className="flex flex-wrap gap-2">
              {message.followUpQuestions.map((q, idx) => (
                <motion.button
                  key={idx}
                  onClick={() => onFollowUpClick(q)}
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
        {!isUser && !message.error && message.id && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => onFeedback(message.id, 'helpful')}
              className={`p-1.5 rounded-lg transition-colors ${
                message.feedback === 'helpful'
                  ? 'bg-prism-blue/20 text-prism-blue'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
              title="Helpful"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => onFeedback(message.id, 'not_helpful')}
              className={`p-1.5 rounded-lg transition-colors ${
                message.feedback === 'not_helpful'
                  ? 'bg-red-500/20 text-red-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
              title="Not helpful"
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-9 h-9 rounded-xl bg-zinc-700 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-zinc-400" />
        </div>
      )}
    </motion.div>
  );
}

// Source citation badge
function SourceBadge({ source, isExpanded, onToggle }) {
  const typeColors = {
    segment: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    deal: 'bg-prism-500/10 text-prism-400 border-prism-500/20',
    person: 'bg-prism-lavender/10 text-prism-lavender border-prism-lavender/20',
    transcript: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    stats: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
  };

  const colors = typeColors[source.type] || typeColors.stats;

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`text-xs px-2 py-1 rounded-lg border ${colors} hover:opacity-80 transition-opacity flex items-center gap-1`}
      >
        <span className="capitalize">{source.type}</span>
        {source.name && <span className="text-zinc-500">: {source.name}</span>}
      </button>

      <AnimatePresence>
        {isExpanded && source.snippet && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            className="absolute top-full left-0 mt-2 z-10 w-64 p-3 glass-card-elevated text-xs"
          >
            <p className="text-zinc-300 line-clamp-4">{source.snippet}</p>
            {source.transcriptFilename && (
              <p className="text-zinc-500 mt-2 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {source.transcriptFilename}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Mini MEDDPICC scorecard
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
      <p className="text-xs text-zinc-500 mb-2">
        {visualization.dealName} - MEDDPICC
      </p>
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
            <div
              key={letter}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${statusColors[status]}`}
              title={`${letter}: ${status}`}
            >
              {letter}
            </div>
          );
        })}
      </div>
    </div>
  );
}
