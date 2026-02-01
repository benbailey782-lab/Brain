import React, { useState, useEffect } from 'react';
import { 
  Package, Settings, Users, Target, Lightbulb, 
  HelpCircle, Coffee, MessageSquare, Filter, Search,
  ChevronDown, ChevronRight, ExternalLink
} from 'lucide-react';

const KNOWLEDGE_TYPES = [
  { id: 'all', label: 'All Knowledge', icon: MessageSquare, color: 'zinc' },
  { id: 'product_knowledge', label: 'Product', icon: Package, color: 'blue' },
  { id: 'process_knowledge', label: 'Process', icon: Settings, color: 'purple' },
  { id: 'people_context', label: 'People', icon: Users, color: 'green' },
  { id: 'sales_insight', label: 'Sales Insight', icon: Target, color: 'prism' },
  { id: 'advice_received', label: 'Advice', icon: Lightbulb, color: 'lavender' },
  { id: 'decision_rationale', label: 'Decisions', icon: HelpCircle, color: 'indigo' },
  { id: 'competitive_intel', label: 'Competitive', icon: Target, color: 'red' },
  { id: 'small_talk', label: 'Small Talk', icon: Coffee, color: 'zinc' },
  { id: 'unknown', label: 'Uncategorized', icon: HelpCircle, color: 'zinc' },
];

const colorClasses = {
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  green: 'bg-prism-blue/20 text-prism-blue border-prism-blue/30',
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  zinc: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  prism: 'bg-prism-500/20 text-prism-blue border-prism-500/30',
  lavender: 'bg-prism-lavender/20 text-prism-lavender border-prism-lavender/30',
};

function SegmentCard({ segment }) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = KNOWLEDGE_TYPES.find(t => t.id === segment.knowledge_type) || KNOWLEDGE_TYPES[0];
  const Icon = typeInfo.icon;
  
  return (
    <div className="bg-zinc-800/50 rounded-lg border border-zinc-700/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-zinc-700/30 transition-colors"
      >
        <div className={`p-1.5 rounded ${colorClasses[typeInfo.color]} mt-0.5`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        
        <div className="flex-1 min-w-0">
          {segment.summary ? (
            <p className="text-sm text-zinc-200">{segment.summary}</p>
          ) : (
            <p className="text-sm text-zinc-400 italic">
              {segment.content?.substring(0, 100)}...
            </p>
          )}
          
          <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
            {segment.speaker && (
              <span className="bg-zinc-700/50 px-2 py-0.5 rounded">
                {segment.speaker}
              </span>
            )}
            {segment.start_time && (
              <span>{segment.start_time}</span>
            )}
            <span className="text-zinc-600">•</span>
            <span>{typeInfo.label}</span>
          </div>
        </div>
        
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-zinc-500 mt-1" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-500 mt-1" />
        )}
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-700/50">
          <div className="mt-3 p-3 bg-zinc-900/50 rounded text-sm text-zinc-300 whitespace-pre-wrap">
            {segment.content}
          </div>
          
          {segment.tags && segment.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {segment.tags.map((tag, i) => (
                <span 
                  key={i}
                  className="px-2 py-0.5 bg-zinc-700/50 text-zinc-400 text-xs rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          <div className="mt-3 text-xs text-zinc-500">
            From: {segment.transcript_filename || `Transcript #${segment.transcript_id}`}
          </div>
        </div>
      )}
    </div>
  );
}

function SegmentBrowser() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({});

  useEffect(() => {
    loadSegments();
    loadStats();
  }, [selectedType]);

  const loadSegments = async () => {
    setLoading(true);
    try {
      const url = selectedType === 'all' 
        ? '/api/segments'
        : `/api/segments?knowledgeType=${selectedType}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load segments');
      const data = await res.json();
      setSegments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const filteredSegments = segments.filter(segment => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      segment.content?.toLowerCase().includes(query) ||
      segment.summary?.toLowerCase().includes(query) ||
      segment.speaker?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">Knowledge Browser</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Browse and search through all extracted knowledge segments
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Knowledge Type Filter */}
        <div className="flex flex-wrap gap-2">
          {KNOWLEDGE_TYPES.map(type => {
            const Icon = type.icon;
            const isActive = selectedType === type.id;
            const count = type.id === 'all' 
              ? stats.totalSegments 
              : stats.segmentsByType?.[type.id] || 0;
            
            return (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                  transition-colors border
                  ${isActive 
                    ? colorClasses[type.color]
                    : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:bg-zinc-700/50'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {type.label}
                {count > 0 && (
                  <span className="text-xs opacity-60">({count})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search segments..."
          className="w-full pl-10 pr-4 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg
                     text-sm text-zinc-200 placeholder-zinc-500
                     focus:outline-none focus:border-prism-blue/50"
        />
      </div>

      {/* Segments List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-prism-blue border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-400">
          {error}
        </div>
      ) : filteredSegments.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">
            {searchQuery 
              ? 'No segments match your search'
              : 'No segments yet. Drop some transcripts in the watch folder!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-zinc-500">
            {filteredSegments.length} segment{filteredSegments.length !== 1 ? 's' : ''}
            {searchQuery && ' matching your search'}
          </div>
          
          {filteredSegments.map(segment => (
            <SegmentCard key={segment.id} segment={segment} />
          ))}
        </div>
      )}
    </div>
  );
}

export default SegmentBrowser;
