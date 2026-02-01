import React, { useState, useEffect } from 'react';
import {
  Lightbulb, Target, TrendingUp, Sparkles, RefreshCw,
  ThumbsUp, ThumbsDown, X, ChevronRight, Zap,
  Users, DollarSign, Building2, Clock, AlertCircle
} from 'lucide-react';
import ConfidenceBadge from '../shared/ConfidenceBadge';

const INSIGHT_ICONS = {
  icp: Target,
  pattern: TrendingUp,
  coaching: Sparkles,
  signal: Zap,
  recommendation: Lightbulb
};

const INSIGHT_COLORS = {
  icp: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  pattern: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  coaching: 'bg-prism-blue/10 text-prism-blue border-prism-blue/30',
  signal: 'bg-prism-lavender/10 text-prism-lavender border-prism-lavender/30',
  recommendation: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
};

export default function InsightsDashboard() {
  const [insights, setInsights] = useState([]);
  const [icp, setIcp] = useState(null);
  const [patterns, setPatterns] = useState([]);
  const [coaching, setCoaching] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [learningStatus, setLearningStatus] = useState(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchInsights(),
        fetchICP(),
        fetchPatterns(),
        fetchCoaching(),
        fetchLearningStatus()
      ]);
    } catch (err) {
      console.error('Failed to fetch insights data:', err);
    }
    setLoading(false);
  };

  const fetchInsights = async () => {
    try {
      const res = await fetch('/api/insights?active=true');
      const data = await res.json();
      setInsights(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch insights:', err);
    }
  };

  const fetchICP = async () => {
    try {
      const res = await fetch('/api/insights/icp');
      const data = await res.json();
      if (data && Object.keys(data).length > 0) {
        setIcp(data);
      }
    } catch (err) {
      console.error('Failed to fetch ICP:', err);
    }
  };

  const fetchPatterns = async () => {
    try {
      const res = await fetch('/api/insights/patterns');
      const data = await res.json();
      setPatterns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch patterns:', err);
    }
  };

  const fetchCoaching = async () => {
    try {
      const res = await fetch('/api/insights/coaching');
      setCoaching(await res.json());
    } catch (err) {
      console.error('Failed to fetch coaching:', err);
    }
  };

  const fetchLearningStatus = async () => {
    try {
      const res = await fetch('/api/learning/status');
      setLearningStatus(await res.json());
    } catch (err) {
      console.error('Failed to fetch learning status:', err);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      await fetch('/api/learning/analyze', { method: 'POST' });
      await fetchAllData();
    } catch (err) {
      console.error('Failed to run analysis:', err);
    }
    setAnalyzing(false);
  };

  const submitFeedback = async (insightId, isHelpful) => {
    try {
      await fetch(`/api/insights/${insightId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: isHelpful ? 'helpful' : 'not_helpful' })
      });
      await fetchInsights();
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Loading insights...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Insights</h1>
          <p className="text-zinc-400 text-sm mt-1">
            AI-powered analysis of your sales patterns
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="flex items-center gap-2 px-4 py-2 bg-prism-500 hover:bg-prism-blue text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>

      {/* Learning Status */}
      {learningStatus && (
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-prism-500/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-prism-blue" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Learning Engine</div>
                <div className="text-xs text-zinc-400">
                  Last analysis: {learningStatus.lastRun ? new Date(learningStatus.lastRun).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-zinc-400">
                <span className="text-white font-medium">{learningStatus.dealsWithOutcome || 0}</span> deals tracked
              </div>
              <div className="text-zinc-400">
                <span className="text-white font-medium">{learningStatus.transcriptsProcessed || 0}</span> transcripts analyzed
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ICP Card */}
      {icp && (
        <ICPCard icp={icp} />
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Insights */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">Active Insights</h2>
            <span className="text-xs text-zinc-500">{insights.length} insights</span>
          </div>

          {insights.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No insights yet. Run analysis to discover patterns.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {insights.slice(0, 5).map(insight => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onFeedback={submitFeedback}
                />
              ))}
            </div>
          )}
        </div>

        {/* Patterns */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">Detected Patterns</h2>
          </div>

          {patterns.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No patterns detected yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {patterns.map((pattern, idx) => (
                <PatternCard key={idx} pattern={pattern} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Coaching Recommendations */}
      {coaching && coaching.recommendations && coaching.recommendations.length > 0 && (
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-prism-blue/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-prism-blue" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Coaching Recommendations</h2>
              <p className="text-xs text-zinc-400">Based on your recent calls</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coaching.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border ${
                  rec.priority === 'high' ? 'bg-red-500/5 border-red-500/20' :
                  rec.priority === 'medium' ? 'bg-amber-500/5 border-amber-500/20' :
                  'bg-zinc-700/30 border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    rec.priority === 'high' ? 'bg-red-500/10 text-red-400' :
                    rec.priority === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-zinc-700 text-zinc-400'
                  }`}>
                    {rec.priority}
                  </span>
                </div>
                <p className="text-sm text-zinc-300">{rec.recommendation}</p>
                {rec.trend && (
                  <p className="text-xs text-zinc-500 mt-2">{rec.trend}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ICPCard({ icp }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/20 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Target className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Ideal Customer Profile</h2>
            <p className="text-sm text-zinc-400">
              Based on {icp.sampleSize || 0} closed deals
            </p>
          </div>
        </div>
        {icp.confidence && <ConfidenceBadge confidence={icp.confidence} />}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {icp.industries && icp.industries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
              <Building2 className="w-3 h-3" />
              Top Industries
            </div>
            <div className="space-y-1">
              {icp.industries.slice(0, 3).map((ind, i) => (
                <div key={i} className="text-sm text-zinc-300">{ind.name || ind}</div>
              ))}
            </div>
          </div>
        )}

        {icp.companySizes && icp.companySizes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
              <Users className="w-3 h-3" />
              Company Size
            </div>
            <div className="space-y-1">
              {icp.companySizes.slice(0, 3).map((size, i) => (
                <div key={i} className="text-sm text-zinc-300">{size.range || size}</div>
              ))}
            </div>
          </div>
        )}

        {icp.dealSizes && (
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
              <DollarSign className="w-3 h-3" />
              Deal Size
            </div>
            <div className="text-sm text-zinc-300">
              Avg: ${(icp.dealSizes.avg || 0).toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500">
              Range: ${(icp.dealSizes.min || 0).toLocaleString()} - ${(icp.dealSizes.max || 0).toLocaleString()}
            </div>
          </div>
        )}

        {icp.salesCycles && (
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
              <Clock className="w-3 h-3" />
              Sales Cycle
            </div>
            <div className="text-sm text-zinc-300">
              Avg: {icp.salesCycles.avg || 0} days
            </div>
            <div className="text-xs text-zinc-500">
              Range: {icp.salesCycles.min || 0} - {icp.salesCycles.max || 0} days
            </div>
          </div>
        )}
      </div>

      {expanded && icp.winningBehaviors && icp.winningBehaviors.length > 0 && (
        <div className="mt-4 pt-4 border-t border-purple-500/20">
          <h3 className="text-sm font-medium text-white mb-3">Winning Behaviors</h3>
          <div className="space-y-2">
            {icp.winningBehaviors.map((behavior, i) => (
              <div key={i} className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-prism-blue flex-shrink-0 mt-0.5" />
                <span className="text-sm text-zinc-300">{behavior}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {icp.winningBehaviors && icp.winningBehaviors.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
        >
          {expanded ? 'Show less' : 'Show winning behaviors'}
          <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      )}
    </div>
  );
}

function InsightCard({ insight, onFeedback }) {
  const Icon = INSIGHT_ICONS[insight.type] || Lightbulb;
  const colorClass = INSIGHT_COLORS[insight.type] || INSIGHT_COLORS.recommendation;

  return (
    <div className="bg-zinc-700/30 rounded-lg p-3 border border-zinc-700/50">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-zinc-400 uppercase">{insight.type}</span>
            {insight.confidence && (
              <ConfidenceBadge confidence={insight.confidence} size="sm" />
            )}
          </div>

          <p className="text-sm text-zinc-200">{insight.content}</p>

          {insight.context && (
            <p className="text-xs text-zinc-500 mt-1">{insight.context}</p>
          )}

          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => onFeedback(insight.id, true)}
              className="p-1 text-zinc-500 hover:text-prism-blue transition-colors"
              title="Helpful"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => onFeedback(insight.id, false)}
              className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
              title="Not helpful"
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
            {insight.feedback_count > 0 && (
              <span className="text-xs text-zinc-500">
                {insight.feedback_count} votes
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PatternCard({ pattern }) {
  return (
    <div className="bg-zinc-700/30 rounded-lg p-3 border border-zinc-700/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white">{pattern.pattern || pattern.name}</span>
        {pattern.impact && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            pattern.impact === 'positive' ? 'bg-prism-blue/10 text-prism-blue' :
            pattern.impact === 'negative' ? 'bg-red-500/10 text-red-400' :
            'bg-zinc-700 text-zinc-400'
          }`}>
            {pattern.impact}
          </span>
        )}
      </div>

      {pattern.description && (
        <p className="text-sm text-zinc-400">{pattern.description}</p>
      )}

      {pattern.occurrence && (
        <div className="text-xs text-zinc-500 mt-2">
          Observed in {pattern.occurrence}% of {pattern.context || 'deals'}
        </div>
      )}

      {pattern.correlation && (
        <div className="text-xs text-zinc-500 mt-1">
          Correlation with {pattern.correlationTarget}: {Math.round(pattern.correlation * 100)}%
        </div>
      )}
    </div>
  );
}
