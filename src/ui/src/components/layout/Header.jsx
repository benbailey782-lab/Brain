import { AnimatePresence, motion } from 'framer-motion';
import { Menu } from 'lucide-react';

export default function Header({ health, onMenuClick }) {
  return (
    <header
      className="h-14 sticky top-0 z-10"
      style={{
        background: 'var(--surface-1)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--glass-border)'
      }}
    >
      <div className="h-full px-4 flex items-center justify-between gap-4">
        {/* Left side - mobile menu */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-zinc-400 hover:text-zinc-200 rounded-xl hover:bg-white/5 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side - AI status pill */}
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {health && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-full
                  text-xs font-medium transition-colors
                  ${health.aiEnabled
                    ? 'bg-prism-blue/10 text-prism-blue'
                    : 'bg-amber-500/10 text-amber-400'
                  }
                `}
              >
                <div className={`
                  w-1.5 h-1.5 rounded-full
                  ${health.aiEnabled ? 'bg-prism-blue pulse-glow' : 'bg-amber-500'}
                `} />
                <span>
                  {health.aiEnabled
                    ? (health.aiModel ? health.aiModel.split(':')[0] : 'AI Ready')
                    : 'AI Offline'
                  }
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
