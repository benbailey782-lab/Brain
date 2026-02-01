import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, User, Building, Mail, Phone, Briefcase,
  MessageSquare, FileText, Target, Calendar, Edit2,
  Save, X, AlertCircle, Plus, ChevronRight,
  RefreshCw, Sparkles, MessageCircle, Lightbulb
} from 'lucide-react';

const RELATIONSHIP_COLORS = {
  prospect: 'bg-amber-500/20 text-amber-400',
  customer: 'bg-prism-blue/20 text-prism-blue',
  colleague: 'bg-blue-500/20 text-blue-400',
  mentor: 'bg-purple-500/20 text-purple-400',
  manager: 'bg-indigo-500/20 text-indigo-400',
  competitor_contact: 'bg-red-500/20 text-red-400',
  other: 'bg-zinc-500/20 text-zinc-400',
};

// AI Brief component for person living sections
function PersonAIBrief({ personId }) {
  const [sections, setSections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSections();
  }, [personId]);

  const loadSections = async () => {
    try {
      const res = await fetch(`/api/living-sections/person/${personId}`);
      if (res.ok) {
        const data = await res.json();
        setSections(data);
      }
    } catch (err) {
      setError('Failed to load AI brief');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/living-sections/person/${personId}/regenerate`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setSections(data);
      }
    } catch (err) {
      setError('Failed to regenerate');
    } finally {
      setRefreshing(false);
    }
  };

  // Parse content if it's JSON
  const parseContent = (section) => {
    if (!section?.content) return null;
    try {
      return typeof section.content === 'string'
        ? JSON.parse(section.content)
        : section.content;
    } catch {
      return section.content;
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-5 animate-pulse">
        <div className="h-4 bg-white/5 rounded w-1/4 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-white/5 rounded w-full" />
          <div className="h-3 bg-white/5 rounded w-3/4" />
        </div>
      </div>
    );
  }

  const summary = parseContent(sections?.person_summary);
  const highlights = parseContent(sections?.interaction_highlights);

  if (!summary && !highlights) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-prism-blue/20 to-prism-400/20 flex items-center justify-center glow-prism-subtle">
              <Sparkles className="w-5 h-5 text-prism-blue" />
            </div>
            <div>
              <h3 className="font-medium text-white">AI Brief</h3>
              <p className="text-xs text-zinc-500">Generate insights about this person</p>
            </div>
          </div>
          <button
            onClick={handleRegenerate}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-prism-blue/10 text-prism-blue hover:bg-prism-blue/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Generating...' : 'Generate Brief'}
          </button>
        </div>
        <p className="text-sm text-zinc-500">No AI brief available yet. Click to generate insights based on conversation history.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-prism-blue/20 to-prism-400/20 flex items-center justify-center glow-prism-subtle">
            <Sparkles className="w-5 h-5 text-prism-blue" />
          </div>
          <div>
            <h3 className="font-medium text-white">AI Brief</h3>
            <p className="text-xs text-zinc-500">AI-generated insights</p>
          </div>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Regenerating...' : 'Refresh'}
        </button>
      </div>

      {/* Person Summary */}
      {summary && (
        <div className="mb-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            {typeof summary === 'string' ? summary : summary.overview || summary.summary}
          </p>
          {summary.key_traits && (
            <div className="flex flex-wrap gap-2 mt-3">
              {summary.key_traits.map((trait, i) => (
                <span key={i} className="px-2 py-1 rounded-lg text-xs bg-prism-blue/10 text-prism-blue border border-prism-blue/20">
                  {trait}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Interaction Highlights */}
      {highlights && (
        <div className="pt-4 border-t border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-zinc-300">Interaction Highlights</span>
          </div>
          <div className="space-y-2">
            {(Array.isArray(highlights) ? highlights : highlights.items || []).slice(0, 4).map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-zinc-400">
                  {typeof item === 'string' ? item : item.highlight || item.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staleness indicator */}
      {sections && Object.values(sections).some(s => s?.is_stale) && (
        <div className="flex items-center gap-2 text-xs text-amber-400 mt-4 pt-4 border-t border-white/5">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Brief may be outdated. Click refresh for fresh insights.</span>
        </div>
      )}
    </motion.div>
  );
}

// Talking Points component
function TalkingPoints({ personId }) {
  const [section, setSection] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTalkingPoints();
  }, [personId]);

  const loadTalkingPoints = async () => {
    try {
      const res = await fetch(`/api/living-sections/person/${personId}/talking_points`);
      if (res.ok) {
        const data = await res.json();
        setSection(data);
      }
    } catch (err) {
      // Silently fail - talking points are optional
    } finally {
      setLoading(false);
    }
  };

  // Parse content if it's JSON
  const parseContent = (section) => {
    if (!section?.content) return null;
    try {
      return typeof section.content === 'string'
        ? JSON.parse(section.content)
        : section.content;
    } catch {
      return section.content;
    }
  };

  const points = parseContent(section);

  if (loading) {
    return (
      <div className="glass-card p-5 animate-pulse">
        <div className="h-4 bg-white/5 rounded w-1/3 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-white/5 rounded w-full" />
          <div className="h-3 bg-white/5 rounded w-5/6" />
        </div>
      </div>
    );
  }

  if (!points) return null;

  const pointsList = Array.isArray(points) ? points : points.items || points.points || [];
  if (pointsList.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 border-l-2 border-l-purple-500"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center glow-purple">
          <Lightbulb className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="font-medium text-white">Talking Points</h3>
          <p className="text-xs text-zinc-500">For your next call</p>
        </div>
      </div>
      <div className="space-y-3">
        {pointsList.map((point, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10 hover:border-purple-500/20 transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-medium text-purple-400">{i + 1}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-zinc-200">
                {typeof point === 'string' ? point : point.topic || point.point}
              </p>
              {point.context && (
                <p className="text-xs text-zinc-500 mt-1">{point.context}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function PersonDetail({ person, onBack, onNavigateToDeal }) {
  const [personData, setPersonData] = useState(null);
  const [segments, setSegments] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    if (person?.id) {
      loadPersonData();
    }
  }, [person?.id]);

  const loadPersonData = async () => {
    setLoading(true);
    try {
      // Load person details
      const personRes = await fetch(`/api/people/${person.id}`);
      const personJson = await personRes.json();
      setPersonData(personJson);
      setEditForm({
        name: personJson.name || '',
        role: personJson.role || '',
        company: personJson.company || '',
        email: personJson.email || '',
        phone: personJson.phone || '',
        relationship_type: personJson.relationship_type || 'other',
        notes: personJson.notes || ''
      });

      // Load related segments
      const segmentsRes = await fetch(`/api/people/${person.id}/segments`);
      if (segmentsRes.ok) {
        setSegments(await segmentsRes.json());
      }

      // Load related deals (by company match if available)
      if (personJson.company) {
        const dealsRes = await fetch('/api/deals');
        if (dealsRes.ok) {
          const allDeals = await dealsRes.json();
          const relatedDeals = allDeals.filter(d =>
            d.company_name?.toLowerCase() === personJson.company?.toLowerCase() ||
            d.contact_name?.toLowerCase() === personJson.name?.toLowerCase()
          );
          setDeals(relatedDeals);
        }
      }
    } catch (err) {
      console.error('Failed to load person data:', err);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/people/${person.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (!res.ok) throw new Error('Failed to update person');
      setIsEditing(false);
      loadPersonData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-prism-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!personData) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-400">Person not found</p>
        <button
          onClick={onBack}
          className="mt-4 text-prism-blue hover:text-prism-300"
        >
          Go back
        </button>
      </div>
    );
  }

  const relationshipColor = RELATIONSHIP_COLORS[personData.relationship_type] || RELATIONSHIP_COLORS.other;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center text-2xl font-medium text-zinc-300">
            {personData.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-white">{personData.name}</h2>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${relationshipColor}`}>
                {personData.relationship_type?.replace('_', ' ') || 'other'}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-zinc-400">
              {personData.role && (
                <span className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" />
                  {personData.role}
                </span>
              )}
              {personData.company && (
                <span className="flex items-center gap-1">
                  <Building className="w-4 h-4" />
                  {personData.company}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <Edit2 className="w-5 h-5" />
        </button>
      </div>

      {/* Edit Form */}
      {isEditing && (
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 p-5">
          <h3 className="text-sm font-medium text-zinc-300 mb-4">Edit Person</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-prism-blue"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Role</label>
              <input
                type="text"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-prism-blue"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Company</label>
              <input
                type="text"
                value={editForm.company}
                onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-prism-blue"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Relationship</label>
              <select
                value={editForm.relationship_type}
                onChange={(e) => setEditForm({ ...editForm, relationship_type: e.target.value })}
                className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-prism-blue"
              >
                <option value="prospect">Prospect</option>
                <option value="customer">Customer</option>
                <option value="colleague">Colleague</option>
                <option value="mentor">Mentor</option>
                <option value="manager">Manager</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-prism-blue"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Phone</label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-prism-blue"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Notes</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={3}
                className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-prism-blue"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 rounded text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded text-sm bg-prism-500 hover:bg-prism-blue text-white flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
        </div>
      )}

      {/* AI Brief Section */}
      <PersonAIBrief personId={person?.id} />

      {/* Contact Info */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Contact Information</h3>
        <div className="grid grid-cols-2 gap-4">
          {personData.email && (
            <a
              href={`mailto:${personData.email}`}
              className="flex items-center gap-3 p-3 bg-zinc-700/30 rounded-lg hover:bg-zinc-700/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-xs text-zinc-500">Email</div>
                <div className="text-sm text-zinc-200">{personData.email}</div>
              </div>
            </a>
          )}
          {personData.phone && (
            <a
              href={`tel:${personData.phone}`}
              className="flex items-center gap-3 p-3 bg-zinc-700/30 rounded-lg hover:bg-zinc-700/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-prism-blue/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-prism-blue" />
              </div>
              <div>
                <div className="text-xs text-zinc-500">Phone</div>
                <div className="text-sm text-zinc-200">{personData.phone}</div>
              </div>
            </a>
          )}
        </div>
        {personData.notes && (
          <div className="mt-4 pt-4 border-t border-zinc-700/50">
            <div className="text-xs text-zinc-500 mb-2">Notes</div>
            <p className="text-sm text-zinc-300">{personData.notes}</p>
          </div>
        )}
      </div>

      {/* Related Deals */}
      {deals.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-300">Related Deals</h3>
            <span className="text-xs text-zinc-500">{deals.length} deals</span>
          </div>
          <div className="space-y-2">
            {deals.map(deal => (
              <button
                key={deal.id}
                onClick={() => onNavigateToDeal && onNavigateToDeal(deal)}
                className="w-full flex items-center justify-between p-3 bg-white/[0.02] rounded-lg hover:bg-white/[0.05] transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Target className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{deal.company_name}</div>
                    {deal.value_amount && (
                      <div className="text-xs text-zinc-400">
                        ${deal.value_amount.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Related Segments */}
      {segments.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-300">Conversation History</h3>
            <span className="text-xs text-zinc-500">{segments.length} segments</span>
          </div>
          <div className="space-y-3">
            {segments.slice(0, 10).map(segment => (
              <div
                key={segment.id}
                className="p-3 bg-white/[0.02] rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    segment.classification === 'objection' ? 'bg-red-500/10 text-red-400' :
                    segment.classification === 'buying_signal' ? 'bg-prism-blue/10 text-prism-blue' :
                    segment.classification === 'pain_point' ? 'bg-amber-500/10 text-amber-400' :
                    segment.classification === 'decision_criteria' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-zinc-700 text-zinc-400'
                  }`}>
                    {segment.classification?.replace(/_/g, ' ') || 'unclassified'}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {segment.transcript_filename || 'Unknown transcript'}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 line-clamp-2">{segment.content}</p>
              </div>
            ))}
            {segments.length > 10 && (
              <div className="text-center text-xs text-zinc-500">
                +{segments.length - 10} more segments
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interaction Stats */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Interaction Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-white/[0.02] rounded-lg">
            <div className="text-2xl font-semibold text-white">{segments.length}</div>
            <div className="text-xs text-zinc-500">Segments</div>
          </div>
          <div className="text-center p-3 bg-white/[0.02] rounded-lg">
            <div className="text-2xl font-semibold text-white">{deals.length}</div>
            <div className="text-xs text-zinc-500">Deals</div>
          </div>
          <div className="text-center p-3 bg-white/[0.02] rounded-lg">
            <div className="text-2xl font-semibold text-white">
              {new Set(segments.map(s => s.transcript_id)).size}
            </div>
            <div className="text-xs text-zinc-500">Conversations</div>
          </div>
        </div>
      </div>

      {/* Talking Points for Next Call */}
      <TalkingPoints personId={person?.id} />
    </div>
  );
}
