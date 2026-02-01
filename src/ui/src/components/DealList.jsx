import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Target, Plus, Building, DollarSign, Calendar,
  ChevronRight, AlertCircle, CheckCircle, Clock
} from 'lucide-react';
import DealDetail from './DealDetail';
import Modal from './shared/Modal';

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-prism-blue', textColor: 'text-prism-blue' },
  won: { label: 'Won', color: 'bg-blue-500', textColor: 'text-blue-400' },
  lost: { label: 'Lost', color: 'bg-red-500', textColor: 'text-red-400' },
  stalled: { label: 'Stalled', color: 'bg-amber-500', textColor: 'text-amber-400' },
};

function CreateDealModal({ isOpen, onClose, onCreate }) {
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    contactRole: '',
    valueAmount: '',
    status: 'active',
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate({
      ...formData,
      valueAmount: formData.valueAmount ? parseFloat(formData.valueAmount) : null
    });
    setFormData({ companyName: '', contactName: '', contactRole: '', valueAmount: '', status: 'active', notes: '' });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Deal" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Company Name *</label>
          <input
            type="text"
            required
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-zinc-200 focus:outline-none focus:border-prism-blue transition-colors"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Contact Name</label>
            <input
              type="text"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-zinc-200 focus:outline-none focus:border-prism-blue transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Contact Role</label>
            <input
              type="text"
              value={formData.contactRole}
              onChange={(e) => setFormData({ ...formData, contactRole: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-zinc-200 focus:outline-none focus:border-prism-blue transition-colors"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Deal Value ($)</label>
            <input
              type="number"
              value={formData.valueAmount}
              onChange={(e) => setFormData({ ...formData, valueAmount: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-zinc-200 focus:outline-none focus:border-prism-blue transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-zinc-200 focus:outline-none focus:border-prism-blue transition-colors"
            >
              <option value="active">Active</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="stalled">Stalled</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-zinc-200 focus:outline-none focus:border-prism-blue transition-colors resize-none"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 bg-prism-500 hover:bg-prism-blue text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
          >
            Create Deal
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MeddpiccProgress({ meddpicc }) {
  if (!meddpicc || meddpicc.length === 0) return null;

  const letters = ['M', 'E', 'D1', 'D2', 'P', 'I', 'C1', 'C2'];
  const identified = meddpicc.filter(m => m.status === 'identified').length;
  const partial = meddpicc.filter(m => m.status === 'partial').length;

  return (
    <div className="flex items-center gap-1">
      {letters.map(letter => {
        const item = meddpicc.find(m => m.letter === letter);
        const status = item?.status || 'unknown';
        return (
          <div
            key={letter}
            className={`w-5 h-5 rounded text-[10px] flex items-center justify-center font-medium ${
              status === 'identified' ? 'bg-prism-blue/30 text-prism-blue border border-prism-blue/50' :
              status === 'partial' ? 'bg-amber-500/30 text-amber-400 border border-amber-500/50' :
              'bg-zinc-700/50 text-zinc-500 border border-zinc-600'
            }`}
            title={`${letter}: ${status}`}
          >
            {letter.replace('1', '').replace('2', '')}
          </div>
        );
      })}
      <span className="text-xs text-zinc-500 ml-2">
        {identified}/{letters.length}
      </span>
    </div>
  );
}

function DealCard({ deal, onClick, index = 0 }) {
  const statusConfig = STATUS_CONFIG[deal.status] || STATUS_CONFIG.active;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="w-full glass-card-interactive p-5 text-left"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-prism-500/10 border border-prism-500/20">
            <Building className="w-5 h-5 text-prism-400" />
          </div>
          <div>
            <h3 className="font-medium text-white">{deal.company_name}</h3>
            {deal.contact_name && (
              <p className="text-sm text-zinc-400 mt-0.5">
                {deal.contact_name}{deal.contact_role && ` - ${deal.contact_role}`}
              </p>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-zinc-500" />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${statusConfig.color}/20 ${statusConfig.textColor}`}>
            {statusConfig.label}
          </span>
          {deal.value_amount && (
            <span className="flex items-center gap-1 text-sm text-zinc-400">
              <DollarSign className="w-3.5 h-3.5" />
              {deal.value_amount.toLocaleString()}
            </span>
          )}
        </div>
        <MeddpiccProgress meddpicc={deal.meddpicc} />
      </div>
    </motion.button>
  );
}

function DealList({ onSelect }) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/deals');
      if (!res.ok) throw new Error('Failed to load deals');
      const data = await res.json();
      const dealsArray = Array.isArray(data) ? data : [];

      // Load MEDDPICC for each deal
      const dealsWithMeddpicc = await Promise.all(
        dealsArray.map(async (deal) => {
          const meddRes = await fetch(`/api/deals/${deal.id}/meddpicc`);
          const meddpicc = meddRes.ok ? await meddRes.json() : [];
          return { ...deal, meddpicc };
        })
      );

      setDeals(dealsWithMeddpicc);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (dealData) => {
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dealData)
      });
      if (!res.ok) throw new Error('Failed to create deal');
      setShowCreate(false);
      loadDeals();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSelectDeal = (deal) => {
    if (onSelect) {
      onSelect(deal);
    } else {
      setSelectedDeal(deal.id);
    }
  };

  if (!onSelect && selectedDeal) {
    return (
      <DealDetail
        dealId={selectedDeal}
        onBack={() => {
          setSelectedDeal(null);
          loadDeals();
        }}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center glow-amber">
            <Target className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Deals</h2>
            <p className="text-sm text-zinc-400">
              Track opportunities and MEDDPICC progress
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-prism-500 hover:bg-prism-blue text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Deal
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-prism-blue border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="glass-card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400">{error}</p>
        </div>
      ) : deals.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-zinc-600" />
          </div>
          <p className="text-zinc-400">No deals yet</p>
          <p className="text-sm text-zinc-500 mt-1">Create your first deal to start tracking</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {deals.map((deal, index) => (
            <DealCard
              key={deal.id}
              deal={deal}
              index={index}
              onClick={() => handleSelectDeal(deal)}
            />
          ))}
        </div>
      )}

      <CreateDealModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </motion.div>
  );
}

export default DealList;
