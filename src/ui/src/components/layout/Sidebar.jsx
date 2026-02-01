import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  MessageSquare,
  Sparkles,
  Target,
  Briefcase,
  Users,
  BookOpen,
  FileText,
  BarChart3,
  Settings
} from 'lucide-react';

// Prism Logo Mark SVG component
const PrismLogo = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 280 199" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse opacity="0.6" cx="140" cy="139" rx="140" ry="60" fill="url(#paint0_linear_sidebar)"/>
    <ellipse opacity="0.6" cx="139.5" cy="100.5" rx="137.5" ry="57.5" fill="url(#paint1_linear_sidebar)"/>
    <ellipse opacity="0.6" cx="140" cy="60" rx="140" ry="60" fill="url(#paint2_linear_sidebar)"/>
    <defs>
      <linearGradient id="paint0_linear_sidebar" x1="0" y1="139" x2="280" y2="139" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4AA8D8"/>
        <stop offset="1" stopColor="#C888B0"/>
      </linearGradient>
      <linearGradient id="paint1_linear_sidebar" x1="2" y1="100" x2="277" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6078C8"/>
        <stop offset="1" stopColor="#9878C0"/>
      </linearGradient>
      <linearGradient id="paint2_linear_sidebar" x1="0" y1="59.52" x2="280" y2="59.52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7B8EC8"/>
        <stop offset="1" stopColor="#9890C8"/>
      </linearGradient>
    </defs>
  </svg>
);

const SECTIONS = {
  main: 'Main',
  pipeline: 'Pipeline',
  data: 'Data'
};

const NAV_ITEMS = [
  { id: 'ask',         label: 'Ask',         icon: MessageSquare, section: 'main',     color: '#4AA8D8' },
  { id: 'insights',    label: 'Insights',    icon: Sparkles,      section: 'main',     color: '#6078C8' },
  { id: 'prospects',   label: 'Prospects',   icon: Target,        section: 'pipeline', color: '#7B8EC8' },
  { id: 'deals',       label: 'Deals',       icon: Briefcase,     section: 'pipeline', color: '#6078C8' },
  { id: 'people',      label: 'People',      icon: Users,         section: 'data',     color: '#9878C0' },
  { id: 'knowledge',   label: 'Knowledge',   icon: BookOpen,      section: 'data',     color: '#7B8EC8' },
  { id: 'transcripts', label: 'Transcripts', icon: FileText,      section: 'data',     color: '#4AA8D8' },
  { id: 'stats',       label: 'Stats',       icon: BarChart3,     section: 'data',     color: '#9890C8' },
  { id: 'settings',    label: 'Settings',    icon: Settings,      section: 'data',     color: '#C888B0' },
];

export default function Sidebar({ activeView, onNavigate, collapsed, onToggleCollapse, health }) {
  const groupedItems = NAV_ITEMS.reduce((acc, item) => {
    const section = item.section || 'main';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex flex-col sticky top-0 h-screen"
      style={{
        background: 'var(--surface-1)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--glass-border)'
      }}
    >
      {/* Logo */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/[0.03] flex items-center justify-center flex-shrink-0 border border-white/5">
            <PrismLogo className="w-7 h-5" />
          </div>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <h1 className="text-lg font-semibold text-white truncate">Prism</h1>
                <p className="text-xs text-zinc-500 truncate">Intelligence Engine</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {Object.entries(groupedItems).map(([section, sectionItems]) => (
          <div key={section} className="mb-6">
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="px-4 mb-2"
                >
                  <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-[0.08em]">
                    {SECTIONS[section]}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1 px-2">
              {sectionItems.map(item => {
                const isActive = activeView === item.id;
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                      transition-all duration-200 text-sm font-medium relative
                      ${isActive ? '' : 'text-zinc-400 hover:text-zinc-200'}
                    `}
                    style={isActive ? {
                      color: item.color,
                      background: `${item.color}10`,
                      boxShadow: `inset 0 0 20px ${item.color}08`
                    } : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full"
                        style={{ backgroundColor: item.color }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}

                    <item.icon className="w-5 h-5 flex-shrink-0" />

                    <AnimatePresence mode="wait">
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.15 }}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* AI Status */}
      <AnimatePresence mode="wait">
        {!collapsed && health && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="p-4 border-t border-white/5"
          >
            <div className="flex items-center gap-2">
              <div className={`
                w-2 h-2 rounded-full flex-shrink-0
                ${health.aiEnabled ? 'bg-prism-blue pulse-glow' : 'bg-amber-500'}
              `} />
              <span className="text-xs text-zinc-400 truncate">
                {health.aiEnabled
                  ? `${health.aiProvider || 'AI'} ready`
                  : 'AI inactive'
                }
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed AI indicator */}
      {collapsed && health && (
        <div className="p-4 border-t border-white/5 flex justify-center">
          <div className={`
            w-2 h-2 rounded-full
            ${health.aiEnabled ? 'bg-prism-blue pulse-glow' : 'bg-amber-500'}
          `} />
        </div>
      )}

      {/* Collapse toggle */}
      <motion.button
        onClick={onToggleCollapse}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="p-4 border-t border-white/5 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <motion.div
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-5 h-5" />
        </motion.div>
      </motion.button>
    </motion.aside>
  );
}
