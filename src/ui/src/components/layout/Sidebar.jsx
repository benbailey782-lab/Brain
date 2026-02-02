import { useState, useEffect } from 'react';
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
    <ellipse opacity="0.85" cx="140" cy="139" rx="140" ry="60" fill="url(#paint0_linear_sidebar)"/>
    <ellipse opacity="0.85" cx="139.5" cy="100.5" rx="137.5" ry="57.5" fill="url(#paint1_linear_sidebar)"/>
    <ellipse opacity="0.85" cx="140" cy="60" rx="140" ry="60" fill="url(#paint2_linear_sidebar)"/>
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

// Prism Wordmark SVG — matches brand typeface from logo-wordmark.svg
const PrismWordmark = ({ className = "h-5" }) => (
  <svg className={className} viewBox="0 0 201 55" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.875 42V0.125H23.5625C25.3542 0.125 27.1042 0.4792 28.8125 1.1875C30.5625 1.8542 32.125 2.8333 33.5 4.125C34.9167 5.375 36.0417 6.8958 36.875 8.6875C37.7083 10.4375 38.125 12.3958 38.125 14.5625C38.125 17.4375 37.4375 19.9583 36.0625 22.125C34.6875 24.25 32.8125 25.9167 30.4375 27.125C28.1042 28.3333 25.5 28.9375 22.625 28.9375C20.2083 28.9375 18.0417 28.6667 16.125 28.125C14.25 27.5833 12.7917 27.0417 11.75 26.5V21.375C12.75 21.9167 14.25 22.4583 16.25 23C18.25 23.5 20.3125 23.75 22.4375 23.75C25.6042 23.75 28.0417 22.9583 29.75 21.375C31.5 19.7917 32.375 17.5208 32.375 14.5625C32.375 12.7708 31.875 11.2083 30.875 9.875C29.9167 8.5 28.6458 7.4167 27.0625 6.625C25.4792 5.8333 23.7917 5.4375 22 5.4375H12.5V42H6.875ZM48.125 42V0.125H64.1875C65.9792 0.125 67.7292 0.375 69.4375 0.875C71.1875 1.375 72.75 2.1458 74.125 3.1875C75.5417 4.1875 76.6667 5.4792 77.5 7.0625C78.3333 8.6458 78.75 10.5208 78.75 12.6875C78.75 15.2708 78 17.4583 76.5 19.25C75.0417 21.0417 73.1667 22.3958 70.875 23.3125C68.625 24.1875 66.2917 24.625 63.875 24.625C63.2083 24.625 62.375 24.5833 61.375 24.5C60.4167 24.4167 59.4167 24.3333 58.375 24.25C57.3333 24.125 56.3542 24 55.4375 23.875C54.5208 23.7083 53.8125 23.5625 53.3125 23.4375V18.75C54.7292 19.1667 56.2917 19.5 58 19.75C59.7083 19.9583 61.3958 20.0625 63.0625 20.0625C66.2292 20.0625 68.6667 19.3958 70.375 18.0625C72.125 16.7292 73 14.9375 73 12.6875C73 10.3542 72.0417 8.5625 70.125 7.3125C68.25 6.0625 65.9583 5.4375 63.25 5.4375H53.75V42H48.125ZM71.75 42L52.6875 23.4375L57.1875 21.125L80.375 42H71.75ZM95.5625 42V0.125H101.188V42H95.5625ZM88.5 42V36.6875H108.25V42H88.5ZM88.5 5.4375V0.125H108.25V5.4375H88.5ZM130.312 42.625C127.896 42.625 125.667 42.2083 123.625 41.375C121.583 40.5417 119.812 39.6042 118.312 38.5625V32.75C119.938 33.875 121.792 34.8958 123.875 35.8125C126 36.6875 128.396 37.125 131.062 37.125C133.146 37.125 134.979 36.6042 136.562 35.5625C138.146 34.5208 138.938 33.0833 138.938 31.25C138.938 30.2083 138.604 29.3125 137.938 28.5625C137.312 27.8125 136.542 27.1667 135.625 26.625C134.708 26.0833 133.812 25.625 132.938 25.25L126 22.125C124 21.2083 122.438 20.2083 121.312 19.125C120.188 18.0417 119.396 16.8542 118.938 15.5625C118.479 14.2292 118.25 12.7917 118.25 11.25C118.25 9.0417 118.875 7.0625 120.125 5.3125C121.417 3.5208 123.125 2.1042 125.25 1.0625C127.375 0.0208 129.667 -0.5 132.125 -0.5C134.583 -0.5 136.604 -0.1458 138.188 0.5625C139.812 1.2708 141.229 2.0208 142.438 2.8125V8.625C141.271 7.75 139.854 6.9375 138.188 6.1875C136.521 5.3958 134.708 5 132.75 5C131.5 5 130.188 5.2292 128.812 5.6875C127.479 6.1042 126.354 6.7917 125.438 7.75C124.521 8.7083 124.062 9.9375 124.062 11.4375C124.062 13.1042 124.667 14.375 125.875 15.25C127.083 16.125 128.542 16.9583 130.25 17.75L136 20.375C138.875 21.6667 141.042 23.1042 142.5 24.6875C143.958 26.2708 144.688 28.375 144.688 31C144.688 33.2917 144.021 35.3125 142.688 37.0625C141.354 38.7708 139.604 40.125 137.438 41.125C135.271 42.125 132.896 42.625 130.312 42.625ZM154.688 42V0.125H156.438L174.312 19.3125L191.875 0.125H193.625V42H188V11.6875L175.062 25.5H173.562L160.312 11.6875V42H154.688Z"
      fill="url(#wordmark_gradient)"
    />
    <defs>
      <linearGradient id="wordmark_gradient" x1="100" y1="-2" x2="100" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="white"/>
        <stop offset="1" stopColor="#999999"/>
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

function ProcessingIndicator() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let interval;
    const poll = async () => {
      try {
        const res = await fetch('/api/processing/status');
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
          // Poll faster when actively processing
          if (data.activeCount > 0 && !interval) {
            interval = setInterval(poll, 3000);
          } else if (data.activeCount === 0 && interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      } catch (e) { /* ignore */ }
    };

    poll();
    // Start with slower polling, speeds up when active
    interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!status || (status.activeCount === 0 && status.totalProcessed === 0)) return null;

  return (
    <div className="px-4 py-3 border-t border-white/5">
      {status.activeCount > 0 ? (
        <div className="flex items-center gap-2.5">
          <div className="relative w-4 h-4 flex-shrink-0">
            <div className="absolute inset-0 rounded-full border-2 border-prism-blue/30" />
            <div className="absolute inset-0 rounded-full border-2 border-prism-blue border-t-transparent animate-spin" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-zinc-300 truncate">
              Processing {status.activeCount} file{status.activeCount > 1 ? 's' : ''}...
            </div>
            <div className="text-[10px] text-zinc-500 truncate">
              {status.active[0]?.filename}
              {status.active[0]?.elapsed > 0 && ` — ${status.active[0].elapsed}s`}
            </div>
          </div>
        </div>
      ) : status.recentCompleted?.length > 0 ? (
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-xs text-zinc-500">
            {status.totalProcessed} file{status.totalProcessed > 1 ? 's' : ''} processed
          </div>
        </div>
      ) : null}

      {status.recentFailed?.length > 0 && (
        <div className="mt-1.5 flex items-center gap-2.5">
          <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-red-500" />
          </div>
          <div className="text-xs text-red-400 truncate">
            {status.recentFailed[0]?.filename} — failed
          </div>
        </div>
      )}
    </div>
  );
}

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
          <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
            <PrismLogo className="w-7 h-5" />
          </div>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden flex flex-col"
              >
                <PrismWordmark className="h-4" />
                <p className="text-[10px] text-zinc-500 tracking-wide mt-0.5">Intelligence Engine</p>
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

      {/* Processing indicator */}
      {!collapsed && <ProcessingIndicator />}

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
