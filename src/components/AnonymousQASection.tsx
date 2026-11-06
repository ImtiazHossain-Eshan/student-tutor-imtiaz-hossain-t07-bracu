import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnonymousQuestion } from '../types';
import {
  loadQuestions,
  submitAnonymousQuestion,
  answerQuestion,
  deleteQuestion,
  checkTutorPin,
  isTutorAuthenticated,
  setTutorAuthenticated,
} from '../services/qaService';

interface AnonymousQASectionProps {
  avatarUrl: string;
  triggerToast: (msg: string) => void;
}

export const AnonymousQASection: React.FC<AnonymousQASectionProps> = ({
  avatarUrl,
  triggerToast,
}) => {
  const [questions, setQuestions] = useState<AnonymousQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'pending'>('all');

  // Student Ask Modal State
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [askQuestion, setAskQuestion] = useState('');
  const [askCodeSnippet, setAskCodeSnippet] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tutor Mode State
  const [isTutorMode, setIsTutorMode] = useState<boolean>(() => isTutorAuthenticated());
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // Inline Answer State
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [isPublishingAnswer, setIsPublishingAnswer] = useState(false);

  // Load questions on mount
  useEffect(() => {
    let isMounted = true;
    const fetchQAs = async () => {
      try {
        const loaded = await loadQuestions();
        if (isMounted) {
          setQuestions(loaded);
          setIsLoading(false);
        }
      } catch {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchQAs();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Tutor PIN unlock
  const handleUnlockTutor = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkTutorPin(enteredPin)) {
      setTutorAuthenticated(true);
      setIsTutorMode(true);
      setIsPinModalOpen(false);
      setEnteredPin('');
      setPinError(false);
      triggerToast('Tutor Mode unlocked.');
    } else {
      setPinError(true);
    }
  };

  // Handle Exit Tutor Mode
  const handleExitTutorMode = () => {
    setTutorAuthenticated(false);
    setIsTutorMode(false);
    setAnsweringQuestionId(null);
    triggerToast('Exited Tutor Mode.');
  };

  // Handle Student Submit
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askQuestion.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await submitAnonymousQuestion(
        'General',
        askQuestion.trim(),
        askCodeSnippet.trim() || undefined
      );

      setQuestions((prev) => [created, ...prev]);
      setAskQuestion('');
      setAskCodeSnippet('');
      setIsAskModalOpen(false);
      triggerToast('Question posted anonymously.');
    } catch {
      triggerToast('Failed to post question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Tutor Publish Answer
  const handlePublishAnswer = async (questionId: string) => {
    if (!answerDraft.trim()) return;

    setIsPublishingAnswer(true);
    try {
      const updatedList = await answerQuestion(questionId, answerDraft.trim());
      setQuestions(updatedList);
      setAnsweringQuestionId(null);
      setAnswerDraft('');
      triggerToast('Answer published.');
    } catch {
      triggerToast('Failed to publish answer.');
    } finally {
      setIsPublishingAnswer(false);
    }
  };

  // Handle Tutor Delete
  const handleDelete = async (questionId: string) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      const updatedList = await deleteQuestion(questionId);
      setQuestions(updatedList);
      triggerToast('Question deleted.');
    } catch {
      triggerToast('Failed to delete question.');
    }
  };

  const filteredQuestions = questions.filter((q) => {
    if (filterTab === 'pending') return !q.isAnswered;
    return true;
  });

  const pendingCount = questions.filter((q) => !q.isAnswered).length;

  return (
    <section id="qa" className="scroll-mt-20 py-8 border-b-2 border-[var(--ink)] bg-[var(--paper)]">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-[var(--ink)]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--ink-2)]">
                Anonymous Student Q&amp;A
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-black uppercase text-[var(--ink)] tracking-tight">
              Course Questions &amp; Answers
            </h2>
            <p className="text-xs font-sans text-[var(--ink-2)] mt-0.5">
              Ask Java and lab questions anonymously. Answered directly by your Student Tutor (Imtiaz Hossain, T07).
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsAskModalOpen(true)}
              className="px-3.5 py-2 bg-[#1d49a7] hover:bg-[#163a86] dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-display font-black uppercase tracking-wider rounded-xs shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Ask Question</span>
            </button>

            {isTutorMode ? (
              <div className="flex items-center gap-1">
                <span className="px-2.5 py-1.5 bg-emerald-700 text-white text-[11px] font-mono font-bold uppercase rounded-xs">
                  Tutor Mode: On
                </span>
                <button
                  type="button"
                  onClick={handleExitTutorMode}
                  className="px-2 py-1.5 bg-[var(--paper-2)] hover:bg-[var(--ink)] text-[var(--ink)] hover:text-[var(--paper)] border border-[var(--ink)] text-[11px] font-mono font-bold rounded-xs transition-colors cursor-pointer"
                >
                  Exit
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPinError(false);
                  setIsPinModalOpen(true);
                }}
                className="px-2.5 py-2 bg-[var(--paper-2)] hover:bg-[var(--ink)]/5 text-[var(--ink-2)] hover:text-[var(--ink)] border border-[var(--ink)]/30 text-xs font-mono font-bold rounded-xs transition-colors flex items-center gap-1 cursor-pointer"
                title="Tutor answer login"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Tutor</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Minimal Filter Tabs ── */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1 rounded-xs transition-colors cursor-pointer font-bold ${
              filterTab === 'all'
                ? 'bg-[var(--ink)] text-[var(--paper)]'
                : 'bg-[var(--paper-2)] text-[var(--ink-2)] hover:text-[var(--ink)] border border-[var(--ink)]/20'
            }`}
          >
            All Questions ({questions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('pending')}
            className={`px-3 py-1 rounded-xs transition-colors cursor-pointer font-bold flex items-center gap-1.5 ${
              filterTab === 'pending'
                ? 'bg-amber-600 text-white'
                : 'bg-[var(--paper-2)] text-[var(--ink-2)] hover:text-[var(--ink)] border border-[var(--ink)]/20'
            }`}
          >
            <span>Unanswered</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-xs bg-amber-500 text-white text-[10px]">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Questions List ── */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="p-8 text-center text-xs font-mono text-[var(--ink-3)]">
              Loading questions...
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-[var(--ink)]/20 rounded-xs bg-[var(--paper-card)]">
              <p className="text-sm font-sans text-[var(--ink-2)]">
                {filterTab === 'pending'
                  ? 'All questions currently have answers.'
                  : 'No questions posted yet. Be the first to ask!'}
              </p>
              <button
                type="button"
                onClick={() => setIsAskModalOpen(true)}
                className="mt-3 px-3 py-1.5 bg-[#1d49a7] text-white text-xs font-display font-bold uppercase rounded-xs"
              >
                Ask a Question
              </button>
            </div>
          ) : (
            filteredQuestions.map((q) => (
              <div
                key={q.id}
                className="p-4 sm:p-5 border-2 border-[var(--ink)]/30 rounded-xs bg-[var(--paper-card)] space-y-3 shadow-2xs"
              >
                {/* Question Header & Prompt */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[var(--ink-3)]">
                    <span>Anonymous Student · {q.createdAt}</span>
                    {isTutorMode && (
                      <button
                        type="button"
                        onClick={() => handleDelete(q.id)}
                        className="text-red-500 hover:text-red-700 cursor-pointer font-mono text-[11px]"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <h3 className="font-sans font-bold text-sm sm:text-base text-[var(--ink)] leading-snug">
                    {q.question}
                  </h3>
                </div>

                {/* Optional Code Snippet */}
                {q.codeSnippet && (
                  <pre className="p-3 bg-[#0a101d] text-emerald-300 font-mono text-xs rounded-xs overflow-x-auto border border-white/10 leading-relaxed">
                    <code>{q.codeSnippet}</code>
                  </pre>
                )}

                {/* Tutor Answer Box */}
                {q.isAnswered && q.answer ? (
                  <div className="p-3.5 bg-[var(--paper-2)] border-l-3 border-[#1d49a7] rounded-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={avatarUrl}
                          alt="Imtiaz Hossain"
                          className="w-5 h-5 rounded-full object-cover border border-[#1d49a7]"
                        />
                        <span className="font-display font-black text-xs uppercase text-[var(--ink)]">
                          Imtiaz Hossain (T07)
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-xs bg-[#1d49a7] text-white">
                          Tutor
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-[var(--ink-3)]">
                        {q.answeredAt}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-sans text-[var(--ink)] whitespace-pre-line leading-relaxed">
                      {q.answer}
                    </p>

                    {isTutorMode && answeringQuestionId !== q.id && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setAnsweringQuestionId(q.id);
                            setAnswerDraft(q.answer || '');
                          }}
                          className="text-xs font-mono font-bold text-[#1d49a7] dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Edit Answer
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-1">
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-700 dark:text-amber-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span>Awaiting answer from Student Tutor</span>
                    </span>

                    {isTutorMode && answeringQuestionId !== q.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setAnsweringQuestionId(q.id);
                          setAnswerDraft('');
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold rounded-xs cursor-pointer"
                      >
                        Answer
                      </button>
                    )}
                  </div>
                )}

                {/* Inline Answer Editor (Tutor Mode Only) */}
                {isTutorMode && answeringQuestionId === q.id && (
                  <div className="pt-2 p-3 bg-[var(--paper-2)] border border-[var(--ink)]/30 rounded-xs space-y-2">
                    <label className="block text-xs font-mono font-bold text-[var(--ink)]">
                      Your Answer:
                    </label>
                    <textarea
                      rows={4}
                      value={answerDraft}
                      onChange={(e) => setAnswerDraft(e.target.value)}
                      placeholder="Type your explanation here..."
                      className="w-full p-2 bg-[var(--paper)] border border-[var(--ink)]/40 rounded-xs text-xs font-sans text-[var(--ink)] outline-hidden focus:border-[#1d49a7]"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isPublishingAnswer || !answerDraft.trim()}
                        onClick={() => handlePublishAnswer(q.id)}
                        className="px-3 py-1.5 bg-[#1d49a7] hover:bg-[#163a86] text-white text-xs font-display font-bold uppercase rounded-xs cursor-pointer disabled:opacity-50"
                      >
                        {isPublishingAnswer ? 'Saving...' : 'Post Answer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAnsweringQuestionId(null);
                          setAnswerDraft('');
                        }}
                        className="px-3 py-1.5 bg-[var(--paper)] text-[var(--ink-2)] hover:text-[var(--ink)] border border-[var(--ink)]/30 text-xs font-mono rounded-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

      </div>

      {/* ── Ask Question Modal ── */}
      <AnimatePresence>
        {isAskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[var(--paper-card)] border-2 border-[var(--ink)] rounded-xs shadow-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--ink)]/20">
                <div>
                  <h3 className="font-display font-black text-base uppercase text-[var(--ink)]">
                    Ask a Question
                  </h3>
                  <p className="text-xs font-mono text-[var(--ink-2)]">
                    100% Anonymous. No name or ID required.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAskModalOpen(false)}
                  className="text-[var(--ink-3)] hover:text-[var(--ink)] text-sm font-mono cursor-pointer"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleStudentSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-[var(--ink)] mb-1">
                    Your Question <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={askQuestion}
                    onChange={(e) => setAskQuestion(e.target.value)}
                    placeholder="e.g. Why does my for loop skip the last element in the array?"
                    className="w-full p-2.5 bg-[var(--paper)] border-2 border-[var(--ink)]/30 rounded-xs text-xs font-sans text-[var(--ink)] outline-hidden focus:border-[#1d49a7]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-[var(--ink)] mb-1">
                    Java Code or Error Snippet <span className="font-normal text-[var(--ink-3)]">(Optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={askCodeSnippet}
                    onChange={(e) => setAskCodeSnippet(e.target.value)}
                    placeholder="Paste relevant Java code or compiler error here..."
                    className="w-full p-2.5 bg-[var(--paper)] border border-[var(--ink)]/30 rounded-xs font-mono text-xs text-[var(--ink)] outline-hidden focus:border-[#1d49a7]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--ink)]/20">
                  <button
                    type="button"
                    onClick={() => setIsAskModalOpen(false)}
                    className="px-3 py-1.5 bg-[var(--paper-2)] border border-[var(--ink)]/30 text-[var(--ink-2)] hover:text-[var(--ink)] text-xs font-mono rounded-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !askQuestion.trim()}
                    className="px-4 py-1.5 bg-[#1d49a7] hover:bg-[#163a86] text-white text-xs font-display font-black uppercase tracking-wider rounded-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Posting...' : 'Submit Anonymously'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Tutor PIN Unlock Modal ── */}
      <AnimatePresence>
        {isPinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[var(--paper-card)] border-2 border-[var(--ink)] rounded-xs shadow-xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--ink)]/20">
                <h4 className="font-display font-black text-sm uppercase text-[var(--ink)]">
                  Tutor Unlock
                </h4>
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="text-xs font-mono text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleUnlockTutor} className="space-y-3">
                <div>
                  <label className="block text-xs font-mono text-[var(--ink-2)] mb-1">
                    Enter Passcode:
                  </label>
                  <input
                    type="password"
                    autoFocus
                    value={enteredPin}
                    onChange={(e) => {
                      setEnteredPin(e.target.value);
                      setPinError(false);
                    }}
                    placeholder="Enter PIN"
                    className="w-full p-2 bg-[var(--paper)] border-2 border-[var(--ink)]/40 rounded-xs font-mono text-sm text-[var(--ink)] outline-hidden focus:border-[#1d49a7]"
                  />
                  {pinError && (
                    <p className="text-[11px] font-mono text-red-500 mt-1">
                      Incorrect passcode.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsPinModalOpen(false)}
                    className="px-3 py-1.5 bg-[var(--paper-2)] border border-[var(--ink)]/30 text-xs font-mono rounded-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#1d49a7] text-white text-xs font-display font-bold uppercase rounded-xs cursor-pointer"
                  >
                    Unlock
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};
