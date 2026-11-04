import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import logo128 from './assets/rounded-logo-128.png';
import logo256 from './assets/rounded-logo-256.png';
import discordLogo from './assets/discord-logo-64.png';

/* ─── Schedule Data (Regular Semester  -  Official BRACU Consultation Planner) ─── */

interface SlotData {
  time: string;
  activity: 'offline' | 'online' | 'lab' | 'class';
  title: string;
  location?: string;
}

interface DaySchedule {
  day: string;
  abbr: string;
  isFree?: boolean;
  slots: (SlotData | null)[];
  consultations: {
    time: string;
    activity: 'offline' | 'online' | 'lab' | 'class';
    title: string;
    location?: string;
  }[];
}

const LOGO_128 = logo128;
const LOGO_256 = logo256;
const DISCORD_LOGO = discordLogo;

const CONSULTATION_SLOT_OPTIONS = [
  'Saturday · 12:30 PM - 1:50 PM (Offline 10G-33L)',
  'Saturday · 2:00 PM - 3:20 PM (Offline 10G-33L)',
  'Sunday · 9:30 PM - 10:50 PM (Online Discord)',
  'Monday · 2:00 PM - 3:20 PM (Offline 10G-33L)',
  'Wednesday · 2:00 PM - 3:20 PM (Offline 10G-33L)',
  'Wednesday · 9:30 PM - 10:50 PM (Online Discord)',
  'Thursday · 11:00 AM - 1:50 PM (CSE110 Lab 09B-09L)',
  'Thursday · 2:00 PM - 3:20 PM (Offline 10G-33L)',
  'Thursday · 3:30 PM - 4:50 PM (Offline 10G-33L)',
];

const JAVA_TOPIC_PRESETS = [
  'Module 1: Flowchart',
  'Module 2: Variables & Data types',
  'Module 3: Operators',
  'Module 4: User Input & Errors in Java',
  'Module 5: Branching',
  'Module 6: Iterations',
  'Module 7: Iterations (Nested)',
  'Module 8: String',
  'Module 9: Array',
  'Module 10: Method',
  'Module 11: Recursive Method',
  'Lab Assignment Debugging',
];

/* 6 Active Time Slots (Each slot is 1h 20m; 10 min breaks excluded) */
const TIME_COLUMNS = [
  { id: 1, label: '8:00 AM - 9:20 AM', sub: 'Student Class', hasSession: true },
  { id: 2, label: '11:00 AM - 12:20 PM', sub: 'Lab / Class', hasSession: true },
  { id: 3, label: '12:30 PM - 1:50 PM', sub: 'Consultation / Lab', hasSession: true },
  { id: 4, label: '2:00 PM - 3:20 PM', sub: 'Offline Session', hasSession: true },
  { id: 5, label: '3:30 PM - 4:50 PM', sub: 'Offline Session', hasSession: true },
  { id: 6, label: '9:30 PM - 10:50 PM', sub: 'Online Discord', hasSession: true },
];

const SCHEDULE_ROWS: DaySchedule[] = [
  {
    day: 'Saturday',
    abbr: 'SAT',
    slots: [
      { time: '8:00 AM - 9:20 AM', activity: 'class', title: 'Class', location: 'Student Slot' },
      { time: '11:00 AM - 12:20 PM', activity: 'class', title: 'Class', location: 'Student Slot' },
      { time: '12:30 PM - 1:50 PM', activity: 'offline', title: 'Offline Consultation', location: '10G-33L' },
      { time: '2:00 PM - 3:20 PM', activity: 'offline', title: 'Offline Consultation', location: '10G-33L' },
      null,
      null,
    ],
    consultations: [
      { time: '8:00 AM - 9:20 AM', activity: 'class', title: 'Student Class', location: 'Class' },
      { time: '11:00 AM - 12:20 PM', activity: 'class', title: 'Student Class', location: 'Class' },
      { time: '12:30 PM - 1:50 PM', activity: 'offline', title: 'Offline Consultation', location: '10G-33L' },
      { time: '2:00 PM - 3:20 PM', activity: 'offline', title: 'Offline Consultation', location: '10G-33L' },
    ],
  },
  {
    day: 'Sunday',
    abbr: 'SUN',
    slots: [
      null,
      null,
      null,
      null,
      null,
      { time: '9:30 PM - 10:50 PM', activity: 'online', title: 'Online Consultation', location: 'Discord' },
    ],
    consultations: [
      { time: '9:30 PM - 10:50 PM', activity: 'online', title: 'Online Consultation', location: 'Discord' },
    ],
  },
  {
    day: 'Monday',
    abbr: 'MON',
    slots: [
      null,
      null,
      null,
      { time: '2:00 PM - 3:20 PM', activity: 'offline', title: 'Offline Consultation', location: '10G-33L' },
      null,
      null,
    ],
    consultations: [
      { time: '2:00 PM - 3:20 PM', activity: 'offline', title: 'Offline Consultation', location: '10G-33L' },
    ],
  },
  {
    day: 'Tuesday',
    abbr: 'TUE',
    isFree: true,
    slots: [null, null, null, null, null, null],
    consultations: [],
  },
  {
    day: 'Wednesday',
    abbr: 'WED',
    slots: [
      null,
      null,
      null,
      { time: '2:00 PM - 3:20 PM', activity: 'offline', title: 'Offline Consultation', location: '10G-33L' },
      null,
      { time: '9:30 PM - 10:50 PM', activity: 'online', title: 'Online Consultation', location: 'Discord' },
    ],
    consultations: [
      { time: '2:00 PM - 3:20 PM', activity: 'offline', title: 'Offline Consultation', location: '10G-33L' },
      { time: '9:30 PM - 10:50 PM', activity: 'online', title: 'Online Consultation', location: 'Discord' },
    ],
  },
  {
    day: 'Thursday',
    abbr: 'THU',
    slots: [
      null,
      { time: '11:00 AM - 12:20 PM', activity: 'lab', title: 'CSE110-07 Lab', location: '09B-09L' },
      { time: '12:30 PM - 1:50 PM', activity: 'lab', title: 'CSE110-07 Lab', location: '09B-09L' },
      { time: '2:00 PM - 3:20 PM', activity: 'offline', title: 'Offline Consultation', location: '10G-33L' },
      { time: '3:30 PM - 4:50 PM', activity: 'offline', title: 'Offline Consultation', location: '10G-33L' },
      null,
    ],
    consultations: [
      { time: '11:00 AM - 1:50 PM', activity: 'lab', title: 'CSE110-07 Lab Class', location: '09B-09L' },
      { time: '2:00 PM - 3:20 PM', activity: 'offline', title: 'Offline Consultation', location: '10G-33L' },
      { time: '3:30 PM - 4:50 PM', activity: 'offline', title: 'Offline Consultation', location: '10G-33L' },
    ],
  },
  {
    day: 'Friday',
    abbr: 'FRI',
    isFree: true,
    slots: [null, null, null, null, null, null],
    consultations: [],
  },
];

/* ─── Interactive 3D Session Cell Component with Framer Motion Tilt Physics ─── */

function Session3DCell({
  cell,
  day,
  onSelect,
}: {
  cell: SlotData;
  day: string;
  onSelect: (session: { day: string; slot: SlotData }) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 350, damping: 25 });
  const mouseYSpring = useSpring(y, { stiffness: 350, damping: 25 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['12deg', '-12deg']);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-12deg', '12deg']);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width - 0.5;
    const mouseY = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(mouseX);
    y.set(mouseY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelect({ day, slot: cell })}
      className="w-full h-full cursor-pointer relative group p-0.5"
      style={{ perspective: 800 }}
      role="button"
      tabIndex={0}
      aria-label={`${cell.title} on ${day} at ${cell.time}`}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        whileHover={{
          scale: 1.05,
          z: 25,
          boxShadow: '0 16px 30px -8px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.25)',
        }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
        className={`h-full w-full p-2.5 flex flex-col items-center justify-center text-center rounded-xs transition-shadow relative overflow-hidden select-none ${
          cell.activity === 'offline'
            ? 'bg-[#e6f7ef] dark:bg-emerald-950/60 border-2 border-[#059669] dark:border-emerald-400 shadow-xs'
            : cell.activity === 'online'
            ? 'bg-[#eef2ff] dark:bg-indigo-950/60 border-2 border-[#4f46e5] dark:border-indigo-400 shadow-xs'
            : cell.activity === 'lab'
            ? 'bg-[#fff7ed] dark:bg-amber-950/60 border-2 border-[#ea580c] dark:border-amber-400 shadow-xs'
            : 'bg-[var(--paper-2)] border-2 border-[var(--ink)]/50 shadow-2xs'
        }`}
      >
        {/* Subtle 3D dynamic specular sheen */}
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-tr from-transparent via-white/15 to-transparent" />

        {/* Floating 3D Contents with translateZ parallax */}
        <div style={{ transform: 'translateZ(18px)' }} className="flex flex-col items-center justify-center pointer-events-none w-full px-1">
          {cell.activity === 'offline' && (
            <>
              <span className="text-xs sm:text-sm lg:text-[15px] font-display font-black uppercase tracking-wider text-[#065f46] dark:text-emerald-300 leading-none">
                OFFLINE
              </span>
              <span className="text-[11px] sm:text-xs font-sans font-extrabold text-[#047857] dark:text-emerald-400 leading-tight mt-1">
                Consultation
              </span>
              <span className="mt-1.5 px-2.5 py-1 rounded-xs text-xs sm:text-[13px] font-mono font-black bg-[#065f46] text-white dark:bg-emerald-400 dark:text-black shadow-xs tracking-tight">
                {cell.location}
              </span>
            </>
          )}

          {cell.activity === 'online' && (
            <>
              <span className="text-xs sm:text-sm lg:text-[15px] font-display font-black uppercase tracking-wider text-[#3730a3] dark:text-indigo-200 leading-none">
                ONLINE
              </span>
              <span className="text-[11px] sm:text-xs font-sans font-extrabold text-[#4338ca] dark:text-indigo-300 leading-tight mt-1">
                Consultation
              </span>
              <span className="mt-1.5 px-2.5 py-1 rounded-xs text-xs sm:text-[13px] font-mono font-black bg-[#4338ca] text-white dark:bg-indigo-400 dark:text-black flex items-center gap-1.5 shadow-xs tracking-tight">
                <img
                  src={DISCORD_LOGO}
                  alt="Discord"
                  className="w-4 h-4 object-contain shrink-0"
                />
                Discord
              </span>
            </>
          )}

          {cell.activity === 'lab' && (
            <>
              <span className="text-xs sm:text-sm lg:text-[15px] font-display font-black uppercase tracking-wider text-[#9a3412] dark:text-amber-200 leading-none">
                CSE110 LAB
              </span>
              <span className="text-[11px] sm:text-xs font-sans font-extrabold text-[#c2410c] dark:text-amber-300 leading-tight mt-1">
                Section 07
              </span>
              <span className="mt-1.5 px-2.5 py-1 rounded-xs text-xs sm:text-[13px] font-mono font-black bg-[#9a3412] text-white dark:bg-amber-400 dark:text-black shadow-xs tracking-tight">
                {cell.location}
              </span>
            </>
          )}

          {cell.activity === 'class' && (
            <>
              <span className="text-xs sm:text-sm lg:text-[15px] font-display font-black uppercase tracking-wider text-[var(--ink)] leading-none">
                CLASS
              </span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-[var(--ink-2)] mt-1">
                Student Slot
              </span>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const themeParam = urlParams.get('theme');
      if (themeParam === 'light' || themeParam === 'dark') return themeParam;
      const saved = localStorage.getItem('st_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedDiscordId, setCopiedDiscordId] = useState(false);
  const [copiedSlackId, setCopiedSlackId] = useState(false);
  const [copiedRawText, setCopiedRawText] = useState(false);
  const [copiedModalDiscordId, setCopiedModalDiscordId] = useState(false);
  const [copiedModalRoom, setCopiedModalRoom] = useState(false);
  const [mobileTab, setMobileTab] = useState<'cards' | 'table'>('cards');
  const [selectedSession, setSelectedSession] = useState<{ day: string; slot: SlotData } | null>(null);

  // Consultation Request Composer State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerName, setComposerName] = useState('');
  const [composerId, setComposerId] = useState('');
  const [composerSlot, setComposerSlot] = useState(CONSULTATION_SLOT_OPTIONS[0]);
  const [composerTopic, setComposerTopic] = useState('');
  const [composerQuestion, setComposerQuestion] = useState('');
  const [composerAttempts, setComposerAttempts] = useState('');
  const [composerCopiedToast, setComposerCopiedToast] = useState<string | null>(null);

  const copyDiscordId = () => {
    navigator.clipboard.writeText('bloodrayne_');
    setCopiedDiscordId(true);
    setTimeout(() => setCopiedDiscordId(false), 2000);
  };

  const copyModalDiscordId = () => {
    navigator.clipboard.writeText('bloodrayne_');
    setCopiedModalDiscordId(true);
    setTimeout(() => setCopiedModalDiscordId(false), 2000);
  };

  const copySlackMemberId = () => {
    navigator.clipboard.writeText('U0CDM29USQ7');
    setCopiedSlackId(true);
    setTimeout(() => setCopiedSlackId(false), 2000);
  };

  const generateConsultationMessage = () => {
    const name = composerName.trim() || '[Student Name]';
    const id = composerId.trim() || '[Student ID]';
    const topic = composerTopic.trim() || '[e.g. Module 7: Iterations (Nested) / Module 9: Array]';
    const slot = composerSlot || '[Selected Slot]';
    const question = composerQuestion.trim() || '[Briefly describe the specific problem or error traceback]';
    const attempts = composerAttempts.trim() || '[Mention your initial logic or attempts]';

    return `Hello Imtiaz bhaiya,\n\n- Name: ${name}\n- Student ID: ${id}\n- Section: CSE110 Section 07\n- Topic / Concept: ${topic}\n- Requested Time: ${slot}\n\nQuestion / Issue:\n${question}\n\nWhat I have tried so far:\n${attempts}`;
  };

  const triggerToast = (msg: string) => {
    setComposerCopiedToast(msg);
    setTimeout(() => setComposerCopiedToast(null), 3500);
  };

  const handleCopyConsultationText = () => {
    const text = generateConsultationMessage();
    navigator.clipboard.writeText(text);
    setCopiedRawText(true);
    triggerToast('Copied formatted message to clipboard!');
    setTimeout(() => setCopiedRawText(false), 2200);
  };

  const handleSendDiscord = () => {
    const text = generateConsultationMessage();
    navigator.clipboard.writeText(text);
    triggerToast('Copied formatted message! Opening Discord...');
    window.open('https://discord.gg/S6qrvUVrgF', '_blank');
  };

  const handleSendSlack = () => {
    const text = generateConsultationMessage();
    navigator.clipboard.writeText(text);
    triggerToast('Copied formatted message! Opening Slack...');
    window.open('https://cse110fall2026.slack.com/team/U0CDM29USQ7', '_blank');
  };

  const handleSendEmail = () => {
    const text = generateConsultationMessage();
    const subject = encodeURIComponent(
      `CSE110 Consultation Request - ${composerName.trim() || 'Student'} (${composerId.trim() || 'ID'})`
    );
    const body = encodeURIComponent(text);
    window.open(`mailto:imtiaz.hossain@g.bracu.ac.bd?subject=${subject}&body=${body}`, '_blank');
  };

  const openComposerForSession = (day: string, slot: SlotData) => {
    setSelectedSession(null);
    setComposerSlot(`${day} · ${slot.time} (${slot.title}${slot.location ? ` - ${slot.location}` : ''})`);
    setIsComposerOpen(true);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('st_theme', theme);
  }, [theme]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedSession(null);
    };
    if (selectedSession) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedSession]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const copyEmail = () => {
    navigator.clipboard.writeText('imtiaz.hossain@g.bracu.ac.bd');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const copyRoom = (room: string) => {
    navigator.clipboard.writeText(room);
    setCopiedModalRoom(true);
    setTimeout(() => setCopiedModalRoom(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] font-sans antialiased selection:bg-[var(--blue)] selection:text-white transition-colors duration-200">

      {/* ── 1. Top Blueprint Masthead ── */}
      <header className="sticky top-0 z-50 bg-[#1d49a7] dark:bg-[#0b1426] text-white border-b-2 border-[#163a86] dark:border-[#1e2e4a] shadow-md blueprint-grain">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          
          {/* Masthead Wordmark with Profile Avatar */}
          <div className="flex items-center gap-3">
            <a href="#" className="relative group shrink-0" title="Imtiaz Hossain (T07)">
              <div className="w-10 h-10 rounded-full p-[1.5px] bg-gradient-to-tr from-[#bf953f] via-[#fcf6ba] via-[#b38728] to-[#aa771c] shadow-[0_2px_10px_rgba(191,149,63,0.35)] group-hover:scale-105 transition-transform">
                <img
                  src={LOGO_128}
                  alt="Imtiaz Hossain"
                  className="w-full h-full rounded-full object-cover"
                  onError={(e) => {
                    const t = e.currentTarget;
                    if (!t.dataset.fallback) {
                      t.dataset.fallback = '1';
                      t.src = 'rounded-logo-128.png';
                    }
                  }}
                />
              </div>
              <span className="absolute -bottom-1 -right-1 px-1 py-0.2 text-[9px] font-mono font-bold bg-[#16181d] text-[#cdd9f3] border border-white/40 rounded">
                T07
              </span>
            </a>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-lg sm:text-xl tracking-tight uppercase text-white">
                  ST_Imtiaz_T07
                </span>
              </div>
            </div>
          </div>

          {/* Quick Nav Anchors */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-display font-bold uppercase tracking-wider text-[#cdd9f3]">
            <a href="#routine" className="hover:text-white transition-colors">
              Timetable Routine
            </a>
          </nav>

          {/* Header Controls: Tactile Theme Switch & Discord */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Dark / Light Mode Switch */}
            <button
              type="button"
              onClick={toggleTheme}
              className="px-3 py-1.5 rounded-sm text-xs font-display font-bold uppercase tracking-wider transition-all flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 active:scale-95 shadow-sm"
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <>
                  <svg className="w-3.5 h-3.5 text-amber-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  </svg>
                  <span className="text-[11px]">Light Mode</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-blue-100 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  </svg>
                  <span className="text-[11px]">Dark Mode</span>
                </>
              )}
            </button>

            {/* Join Discord CTA using Official Discord PNG Icon */}
            <a
              href="https://discord.gg/S6qrvUVrgF"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-sm text-xs font-display font-extrabold uppercase tracking-wider text-[#16181d] bg-white hover:bg-[#dce3f1] transition-all shadow-sm active:scale-95 shrink-0 border border-white"
            >
              <img
                src={DISCORD_LOGO}
                alt="Discord"
                className="w-4 h-4 object-contain shrink-0"
              />
              <span>Discord</span>
            </a>
          </div>

        </div>
      </header>

      {/* ── 2. Blueprint Cover / Hero Section ── */}
      <section className="relative bg-[#1d49a7] dark:bg-[#0c162b] text-white blueprint-grain blueprint-grid border-b-2 border-[#16181d] dark:border-[#1e2e4a] overflow-hidden py-8 sm:py-14">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Column: Clean Title and Essential CTA */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Category Eyebrow */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold tracking-wider uppercase text-[#cdd9f3]">
                <span className="px-2 py-0.5 rounded-xs bg-white/15 text-white border border-white/25">
                  BRAC UNIVERSITY
                </span>
                <span>/</span>
                <span>DEPT. OF COMPUTER SCIENCE &amp; ENGINEERING</span>
                <span>/</span>
                <span className="text-white">SECTION 07</span>
              </div>

              {/* Clean Noticeable Title */}
              <div className="space-y-1.5">
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-black tracking-tighter uppercase leading-[0.95] text-white">
                  CSE110 CONSULTATION <em className="not-italic text-[#cdd9f3] block">MANUAL &amp; TIMETABLE</em>
                </h1>
                <p className="text-sm sm:text-base font-mono uppercase tracking-widest text-[#dce3f1] pt-1">
                  FALL 2026 SEMESTER · STUDENT TUTOR: IMTIAZ HOSSAIN (T07)
                </p>
              </div>

              {/* Action Buttons Row */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href="#routine"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xs text-xs font-display font-black uppercase tracking-wider bg-white text-[#163a86] hover:bg-[#dce3f1] transition-all border-2 border-white shadow-md active:scale-95"
                >
                  <span>Inspect Weekly Schedule</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                  </svg>
                </a>
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xs text-xs font-display font-black uppercase tracking-wider bg-[#163a86] hover:bg-[#122e6b] text-white transition-all border-2 border-white/60 hover:border-white shadow-md active:scale-95 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                  <span>Draft Consultation Request</span>
                </button>
              </div>

            </div>

            {/* Right Column: Profile Card with Moved Copy Email Button */}
            <div className="lg:col-span-5">
              <div className="relative border-2 border-white/60 dark:border-white/30 bg-[#163a86]/90 dark:bg-[#0e1c36]/90 p-6 sm:p-7 rounded-sm shadow-2xl backdrop-blur-xs">
                
                {/* Vintage Corner Registration Ticks */}
                <span className="absolute -top-2.5 -left-2.5 text-white/70 font-mono text-sm font-bold">┌</span>
                <span className="absolute -top-2.5 -right-2.5 text-white/70 font-mono text-sm font-bold">┐</span>
                <span className="absolute -bottom-2.5 -left-2.5 text-white/70 font-mono text-sm font-bold">└</span>
                <span className="absolute -bottom-2.5 -right-2.5 text-white/70 font-mono text-sm font-bold">┘</span>

                {/* Profile Portrait & Identifiers with Clickable Portal Logos */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/20">
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div className="relative shrink-0">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-[2px] bg-gradient-to-tr from-[#bf953f] via-[#fcf6ba] via-[#b38728] via-[#fbf5b7] to-[#aa771c] shadow-[0_4px_22px_rgba(191,149,63,0.38)]">
                        <img
                          src={LOGO_256}
                          alt="Imtiaz Hossain"
                          className="w-full h-full rounded-full object-cover"
                          onError={(e) => {
                            const t = e.currentTarget;
                            if (!t.dataset.fallback) {
                              t.dataset.fallback = '1';
                              t.src = 'rounded-logo-256.png';
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#cdd9f3]">
                        STUDENT TUTOR · BRACU CSE
                      </div>
                      <div className="text-2xl sm:text-3xl font-display font-black uppercase text-white tracking-tight">
                        IMTIAZ HOSSAIN
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs font-mono">
                        <span className="px-2 py-0.5 bg-white/20 text-white font-bold rounded-xs border border-white/30">
                          INITIAL: T07
                        </span>
                        <span className="px-2 py-0.5 bg-white/20 text-white font-bold rounded-xs border border-white/30">
                          SEC: 07
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Clickable Logos Cluster (GitHub, Portfolio, LinkedIn, BRACU Vault, Discord) */}
                  <div className="flex items-center gap-1.5 self-start sm:self-center bg-white/10 p-1.5 rounded-xs border border-white/20 shadow-xs">
                    {/* 1. GitHub */}
                    <a
                      href="https://github.com/ImtiazHossain-Eshan"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="GitHub: @ImtiazHossain-Eshan"
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xs bg-[#16181d] text-white hover:bg-black border border-white/25 hover:border-white flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-xs"
                      aria-label="GitHub Profile"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                      </svg>
                    </a>

                    {/* 2. Portfolio */}
                    <a
                      href="https://www.imtiazhossain.dev/"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Portfolio: imtiazhossain.dev"
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xs bg-[#0b0d11] text-[#7cdfff] hover:bg-black border border-[#2a5d70] hover:border-[#7cdfff] flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-xs"
                      aria-label="Personal Portfolio"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 32 32">
                        <rect width="32" height="32" rx="4" fill="#0b0d11"/>
                        <g stroke="#2a5d70" strokeWidth="1.2">
                          <line x1="9.5" y1="21.5" x2="16" y2="9.5"/>
                          <line x1="16" y1="9.5" x2="23" y2="18.5"/>
                          <line x1="9.5" y1="21.5" x2="23" y2="18.5"/>
                          <line x1="16" y1="9.5" x2="14" y2="15.8"/>
                        </g>
                        <circle cx="14" cy="15.8" r="1.4" fill="#7cdfff"/>
                        <circle cx="9.5" cy="21.5" r="2" fill="#7cdfff"/>
                        <circle cx="16" cy="9.5" r="2.6" fill="#7cdfff"/>
                        <circle cx="23" cy="18.5" r="1.8" fill="#7cdfff"/>
                      </svg>
                    </a>

                    {/* 3. LinkedIn */}
                    <a
                      href="https://www.linkedin.com/in/imtiazhossaineshan/"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="LinkedIn: in/imtiazhossaineshan"
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xs bg-[#0077B5] text-white hover:bg-[#005f93] border border-white/25 hover:border-white flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-xs"
                      aria-label="LinkedIn Profile"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.64a1.65 1.65 0 1 0 0 3.3 1.65 1.65 0 0 0 0-3.3z"/>
                      </svg>
                    </a>

                    {/* 4. BRACU Vault */}
                    <a
                      href="https://www.bracuvault.me/"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="BRACU Vault: bracuvault.me"
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xs bg-gradient-to-br from-[#C2A878] via-[#A07A4A] to-[#6F5836] p-1 border border-amber-300/40 hover:border-amber-300 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-xs"
                      aria-label="BRACU Vault"
                    >
                      <svg viewBox="0 0 48 48" className="w-full h-full">
                        <g fill="none" stroke="#F8F5F0" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M24 9 L37 16.5 L37 31.5 L24 39 L11 31.5 L11 16.5 Z"/>
                          <path d="M16 20 L24 29 L32 20"/>
                        </g>
                        <circle cx="24" cy="29" r="3.2" fill="#F8F5F0"/>
                      </svg>
                    </a>

                    {/* 4.5. Slack Profile */}
                    <a
                      href="https://cse110fall2026.slack.com/team/U0CDM29USQ7"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Slack: ST_Imtiaz_T07 (U0CDM29USQ7)"
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xs bg-[#4A154B] text-white hover:bg-[#611f69] border border-white/25 hover:border-white flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-xs"
                      aria-label="Slack Profile"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                      </svg>
                    </a>

                    {/* 5. Discord Server */}
                    <a
                      href="https://discord.gg/S6qrvUVrgF"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="CSE ST Discord Server (#cse110)"
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xs bg-[#5865F2] hover:bg-[#4752c4] border border-white/25 hover:border-white p-1.5 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-xs"
                      aria-label="Join CSE ST Discord Server"
                    >
                      <img
                        src={DISCORD_LOGO}
                        alt="Discord Server"
                        className="w-full h-full object-contain"
                      />
                    </a>

                    {/* 6. Tutor Discord Handle (bloodrayne_) */}
                    <button
                      type="button"
                      onClick={copyDiscordId}
                      title={copiedDiscordId ? "Copied Tutor Discord ID: bloodrayne_" : "Copy Tutor Discord ID: bloodrayne_"}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xs bg-[#2b2d31] hover:bg-[#1e1f22] text-white border border-white/25 hover:border-emerald-400 p-1 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-xs font-mono text-[9px] font-bold"
                      aria-label="Copy Tutor Discord ID: bloodrayne_"
                    >
                      {copiedDiscordId ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      ) : (
                        <span>@ID</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Location & Contact Grid */}
                <div className="pt-4 grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-2.5 bg-white/10 rounded-xs border border-white/15">
                    <div className="text-[10px] text-[#cdd9f3] uppercase">Offline Room</div>
                    <div className="text-base font-bold text-white mt-0.5">10G-33L</div>
                    <div className="text-[10px] text-white/70">Building UB10 · 10th Fl</div>
                  </div>

                  <div className="p-2.5 bg-white/10 rounded-xs border border-white/15">
                    <div className="text-[10px] text-[#cdd9f3] uppercase">Lab Class</div>
                    <div className="text-base font-bold text-white mt-0.5">09B-09L</div>
                    <div className="text-[10px] text-white/70">Thu 11:00 AM - 1:50 PM</div>
                  </div>

                  {/* Discord ID (Personal) */}
                  <div className="p-2.5 bg-white/10 rounded-xs border border-white/15 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-[#cdd9f3] uppercase flex items-center justify-between">
                        <span>Discord ID</span>
                        <span className="text-[9px] text-emerald-400 font-bold uppercase">Personal</span>
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-white font-mono mt-0.5 truncate">
                        bloodrayne_
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={copyDiscordId}
                      className="mt-2 w-full py-1.5 bg-white/15 hover:bg-white text-white hover:text-[#163a86] text-[10px] font-display font-black uppercase tracking-wider rounded-xs transition-all flex items-center justify-center gap-1 active:scale-95 shadow-xs"
                    >
                      {copiedDiscordId ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>Copied ID</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                          </svg>
                          <span>Copy Discord ID</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Discord Server (CSE ST) */}
                  <div className="p-2.5 bg-white/10 rounded-xs border border-white/15 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-[#cdd9f3] uppercase flex items-center justify-between">
                        <span>Discord Server</span>
                        <span className="text-[9px] text-indigo-300 font-bold uppercase">#cse110</span>
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-white font-mono mt-0.5 truncate">
                        CSE ST Server
                      </div>
                    </div>
                    <a
                      href="https://discord.gg/S6qrvUVrgF"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 w-full py-1.5 bg-[#5865F2] hover:bg-[#4752c4] text-white text-[10px] font-display font-black uppercase tracking-wider rounded-xs transition-all flex items-center justify-center gap-1 active:scale-95 shadow-xs"
                    >
                      <span>Join Server</span>
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18m0 0v4.5m0-4.5L7.5 16.5" />
                      </svg>
                    </a>
                  </div>

                  {/* Slack Channel & Profile */}
                  <div className="p-2.5 bg-white/10 rounded-xs border border-white/15 flex flex-col justify-between col-span-2 sm:col-span-1">
                    <div>
                      <div className="text-[10px] text-[#cdd9f3] uppercase flex items-center justify-between">
                        <span>Slack Profile</span>
                        <span className="text-[9px] text-amber-300 font-bold uppercase">CSE110 Fall 26</span>
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-white font-mono mt-0.5 truncate">
                        ST_Imtiaz_T07
                      </div>
                      <div className="text-[10px] text-white/70 font-mono">
                        Member ID: U0CDM29USQ7
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <a
                        href="https://cse110fall2026.slack.com/team/U0CDM29USQ7"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1.5 bg-[#4A154B] hover:bg-[#611f69] text-white text-[10px] font-display font-black uppercase tracking-wider rounded-xs transition-all flex items-center justify-center gap-1 active:scale-95 shadow-xs"
                      >
                        <span>Open Slack</span>
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18m0 0v4.5m0-4.5L7.5 16.5" />
                        </svg>
                      </a>
                      <button
                        type="button"
                        onClick={copySlackMemberId}
                        className="px-2 py-1.5 bg-white/15 hover:bg-white text-white hover:text-[#163a86] text-[10px] font-mono font-bold uppercase rounded-xs transition-all shrink-0 cursor-pointer"
                        title="Copy Slack Member ID: U0CDM29USQ7"
                      >
                        {copiedSlackId ? 'Copied' : 'ID'}
                      </button>
                    </div>
                  </div>

                  {/* Moved Copy Email Button inside the Official Email box */}
                  <div className="p-3 bg-white/10 rounded-xs border border-white/20 col-span-2 sm:col-span-1 flex flex-col justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] text-[#cdd9f3] uppercase">Official Email</div>
                      <div className="text-xs sm:text-sm font-bold text-white font-mono break-all mt-0.5">
                        imtiaz.hossain@g.bracu.ac.bd
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={copyEmail}
                      className="w-full py-1.5 bg-white text-[#163a86] hover:bg-[#dce3f1] text-xs font-display font-black uppercase tracking-wider rounded-xs transition-all shrink-0 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                    >
                      {copiedEmail ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                          </svg>
                          <span>Copy Email</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* One-Click Draft Consultation Request Button */}
                  <div className="col-span-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsComposerOpen(true)}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-display font-black text-xs uppercase tracking-wider rounded-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-emerald-300/40 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                      <span>Draft Consultation Request</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 3. High-Contrast Strip ── */}
      <div className="bg-[#16181d] text-[#eceeeb] border-b-2 border-[#16181d] py-3 px-4 sm:px-6 lg:px-8 text-xs font-display font-bold uppercase tracking-wider overflow-x-auto">
        <div className="max-w-[1560px] mx-auto flex items-center justify-between gap-6 min-w-[700px]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
            <span>CSE110 SECTION 07 · FALL 2026</span>
          </div>

          <div className="flex items-center gap-6 font-mono text-[11px] text-[#cdd9f3]">
            <span>OFFLINE: <strong className="text-white">10G-33L</strong></span>
            <span>LAB: <strong className="text-white">09B-09L</strong></span>
            <span>ONLINE: <strong className="text-white">DISCORD (#cse110)</strong></span>
            <span>MAX: <strong className="text-white">15 HRS/WK</strong></span>
          </div>
        </div>
      </div>

      {/* ── 4. Main Body Content ── */}
      <main className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">

        {/* ── Weekly Consultation Timetable ── */}
        <section id="routine" aria-label="Weekly Consultation Routine" className="space-y-4">
          
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-3 border-b-2 border-[var(--ink)]">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-black uppercase text-[var(--ink)] tracking-tight">
                  Weekly Consultation Timetable
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold bg-[var(--blue-tint)] dark:bg-blue-950/60 text-[var(--blue)] border border-[var(--blue)]/30">
                  3D Interactive
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--ink-2)] font-medium mt-1">
                Official CSE110 Section 07 timetable with offline rooms, online Discord sessions, and laboratory hours.
              </p>
            </div>

            {/* Mobile View Toggle & Status */}
            <div className="flex items-center gap-3">
              {/* Mobile View Toggle (Cards vs Table) */}
              <div className="md:hidden flex items-center p-0.5 bg-[var(--paper-2)] border border-[var(--ink)] rounded-xs">
                <button
                  type="button"
                  onClick={() => setMobileTab('cards')}
                  className={`px-3 py-1 text-xs font-display font-bold uppercase ${
                    mobileTab === 'cards'
                      ? 'bg-[var(--ink)] text-[var(--paper)]'
                      : 'text-[var(--ink-2)]'
                  }`}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab('table')}
                  className={`px-3 py-1 text-xs font-display font-bold uppercase ${
                    mobileTab === 'table'
                      ? 'bg-[var(--ink)] text-[var(--paper)]'
                      : 'text-[var(--ink-2)]'
                  }`}
                >
                  Table
                </button>
              </div>

              {/* Status Indicator */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--paper-card)] border border-[var(--ink)] text-xs font-mono font-bold text-[var(--ink)]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Regular Semester Time</span>
              </div>
            </div>
          </div>

          {/* Prominent Pre-Session Note Banner with Glowing NOTE badge & 3D Icon */}
          <div className="p-3 sm:p-3.5 bg-[var(--paper-card)] border-2 border-[var(--ink)] text-xs text-[var(--ink)] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm rounded-xs relative overflow-hidden">
            <div className="flex items-center gap-3">
              {/* Glowing NOTE badge */}
              <span className="relative inline-flex items-center justify-center px-2.5 py-1 rounded-xs bg-[#1d49a7] dark:bg-[#2563eb] text-white font-display font-black text-[11px] uppercase tracking-widest shrink-0 shadow-[0_0_15px_rgba(37,99,235,0.9),0_0_30px_rgba(59,130,246,0.55)] border border-blue-400">
                <span className="relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,1)]">
                  NOTE
                </span>
                <span className="absolute inset-0 rounded-xs bg-blue-400/40 animate-pulse pointer-events-none" />
              </span>

              <span className="font-sans font-bold text-xs sm:text-sm text-[var(--ink)]">
                “Please email or DM me your topic before dropping by so we can make the most out of our session.”
              </span>
            </div>

            {/* 3D Physics Hint with Isometric 3D Cube Icon */}
            <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-[var(--ink-2)] shrink-0 bg-[var(--paper-2)] px-2.5 py-1 rounded-xs border border-[var(--ink)]/20 shadow-2xs">
              <svg className="w-3.5 h-3.5 text-[var(--blue)] shrink-0 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
              <span className="font-semibold">Hover / Tap cards for 3D physics</span>
            </div>
          </div>

          {/* ── DESKTOP SPREADSHEET TABLE (Framer Motion 3D Interactive Reacting Cells) ── */}
          <div className={`${mobileTab === 'cards' ? 'hidden md:block' : 'block'} border-2 border-[var(--ink)] bg-[var(--paper-card)] overflow-x-auto md:overflow-x-visible shadow-sm`}>
            <table className="w-full table-fixed text-xs border-collapse min-w-[700px] md:min-w-full">
              <thead>
                <tr className="bg-[var(--ink)] text-[var(--paper)]">
                  {/* Day Column Header */}
                  <th className="py-3.5 px-3 text-left font-display font-black uppercase tracking-wider text-xs border-r border-white/20 w-[13%]">
                    DAY
                  </th>

                  {/* 6 Time Columns */}
                  {TIME_COLUMNS.map((col, idx) => (
                    <th
                      key={col.id}
                      className={`py-3.5 px-2 text-center border-r border-white/20 last:border-r-0 w-[14.5%] ${
                        col.hasSession ? 'bg-[#1d49a7] text-white' : ''
                      } ${idx === TIME_COLUMNS.length - 1 ? 'border-r-0' : ''}`}
                    >
                      <div className="font-mono text-xs sm:text-sm font-bold leading-tight">
                        {col.label}
                      </div>
                      <div className="text-[11px] sm:text-xs font-mono opacity-85 truncate mt-0.5 font-semibold">
                        {col.sub}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {SCHEDULE_ROWS.map((row, rowIdx) => {
                  const isLastRow = rowIdx === SCHEDULE_ROWS.length - 1;
                  return (
                    <tr
                      key={row.day}
                      className={`transition-colors ${
                        row.isFree
                          ? 'bg-[var(--paper-2)]/40'
                          : 'hover:bg-[var(--blue-tint)]/40 dark:hover:bg-blue-950/20'
                      }`}
                    >
                      {/* Day Column Cell */}
                      <td className={`py-4 px-3 font-display font-black uppercase text-[var(--ink)] bg-[var(--paper-2)] border-r-2 border-[var(--ink)] whitespace-nowrap text-xs ${!isLastRow ? 'border-b border-[var(--ink)]/30' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-xs shrink-0 ${row.isFree ? 'bg-slate-400' : 'bg-[var(--blue)]'}`} />
                          <span className="lg:hidden">{row.abbr}</span>
                          <span className="hidden lg:inline">{row.day}</span>
                        </div>
                      </td>

                      {/* 5 Slot Cells with Framer Motion 3D Physics */}
                      {row.slots.map((cell, idx) => {
                        const isLastCol = idx === row.slots.length - 1;
                        return (
                          <td
                            key={`${row.day}-${idx}`}
                            className={`p-1.5 text-center align-middle h-28 sm:h-32 relative hover:z-30 overflow-visible ${!isLastCol ? 'border-r border-[var(--ink)]/25' : ''} ${!isLastRow ? 'border-b border-[var(--ink)]/25' : ''}`}
                          >
                            {cell ? (
                              <Session3DCell
                                cell={cell}
                                day={row.day}
                                onSelect={(session) => setSelectedSession(session)}
                              />
                            ) : (
                              <span className="text-[var(--ink-3)] font-mono text-base opacity-30 select-none">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── MOBILE TOUCH CARDS (Interactive with Framer Motion) ── */}
          <div className={`${mobileTab === 'table' ? 'hidden' : 'block md:hidden'} space-y-3`}>
            {SCHEDULE_ROWS.map((row) => (
              <div
                key={`mobile-${row.day}`}
                className={`p-4 border-2 rounded-xs transition-all ${
                  row.consultations.length > 0
                    ? 'bg-[var(--paper-card)] border-[var(--ink)] shadow-sm'
                    : 'bg-[var(--paper-2)]/60 border-[var(--ink)]/30 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-[var(--ink)]/20">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-xs ${row.isFree ? 'bg-slate-400' : 'bg-[var(--blue)]'}`} />
                    <span className="font-display font-black text-lg uppercase text-[var(--ink)]">
                      {row.day}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-xs bg-[var(--ink)] text-[var(--paper)]">
                    {row.consultations.length > 0
                      ? `${row.consultations.length} slot${row.consultations.length > 1 ? 's' : ''}`
                      : 'Free Day'}
                  </span>
                </div>

                {row.consultations.length > 0 ? (
                  <div className="pt-3 space-y-2">
                    {row.consultations.map((c, i) => (
                      <motion.div
                        key={i}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setSelectedSession({ day: row.day, slot: c })}
                        className={`p-3 border-2 rounded-xs flex items-center justify-between gap-3 cursor-pointer ${
                          c.activity === 'offline'
                            ? 'bg-[#e6f7ef] dark:bg-emerald-950/60 border-[#059669] text-[#065f46] dark:text-emerald-200'
                            : c.activity === 'online'
                            ? 'bg-[#eef2ff] dark:bg-indigo-950/60 border-[#4f46e5] text-[#3730a3] dark:text-indigo-200'
                            : c.activity === 'lab'
                            ? 'bg-[#fff7ed] dark:bg-amber-950/60 border-[#ea580c] text-[#9a3412] dark:text-amber-200'
                            : 'bg-[var(--paper-2)] border-[var(--ink)] text-[var(--ink)]'
                        }`}
                      >
                        <div>
                          <div className="font-display font-extrabold uppercase text-xs">{c.title}</div>
                          <div className="text-[11px] font-mono font-medium opacity-90">{c.time}</div>
                        </div>
                        {c.location && (
                          <span className="px-2 py-1 rounded-xs text-xs font-mono font-black bg-[var(--ink)] text-[var(--paper)] shrink-0 shadow-xs">
                            {c.location}
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="pt-2 text-xs text-[var(--ink-2)] font-mono italic">
                    Free day  -  no consultation hours scheduled.
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Table Legend Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs font-mono text-[var(--ink-2)]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-display font-black text-[var(--ink)] uppercase">Key Legend:</span>
              
              <div className="flex items-center gap-1.5 font-bold text-[#065f46] dark:text-emerald-300">
                <span className="w-3 h-3 rounded-xs bg-[#059669]" />
                <span>Offline Consultation [10G-33L]</span>
              </div>

              <div className="flex items-center gap-1.5 font-bold text-[#3730a3] dark:text-indigo-300">
                <span className="w-3 h-3 rounded-xs bg-[#4f46e5]" />
                <span>Online Consultation [Discord]</span>
              </div>

              <div className="flex items-center gap-1.5 font-bold text-[#9a3412] dark:text-amber-300">
                <span className="w-3 h-3 rounded-xs bg-[#ea580c]" />
                <span>CSE110-07 Lab [09B-09L]</span>
              </div>

              <div className="flex items-center gap-1.5 font-bold text-[var(--ink-2)]">
                <span className="w-3 h-3 rounded-xs bg-slate-400" />
                <span>Student Class</span>
              </div>
            </div>

            <div className="text-[11px] font-mono text-[var(--ink-3)]">
              * Tuesday &amp; Friday: No Scheduled Consultation
            </div>
          </div>

        </section>

      </main>

      {/* ── 5. Clean, Minimal Footer ── */}
      <footer className="border-t-2 border-[var(--ink)] bg-[var(--paper-2)] py-6 text-xs font-mono text-[var(--ink-2)]">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="font-display font-black uppercase text-[var(--ink)] tracking-wider text-xs">
              CSE110 Section 07 · Fall 2026
            </span>
            <span className="hidden sm:inline text-[var(--ink-3)]">/</span>
            <span className="font-sans font-medium text-[var(--ink-2)] text-xs sm:text-sm">
              Developed by{' '}
              <a
                href="https://www.imtiazhossain.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[var(--ink)] hover:text-[var(--blue)] underline underline-offset-2 transition-colors"
              >
                Imtiaz Hossain
              </a>{' '}
              for Students
            </span>
          </div>

          <div className="text-[11px] text-[var(--ink-3)] font-mono flex items-center gap-2">
            <span>BRAC University</span>
            <span>·</span>
            <span>Dept. of CSE</span>
          </div>
        </div>
      </footer>

      {/* ── 6. Framer Motion Reactive 3D Session Detail Modal ── */}
      <AnimatePresence>
        {selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop with Blur & Fade */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSession(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />

            {/* Modal Dialog Card with Spring Zoom */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-lg bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] rounded-xs shadow-2xl overflow-hidden z-10"
              style={{ perspective: 1000 }}
            >
              {/* Corner Registration Ticks */}
              <span className="absolute top-2 left-2 text-[var(--ink)]/40 font-mono text-xs">┌</span>
              <span className="absolute top-2 right-2 text-[var(--ink)]/40 font-mono text-xs">┐</span>
              <span className="absolute bottom-2 left-2 text-[var(--ink)]/40 font-mono text-xs">└</span>
              <span className="absolute bottom-2 right-2 text-[var(--ink)]/40 font-mono text-xs">┘</span>

              {/* Modal Header */}
              <div className="px-6 pt-6 pb-4 border-b-2 border-[var(--ink)] flex items-start justify-between gap-4 bg-[var(--paper-2)]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs bg-[var(--ink)] text-[var(--paper)]">
                      {selectedSession.day}
                    </span>
                    <span className="text-xs font-mono font-bold text-[var(--ink-2)]">
                      {selectedSession.slot.time}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-display font-black uppercase text-[var(--ink)] tracking-tight mt-1.5">
                    {selectedSession.slot.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSession(null)}
                  className="w-8 h-8 rounded-xs border-2 border-[var(--ink)] bg-[var(--paper)] hover:bg-[var(--ink)] hover:text-[var(--paper)] flex items-center justify-center transition-colors shrink-0"
                  aria-label="Close modal"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Location / Station Callout */}
                <div className="p-4 rounded-xs border-2 border-[var(--ink)] bg-[var(--paper-card)] space-y-2">
                  <div className="text-[10px] font-mono font-black uppercase tracking-wider text-[var(--blue)]">
                    Session Location / Platform
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg sm:text-xl font-display font-black text-[var(--ink)]">
                        {selectedSession.slot.location === 'Discord'
                          ? 'CSE ST Discord Server'
                          : selectedSession.slot.location === '10G-33L'
                          ? 'Room 10G-33L'
                          : selectedSession.slot.location === '09B-09L'
                          ? 'Lab Room 09B-09L'
                          : 'BRACU Classroom'}
                      </div>
                      <div className="text-xs font-mono text-[var(--ink-2)] mt-0.5">
                        {selectedSession.slot.location === 'Discord'
                          ? 'Online Voice & Text Room · Channel #cse110'
                          : selectedSession.slot.location === '10G-33L'
                          ? 'UB10 Building G · 10th Floor · BRAC University'
                          : selectedSession.slot.location === '09B-09L'
                          ? 'UB09 Building B · 9th Floor · Lab Section 07'
                          : 'Classroom scheduled slot'}
                      </div>
                    </div>

                    {selectedSession.slot.location && selectedSession.slot.location !== 'Class' && selectedSession.slot.location !== 'Discord' && (
                      <button
                        type="button"
                        onClick={() => copyRoom(selectedSession.slot.location!)}
                        className="px-3 py-1.5 bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--blue)] text-xs font-mono font-bold uppercase rounded-xs transition-colors shrink-0 flex items-center gap-1.5"
                      >
                        {copiedModalRoom ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <span>Copy Room</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* For Online Sessions: Tutor Discord Handle Direct Callout */}
                {selectedSession.slot.activity === 'online' && (
                  <div className="p-3 bg-[#5865F2]/10 border-2 border-[#5865F2]/30 rounded-xs flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-mono font-bold text-[#5865F2] uppercase">
                        Student Tutor Discord ID
                      </div>
                      <div className="text-sm font-bold font-mono text-[var(--ink)] mt-0.5">
                        bloodrayne_
                      </div>
                      <div className="text-[10px] text-[var(--ink-2)] font-mono">
                        Personal handle · Direct message for consult topics
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={copyModalDiscordId}
                      className="px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-mono font-bold uppercase rounded-xs transition-colors shrink-0 flex items-center gap-1.5 shadow-xs active:scale-95"
                    >
                      {copiedModalDiscordId ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <span>Copy ID</span>
                      )}
                    </button>
                  </div>
                )}

                {/* Pre-Session Advice Reminder with Sleek Technical Sign */}
                <div className="p-3.5 bg-amber-500/10 border-2 border-amber-600/40 rounded-xs flex items-start gap-3">
                  <div className="w-6 h-6 rounded-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40 mt-0.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div className="text-xs text-[var(--ink)]">
                    <strong className="font-bold text-[var(--ink)] block mb-0.5">Note from Imtiaz:</strong>
                    “Please email or DM me your topic before dropping by so we can make the most out of our session.”
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  {selectedSession.slot.activity === 'online' ? (
                    <a
                      href="https://discord.gg/S6qrvUVrgF"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-display font-black uppercase tracking-wider rounded-xs transition-colors inline-flex items-center gap-2 shadow-sm"
                    >
                      <img
                        src={DISCORD_LOGO}
                        alt="Discord"
                        className="w-4 h-4 object-contain brightness-200"
                      />
                      <span>Open Discord #cse110</span>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18m0 0v4.5m0-4.5L7.5 16.5" />
                      </svg>
                    </a>
                  ) : (
                    <a
                      href="mailto:imtiaz.hossain@g.bracu.ac.bd"
                      className="px-5 py-2.5 bg-[var(--blue)] hover:bg-[var(--blue-deep)] text-white text-xs font-display font-black uppercase tracking-wider rounded-xs transition-colors inline-flex items-center gap-2 shadow-sm"
                    >
                      <span>Email Tutor</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => openComposerForSession(selectedSession.day, selectedSession.slot)}
                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-display font-black uppercase tracking-wider rounded-xs transition-all inline-flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                    <span>Draft Request for this Slot</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSession(null)}
                    className="px-4 py-2.5 bg-[var(--paper-2)] border-2 border-[var(--ink)] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--paper)] text-xs font-display font-bold uppercase tracking-wider rounded-xs transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 7. Consultation Request Interactive Composer Modal ── */}
      <AnimatePresence>
        {isComposerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsComposerOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-5xl bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] rounded-xs shadow-2xl overflow-hidden z-10 max-h-[92vh] flex flex-col my-auto"
            >
              {/* Corner Registration Ticks */}
              <span className="absolute top-2 left-2 text-[var(--ink)]/40 font-mono text-xs">┌</span>
              <span className="absolute top-2 right-2 text-[var(--ink)]/40 font-mono text-xs">┐</span>
              <span className="absolute bottom-2 left-2 text-[var(--ink)]/40 font-mono text-xs">└</span>
              <span className="absolute bottom-2 right-2 text-[var(--ink)]/40 font-mono text-xs">┘</span>

              {/* Header */}
              <div className="px-6 py-4 border-b-2 border-[var(--ink)] bg-[var(--paper-2)] flex items-start justify-between gap-4 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[var(--ink-2)]">
                      CSE110: Programming Language I
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-display font-black uppercase text-[var(--ink)] tracking-tight mt-1">
                    DRAFT CONSULTATION REQUEST
                  </h3>
                  <p className="text-xs font-mono text-[var(--ink-2)] mt-0.5">
                    Fill your details below. 1-click copies the formatted message and redirects you to Discord, Slack, or Email.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  className="w-8 h-8 rounded-xs border-2 border-[var(--ink)] bg-[var(--paper)] hover:bg-[var(--ink)] hover:text-[var(--paper)] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  aria-label="Close composer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Form & Preview Body (Side-by-Side) */}
              <div className="p-4 sm:p-6 overflow-y-auto text-xs flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                  {/* Left Column: Form Inputs (7 cols on lg) */}
                  <div className="lg:col-span-7 space-y-3.5">
                    {/* Row 1: Student Name & ID */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-mono font-bold uppercase text-[11px] text-[var(--ink)] mb-1">
                          Student Name *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Tanvir Ahmed"
                          value={composerName}
                          onChange={(e) => setComposerName(e.target.value)}
                          className="w-full px-3 py-2 bg-[var(--paper-2)] border-2 border-[var(--ink)]/40 focus:border-[var(--blue)] rounded-xs font-sans text-xs text-[var(--ink)] outline-hidden transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block font-mono font-bold uppercase text-[11px] text-[var(--ink)] mb-1">
                          Student ID *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 23101234"
                          value={composerId}
                          onChange={(e) => setComposerId(e.target.value)}
                          className="w-full px-3 py-2 bg-[var(--paper-2)] border-2 border-[var(--ink)]/40 focus:border-[var(--blue)] rounded-xs font-mono text-xs text-[var(--ink)] outline-hidden transition-colors"
                        />
                      </div>
                    </div>

                    {/* Row 2: Selected Consultation Slot */}
                    <div>
                      <label className="block font-mono font-bold uppercase text-[11px] text-[var(--ink)] mb-1">
                        Requested Time / Slot *
                      </label>
                      <select
                        value={composerSlot}
                        onChange={(e) => setComposerSlot(e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--paper-2)] border-2 border-[var(--ink)]/40 focus:border-[var(--blue)] rounded-xs font-mono text-xs text-[var(--ink)] outline-hidden transition-colors"
                      >
                        {CONSULTATION_SLOT_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Row 3: Java Topic / Concept with Quick Selection Chips */}
                    <div>
                      <label className="block font-mono font-bold uppercase text-[11px] text-[var(--ink)] mb-1">
                        Java Topic / Concept *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Module 7: Iterations (Nested) or Module 9: Array"
                        value={composerTopic}
                        onChange={(e) => setComposerTopic(e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--paper-2)] border-2 border-[var(--ink)]/40 focus:border-[var(--blue)] rounded-xs font-sans text-xs text-[var(--ink)] outline-hidden transition-colors mb-2"
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] text-[var(--ink-3)] uppercase mr-1">Quick Chips:</span>
                        {JAVA_TOPIC_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setComposerTopic(preset)}
                            className={`px-2 py-0.5 rounded-xs font-mono text-[10px] transition-all cursor-pointer ${
                              composerTopic === preset
                                ? 'bg-[#1d49a7] text-white border-2 border-[#163a86] dark:bg-blue-600 dark:border-blue-300 font-bold shadow-xs'
                                : 'bg-[var(--paper-2)] hover:bg-[var(--blue)]/15 text-[var(--ink)] border border-[var(--ink)]/30'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Row 4: Question / Issue */}
                    <div>
                      <label className="block font-mono font-bold uppercase text-[11px] text-[var(--ink)] mb-1">
                        Question / Issue (Problem description) *
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Describe where you are stuck, runtime ArrayIndexOutOfBoundsException, infinite loop, etc."
                        value={composerQuestion}
                        onChange={(e) => setComposerQuestion(e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--paper-2)] border-2 border-[var(--ink)]/40 focus:border-[var(--blue)] rounded-xs font-sans text-xs text-[var(--ink)] outline-hidden transition-colors"
                      />
                    </div>

                    {/* Row 5: What I Have Tried So Far */}
                    <div>
                      <label className="block font-mono font-bold uppercase text-[11px] text-[var(--ink)] mb-1">
                        What I Have Tried So Far *
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Dry run on paper, checking loop termination condition, printing array lengths..."
                        value={composerAttempts}
                        onChange={(e) => setComposerAttempts(e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--paper-2)] border-2 border-[var(--ink)]/40 focus:border-[var(--blue)] rounded-xs font-sans text-xs text-[var(--ink)] outline-hidden transition-colors"
                      />
                    </div>
                  </div>

                  {/* Right Column: Highlighted Live Output Preview (5 cols on lg) */}
                  <div className="lg:col-span-5 flex flex-col">
                    <div className="h-full flex flex-col border-2 border-[#1d49a7] dark:border-blue-400 bg-[var(--paper-2)] dark:bg-[#0c162b] rounded-xs shadow-md overflow-hidden ring-1 ring-[#1d49a7]/30">
                      {/* Highlighted Header */}
                      <div className="px-3.5 py-2.5 bg-[#1d49a7] dark:bg-[#163a86] text-white flex items-center justify-between border-b-2 border-[#163a86] dark:border-blue-500 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="font-mono font-bold uppercase text-[11px] tracking-wider text-white">
                            LIVE OUTPUT PREVIEW
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyConsultationText}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xs font-mono text-[11px] font-bold uppercase tracking-wider text-white bg-white/15 hover:bg-white/25 border border-white/40 hover:border-white transition-all cursor-pointer shadow-xs active:scale-95"
                          title="Copy raw formatted text"
                        >
                          {copiedRawText ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
                              <span className="text-emerald-200 font-bold">COPIED!</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                              </svg>
                              <span>Copy text</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Highlighted Body Preview Content */}
                      <pre className="flex-1 p-3.5 bg-[var(--paper)] dark:bg-[#070e1c] font-mono text-[11px] text-[var(--ink)] whitespace-pre-wrap leading-relaxed select-all overflow-y-auto min-h-[220px]">
                        {generateConsultationMessage()}
                      </pre>

                      {/* Technical Footer Indicator */}
                      <div className="px-3 py-1.5 bg-[var(--paper-2)] border-t border-[var(--ink)]/20 flex items-center justify-between text-[10px] font-mono text-[var(--ink-3)] shrink-0">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>SYNCHRONIZED LIVE</span>
                        </span>
                        <span>DISCORD / SLACK / EMAIL</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="p-3.5 sm:px-6 border-t-2 border-[var(--ink)] bg-[var(--paper-2)] flex items-center justify-between gap-2 sm:gap-3 shrink-0">
                {/* Most Left: Close Button */}
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  className="px-4 py-2 bg-[var(--paper-2)] hover:bg-[var(--ink)] text-[var(--ink)] hover:text-[var(--paper)] border-2 border-[var(--ink)] text-xs font-display font-black uppercase tracking-wider rounded-xs transition-all inline-flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span>Close</span>
                </button>

                {/* Right Cluster: Copy Text, Discord, Slack, and Email on Most Right */}
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2">
                  {/* Copy Raw Text */}
                  <button
                    type="button"
                    onClick={handleCopyConsultationText}
                    className="px-3.5 py-2 bg-[var(--paper-2)] hover:bg-[var(--ink)] text-[var(--ink)] hover:text-[var(--paper)] border-2 border-[var(--ink)]/60 hover:border-[var(--ink)] text-xs font-display font-bold uppercase tracking-wider rounded-xs transition-all inline-flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    title="Copy formatted consultation request text"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                    </svg>
                    <span>{copiedRawText ? 'Copied!' : 'Copy Text'}</span>
                  </button>

                  {/* Send via Discord */}
                  <button
                    type="button"
                    onClick={handleSendDiscord}
                    className="px-3.5 py-2 bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-display font-black uppercase tracking-wider rounded-xs transition-all inline-flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer border border-[#4752c4]"
                  >
                    <img src={DISCORD_LOGO} alt="Discord" className="w-3.5 h-3.5 object-contain brightness-200" />
                    <span>Copy &amp; Discord</span>
                  </button>

                  {/* Send via Slack */}
                  <button
                    type="button"
                    onClick={handleSendSlack}
                    className="px-3.5 py-2 bg-[#4A154B] hover:bg-[#611f69] text-white text-xs font-display font-black uppercase tracking-wider rounded-xs transition-all inline-flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer border border-[#611f69]"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.52-2.523h-6.313z"/>
                    </svg>
                    <span>Copy &amp; Slack</span>
                  </button>

                  {/* Send via Email - Most Right Side */}
                  <button
                    type="button"
                    onClick={handleSendEmail}
                    className="px-4 py-2 bg-[var(--blue)] hover:bg-[var(--blue-deep)] text-white text-xs font-display font-black uppercase tracking-wider rounded-xs transition-all inline-flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer border border-blue-400/30"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <span>Open in Email</span>
                    <svg className="w-3 h-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Toast Notification Floating Pill ── */}
      <AnimatePresence>
        {composerCopiedToast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-60 bg-[#16181d] text-white border-2 border-emerald-400 px-4 py-3 rounded-xs shadow-2xl flex items-center gap-3 font-mono text-xs"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold">{composerCopiedToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
