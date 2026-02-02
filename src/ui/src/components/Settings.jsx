import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, Database, Cpu, RefreshCw, Check, AlertCircle,
  ExternalLink, HardDrive, Trash2, FileText, Users,
  Briefcase, MessageSquare, Mail, Paperclip, X, Info
} from 'lucide-react';
import GlassCard from './shared/GlassCard';

// Prism Logo Mark SVG component
const PrismLogo = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 280 199" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse opacity="0.6" cx="140" cy="139" rx="140" ry="60" fill="url(#paint0_linear_settings)"/>
    <ellipse opacity="0.6" cx="139.5" cy="100.5" rx="137.5" ry="57.5" fill="url(#paint1_linear_settings)"/>
    <ellipse opacity="0.6" cx="140" cy="60" rx="140" ry="60" fill="url(#paint2_linear_settings)"/>
    <defs>
      <linearGradient id="paint0_linear_settings" x1="0" y1="139" x2="280" y2="139" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4AA8D8"/><stop offset="1" stopColor="#C888B0"/>
      </linearGradient>
      <linearGradient id="paint1_linear_settings" x1="2" y1="100" x2="277" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6078C8"/><stop offset="1" stopColor="#9878C0"/>
      </linearGradient>
      <linearGradient id="paint2_linear_settings" x1="0" y1="59.52" x2="280" y2="59.52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7B8EC8"/><stop offset="1" stopColor="#9890C8"/>
      </linearGradient>
    </defs>
  </svg>
);

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function DataStat({ icon: Icon, label, value, color = 'text-prism-blue' }) {
  return (
    <div className="p-3 bg-white/5 rounded-xl text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color} opacity-60`} />
      </div>
      <div className="text-xl font-semibold text-white">{value}</div>
      <div className="text-[11px] text-zinc-500">{label}</div>
    </div>
  );
}

function FolderConfig({ label, description, icon: Icon, iconColor, folder, onFolderChange, onSave, loading, saved, health, folderExistsKey, fileCountKey, fileLabel, isElectron, onBrowse }) {
  const folderExists = health?.[folderExistsKey];
  const fileCount = health?.[fileCountKey] || 0;
  const isConfigured = folder && folder.trim() !== '';

  return (
    <GlassCard variant="static" padding="p-6">
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-medium text-white mb-1">{label}</h3>
          <p className="text-sm text-zinc-400 mb-4">{description}</p>

          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-300 font-mono truncate">
              {folder || 'Not configured'}
            </div>
            {isElectron && (
              <motion.button
                onClick={onBrowse}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2.5 bg-prism-500 hover:bg-prism-600 text-white rounded-xl text-sm font-medium transition-colors flex-shrink-0"
              >
                Browse...
              </motion.button>
            )}
          </div>

          {/* Dev mode hint */}
          {!isElectron && isConfigured && (
            <p className="mt-2 text-[11px] text-zinc-600">
              Set via WATCH_FOLDER in .env file. Restart the server to change.
            </p>
          )}

          {/* Status indicator */}
          {health && isConfigured && (
            <div className="mt-3 flex items-center gap-2">
              {folderExists ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-prism-blue" />
                  <span className="text-xs text-zinc-400">
                    Connected — {fileCount} {fileLabel}{fileCount !== 1 ? 's' : ''} in folder
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs text-amber-400">
                    Folder not found — check the path
                  </span>
                </>
              )}
            </div>
          )}

          {!isConfigured && (
            <div className="mt-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-600" />
              <span className="text-xs text-zinc-500">Not configured</span>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

export default function Settings() {
  const [health, setHealth] = useState(null);
  const [dataInfo, setDataInfo] = useState(null);
  const [watchFolder, setWatchFolder] = useState('');
  const [emailFolder, setEmailFolder] = useState('');
  const [watchLoading, setWatchLoading] = useState(false);
  const [watchSaved, setWatchSaved] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [error, setError] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [healthRes, dataRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/data/info')
      ]);

      if (healthRes.ok) {
        const h = await healthRes.json();
        setHealth(h);
        setWatchFolder(h.watchFolder || '');
        setEmailFolder(h.emailFolder || '');
      }

      if (dataRes.ok) {
        setDataInfo(await dataRes.json());
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleSaveWatch = async () => {
    setWatchLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/config/watch-folder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchFolder })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
      setWatchSaved(true);
      setTimeout(() => setWatchSaved(false), 3000);
      if (isElectron) await window.electronAPI.saveConfig({ watchFolder });
      // Refresh health to update folder status
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) setHealth(await healthRes.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setWatchLoading(false);
    }
  };

  const handleSaveEmail = async () => {
    setEmailLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/config/email-folder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailFolder })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 3000);
      if (isElectron) await window.electronAPI.saveConfig({ emailFolder });
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) setHealth(await healthRes.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleBrowseWatch = async () => {
    if (!isElectron) return;
    try {
      const folder = await window.electronAPI.selectFolder();
      if (folder) {
        setWatchFolder(folder);
        // Auto-save on Electron browse
        const res = await fetch('/api/config/watch-folder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ watchFolder: folder })
        });
        if (res.ok) {
          await window.electronAPI.saveConfig({ watchFolder: folder });
          setWatchSaved(true);
          setTimeout(() => setWatchSaved(false), 3000);
          const healthRes = await fetch('/api/health');
          if (healthRes.ok) setHealth(await healthRes.json());
        }
      }
    } catch (err) {
      setError('Failed to select folder');
    }
  };

  const handleBrowseEmail = async () => {
    if (!isElectron) return;
    try {
      const folder = await window.electronAPI.selectFolder();
      if (folder) {
        setEmailFolder(folder);
        const res = await fetch('/api/config/email-folder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailFolder: folder })
        });
        if (res.ok) {
          await window.electronAPI.saveConfig({ emailFolder: folder });
          setEmailSaved(true);
          setTimeout(() => setEmailSaved(false), 3000);
          const healthRes = await fetch('/api/health');
          if (healthRes.ok) setHealth(await healthRes.json());
        }
      }
    } catch (err) {
      setError('Failed to select folder');
    }
  };

  const handleReset = async () => {
    setResetLoading(true);
    try {
      const res = await fetch('/api/data/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET_ALL_DATA' })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Reset failed');
      setResetSuccess(true);
      setShowResetConfirm(false);
      setTimeout(async () => {
        await loadData();
        setResetSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const hasData = dataInfo && (dataInfo.transcripts?.total > 0 || dataInfo.segments > 0);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">Configure your Prism installation</p>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="p-0.5 hover:bg-white/5 rounded"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="space-y-6">

        {/* ============ TRANSCRIPT WATCH FOLDER ============ */}
        <FolderConfig
          label="Transcript Folder"
          description="Prism watches this folder for new call recordings, transcripts, and documents. Supported formats: .txt, .md, .json, .srt, .pdf, .docx, .eml"
          icon={Folder}
          iconColor="bg-prism-blue/10 text-prism-blue"
          folder={watchFolder}
          onFolderChange={setWatchFolder}
          onSave={handleSaveWatch}
          loading={watchLoading}
          saved={watchSaved}
          health={health}
          folderExistsKey="watchFolderExists"
          fileCountKey="watchFolderFileCount"
          fileLabel="supported file"
          isElectron={isElectron}
          onBrowse={handleBrowseWatch}
        />

        {/* ============ EMAIL WATCH FOLDER ============ */}
        <FolderConfig
          label="Email Folder"
          description="Point this at a folder where your email client saves .eml files. Prism will automatically parse email content and extract all attachments (PDFs, contracts, proposals)."
          icon={Mail}
          iconColor="bg-purple-500/10 text-purple-400"
          folder={emailFolder}
          onFolderChange={setEmailFolder}
          onSave={handleSaveEmail}
          loading={emailLoading}
          saved={emailSaved}
          health={health}
          folderExistsKey="emailFolderExists"
          fileCountKey="emailFolderFileCount"
          fileLabel=".eml file"
          isElectron={isElectron}
          onBrowse={handleBrowseEmail}
        />

        {/* ============ DATA MANAGEMENT ============ */}
        <GlassCard variant="static" padding="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <HardDrive className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-medium text-white mb-1">Data Management</h3>
              <p className="text-sm text-zinc-400 mb-4">
                All ingested data is stored in a local SQLite database. This data persists across app restarts
                and is independent of the watch folders — once a file is ingested, the original is no longer needed.
              </p>

              {dataInfo ? (
                <div className="space-y-4">
                  {/* Database location + size */}
                  <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Database className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                        <span className="text-xs text-zinc-400 font-mono truncate" title={dataInfo.dbPath}>
                          {dataInfo.dbPath}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500 flex-shrink-0 ml-3">
                        {formatBytes(dataInfo.dbSizeBytes)}
                      </span>
                    </div>
                  </div>

                  {/* Data counts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <DataStat icon={FileText} label="Transcripts" value={dataInfo.transcripts?.files || 0} color="text-prism-blue" />
                    <DataStat icon={Mail} label="Emails" value={dataInfo.transcripts?.emails || 0} color="text-purple-400" />
                    <DataStat icon={Briefcase} label="Deals" value={dataInfo.deals || 0} color="text-sky-400" />
                    <DataStat icon={Users} label="People" value={dataInfo.people || 0} color="text-prism-pink" />
                  </div>

                  {/* Secondary stats row */}
                  <div className="grid grid-cols-3 gap-3">
                    <DataStat icon={Paperclip} label="Attachments" value={dataInfo.transcripts?.attachments || 0} color="text-amber-400" />
                    <DataStat icon={MessageSquare} label="Segments" value={dataInfo.segments || 0} color="text-emerald-400" />
                    <DataStat icon={MessageSquare} label="Queries" value={dataInfo.queries || 0} color="text-zinc-400" />
                  </div>

                  {/* Processing status + date range */}
                  {dataInfo.transcripts?.total > 0 && (
                    <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                      <span>
                        {dataInfo.transcripts.processed} of {dataInfo.transcripts.total} sources processed
                        {dataInfo.transcripts.unprocessed > 0 && (
                          <span className="text-amber-400 ml-1">
                            ({dataInfo.transcripts.unprocessed} pending)
                          </span>
                        )}
                      </span>
                      {dataInfo.dateRange?.earliest && (
                        <span>{formatDate(dataInfo.dateRange.earliest)} — {formatDate(dataInfo.dateRange.latest)}</span>
                      )}
                    </div>
                  )}

                  {/* Reset section */}
                  {hasData && (
                    <div className="pt-3 border-t border-white/5">
                      <AnimatePresence mode="wait">
                        {resetSuccess ? (
                          <motion.div
                            key="success"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-2 text-sm text-prism-blue"
                          >
                            <Check className="w-4 h-4" />
                            All data cleared. Files in watched folders will be re-ingested automatically.
                          </motion.div>
                        ) : showResetConfirm ? (
                          <motion.div
                            key="confirm"
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
                          >
                            <p className="text-sm text-red-300 mb-3">
                              This will permanently delete all transcripts, emails, segments, deals, people, and query history.
                              Source files in the watch folders will NOT be deleted and can be re-imported.
                            </p>
                            <div className="flex items-center gap-2">
                              <motion.button
                                onClick={handleReset}
                                disabled={resetLoading}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                              >
                                {resetLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Yes, delete all data
                              </motion.button>
                              <button
                                onClick={() => setShowResetConfirm(false)}
                                className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.button
                            key="trigger"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowResetConfirm(true)}
                            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Clear all data and start fresh
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-zinc-500">Loading data info...</div>
              )}
            </div>
          </div>
        </GlassCard>

        {/* ============ AI PROVIDER ============ */}
        <GlassCard variant="static" padding="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <Cpu className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-medium text-white mb-1">AI Provider</h3>
              <p className="text-sm text-zinc-400 mb-4">AI processing status and configuration.</p>

              {health ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-sm text-zinc-400">Status</span>
                    <span className={`text-sm flex items-center gap-2 ${health.aiEnabled ? 'text-prism-blue' : 'text-amber-400'}`}>
                      <span className={`w-2 h-2 rounded-full ${health.aiEnabled ? 'bg-prism-blue' : 'bg-amber-500'}`} />
                      {health.aiEnabled ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-sm text-zinc-400">Provider</span>
                    <span className="text-sm text-zinc-200">{health.aiProvider || 'None'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-zinc-400">Model</span>
                    <span className="text-sm text-zinc-200">{health.aiModel || 'N/A'}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-zinc-500">Loading AI status...</div>
              )}

              {!health?.aiEnabled && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-sm text-amber-400">AI features require Ollama to be installed and running.</p>
                  <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer"
                    className="text-sm text-prism-blue hover:underline flex items-center gap-1 mt-2">
                    Learn how to install Ollama <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        {/* ============ ABOUT ============ */}
        <GlassCard variant="static" padding="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#09090b] border border-white/10 flex items-center justify-center flex-shrink-0">
              <PrismLogo className="w-6 h-4" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-medium text-white mb-1">About Prism</h3>
              <p className="text-sm text-zinc-400 mb-4">Intelligence Engine for Sales Professionals</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-sm text-zinc-400">Version</span>
                  <span className="text-sm text-zinc-200">0.2.0</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-zinc-400">Environment</span>
                  <span className="text-sm text-zinc-200">{isElectron ? 'Desktop App' : 'Web'}</span>
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-4">
                Your personal AI-powered sales intelligence engine. Prism automatically
                analyzes your sales conversations and emails to surface insights, track
                deal progress, and build institutional memory.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
