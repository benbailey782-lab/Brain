import React from 'react';
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Lightbulb,
  Target,
  DollarSign,
  Users,
  BookOpen,
  FileText,
  BarChart3
} from 'lucide-react';

const SECTIONS = {
  main: 'Main',
  pipeline: 'Pipeline',
  data: 'Data'
};

const NAV_ITEMS = [
  { id: 'ask', label: 'Ask', icon: MessageSquare, section: 'main' },
  { id: 'insights', label: 'Insights', icon: Lightbulb, section: 'main' },
  { id: 'prospects', label: 'Prospects', icon: Target, section: 'pipeline' },
  { id: 'deals', label: 'Deals', icon: DollarSign, section: 'pipeline' },
  { id: 'people', label: 'People', icon: Users, section: 'data' },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen, section: 'data' },
  { id: 'transcripts', label: 'Transcripts', icon: FileText, section: 'data' },
  { id: 'stats', label: 'Stats', icon: BarChart3, section: 'data' },
];

export default function Sidebar({ activeView, onNavigate, collapsed, onToggleCollapse, health }) {
  const groupedItems = NAV_ITEMS.reduce((acc, item) => {
    const section = item.section || 'main';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  return (
    <aside className={`
      ${collapsed ? 'w-16' : 'w-64'}
      bg-zinc-900 border-r border-zinc-800
      flex flex-col transition-all duration-200
      sticky top-0 h-screen
    `}>
      {/* Logo */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
            <Brain className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-semibold text-white truncate">Sales Brain</h1>
              <p className="text-xs text-zinc-500 truncate">Intelligence Engine</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {Object.entries(groupedItems).map(([section, sectionItems]) => (
          <div key={section} className="mb-6">
            {!collapsed && (
              <div className="px-4 mb-2">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  {SECTIONS[section]}
                </span>
              </div>
            )}

            <div className="space-y-1 px-2">
              {sectionItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-colors text-sm font-medium
                    ${activeView === item.id
                      ? 'bg-green-500/10 text-green-400'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}
                  `}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className={`w-5 h-5 flex-shrink-0 ${
                    activeView === item.id ? 'text-green-400' : ''
                  }`} />
                  {!collapsed && <span>{item.label}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* AI Status */}
      {!collapsed && health && (
        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${health.aiEnabled ? 'bg-green-500' : 'bg-amber-500'}`} />
            <span className="text-zinc-400">
              {health.aiEnabled ? `${health.aiProvider} active` : 'AI inactive'}
            </span>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="p-4 border-t border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-300"
      >
        {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>
    </aside>
  );
}
