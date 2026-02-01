import { motion } from 'framer-motion';

/**
 * StatCard - Unified stat card with glow effects
 */
export default function StatCard({
  icon: Icon,
  value,
  label,
  color = 'green',
  trend = null,
  trendLabel = '',
  className = '',
  delay = 0
}) {
  const colorMap = {
    green: {
      bg: 'bg-prism-blue/10',
      glow: 'glow-prism',
      text: 'text-prism-blue',
      icon: 'text-prism-blue'
    },
    blue: {
      bg: 'bg-blue-500/10',
      glow: 'glow-blue',
      text: 'text-blue-400',
      icon: 'text-blue-400'
    },
    purple: {
      bg: 'bg-purple-500/10',
      glow: 'glow-purple',
      text: 'text-purple-400',
      icon: 'text-purple-400'
    },
    amber: {
      bg: 'bg-amber-500/10',
      glow: 'glow-amber',
      text: 'text-amber-400',
      icon: 'text-amber-400'
    },
    prism: {
      bg: 'bg-prism-500/10',
      glow: 'glow-prism',
      text: 'text-prism-blue',
      icon: 'text-prism-blue'
    },
    red: {
      bg: 'bg-red-500/10',
      glow: 'glow-red',
      text: 'text-red-400',
      icon: 'text-red-400'
    },
    cyan: {
      bg: 'bg-cyan-500/10',
      glow: 'glow-blue',
      text: 'text-cyan-400',
      icon: 'text-cyan-400'
    },
    zinc: {
      bg: 'bg-zinc-500/10',
      glow: '',
      text: 'text-zinc-400',
      icon: 'text-zinc-400'
    }
  };

  const colors = colorMap[color] || colorMap.green;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay, ease: 'easeOut' }}
      className={`glass-card-static p-5 ${className}`}
    >
      <div className="flex items-start gap-4">
        {Icon && (
          <div className={`w-10 h-10 rounded-xl ${colors.bg} ${colors.glow} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${colors.icon}`} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-3xl font-semibold tracking-tight text-white tabular-nums">
            {value}
          </div>
          <div className="text-xs text-zinc-500 uppercase tracking-wide mt-1">
            {label}
          </div>
          {trend !== null && (
            <div className={`text-xs mt-2 ${trend >= 0 ? 'text-prism-blue' : 'text-red-400'}`}>
              {trend >= 0 ? '+' : ''}{trend}% {trendLabel}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * StatCardCompact - Smaller variant for inline stats
 */
export function StatCardCompact({
  icon: Icon,
  value,
  label,
  color = 'green',
  className = ''
}) {
  const colorMap = {
    green: { bg: 'bg-prism-blue/10', icon: 'text-prism-blue' },
    blue: { bg: 'bg-blue-500/10', icon: 'text-blue-400' },
    purple: { bg: 'bg-purple-500/10', icon: 'text-purple-400' },
    amber: { bg: 'bg-amber-500/10', icon: 'text-amber-400' },
    prism: { bg: 'bg-prism-500/10', icon: 'text-prism-blue' },
    red: { bg: 'bg-red-500/10', icon: 'text-red-400' },
    zinc: { bg: 'bg-zinc-500/10', icon: 'text-zinc-400' }
  };

  const colors = colorMap[color] || colorMap.green;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {Icon && (
        <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${colors.icon}`} />
        </div>
      )}
      <div>
        <div className="text-lg font-semibold text-white tabular-nums">{value}</div>
        <div className="text-xs text-zinc-500">{label}</div>
      </div>
    </div>
  );
}

/**
 * StatCardGrid - Grid of stat cards with staggered animation
 */
export function StatCardGrid({ children, className = '' }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {children}
    </div>
  );
}

/**
 * StatBadge - Inline stat badge
 */
export function StatBadge({ value, label, color = 'green', className = '' }) {
  const colorMap = {
    green: 'bg-prism-blue/10 text-prism-blue',
    blue: 'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    amber: 'bg-amber-500/10 text-amber-400',
    prism: 'bg-prism-500/10 text-prism-blue',
    red: 'bg-red-500/10 text-red-400',
    zinc: 'bg-zinc-500/10 text-zinc-400'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${colorMap[color]} ${className}`}>
      <span className="tabular-nums">{value}</span>
      {label && <span className="text-zinc-500">{label}</span>}
    </span>
  );
}
