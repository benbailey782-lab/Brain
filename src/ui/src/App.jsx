import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import TranscriptList from './components/TranscriptList';
import TranscriptDetail from './components/TranscriptDetail';
import SegmentBrowser from './components/SegmentBrowser';
import StatsPanel from './components/StatsPanel';
import DealList from './components/DealList';
import DealDetail from './components/DealDetail';
import PeopleList from './components/PeopleList';
import PersonDetail from './components/PersonDetail';
import ProspectList from './components/prospects/ProspectList';
import ProspectDetail from './components/prospects/ProspectDetail';
import InsightsDashboard from './components/insights/InsightsDashboard';
import AskPanel from './components/AskPanel';
import CaptureModal from './components/CaptureModal';
import Settings from './components/Settings';
import SetupWizard from './components/SetupWizard';

// Page transition wrapper
function PageWrapper({ children, viewKey }) {
  return (
    <motion.div
      key={viewKey}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

function App() {
  const [activeView, setActiveView] = useState('ask');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [setupComplete, setSetupComplete] = useState(true); // default true for web
  const [captureModalOpen, setCaptureModalOpen] = useState(false);

  useEffect(() => {
    // Check API health
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(err => setError('Cannot connect to server. Is it running?'));
  }, []);

  useEffect(() => {
    // Check setup status in Electron
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
      window.electronAPI.getConfig().then(config => {
        if (config && !config.setupComplete) {
          setSetupComplete(false);
        }
      }).catch(() => {});
    }
  }, []);

  const handleSelectItem = (item) => {
    setSelectedItem(item);
  };

  const handleBack = () => {
    setSelectedItem(null);
  };

  const handleNavigate = (viewId) => {
    setActiveView(viewId);
    setSelectedItem(null);
  };

  // Generate a unique key for the current view state
  const getViewKey = () => {
    if (selectedItem) {
      return `${activeView}-detail-${selectedItem.id || 'item'}`;
    }
    return activeView;
  };

  const renderContent = () => {
    // Handle detail views when an item is selected
    if (selectedItem) {
      switch (activeView) {
        case 'transcripts':
          return (
            <TranscriptDetail
              transcript={selectedItem}
              onBack={handleBack}
            />
          );
        case 'deals':
          return (
            <DealDetail
              deal={selectedItem}
              onBack={handleBack}
              onNavigateToPerson={(person) => {
                setActiveView('people');
                setSelectedItem(person);
              }}
            />
          );
        case 'people':
          return (
            <PersonDetail
              person={selectedItem}
              onBack={handleBack}
              onNavigateToDeal={(deal) => {
                setActiveView('deals');
                setSelectedItem(deal);
              }}
            />
          );
        case 'prospects':
          return (
            <ProspectDetail
              prospect={selectedItem}
              onBack={handleBack}
              onConvertToDeal={(deal) => {
                setActiveView('deals');
                setSelectedItem(deal);
              }}
            />
          );
        default:
          break;
      }
    }

    // Main list/panel views
    switch (activeView) {
      case 'ask':
        return <AskPanel onOpenCapture={() => setCaptureModalOpen(true)} />;
      case 'insights':
        return <InsightsDashboard />;
      case 'prospects':
        return <ProspectList onSelect={handleSelectItem} />;
      case 'deals':
        return <DealList onSelect={handleSelectItem} />;
      case 'people':
        return <PeopleList onSelect={handleSelectItem} />;
      case 'knowledge':
        return <SegmentBrowser />;
      case 'transcripts':
        return <TranscriptList onSelect={handleSelectItem} />;
      case 'stats':
        return <StatsPanel />;
      case 'settings':
        return <Settings />;
      default:
        return <AskPanel />;
    }
  };

  // Show setup wizard on first run (Electron only)
  if (!setupComplete) {
    return <SetupWizard onComplete={() => setSetupComplete(true)} />;
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface-0)' }}>
      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        health={health}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <Header
          health={health}
          activeView={activeView}
          showBack={!!selectedItem}
          onBack={handleBack}
        />

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-500/10 border-b border-red-500/20 px-6 py-3"
            >
              <div className="flex items-center gap-3 text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Disabled Banner */}
        <AnimatePresence>
          {health && !health.aiEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3"
            >
              <div className="flex items-center gap-3 text-amber-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">
                  AI features require Ollama to be installed and running.{' '}
                  <a
                    href="https://ollama.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-prism-blue hover:underline"
                  >
                    Learn more →
                  </a>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content with page transitions */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <AnimatePresence mode="wait">
              <PageWrapper viewKey={getViewKey()}>
                {renderContent()}
              </PageWrapper>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Floating Capture Button */}
      <CaptureModal activeView={activeView} isOpen={captureModalOpen} onOpenChange={setCaptureModalOpen} />
    </div>
  );
}

export default App;
