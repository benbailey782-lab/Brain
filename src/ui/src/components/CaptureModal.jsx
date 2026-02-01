import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  X,
  Upload,
  FileText,
  ClipboardPaste,
  FileUp,
  Loader2,
  Check,
  AlertCircle,
  Mic,
  MicOff,
  Square,
  Pencil
} from 'lucide-react';

/**
 * CaptureModal - Floating action button with multi-input capture modal
 * Phase 4.2: Added Voice Memo tab
 */
export default function CaptureModal({ activeView, isOpen: externalOpen, onOpenChange }) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Use external control if provided, otherwise internal
  const isOpen = onOpenChange ? externalOpen : internalOpen;
  const setIsOpen = onOpenChange ? onOpenChange : setInternalOpen;
  const [activeTab, setActiveTab] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);

  // Upload file state
  const [dragOver, setDragOver] = useState(false);

  // Quick note state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteContext, setNoteContext] = useState('Sales Call Notes');

  // Paste transcript state
  const [pasteContent, setPasteContent] = useState('');
  const [pasteFilename, setPasteFilename] = useState('');

  // Voice memo state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceTimer, setVoiceTimer] = useState(0);
  const [voiceError, setVoiceError] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  // Check speech support on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  const resetState = () => {
    setUploading(false);
    setUploadResult(null);
    setError(null);
    setDragOver(false);
    setNoteTitle('');
    setNoteContent('');
    setNoteContext('Sales Call Notes');
    setPasteContent('');
    setPasteFilename('');
    setVoiceTranscript('');
    setVoiceTimer(0);
    setVoiceError(null);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    clearInterval(timerRef.current);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(resetState, 300);
  };

  // File upload handler
  const handleFileUpload = useCallback(async (file) => {
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }, []);

  // Drag and drop handlers
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  // Quick note submit
  const handleNoteSubmit = async () => {
    if (!noteContent.trim()) return;

    setUploading(true);
    setError(null);

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteTitle,
          content: noteContent,
          context: noteContext
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save note');
      }

      setUploadResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Paste transcript submit
  const handlePasteSubmit = async () => {
    if (!pasteContent.trim()) return;

    setUploading(true);
    setError(null);

    try {
      const response = await fetch('/api/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: pasteContent,
          filename: pasteFilename || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save transcript');
      }

      setUploadResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Voice recording functions
  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let fullTranscript = '';

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          fullTranscript += event.results[i][0].transcript + ' ';
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        setVoiceError('No speech detected. Please try again.');
      } else if (event.error === 'audio-capture') {
        setVoiceError('No microphone found. Check your audio settings.');
      } else if (event.error === 'not-allowed') {
        setVoiceError('Microphone access denied. Allow mic access in system settings.');
      } else {
        setVoiceError(`Recognition error: ${event.error}`);
      }
      stopRecording();
    };

    recognition.onend = () => {
      // Web Speech API can auto-stop (e.g., after extended silence).
      // Save whatever we collected.
      setVoiceTranscript(fullTranscript.trim());
      setIsRecording(false);
      clearInterval(timerRef.current);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setVoiceTranscript('');
    setVoiceError(null);
    setVoiceTimer(0);

    // Start counting timer
    timerRef.current = setInterval(() => {
      setVoiceTimer(prev => {
        if (prev >= 299) {
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      // onend handler will fire and set transcript + isRecording
    }
    clearInterval(timerRef.current);
  }, []);

  const handleVoiceMemoSubmit = async () => {
    if (!voiceTranscript.trim()) return;

    setUploading(true);
    setError(null);

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Voice Memo - ${new Date().toLocaleString()}`,
          content: voiceTranscript.trim(),
          context: 'Voice Memo'
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save voice memo');
      setUploadResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const tabs = [
    { id: 'upload', label: 'Upload File', icon: Upload },
    { id: 'voice', label: 'Voice Memo', icon: Mic },
    { id: 'note', label: 'Quick Note', icon: FileText },
    { id: 'paste', label: 'Paste Transcript', icon: ClipboardPaste }
  ];

  return (
    <>
      {/* FAB Button - hidden on Ask view */}
      {activeView !== 'ask' && (
        <motion.button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full animated-gradient text-white shadow-lg flex items-center justify-center"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="glass-card-elevated w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <div>
                  <h2 className="text-xl font-semibold text-white">Add Content</h2>
                  <p className="text-sm text-zinc-400 mt-1">Upload files, notes, or paste transcripts</p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Success State */}
              {uploadResult && (
                <div className="p-6">
                  <div className="text-center py-8">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="w-16 h-16 rounded-full bg-prism-blue/10 glow-prism mx-auto mb-4 flex items-center justify-center"
                    >
                      <Check className="w-8 h-8 text-prism-blue" />
                    </motion.div>
                    <h3 className="text-lg font-medium text-white mb-2">
                      {uploadResult.message || 'Content Added'}
                    </h3>
                    <p className="text-sm text-zinc-400">
                      {uploadResult.filename && `File: ${uploadResult.filename}`}
                    </p>
                    {uploadResult.processingStatus === 'processing' && (
                      <p className="text-sm text-prism-blue mt-2">
                        Processing started...
                      </p>
                    )}
                    <button
                      onClick={handleClose}
                      className="mt-6 px-6 py-2 rounded-xl bg-prism-500 hover:bg-prism-600 text-white transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && !uploadResult && (
                <div className="p-6">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-400">{error}</p>
                      <button
                        onClick={() => setError(null)}
                        className="text-xs text-zinc-400 hover:text-white mt-2"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Content */}
              {!uploadResult && !error && (
                <>
                  {/* Tabs */}
                  <div className="flex border-b border-white/5 px-6">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                          flex items-center gap-2 px-4 py-3 text-sm font-medium
                          border-b-2 transition-colors
                          ${activeTab === tab.id
                            ? 'border-prism-blue text-prism-blue'
                            : 'border-transparent text-zinc-400 hover:text-zinc-200'}
                        `}
                      >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {/* Upload Tab */}
                    {activeTab === 'upload' && (
                      <div
                        className={`
                          drop-zone rounded-xl p-8 text-center
                          ${dragOver ? 'drag-over' : ''}
                        `}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                      >
                        {uploading ? (
                          <div className="py-8">
                            <Loader2 className="w-12 h-12 text-prism-blue mx-auto mb-4 animate-spin" />
                            <p className="text-zinc-400">Processing file...</p>
                          </div>
                        ) : (
                          <>
                            <FileUp className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">
                              Drop files here or click to upload
                            </h3>
                            <p className="text-sm text-zinc-500 mb-4">
                              Supports PDF, DOCX, TXT, SRT, MD files up to 10MB
                            </p>
                            <input
                              type="file"
                              accept=".pdf,.docx,.txt,.md,.json,.csv,.srt"
                              onChange={(e) => handleFileUpload(e.target.files[0])}
                              className="hidden"
                              id="file-upload"
                            />
                            <label
                              htmlFor="file-upload"
                              className="inline-block px-6 py-2 rounded-xl bg-prism-500 hover:bg-prism-600 text-white cursor-pointer transition-colors"
                            >
                              Choose File
                            </label>
                          </>
                        )}
                      </div>
                    )}

                    {/* Voice Memo Tab */}
                    {activeTab === 'voice' && (
                      <div className="space-y-4">
                        {!speechSupported ? (
                          /* Unsupported browser fallback */
                          <div className="text-center py-8">
                            <MicOff className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
                            <p className="text-zinc-400">Speech recognition is not available</p>
                            <p className="text-xs text-zinc-500 mt-2">Try using the Quick Note tab instead</p>
                          </div>
                        ) : !voiceTranscript && !isRecording ? (
                          /* Ready state — large mic button */
                          <div className="text-center py-8">
                            <motion.button
                              onClick={startRecording}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="w-24 h-24 rounded-full bg-prism-500/10 border-2 border-prism-500/30 mx-auto mb-4 flex items-center justify-center hover:bg-prism-500/20 transition-colors"
                            >
                              <Mic className="w-10 h-10 text-prism-blue" />
                            </motion.button>
                            <p className="text-zinc-300 font-medium">Tap to start recording</p>
                            <p className="text-xs text-zinc-500 mt-2">
                              Up to 5 minutes - Audio is not saved, only the transcript
                            </p>
                            {voiceError && (
                              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                <p className="text-sm text-red-400">{voiceError}</p>
                              </div>
                            )}
                          </div>
                        ) : isRecording ? (
                          /* Recording state — pulsing stop button + timer */
                          <div className="text-center py-8">
                            <motion.button
                              onClick={stopRecording}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500/40 mx-auto mb-4 flex items-center justify-center"
                            >
                              <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                              >
                                <Square className="w-8 h-8 text-red-400 fill-red-400" />
                              </motion.div>
                            </motion.button>
                            <p className="text-red-400 font-medium">Recording...</p>
                            <p className="text-2xl font-mono text-white mt-2">
                              {formatTimer(voiceTimer)}
                            </p>
                            <p className="text-xs text-zinc-500 mt-2">Tap the square to stop</p>
                          </div>
                        ) : (
                          /* Review/edit state — editable transcript */
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm text-zinc-400">
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Review and edit your transcript before saving</span>
                            </div>
                            <textarea
                              value={voiceTranscript}
                              onChange={(e) => setVoiceTranscript(e.target.value)}
                              rows={8}
                              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:border-prism-blue focus:outline-none transition-colors resize-none"
                            />
                            <div className="flex gap-3">
                              <button
                                onClick={() => {
                                  setVoiceTranscript('');
                                  setVoiceTimer(0);
                                }}
                                className="flex-1 px-4 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                              >
                                Re-record
                              </button>
                              <button
                                onClick={handleVoiceMemoSubmit}
                                disabled={!voiceTranscript.trim() || uploading}
                                className="flex-1 px-6 py-3 rounded-xl bg-prism-500 hover:bg-prism-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center justify-center gap-2"
                              >
                                {uploading ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  'Save Voice Memo'
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quick Note Tab */}
                    {activeTab === 'note' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-zinc-400 mb-2">Title (optional)</label>
                          <input
                            type="text"
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                            placeholder="Meeting notes, call summary..."
                            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:border-prism-blue focus:outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-zinc-400 mb-2">Context</label>
                          <select
                            value={noteContext}
                            onChange={(e) => setNoteContext(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:border-prism-blue focus:outline-none transition-colors"
                          >
                            <option value="Sales Call Notes">Sales Call Notes</option>
                            <option value="Meeting Notes">Meeting Notes</option>
                            <option value="Research">Research</option>
                            <option value="Personal Reminder">Personal Reminder</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-zinc-400 mb-2">Content</label>
                          <textarea
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            placeholder="Write your notes here..."
                            rows={8}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:border-prism-blue focus:outline-none transition-colors resize-none"
                          />
                        </div>
                        <button
                          onClick={handleNoteSubmit}
                          disabled={!noteContent.trim() || uploading}
                          className="w-full px-6 py-3 rounded-xl bg-prism-500 hover:bg-prism-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save Note'
                          )}
                        </button>
                      </div>
                    )}

                    {/* Paste Transcript Tab */}
                    {activeTab === 'paste' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-zinc-400 mb-2">Filename (optional)</label>
                          <input
                            type="text"
                            value={pasteFilename}
                            onChange={(e) => setPasteFilename(e.target.value)}
                            placeholder="call-notes-jan-15.txt"
                            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:border-prism-blue focus:outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-zinc-400 mb-2">Transcript Content</label>
                          <textarea
                            value={pasteContent}
                            onChange={(e) => setPasteContent(e.target.value)}
                            placeholder="Paste your transcript here..."
                            rows={12}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:border-prism-blue focus:outline-none transition-colors resize-none font-mono text-sm"
                          />
                        </div>
                        <button
                          onClick={handlePasteSubmit}
                          disabled={!pasteContent.trim() || uploading}
                          className="w-full px-6 py-3 rounded-xl bg-prism-500 hover:bg-prism-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save Transcript'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
