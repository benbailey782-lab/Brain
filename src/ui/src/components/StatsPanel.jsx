import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Layers, Users, Target, TrendingUp,
  Clock, Mic, MessageSquare, AlertCircle, CheckCircle,
  Package, Settings, Lightbulb, HelpCircle, Coffee, Sparkles
} from 'lucide-react';
import StatCard from './shared/StatCard';

const KNOWLEDGE_TYPE_CONFIG = {
  product_knowledge: { label: 'Product', icon: Package, color: 'bg-blue-500' },
  process_knowledge: { label: 'Process', icon: Settings, color: 'bg-purple-500' },
  people_context: { label: 'People', icon: Users, color: 'bg-prism-blue' },
  sales_insight: { label: 'Sales', icon: Target, color: 'bg-prism-500' },
  advice_received: { label: 'Advice', icon: Lightbulb, color: 'bg-prism-lavender' },
  decision_rationale: { label: 'Decisions', icon: HelpCircle, color: 'bg-indigo-500' },
  competitive_intel: { label: 'Competitive', icon: Target, color: 'bg-red-500' },
  small_talk: { label: 'Small Talk', icon: Coffee, color: 'bg-zinc-500' },
  unknown: { label: 'Unknown', icon: HelpCircle, color: 'bg-zinc-600' },
};

function KnowledgeDistribution({ data }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        No knowledge segments yet
      </div>
    );
  }

  const total = Object.values(data).reduce((sum, count) => sum + count, 0);
  const sorted = Object.entries(data)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      {sorted.map(([type, count]) => {
        const config = KNOWLEDGE_TYPE_CONFIG[type] || KNOWLEDGE_TYPE_CONFIG.unknown;
        const percentage = total > 0 ? (count / total) * 100 : 0;
        const Icon = config.icon;

        return (
          <div key={type} className="group">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-zinc-400" />
                <span className="text-zinc-300">{config.label}</span>
              </div>
              <span className="text-zinc-500">
                {count} ({percentage.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2 bg-zinc-700/50 rounded-full overflow-hidden">
              <div 
                className={`h-full ${config.color} transition-all duration-500`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecentActivity({ transcripts }) {
  if (!transcripts || transcripts.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transcripts.slice(0, 5).map((transcript, index) => (
        <motion.div
          key={transcript.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-lg hover:bg-white/[0.04] transition-colors"
        >
          <div className={`p-1.5 rounded ${transcript.processed_at ? 'bg-prism-blue/20' : 'bg-amber-500/20'}`}>
            {transcript.processed_at ? (
              <CheckCircle className="w-4 h-4 text-prism-blue" />
            ) : (
              <Clock className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-200 truncate">{transcript.filename}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {transcript.processed_at
                ? `Processed ${new Date(transcript.processed_at).toLocaleDateString()}`
                : 'Pending processing'}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function TalkRatioGauge({ ratio }) {
  if (ratio === null || ratio === undefined) {
    return (
      <div className="text-center py-8 text-zinc-500">
        No talk ratio data yet
      </div>
    );
  }

  const percentage = ratio * 100;
  const isGood = percentage >= 30 && percentage <= 50;
  const isOk = percentage >= 20 && percentage <= 60;

  return (
    <div className="text-center">
      <div className="relative w-32 h-32 mx-auto">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-zinc-700"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeDasharray={`${percentage * 2.51} 251`}
            className={isGood ? 'text-prism-500' : isOk ? 'text-amber-500' : 'text-red-500'}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-semibold text-white">
            {percentage.toFixed(0)}%
          </span>
        </div>
      </div>
      <p className="text-sm text-zinc-400 mt-3">
        {isGood ? 'Great balance!' : isOk ? 'Room to improve' : 'Try talking less'}
      </p>
      <p className="text-xs text-zinc-500 mt-1">
        Target: 30-50% talk time
      </p>
    </div>
  );
}

function StatsPanel() {
  const [stats, setStats] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, transcriptsRes, healthRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/transcripts'),
        fetch('/api/health')
      ]);

      if (!statsRes.ok) throw new Error('Failed to load stats');
      
      const statsData = await statsRes.json();
      const transcriptsData = await transcriptsRes.json();
      const healthData = await healthRes.json();

      setStats(statsData);
      setTranscripts(Array.isArray(transcriptsData) ? transcriptsData : []);
      setHealth(healthData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-prism-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const processedCount = transcripts.filter(t => t.processed_at).length;
  const pendingCount = transcripts.length - processedCount;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-prism-blue/20 to-prism-400/20 flex items-center justify-center glow-prism-subtle">
          <Sparkles className="w-6 h-6 text-prism-blue" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Dashboard</h2>
          <p className="text-sm text-zinc-400">
            Overview of your sales learning progress
          </p>
        </div>
      </div>

      {/* AI Status Banner */}
      {health && !health.aiEnabled && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 border-l-2 border-l-amber-500"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm text-amber-200 font-medium">AI Processing Disabled</p>
              <p className="text-xs text-amber-300/70 mt-1">
                Start Ollama to enable AI features: <code className="bg-amber-500/20 px-1.5 py-0.5 rounded">ollama serve</code>
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {health && health.aiEnabled && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 border-l-2 border-l-prism-blue"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-prism-blue/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-prism-blue" />
            </div>
            <div>
              <p className="text-sm text-prism-300 font-medium">AI Ready</p>
              <p className="text-xs text-prism-400/70 mt-1">
                {health.aiProvider}: {health.aiModel}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FileText}
          label="Transcripts"
          value={stats?.totalTranscripts || 0}
          subtext={pendingCount > 0 ? `${pendingCount} pending` : 'All processed'}
          color="green"
          delay={0}
        />
        <StatCard
          icon={Layers}
          label="Segments"
          value={stats?.totalSegments || 0}
          subtext="Knowledge chunks"
          color="blue"
          delay={0.05}
        />
        <StatCard
          icon={Users}
          label="People"
          value={stats?.totalPeople || 0}
          subtext="Tracked contacts"
          color="purple"
          delay={0.1}
        />
        <StatCard
          icon={Target}
          label="Deals"
          value={stats?.totalDeals || 0}
          subtext="Active opportunities"
          color="prism"
          delay={0.15}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Knowledge Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-5"
        >
          <h3 className="text-sm font-medium text-zinc-300 mb-4">
            Knowledge Distribution
          </h3>
          <KnowledgeDistribution data={stats?.segmentsByType} />
        </motion.div>

        {/* Average Talk Ratio */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-5"
        >
          <h3 className="text-sm font-medium text-zinc-300 mb-4">
            Average Talk Ratio
          </h3>
          <TalkRatioGauge ratio={stats?.avgTalkRatio} />
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-5"
      >
        <h3 className="text-sm font-medium text-zinc-300 mb-4">
          Recent Transcripts
        </h3>
        <RecentActivity transcripts={transcripts} />
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass-card p-5"
      >
        <h3 className="text-sm font-medium text-zinc-300 mb-4">
          Getting Started
        </h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5 hover:bg-white/[0.04] transition-colors">
            <div className="w-8 h-8 rounded-full bg-prism-blue/20 flex items-center justify-center mb-3">
              <span className="text-prism-blue font-semibold">1</span>
            </div>
            <h4 className="text-sm font-medium text-zinc-200">Drop Transcripts</h4>
            <p className="text-xs text-zinc-500 mt-1">
              Add .txt, .md, or .json files to the watch folder
            </p>
          </div>
          <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5 hover:bg-white/[0.04] transition-colors">
            <div className="w-8 h-8 rounded-full bg-prism-blue/20 flex items-center justify-center mb-3">
              <span className="text-prism-blue font-semibold">2</span>
            </div>
            <h4 className="text-sm font-medium text-zinc-200">Process with AI</h4>
            <p className="text-xs text-zinc-500 mt-1">
              Segments are extracted and tagged automatically
            </p>
          </div>
          <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5 hover:bg-white/[0.04] transition-colors">
            <div className="w-8 h-8 rounded-full bg-prism-blue/20 flex items-center justify-center mb-3">
              <span className="text-prism-blue font-semibold">3</span>
            </div>
            <h4 className="text-sm font-medium text-zinc-200">Browse & Learn</h4>
            <p className="text-xs text-zinc-500 mt-1">
              Search your knowledge base anytime
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default StatsPanel;
