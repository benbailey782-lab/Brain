import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Custom tooltip matching Prism dark theme
 */
function PrismTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card-elevated rounded-lg px-3 py-2 text-xs border border-white/10">
      <p className="text-zinc-400 mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          {entry.name.toLowerCase().includes('ratio') ? '%' : ''}
        </p>
      ))}
    </div>
  );
}

/**
 * Trend indicator arrow
 */
function TrendIndicator({ current, previous }) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  const pct = previous !== 0 ? Math.abs((diff / previous) * 100).toFixed(0) : 0;

  if (Math.abs(diff) < 0.01) {
    return <span className="flex items-center gap-1 text-xs text-zinc-500"><Minus className="w-3 h-3" /> Flat</span>;
  }

  const isUp = diff > 0;
  const Icon = isUp ? TrendingUp : TrendingDown;

  return (
    <span className={`flex items-center gap-1 text-xs ${isUp ? 'text-emerald-400' : 'text-amber-400'}`}>
      <Icon className="w-3 h-3" /> {pct}%
    </span>
  );
}

/**
 * MetricsChart — Renders coaching metrics as visual charts
 *
 * Expects visualization.metrics to be an array of objects like:
 *   { label: "Jan 15 Call", talk_ratio: 62, strong_moments: 3 }
 */
export default function MetricsChart({ visualization }) {
  const { metrics, chartType = 'bar', title = 'Call Metrics' } = visualization;
  const [view, setView] = useState(chartType);

  if (!metrics || metrics.length === 0) return null;

  // Detect which numeric keys exist for charting
  const sampleKeys = Object.keys(metrics[0]).filter(k => k !== 'label' && typeof metrics[0][k] === 'number');
  const primaryKey = sampleKeys.includes('talk_ratio') ? 'talk_ratio' : sampleKeys[0];
  const secondaryKey = sampleKeys.find(k => k !== primaryKey) || null;

  // Colors from Prism palette
  const PRIMARY_COLOR = '#4AA8D8';
  const SECONDARY_COLOR = '#9878C0';

  // Compute trend
  const latest = metrics[metrics.length - 1]?.[primaryKey];
  const previous = metrics.length > 1 ? metrics[metrics.length - 2]?.[primaryKey] : null;

  const Chart = view === 'line' ? LineChart : BarChart;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass-card-elevated rounded-xl p-4 mt-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold text-white">{title}</h4>
          <TrendIndicator current={latest} previous={previous} />
        </div>

        {/* Chart type toggle */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
          <button
            onClick={() => setView('bar')}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
              view === 'bar' ? 'bg-prism-blue/20 text-prism-blue' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Bar
          </button>
          <button
            onClick={() => setView('line')}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
              view === 'line' ? 'bg-prism-blue/20 text-prism-blue' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Line
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={metrics} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<PrismTooltip />} />

            {view === 'bar' ? (
              <>
                <Bar dataKey={primaryKey} fill={PRIMARY_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} name={formatKey(primaryKey)} />
                {secondaryKey && <Bar dataKey={secondaryKey} fill={SECONDARY_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} name={formatKey(secondaryKey)} />}
              </>
            ) : (
              <>
                <Line type="monotone" dataKey={primaryKey} stroke={PRIMARY_COLOR} strokeWidth={2} dot={{ fill: PRIMARY_COLOR, r: 3 }} name={formatKey(primaryKey)} />
                {secondaryKey && <Line type="monotone" dataKey={secondaryKey} stroke={SECONDARY_COLOR} strokeWidth={2} dot={{ fill: SECONDARY_COLOR, r: 3 }} name={formatKey(secondaryKey)} />}
              </>
            )}
          </Chart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 pt-2 border-t border-white/5">
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PRIMARY_COLOR }} />
          {formatKey(primaryKey)}
        </span>
        {secondaryKey && (
          <span className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SECONDARY_COLOR }} />
            {formatKey(secondaryKey)}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function formatKey(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
