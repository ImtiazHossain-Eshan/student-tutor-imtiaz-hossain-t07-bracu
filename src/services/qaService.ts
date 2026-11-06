import { AnonymousQuestion } from '../types';
import { INITIAL_ANONYMOUS_QUESTIONS } from '../data/scheduleData';

const LOCAL_STORAGE_KEY = 'st_anonymous_questions_v1';
const TUTOR_AUTH_SESSION_KEY = 'st_tutor_authorized_v1';

// Supported tutor PINs (Student ID, Initial, default passkey)
const VALID_TUTOR_PINS = ['23101137', 'T07', 't07', '7070'];

// Optional Supabase Configuration (from environment if configured)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isCloudDbConfigured = (): boolean => {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
};

export const checkTutorPin = (pin: string): boolean => {
  const trimmed = pin.trim();
  const customPin = localStorage.getItem('st_custom_tutor_pin');
  if (customPin && trimmed === customPin) {
    return true;
  }
  return VALID_TUTOR_PINS.includes(trimmed);
};

export const isTutorAuthenticated = (): boolean => {
  return sessionStorage.getItem(TUTOR_AUTH_SESSION_KEY) === 'true';
};

export const setTutorAuthenticated = (authenticated: boolean): void => {
  if (authenticated) {
    sessionStorage.setItem(TUTOR_AUTH_SESSION_KEY, 'true');
  } else {
    sessionStorage.removeItem(TUTOR_AUTH_SESSION_KEY);
  }
};

export const loadQuestions = async (): Promise<AnonymousQuestion[]> => {
  // If Supabase is configured, attempt fetch from cloud
  if (isCloudDbConfigured()) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/anonymous_questions?select=*&order=created_at.desc`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      if (res.ok) {
        const cloudData: AnonymousQuestion[] = await res.json();
        if (Array.isArray(cloudData) && cloudData.length > 0) {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cloudData));
          return cloudData;
        }
      }
    } catch {
      // Fallback silently to local cache
    }
  }

  // Local fallback
  const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (cached) {
    try {
      const parsed: AnonymousQuestion[] = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // JSON parse error, re-seed
    }
  }

  // First time initialization: seed with curated questions
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_ANONYMOUS_QUESTIONS));
  return INITIAL_ANONYMOUS_QUESTIONS;
};

export const submitAnonymousQuestion = async (
  topic: string,
  questionText: string,
  codeSnippet?: string
): Promise<AnonymousQuestion> => {
  const newQuestion: AnonymousQuestion = {
    id: `qa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    topic,
    question: questionText.trim(),
    codeSnippet: codeSnippet?.trim() || undefined,
    isAnswered: false,
    upvotes: 0,
    createdAt: 'Just now',
  };

  // 1. Save to local storage
  const current = await loadQuestions();
  const updated = [newQuestion, ...current];
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

  // 2. Sync to cloud if Supabase is active
  if (isCloudDbConfigured()) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/anonymous_questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(newQuestion),
      });
    } catch {
      // Silently stored locally
    }
  }

  return newQuestion;
};

export const answerQuestion = async (
  questionId: string,
  answerText: string
): Promise<AnonymousQuestion[]> => {
  const current = await loadQuestions();
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const updated = current.map((q) => {
    if (q.id === questionId) {
      return {
        ...q,
        answer: answerText.trim(),
        answeredAt: dateStr,
        isAnswered: true,
      };
    }
    return q;
  });

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

  // Sync to cloud if configured
  if (isCloudDbConfigured()) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/anonymous_questions?id=eq.${questionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          answer: answerText.trim(),
          answeredAt: dateStr,
          isAnswered: true,
        }),
      });
    } catch {
      // Silently handled
    }
  }

  return updated;
};

export const deleteQuestion = async (questionId: string): Promise<AnonymousQuestion[]> => {
  const current = await loadQuestions();
  const updated = current.filter((q) => q.id !== questionId);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

  if (isCloudDbConfigured()) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/anonymous_questions?id=eq.${questionId}`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
    } catch {
      // Silently handled
    }
  }

  return updated;
};

export const upvoteQuestion = async (questionId: string): Promise<AnonymousQuestion[]> => {
  const upvotedKey = `st_upvoted_${questionId}`;
  if (sessionStorage.getItem(upvotedKey)) {
    // Already upvoted this session
    return loadQuestions();
  }

  sessionStorage.setItem(upvotedKey, 'true');
  const current = await loadQuestions();
  const updated = current.map((q) => {
    if (q.id === questionId) {
      return { ...q, upvotes: q.upvotes + 1 };
    }
    return q;
  });

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

  if (isCloudDbConfigured()) {
    const target = updated.find((q) => q.id === questionId);
    if (target) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/anonymous_questions?id=eq.${questionId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ upvotes: target.upvotes }),
        });
      } catch {
        // Silently handled
      }
    }
  }

  return updated;
};

