import { motion } from 'framer-motion';
import { Building2, Briefcase, Calendar, ChevronRight } from 'lucide-react';

/**
 * Initials avatar with color based on relationship type
 */
function Avatar({ name, relationship }) {
  const colors = {
    prospect: 'from-amber-500/30 to-amber-600/20 text-amber-400 border-amber-500/30',
    customer: 'from-prism-blue/30 to-blue-600/20 text-prism-blue border-prism-blue/30',
    colleague: 'from-blue-500/30 to-blue-600/20 text-blue-400 border-blue-500/30',
    mentor: 'from-purple-500/30 to-purple-600/20 text-purple-400 border-purple-500/30',
    champion: 'from-prism-blue/30 to-indigo-600/20 text-prism-blue border-prism-blue/30',
    economic_buyer: 'from-emerald-500/30 to-emerald-600/20 text-emerald-400 border-emerald-500/30',
    competitor_contact: 'from-red-500/30 to-red-600/20 text-red-400 border-red-500/30',
    other: 'from-zinc-500/30 to-zinc-600/20 text-zinc-400 border-zinc-500/30'
  };

  const initials = (name || '?')
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const colorClass = colors[relationship] || colors.other;

  return (
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClass} border flex items-center justify-center text-sm font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

/**
 * Relationship badge
 */
function RelationshipBadge({ type }) {
  const styles = {
    prospect: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    customer: 'bg-prism-blue/15 text-prism-blue border-prism-blue/20',
    colleague: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    mentor: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
    competitor_contact: 'bg-red-500/15 text-red-400 border-red-500/20',
    other: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20'
  };

  const label = (type || 'other').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${styles[type] || styles.other}`}>
      {label}
    </span>
  );
}

/**
 * ContactCard — Rich person overview for Ask panel answers
 */
export default function ContactCard({ visualization, onNavigate }) {
  const { person } = visualization;
  if (!person) return null;

  const lastSeen = person.updated_at ? getRelativeTime(person.updated_at) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="glass-card-static rounded-xl p-3 mt-2"
    >
      <div className="flex items-start gap-3">
        <Avatar name={person.name} relationship={person.relationship_type} />

        <div className="flex-1 min-w-0">
          {/* Name + relationship */}
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-sm font-semibold text-white truncate">{person.name}</h4>
            <RelationshipBadge type={person.relationship_type} />
          </div>

          {/* Role + Company */}
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            {person.role && (
              <span className="flex items-center gap-1">
                <Briefcase className="w-3 h-3" />
                {person.role}
              </span>
            )}
            {person.company && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {person.company}
              </span>
            )}
          </div>

          {/* Last seen + action */}
          <div className="flex items-center justify-between mt-2">
            {lastSeen && (
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Last seen {lastSeen}
              </span>
            )}
            {onNavigate && (
              <button
                onClick={() => onNavigate('people', person.id)}
                className="flex items-center gap-0.5 text-[11px] text-prism-blue hover:text-prism-blue/80 transition-colors"
              >
                View Profile <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function getRelativeTime(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString();
}
