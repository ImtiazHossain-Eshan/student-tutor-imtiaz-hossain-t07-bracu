import { Component, useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import 'highlight.js/styles/vs2015.css';

hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);

/**
 * "Ask the CSE110 Tutor": the same chat as the agent's own page (agent/src/tutor_agent/web/static),
 * in a panel on the ST site that the student can enlarge. Light paper look, streaming answers,
 * tables, VS Code style code with Copy, follow-up suggestions and a collapsed "Show steps".
 * Renders nothing unless VITE_TUTOR_API_URL is set. Answers stream from POST /api/ask (NDJSON).
 */
const API = (import.meta.env.VITE_TUTOR_API_URL as string | undefined)?.replace(/\/$/, '');

type Step = { node: string; ms: number };
type Msg = {
  role: 'me' | 'bot'; text: string; status?: string; pending?: boolean; checking?: boolean; live?: boolean;
  outcome?: string; totalMs?: number; steps?: Step[]; sources?: string[];
};

const LABEL: Record<string, string> = {
  guard: 'Checking the question', classify: 'Understanding the question', retrieve: 'Searching the course material',
  hours: 'Checking consultation hours', answer: 'Writing the answer', grade: 'Checking it against the sources',
  rewrite: 'Searching again',
};
const NEXT: Record<string, string> = { guard: 'classify', retrieve: 'answer', hours: 'answer', answer: 'grade', rewrite: 'retrieve' };
const IDEAS = ['Difference between a tuple and a list?', 'How does a while loop work?', 'Hint for the prime number lab task', 'When can I meet my ST on Saturday?'];
const FOLLOW: Record<string, string[]> = {
  grounded: ['Show me a code example', 'Explain it more simply', 'What are common mistakes?'],
  hint: ['Give me another hint', 'What should I try first?'],
};
const secs = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

/* ---- a small, safe markdown subset: escape first ---- */
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
// Text outside `code` gets emphasis and loses citation numbers (they are for the grader, not the
// student); text inside `code` is left alone, so `t[0]` stays `t[0]`.
const inline = (s: string) => s.split(/(`[^`]+`)/).map((part, i) => i % 2
  ? `<code class="tc-ic">${part.slice(1, -1)}</code>`
  : part
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\s*(\[\d+\])+/g, '')).join('');
function blocks(text: string) {
  let html = '', para: string[] = [], list: { t: string; items: string[] } | null = null, table: string[] = [];
  const fp = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>`; para = []; } };
  const fl = () => { if (list) { html += `<${list.t}>${list.items.map(x => `<li>${inline(x)}</li>`).join('')}</${list.t}>`; list = null; } };
  const cells = (r: string) => r.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map(c => inline(c.trim()));
  const ft = () => {
    if (!table.length) return;
    const [head, ...body] = table.filter(r => !/^[\s|:\-]+$/.test(r));
    table = [];
    if (!head) return; // a table still streaming in may have no header row yet
    html += `<div class="tc-table"><table><thead><tr>${cells(head).map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${cells(r).map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  for (const raw of esc(text).split('\n')) {
    const line = raw.trim(); let m: RegExpMatchArray | null;
    if (!line) { fp(); fl(); ft(); continue; }
    if (line.startsWith('|')) { fp(); fl(); table.push(line); continue; }
    if (table.length) ft();
    if ((m = line.match(/^#{1,4}\s+(.*)/))) { fp(); fl(); html += `<h4>${inline(m[1])}</h4>`; continue; }
    if ((m = line.match(/^[-*]\s+(.*)/)) || (m = line.match(/^\d+[.)]\s+(.*)/))) {
      const t = /^\d/.test(line) ? 'ol' : 'ul'; fp(); if (list && list.t !== t) fl(); list = list || { t, items: [] }; list.items.push(m[1]); continue;
    }
    if (list) { list.items[list.items.length - 1] += ' ' + line; continue; }
    para.push(line);
  }
  fp(); fl(); ft();
  return html;
}
function md(src: string) {
  try { return renderMd(src); } catch { return `<p>${esc(src)}</p>`; } // never let formatting break the page
}
const COPY_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
function renderMd(src: string) {
  const parts = src.split(/```(\w*)\n?([\s\S]*?)```/g);
  let html = '';
  for (let i = 0; i < parts.length; i += 3) {
    html += blocks(parts[i]);
    if (i + 2 < parts.length) {
      const lang = (parts[i + 1] || '').toLowerCase(), code = parts[i + 2].replace(/\n$/, '');
      let body = esc(code);
      try { body = hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : hljs.highlightAuto(code, ['python', 'java']).value; } catch { /* plain text */ }
      html += `<div class="tc-code"><div class="tc-code-head"><span><i class="tc-lang ${esc(lang)}"></i>${esc(lang || 'code')}</span><button type="button" class="tc-copy" aria-label="Copy code">${COPY_ICON}<span>Copy</span></button></div><pre><code class="hljs">${body}</code></pre></div>`;
    }
  }
  return html;
}

/** If the chat ever throws, hide it instead of taking the whole ST site down with it. */
class ChatBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.error('TutorChat failed and was hidden:', err); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function TutorChatSafe() {
  return <ChatBoundary><TutorChat /></ChatBoundary>;
}

const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const I = {
  close: 'M6 6l12 12M18 6L6 18',
  grow: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  shrink: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7',
  pen: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  up: 'M12 19V5M6 11l6-6 6 6',
  chev: 'M9 6l6 6-6 6',
  spark: 'M12 4v4M12 16v4M4 12h4M16 12h4M7 7l2 2M15 15l2 2M17 7l-2 2M9 15l-2 2',
};

function TutorChat() {
  const [open, setOpen] = useState(false);
  const [big, setBig] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false);
  const previous = useRef('');
  const previousLang = useRef('');
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = scroller.current; if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) el.scrollTop = el.scrollHeight;
  }, [msgs]);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 60); }, [open, big]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (big) setBig(false); else setOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, big]);
  useEffect(() => {
    if (!open || !API) return;
    // Free hosting sleeps when idle; tell the student while it wakes instead of a silent wait.
    let done = false;
    const t = setTimeout(() => { if (!done) setWaking(true); }, 1500);
    fetch(`${API}/healthz`).catch(() => {}).finally(() => { done = true; clearTimeout(t); setWaking(false); });
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => {
    const el = input.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [q]);

  if (!API) return null;

  const patch = (fn: (m: Msg) => Msg) => setMsgs(ms => [...ms.slice(0, -1), fn(ms[ms.length - 1])]);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true); setQ('');
    setMsgs(ms => [...ms, { role: 'me', text: question }, { role: 'bot', text: '', pending: true, status: LABEL.guard, steps: [] }]);
    let draft = '', hint = false, lang = '';
    const steps: Step[] = [];
    try {
      const res = await fetch(`${API}/api/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, previous: previous.current, previous_language: previousLang.current }),
      });
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'The tutor could not answer right now. Please try again in a minute.');
      }
      const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl); buf = buf.slice(nl + 1); if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === 'token') {
            draft += ev.text;
            if (!'NOT_IN_MATERIAL'.startsWith(draft.trim().slice(0, 15)) || draft.trim().length > 15) {
              const d = draft; patch(m => ({ ...m, text: d, pending: false, live: true }));
            }
          } else if (ev.type === 'step') {
            steps.push({ node: ev.node, ms: ev.ms });
            if (ev.node === 'classify') { lang = ev.detail?.language || ''; if (ev.detail?.intent === 'lab_help') hint = true; }
            if (ev.node === 'rewrite') { draft = ''; patch(m => ({ ...m, text: '', pending: true, live: false, checking: false, status: LABEL.rewrite })); }
            else if (ev.node === 'answer' && draft && !hint) patch(m => ({ ...m, live: false, checking: true }));
            else if (NEXT[ev.node]) patch(m => ({ ...m, status: hint ? 'Writing a hint and checking it' : LABEL[NEXT[ev.node]] }));
          } else if (ev.type === 'done') {
            const st = [...steps];
            patch(m => ({ ...m, text: ev.answer, pending: false, live: false, checking: false, outcome: ev.outcome, totalMs: ev.total_ms, steps: st, sources: ev.sources }));
            if (ev.outcome !== 'busy') { previous.current = question; previousLang.current = lang; }
          }
        }
      }
    } catch (err) {
      patch(m => ({ ...m, text: err instanceof Error ? err.message : 'The request failed.', pending: false, live: false, checking: false }));
    } finally {
      setBusy(false); input.current?.focus();
    }
  }

  const newChat = () => { if (busy) return; setMsgs([]); previous.current = ''; previousLang.current = ''; input.current?.focus(); };
  const onAnswerClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest('.tc-copy') as HTMLButtonElement | null;
    if (!btn) return;
    const code = btn.closest('.tc-code')?.querySelector('pre code')?.textContent ?? '';
    try { await navigator.clipboard.writeText(code); btn.querySelector('span')!.textContent = 'Copied'; setTimeout(() => { const s = btn.querySelector('span'); if (s) s.textContent = 'Copy'; }, 1400); } catch { /* clipboard blocked */ }
  };

  const spring = { type: 'spring' as const, stiffness: 300, damping: 32 };
  return (
    <>
      <style>{CSS}</style>
      <AnimatePresence>
        {!open && <TutorKey key="key" onOpen={() => setOpen(true)} />}
      </AnimatePresence>
      <AnimatePresence>
        {open && big && (
          <motion.div key="scrim" className="tc-scrim" onClick={() => setBig(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
      {open && (
        <motion.section
          key="panel"
          layout={!reduce}
          transition={spring}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 40, rotateX: 18 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0, rotateX: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 40, rotateX: 18, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
          style={{ transformOrigin: 'bottom right', transformPerspective: 900, borderRadius: 18 }}
          role="dialog"
          aria-label="CSE110 Tutor chat"
          className={`tc-panel ${big ? 'tc-big' : ''}`}
        >
          <motion.header layout="position" className="tc-top">
            <div className="tc-brand"><b>CSE110 Tutor</b><span>Answers from the course material</span></div>
            <div className="tc-actions">
              <button type="button" className="tc-icon" onClick={newChat} disabled={busy || !msgs.length} title="New chat" aria-label="New chat"><Icon d={I.pen} size={17} /></button>
              <button type="button" className="tc-icon" onClick={() => setBig(b => !b)} title={big ? 'Restore size' : 'Enlarge'} aria-label={big ? 'Restore size' : 'Enlarge'} aria-pressed={big}>
                <Icon d={big ? I.shrink : I.grow} size={17} />
              </button>
              <button type="button" className="tc-icon" onClick={() => { setBig(false); setOpen(false); }} title="Close" aria-label="Close the tutor"><Icon d={I.close} size={17} /></button>
            </div>
          </motion.header>

          <div ref={scroller} className="tc-scroll" aria-live="polite">
            <div className="tc-thread">
              {waking && <p className="tc-waking">Waking the tutor up. It runs on a free server that sleeps when idle, so the first answer can take up to a minute.</p>}
              {msgs.length === 0 && (
                <div className="tc-hello">
                  <h2>What do you need help with in CSE110?</h2>
                  <div className="tc-ideas">
                    {IDEAS.map(t => <button key={t} type="button" className="tc-idea" onClick={() => ask(t)}>{t}</button>)}
                  </div>
                </div>
              )}
              {msgs.map((m, i) => m.role === 'me' ? (
                <div key={i} className="tc-me"><p>{m.text}</p></div>
              ) : (
                <div key={i} className="tc-bot">
                  {m.pending ? (
                    <p className="tc-thinking"><span className="tc-dots"><i /><i /><i /></span>{m.status}…</p>
                  ) : (
                    <div className={`tc-answer ${m.live ? 'tc-live' : ''}`} onClick={onAnswerClick} dangerouslySetInnerHTML={{ __html: md(m.text) }} />
                  )}
                  {m.checking && <p className="tc-checking"><span className="tc-spin" />Checking it against the course material…</p>}
                  {!m.pending && !m.live && !m.checking && m.outcome && FOLLOW[m.outcome] && i === msgs.length - 1 && (
                    <div className="tc-next">
                      {FOLLOW[m.outcome].map(f => <button key={f} type="button" disabled={busy} onClick={() => ask(f)}><Icon d={I.spark} size={14} />{f}</button>)}
                    </div>
                  )}
                  {!m.pending && m.steps && m.steps.length > 0 && m.totalMs !== undefined && (
                    <details className="tc-more">
                      <summary><Icon d={I.chev} size={14} />Show steps · {secs(m.totalMs)}</summary>
                      <ol className="tc-steps">{m.steps.map((s, k) => <li key={k}><span>{s.node}</span><span>{secs(s.ms)}</span></li>)}</ol>
                      {m.sources && m.sources.length > 0 && <ol className="tc-srcs">{m.sources.map((s, k) => <li key={k}>{s}</li>)}</ol>}
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>

          <form className="tc-dock" onSubmit={e => { e.preventDefault(); ask(q); }}>
            <div className="tc-box">
              <textarea
                ref={input}
                value={q}
                rows={1}
                maxLength={2000}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(q); } }}
                placeholder="Ask about CSE110"
                aria-label="Your question"
              />
              <button type="submit" className="tc-send" disabled={busy || !q.trim()} aria-label="Send"><Icon d={I.up} /></button>
            </div>
            <p className="tc-foot">Answers come only from the CSE110 course material. Lab questions get hints, not solutions.</p>
          </form>
        </motion.section>
      )}
      </AnimatePresence>
    </>
  );
}

/**
 * The launcher as a physical key: an amber cap on a darker base. It tilts toward the pointer in 3D,
 * the cap presses down onto its base on click, it flips up into place on load and nudges three
 * times to be noticed, then rests. Reduced motion: a plain button.
 */
function TutorKey({ onOpen }: { onOpen: () => void }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0), py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-14, 14]), { stiffness: 260, damping: 18 });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [12, -12]), { stiffness: 260, damping: 18 });
  const glareX = useTransform(px, [-0.5, 0.5], ['20%', '80%']);
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    if (reduce || e.pointerType === 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const reset = () => { px.set(0); py.set(0); };

  return (
    <motion.div
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40"
      style={{ perspective: 700 }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 36, rotateX: -70 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: [36, 0, 0, -5, 0, 0, -5, 0, 0, -5, 0], rotateX: 0 }}
      transition={reduce ? { duration: 0.2 } : {
        opacity: { duration: 0.3, delay: 0.6 },
        rotateX: { type: 'spring', stiffness: 220, damping: 14, delay: 0.6 },
        y: { duration: 9, delay: 0.6, times: [0, 0.06, 0.3, 0.33, 0.37, 0.62, 0.65, 0.69, 0.94, 0.97, 1], ease: 'easeOut' },
      }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7, transition: { duration: 0.15 } }}
    >
      <motion.button
        type="button"
        onClick={onOpen}
        onPointerMove={move}
        onPointerLeave={reset}
        aria-label="Ask the CSE110 Tutor"
        className="tc-key group relative block cursor-pointer select-none"
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        whileHover={reduce ? undefined : { scale: 1.03 }}
      >
        {/* the key's base: its visible depth */}
        <span aria-hidden="true" className="absolute inset-0 translate-y-[5px] rounded-xs border-2 border-[#16181d] bg-[#b97f00]" />
        {/* the cap: presses down onto the base */}
        <motion.span
          className="relative flex items-center gap-2.5 px-4 py-3 rounded-xs border-2 border-[#16181d] bg-[#ffc23a] text-[#16181d] font-display font-black uppercase tracking-wider text-xs overflow-hidden"
          whileTap={reduce ? undefined : { y: 5 }}
          transition={{ type: 'spring', stiffness: 700, damping: 30 }}
        >
          {!reduce && (
            <motion.span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-16 -skew-x-12 bg-white/35 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: glareX, x: '-50%' }} />
          )}
          <span className="tc-bubble relative" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
            <span className="tc-typing"><i /><i /><i /></span>
          </span>
          <span className="relative">Ask the CSE110 Tutor</span>
        </motion.span>
      </motion.button>
    </motion.div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;500;600&family=Atkinson+Hyperlegible+Mono:wght@400;500&display=swap');
.tc-panel {
  --tc-bg: #f5f5f2; --tc-bubble: #e8e8e3; --tc-field: #ffffff; --tc-seam: #dcdcd5; --tc-seam2: #c6c6bf;
  --tc-text: #16181d; --tc-text2: #4a4e5c; --tc-text3: #6a6f7d; --tc-accent: #2f55d4;
  --tc-sans: "Atkinson Hyperlegible Next", ui-sans-serif, system-ui, sans-serif;
  --tc-mono: "Atkinson Hyperlegible Mono", ui-monospace, Consolas, monospace;
  position: fixed; z-index: 50; display: flex; flex-direction: column; overflow: hidden;
  right: 24px; bottom: 24px; width: 440px; height: min(680px, calc(100vh - 48px));
  background: var(--tc-bg); color: var(--tc-text); font: 15px/1.6 var(--tc-sans); -webkit-font-smoothing: antialiased;
  border: 1px solid var(--tc-seam); box-shadow: 0 24px 60px rgba(10, 14, 24, .35), 0 4px 12px rgba(10, 14, 24, .12);
  text-align: left;
}
.tc-panel.tc-big { right: max(16px, calc((100vw - 980px) / 2)); bottom: 3vh; width: min(980px, calc(100vw - 32px)); height: 94vh; }
.tc-scrim { position: fixed; inset: 0; z-index: 49; background: rgba(8, 12, 22, .45); backdrop-filter: blur(2px); }
.tc-panel *, .tc-panel *::before, .tc-panel *::after { box-sizing: border-box; }
.tc-panel ::selection { background: color-mix(in srgb, var(--tc-accent) 22%, transparent); }
.tc-panel :focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 2px; border-radius: 8px; }
.tc-panel button { font: inherit; color: inherit; }
.tc-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 12px 10px 18px; }
.tc-brand { display: flex; flex-direction: column; min-width: 0; }
.tc-brand b { font-weight: 600; font-size: 15px; }
.tc-brand span { font-size: 12.5px; color: var(--tc-text3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tc-actions { display: flex; gap: 2px; }
.tc-icon { width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 9px; background: transparent; color: var(--tc-text2); cursor: pointer; transition: background .15s, color .15s; }
.tc-icon:hover:not(:disabled) { background: var(--tc-bubble); color: var(--tc-text); }
.tc-icon:disabled { opacity: .35; cursor: default; }
.tc-scroll { flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--tc-seam2) transparent; }
.tc-thread { max-width: 760px; margin: 0 auto; padding: 4px 18px 20px; }
.tc-big .tc-thread { padding: 8px 32px 24px; }
.tc-waking { margin: 4px 0 12px; padding: 10px 14px; border-radius: 12px; background: var(--tc-field); border: 1px solid var(--tc-seam); font-size: 13.5px; color: var(--tc-text2); }
.tc-hello { padding: 9vh 0 8px; text-align: center; }
.tc-hello h2 { margin: 0 0 18px; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.25; }
.tc-big .tc-hello h2 { font-size: 28px; }
.tc-ideas { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.tc-idea { padding: 8px 14px; border-radius: 999px; border: 1px solid var(--tc-seam); background: transparent; color: var(--tc-text2); font-size: 14px; cursor: pointer; transition: background .15s, color .15s; }
.tc-idea:hover { background: var(--tc-field); color: var(--tc-text); }
.tc-me { display: flex; justify-content: flex-end; margin: 22px 0 14px; }
.tc-me p { margin: 0; max-width: 82%; padding: 10px 16px; border-radius: 18px; background: var(--tc-bubble); white-space: pre-wrap; word-break: break-word; }
.tc-bot { margin-bottom: 6px; }
.tc-answer { line-height: 1.7; }
.tc-answer p { margin: 0 0 12px; }
.tc-answer ul, .tc-answer ol { margin: 0 0 12px; padding-left: 22px; }
.tc-answer ul { list-style: disc; } .tc-answer ol { list-style: decimal; }
.tc-answer li { margin: 4px 0; }
.tc-answer strong { font-weight: 600; }
.tc-answer h4 { font-size: 15.5px; font-weight: 600; margin: 18px 0 6px; }
.tc-ic { font: .88em var(--tc-mono); background: var(--tc-bubble); padding: 2px 5px; border-radius: 5px; }
.tc-live > :last-child::after { content: ""; display: inline-block; width: 8px; height: 1.05em; margin-left: 2px; vertical-align: -0.15em; background: var(--tc-text); border-radius: 1px; animation: tc-caret 1s steps(1) infinite; }
.tc-live > .tc-code:last-child::after, .tc-live > .tc-table:last-child::after { display: none; }
@keyframes tc-caret { 50% { opacity: 0; } }
.tc-code { margin: 4px 0 16px; border-radius: 12px; overflow: hidden; background: #1e1e1e; box-shadow: 0 6px 18px rgba(22, 24, 29, .12); }
.tc-code-head { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px 6px 14px; background: #2d2d2d; color: #c5c5c5; font: 12.5px/1 var(--tc-mono); }
.tc-code-head > span { display: inline-flex; align-items: center; gap: 8px; }
.tc-lang { width: 8px; height: 8px; border-radius: 50%; background: #569cd6; }
.tc-lang.python { background: #f1c94b; } .tc-lang.java { background: #e8834e; }
.tc-copy { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 9px; border: 0; border-radius: 6px; background: transparent; color: #c5c5c5 !important; font: 12.5px var(--tc-sans) !important; cursor: pointer; }
.tc-copy:hover { background: #3a3a3a; color: #fff !important; }
.tc-code pre { margin: 0; padding: 14px 16px; overflow-x: auto; background: #1e1e1e; }
.tc-code pre code.hljs { display: block; padding: 0; background: transparent; color: #d4d4d4; font: 13.5px/1.6 var(--tc-mono); }
.tc-table { margin: 4px 0 16px; border: 1px solid var(--tc-seam); border-radius: 12px; overflow: auto; background: var(--tc-field); }
.tc-table table { width: 100%; border-collapse: collapse; font-size: 14px; }
.tc-table th, .tc-table td { padding: 9px 12px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--tc-seam); }
.tc-table th { font-weight: 600; background: color-mix(in srgb, var(--tc-bubble) 60%, var(--tc-field)); }
.tc-table tr:last-child td { border-bottom: 0; }
.tc-table td:first-child { font-weight: 500; }
.tc-thinking { display: flex; align-items: center; gap: 10px; margin: 0; color: var(--tc-text3); }
.tc-dots { display: inline-flex; gap: 4px; }
.tc-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--tc-text3); animation: tc-blink 1.2s infinite both; }
.tc-dots i:nth-child(2) { animation-delay: .2s; } .tc-dots i:nth-child(3) { animation-delay: .4s; }
@keyframes tc-blink { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }
.tc-checking { display: flex; align-items: center; gap: 8px; margin: 2px 0 0; font-size: 13.5px; color: var(--tc-text3); }
.tc-spin { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--tc-seam2); border-top-color: var(--tc-text3); animation: tc-spin .8s linear infinite; }
@keyframes tc-spin { to { transform: rotate(360deg); } }
.tc-next { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 4px; }
.tc-next button { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: 999px; border: 1px solid var(--tc-seam); background: var(--tc-field); color: var(--tc-text2); font-size: 14px; cursor: pointer; transition: border-color .15s, color .15s, transform .2s; }
.tc-next button:hover:not(:disabled) { border-color: var(--tc-seam2); color: var(--tc-text); transform: translateY(-1px); }
.tc-next button svg { color: var(--tc-accent); }
.tc-next button:disabled { opacity: .5; cursor: default; }
.tc-more { margin-top: 6px; font-size: 13px; color: var(--tc-text3); }
.tc-more summary { cursor: pointer; list-style: none; display: inline-flex; align-items: center; gap: 4px; border-radius: 6px; }
.tc-more summary::-webkit-details-marker { display: none; }
.tc-more summary:hover { color: var(--tc-text); }
.tc-more summary svg { transition: transform .2s; }
.tc-more[open] summary svg { transform: rotate(90deg); }
.tc-steps, .tc-srcs { list-style: none; margin: 6px 0 0; padding: 0; }
.tc-steps { font: 12.5px var(--tc-mono); }
.tc-steps li { display: flex; justify-content: space-between; gap: 16px; padding: 1px 0; max-width: 380px; }
.tc-srcs li { padding: 2px 0; word-break: break-word; }
.tc-dock { padding: 8px 14px 12px; }
.tc-box { max-width: 760px; margin: 0 auto; display: flex; align-items: flex-end; gap: 8px; padding: 7px 7px 7px 16px; border-radius: 24px; background: var(--tc-field); border: 1px solid var(--tc-seam); box-shadow: 0 2px 10px rgba(22, 24, 29, .05); transition: border-color .2s; }
.tc-box:focus-within { border-color: var(--tc-seam2); }
.tc-box textarea { flex: 1; resize: none; border: 0; outline: 0; background: transparent; color: var(--tc-text); font: 15.5px/1.5 var(--tc-sans); padding: 7px 0; max-height: 180px; caret-color: var(--tc-accent); }
.tc-box textarea::placeholder { color: var(--tc-text3); }
.tc-box textarea:focus-visible { outline: 0; }
.tc-send { width: 36px; height: 36px; flex: none; border-radius: 50%; border: 0; display: grid; place-items: center; background: var(--tc-text); color: var(--tc-bg); cursor: pointer; transition: opacity .15s; }
.tc-send:disabled { opacity: .25; cursor: default; }
.tc-foot { max-width: 760px; margin: 7px auto 0; text-align: center; font-size: 12px; color: var(--tc-text3); }
@media (max-width: 640px) {
  .tc-panel, .tc-panel.tc-big { left: 8px; right: 8px; bottom: 8px; top: 64px; width: auto; height: auto; }
  .tc-panel.tc-big { top: 8px; }
}
.tc-key { filter: drop-shadow(0 10px 14px rgba(0,0,0,.35)); }
.tc-bubble { display: grid; place-items: center; }
.tc-typing { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 1.5px; padding-bottom: 1px; opacity: 0; transition: opacity .2s; }
.tc-typing i { width: 2.5px; height: 2.5px; border-radius: 50%; background: currentColor; animation: tc-typing 1s infinite ease-in-out; }
.tc-typing i:nth-child(2) { animation-delay: .15s; }
.tc-typing i:nth-child(3) { animation-delay: .3s; }
.tc-key:hover .tc-typing { opacity: 1; }
@keyframes tc-typing { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-2px); } }
@media (prefers-reduced-motion: reduce) { .tc-dots i, .tc-typing i, .tc-spin, .tc-live > :last-child::after { animation: none; } }
`;
