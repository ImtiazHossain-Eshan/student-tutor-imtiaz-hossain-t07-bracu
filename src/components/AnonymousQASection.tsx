import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnonymousQuestion } from '../types';
import { QA_TOPIC_OPTIONS } from '../data/scheduleData';
import {
  loadQuestions,
  submitAnonymousQuestion,
  answerQuestion,
  deleteQuestion,
  upvoteQuestion,
  checkTutorPin,
  isTutorAuthenticated,
  setTutorAuthenticated,
  isCloudDbConfigured,
} from '../services/qaService';

interface AnonymousQASectionProps {
  avatarUrl: string;
  triggerToast: (msg: string) => void;
}

export const AnonymousQASection: React.FC<AnonymousQASectionProps> = ({
  avatarUrl,
  triggerToast,
}) => {
  // Questions State
  const [questions, setQuestions] = useState<AnonymousQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [selectedTopic, setSelectedTopic] = useState<string>('All Topics');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'answered' | 'pending'>('all');

  // Student Ask Modal State
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [askTopic, setAskTopic] = useState<string>('Module 6-7: Loops & Patterns');
  const [askQuestion, setAskQuestion] = useState('');
  const [askCodeSnippet, setAskCodeSnippet] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tutor Passcode & Mode State
  const [isTutorMode, setIsTutorMode] = useState<boolean>(() => isTutorAuthenticated());
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // Inline Answer Editor State
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
      triggerToast('Tutor Mode unlocked! You can now answer and edit questions.');
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
      const newQ = await submitAnonymousQuestion(askTopic, askQuestion, askCodeSnippet);
      setQuestions((prev) => [newQ, ...prev]);
      setIsAskModalOpen(false);
      setAskQuestion('');
      setAskCodeSnippet('');
      triggerToast('Question submitted anonymously! It will appear on the board.');
    } catch {
      triggerToast('Failed to submit question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Start Answering
  const handleStartAnswering = (q: AnonymousQuestion) => {
    setAnsweringQuestionId(q.id);
    setAnswerDraft(q.answer || '');
  };

  // Handle Submit Answer
  const handlePublishAnswer = async (questionId: string) => {
    if (!answerDraft.trim()) return;
    setIsPublishingAnswer(true);
    try {
      const updated = await answerQuestion(questionId, answerDraft);
      setQuestions(updated);
      setAnsweringQuestionId(null);
      setAnswerDraft('');
      triggerToast('Answer published successfully!');
    } catch {
      triggerToast('Failed to publish answer.');
    } finally {
      setIsPublishingAnswer(false);
    }
  };

  // Handle Delete Question
  const handleDeleteQuestion = async (questionId: string) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      const updated = await deleteQuestion(questionId);
      setQuestions(updated);
      triggerToast('Question deleted.');
    }
  };

  // Handle Upvote
  const handleUpvote = async (questionId: string) => {
    const updated = await upvoteQuestion(questionId);
    setQuestions(updated);
  };

  // Filtered Questions
  const filteredQuestions = questions.filter((q) => {
    // Topic filter
    if (selectedTopic !== 'All Topics' && q.topic !== selectedTopic) {
      return false;
    }
    // Status filter
    if (statusFilter === 'answered' && !q.isAnswered) return false;
    if (statusFilter === 'pending' && q.isAnswered) return false;

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchQ = q.question.toLowerCase().includes(query);
      const matchA = q.answer?.toLowerCase().includes(query) ?? false;
      const matchTopic = q.topic.toLowerCase().includes(query);
      const matchCode = q.codeSnippet?.toLowerCase().includes(query) ?? false;
      return matchQ || matchA || matchTopic || matchCode;
    }

    return true;
  });

  const totalAnsweredCount = questions.filter((q) => q.isAnswered).length;
  const totalPendingCount = questions.filter((q) => !q.isAnswered).length;

  return (
    <section id="qa" className="scroll-mt-20 py-10 sm:py-14 border-b-2 border-[var(--ink)] bg-[var(--paper)]">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Section Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b-2 border-[var(--ink)]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--ink-2)]">
                Interactive Course Community
              </span>
              <span className="text-xs font-mono text-[var(--ink-3)]">·</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-xs bg-[var(--blue)]/15 text-[var(--blue)] font-bold">
                100% ANONYMOUS
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-black uppercase text-[var(--ink)] tracking-tight">
              Anonymous Student Q&amp;A Board
            </h2>
            <p className="text-xs sm:text-sm font-sans text-[var(--ink-2)] max-w-2xl mt-1">
              Ask questions about Java syntax, loop logic, arrays, or lab evaluations without revealing your identity.
              All responses are answered directly by your Student Tutor.
            </p>
          </div>

          {/* Action Header Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Ask Anonymously CTA */}
            <button
              type="button"
              onClick={() => setIsAskModalOpen(true)}
              className="px-4 py-2.5 bg-[#1d49a7] hover:bg-[#163a86] dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-display font-black uppercase tracking-wider rounded-xs shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer border border-blue-400/30"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Ask Anonymously</span>
            </button>

            {/* Tutor Mode Status / Unlock Button */}
            {isTutorMode ? (
              <div className="flex items-center gap-1.5">
                <span className="px-3 py-2 bg-emerald-600 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                  <span>Tutor Mode: ACTIVE</span>
                </span>
                <button
                  type="button"
                  onClick={handleExitTutorMode}
                  className="px-2.5 py-2 bg-[var(--paper-2)] hover:bg-[var(--ink)] text-[var(--ink)] hover:text-[var(--paper)] border-2 border-[var(--ink)] text-xs font-display font-bold uppercase rounded-xs transition-colors cursor-pointer"
                  title="Lock Tutor Answer Mode"
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
                className="px-3 py-2 bg-[var(--paper-2)] hover:bg-[var(--ink)] text-[var(--ink)] hover:text-[var(--paper)] border-2 border-[var(--ink)]/40 hover:border-[var(--ink)] text-xs font-display font-bold uppercase tracking-wider rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Tutor authentication to answer questions"
              >
                <svg className="w-3.5 h-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Tutor Mode</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Controls Bar: Search & Status Filters ── */}
        <div className="py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-[var(--ink)]/20">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-3)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search questions, Java errors, loops, arrays..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[var(--paper-card)] border-2 border-[var(--ink)]/30 focus:border-[var(--blue)] rounded-xs font-sans text-xs text-[var(--ink)] outline-hidden transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
              >
                CLEAR
              </button>
            )}
          </div>

          {/* Status View Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-[var(--paper-2)] border border-[var(--ink)]/30 rounded-xs self-start md:self-auto text-xs font-mono font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-xs transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[var(--ink)] text-[var(--paper)]'
                  : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              All ({questions.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('answered')}
              className={`px-2.5 py-1 rounded-xs transition-colors cursor-pointer flex items-center gap-1 ${
                statusFilter === 'answered'
                  ? 'bg-emerald-600 text-white'
                  : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              <span>Answered</span>
              <span className="opacity-80">({totalAnsweredCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-xs transition-colors cursor-pointer flex items-center gap-1 ${
                statusFilter === 'pending'
                  ? 'bg-amber-600 text-white'
                  : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              <span>Awaiting Answer</span>
              <span className="opacity-80">({totalPendingCount})</span>
            </button>
          </div>
        </div>

        {/* ── Topic Filter Chips ── */}
        <div className="py-3 flex items-center gap-1.5 overflow-x-auto pb-3 text-xs scrollbar-none">
          <span className="text-[10px] font-mono uppercase font-bold text-[var(--ink-3)] shrink-0 mr-1">
            Topic Filter:
          </span>
          {QA_TOPIC_OPTIONS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setSelectedTopic(topic)}
              className={`px-2.5 py-1 rounded-xs font-mono text-[11px] whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                selectedTopic === topic
                  ? 'bg-[#1d49a7] text-white border border-[#163a86] font-bold shadow-xs'
                  : 'bg-[var(--paper-card)] hover:bg-[var(--ink)]/5 text-[var(--ink)] border border-[var(--ink)]/25'
              }`}
            >
              {topic}
            </button>
          ))}
        </div>

        {/* ── Questions Feed ── */}
        <div className="mt-4 space-y-4">
          {isLoading ? (
            <div className="p-12 text-center font-mono text-xs text-[var(--ink-3)] border-2 border-dashed border-[var(--ink)]/20 rounded-xs">
              Loading anonymous questions...
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-[var(--ink)]/30 rounded-xs bg-[var(--paper-card)]">
              <svg className="w-8 h-8 text-[var(--ink-3)] mx-auto mb-2 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              <div className="font-display font-black text-sm uppercase text-[var(--ink)]">
                No questions found in this filter
              </div>
              <p className="text-xs font-sans text-[var(--ink-2)] mt-1 max-w-sm mx-auto">
                Be the first to ask an anonymous question on this topic. No login or credentials needed.
              </p>
              <button
                type="button"
                onClick={() => setIsAskModalOpen(true)}
                className="mt-3 px-4 py-2 bg-[#1d49a7] text-white text-xs font-display font-black uppercase rounded-xs transition-transform active:scale-95 cursor-pointer shadow-sm"
              >
                Ask a Question Now
              </button>
            </div>
          ) : (
            filteredQuestions.map((q) => (
              <div
                key={q.id}
                className="border-2 border-[var(--ink)]/40 hover:border-[var(--ink)] bg-[var(--paper-card)] rounded-xs shadow-xs transition-colors overflow-hidden"
              >
                {/* Question Card Top Bar */}
                <div className="px-4 py-3 bg-[var(--paper-2)] border-b border-[var(--ink)]/20 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase tracking-wider bg-[var(--blue)] text-white">
                      {q.topic}
                    </span>
                    <span className="text-[11px] font-mono text-[var(--ink-3)]">
                      Submitted {q.createdAt}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--ink-3)]">· Anonymous Student</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Upvote Button */}
                    <button
                      type="button"
                      onClick={() => handleUpvote(q.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[var(--paper)] hover:bg-[var(--ink)]/10 text-[var(--ink)] border border-[var(--ink)]/30 text-[11px] font-mono font-bold transition-all active:scale-95 cursor-pointer"
                      title="Mark as helpful"
                    >
                      <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a2 2 0 00-.8 1.4z" />
                      </svg>
                      <span>Helpful ({q.upvotes})</span>
                    </button>

                    {/* Tutor Delete Button (Tutor Mode Only) */}
                    {isTutorMode && (
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="px-2 py-1 rounded-xs bg-red-100 hover:bg-red-200 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer"
                        title="Delete question (Tutor only)"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Question Body */}
                <div className="p-4 sm:p-5">
                  <div className="font-sans font-bold text-sm text-[var(--ink)] leading-snug">
                    {q.question}
                  </div>

                  {/* Optional Student Code Snippet */}
                  {q.codeSnippet && (
                    <div className="mt-3">
                      <div className="text-[10px] font-mono text-[var(--ink-3)] uppercase font-bold mb-1">
                        Provided Java Code / Error Traceback:
                      </div>
                      <pre className="p-3 bg-[#0a101d] text-[#e2e8f0] rounded-xs font-mono text-xs overflow-x-auto leading-relaxed border border-white/20 selection:bg-blue-600 selection:text-white">
                        {q.codeSnippet}
                      </pre>
                    </div>
                  )}

                  {/* ── Tutor Answer Section ── */}
                  <div className="mt-4 pt-4 border-t border-[var(--ink)]/20">
                    {q.isAnswered ? (
                      <div className="bg-[var(--paper-2)]/70 dark:bg-[#0c162b] border-2 border-[var(--blue)]/60 rounded-xs p-4 sm:p-5 relative">
                        {/* Tutor Header */}
                        <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-[var(--ink)]/15">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-[#bf953f] via-[#fcf6ba] to-[#aa771c] shadow-xs shrink-0">
                              <img
                                src={avatarUrl}
                                alt="Imtiaz Hossain"
                                className="w-full h-full rounded-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-display font-black text-xs uppercase text-[var(--ink)]">
                                  ST_Imtiaz_T07
                                </span>
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-xs bg-emerald-600 text-white">
                                  VERIFIED TUTOR
                                </span>
                              </div>
                              <div className="text-[10px] font-mono text-[var(--ink-3)]">
                                Answered {q.answeredAt || 'Recently'} · CSE110 Section 07
                              </div>
                            </div>
                          </div>

                          {/* Edit Answer Button (Tutor Mode Only) */}
                          {isTutorMode && answeringQuestionId !== q.id && (
                            <button
                              type="button"
                              onClick={() => handleStartAnswering(q)}
                              className="px-2.5 py-1 bg-[var(--paper)] hover:bg-[var(--ink)] text-[var(--ink)] hover:text-[var(--paper)] border border-[var(--ink)]/40 text-[11px] font-mono font-bold rounded-xs transition-colors cursor-pointer"
                            >
                              Edit Answer
                            </button>
                          )}
                        </div>

                        {/* Answer Text Content */}
                        {answeringQuestionId === q.id ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              rows={5}
                              value={answerDraft}
                              onChange={(e) => setAnswerDraft(e.target.value)}
                              className="w-full p-3 bg-[var(--paper)] border-2 border-[var(--blue)] rounded-xs font-mono text-xs text-[var(--ink)] outline-hidden leading-relaxed"
                              placeholder="Write your explanation or code solution..."
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setAnsweringQuestionId(null)}
                                className="px-3 py-1.5 bg-[var(--paper)] border border-[var(--ink)] text-xs font-display font-bold uppercase rounded-xs cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePublishAnswer(q.id)}
                                disabled={isPublishingAnswer}
                                className="px-4 py-1.5 bg-[var(--blue)] text-white text-xs font-display font-black uppercase rounded-xs shadow-xs cursor-pointer active:scale-95"
                              >
                                {isPublishingAnswer ? 'Saving...' : 'Update Answer'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="font-sans text-xs sm:text-[13px] text-[var(--ink)] leading-relaxed whitespace-pre-line">
                            {q.answer}
                          </div>
                        )}
                      </div>
                    ) : (
                      // Unanswered state
                      <div>
                        {answeringQuestionId === q.id ? (
                          <div className="bg-[var(--paper-2)] border-2 border-[var(--blue)] rounded-xs p-4 space-y-3">
                            <div className="text-xs font-mono font-bold uppercase text-[var(--blue)]">
                              Write Tutor Response for ST_Imtiaz_T07:
                            </div>
                            <textarea
                              rows={5}
                              value={answerDraft}
                              onChange={(e) => setAnswerDraft(e.target.value)}
                              className="w-full p-3 bg-[var(--paper)] border-2 border-[var(--ink)]/40 focus:border-[var(--blue)] rounded-xs font-mono text-xs text-[var(--ink)] outline-hidden leading-relaxed"
                              placeholder="Write clear explanation, troubleshooting steps, and Java code snippets..."
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setAnsweringQuestionId(null)}
                                className="px-3 py-1.5 bg-[var(--paper)] border border-[var(--ink)] text-xs font-display font-bold uppercase rounded-xs cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePublishAnswer(q.id)}
                                disabled={isPublishingAnswer}
                                className="px-4 py-1.5 bg-[#1d49a7] hover:bg-[#163a86] text-white text-xs font-display font-black uppercase rounded-xs shadow-md cursor-pointer active:scale-95"
                              >
                                {isPublishingAnswer ? 'Publishing...' : 'Publish Answer'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[var(--paper-2)]/50 rounded-xs border border-dashed border-[var(--ink)]/30">
                            <div className="flex items-center gap-2 text-xs font-mono text-[var(--ink-2)]">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              <span>Awaiting Tutor Response · Typically answered within consultation hours</span>
                            </div>

                            {/* Answer This Question button if Tutor Mode is active */}
                            {isTutorMode && (
                              <button
                                type="button"
                                onClick={() => handleStartAnswering(q)}
                                className="px-3 py-1.5 bg-[#1d49a7] hover:bg-[#163a86] text-white text-xs font-display font-black uppercase rounded-xs transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
                              >
                                Answer This Question
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* ── Student "Ask Anonymously" Modal ── */}
      <AnimatePresence>
        {isAskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAskModalOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-2xl bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] rounded-xs shadow-2xl overflow-hidden z-10 flex flex-col my-auto"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b-2 border-[var(--ink)] bg-[var(--paper-2)] flex items-start justify-between gap-4 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs bg-emerald-600 text-white">
                      100% ANONYMOUS
                    </span>
                    <span className="text-xs font-mono font-bold text-[var(--ink-2)]">
                      CSE110 Section 07
                    </span>
                  </div>
                  <h3 className="text-xl font-display font-black uppercase text-[var(--ink)] tracking-tight mt-1">
                    Ask a Question Anonymously
                  </h3>
                  <p className="text-xs font-mono text-[var(--ink-2)] mt-0.5">
                    No name, ID, or IP address is tracked. Your question will be answered and posted to the board.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAskModalOpen(false)}
                  className="w-8 h-8 rounded-xs border-2 border-[var(--ink)] bg-[var(--paper)] hover:bg-[var(--ink)] hover:text-[var(--paper)] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  aria-label="Close modal"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleStudentSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
                {/* Topic Selection */}
                <div>
                  <label className="block font-mono font-bold uppercase text-[11px] text-[var(--ink)] mb-1">
                    Select Topic / Syllabus Module *
                  </label>
                  <select
                    value={askTopic}
                    onChange={(e) => setAskTopic(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--paper-2)] border-2 border-[var(--ink)]/40 focus:border-[var(--blue)] rounded-xs font-mono text-xs text-[var(--ink)] outline-hidden"
                  >
                    {QA_TOPIC_OPTIONS.filter((t) => t !== 'All Topics').map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Question Text */}
                <div>
                  <label className="block font-mono font-bold uppercase text-[11px] text-[var(--ink)] mb-1">
                    Your Question *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe what you find confusing, syntax issues, loop bounds, lab exam doubts..."
                    value={askQuestion}
                    onChange={(e) => setAskQuestion(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--paper-2)] border-2 border-[var(--ink)]/40 focus:border-[var(--blue)] rounded-xs font-sans text-xs text-[var(--ink)] outline-hidden transition-colors"
                  />
                </div>

                {/* Optional Code Snippet */}
                <div>
                  <label className="block font-mono font-bold uppercase text-[11px] text-[var(--ink)] mb-1">
                    Optional: Java Code Snippet or Error Traceback
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Paste relevant Java lines or terminal error message here..."
                    value={askCodeSnippet}
                    onChange={(e) => setAskCodeSnippet(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a101d] text-[#e2e8f0] border-2 border-[var(--ink)]/40 focus:border-[var(--blue)] rounded-xs font-mono text-xs outline-hidden transition-colors"
                  />
                </div>

                {/* Modal Footer Actions */}
                <div className="pt-3 border-t border-[var(--ink)]/20 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAskModalOpen(false)}
                    className="px-4 py-2 bg-[var(--paper-2)] border-2 border-[var(--ink)] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--paper)] text-xs font-display font-bold uppercase tracking-wider rounded-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !askQuestion.trim()}
                    className="px-5 py-2 bg-[#1d49a7] hover:bg-[#163a86] disabled:opacity-50 text-white text-xs font-display font-black uppercase tracking-wider rounded-xs shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Anonymously'}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPinModalOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-[var(--paper)] border-2 border-[var(--ink)] rounded-xs shadow-2xl p-6 z-10"
            >
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-[var(--blue)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <h4 className="font-display font-black text-sm uppercase text-[var(--ink)]">
                  Unlock Tutor Answer Mode
                </h4>
              </div>
              <p className="text-xs font-sans text-[var(--ink-2)] mb-4 leading-relaxed">
                Enter your Tutor Passcode or Student ID to answer questions directly on the site.
              </p>

              <form onSubmit={handleUnlockTutor} className="space-y-3">
                <input
                  type="password"
                  autoFocus
                  placeholder="Enter Tutor Passcode"
                  value={enteredPin}
                  onChange={(e) => {
                    setEnteredPin(e.target.value);
                    setPinError(false);
                  }}
                  className={`w-full px-3 py-2 bg-[var(--paper-2)] border-2 rounded-xs font-mono text-sm text-[var(--ink)] outline-hidden transition-colors ${
                    pinError ? 'border-red-500' : 'border-[var(--ink)]/40 focus:border-[var(--blue)]'
                  }`}
                />
                {pinError && (
                  <p className="text-[11px] font-mono text-red-600 font-bold">
                    Incorrect Passcode. Try your Student ID (23101137) or T07.
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPinModalOpen(false)}
                    className="px-3 py-1.5 bg-[var(--paper-2)] border border-[var(--ink)]/40 text-[var(--ink)] text-xs font-display font-bold uppercase rounded-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#1d49a7] hover:bg-[#163a86] text-white text-xs font-display font-black uppercase rounded-xs shadow-xs cursor-pointer"
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
