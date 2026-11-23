import { Component, useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

/**
 * "Ask the CSE110 Tutor": a chat with the CSE110 Tutor Agent (agent/), hosted separately.
 * Renders nothing unless VITE_TUTOR_API_URL is set, so the site is unchanged until the agent
 * is deployed. Answers stream from POST /api/ask as newline-delimited JSON events.
 */
const API = (import.meta.env.VITE_TUTOR_API_URL as string | undefined)?.replace(/\/$/, '');

type Msg = { role: 'me' | 'bot'; text: string; status?: string; pending?: boolean; checking?: boolean };

const LABEL: Record<string, string> = {
  guard: 'Checking the question', classify: 'Understanding the question', retrieve: 'Searching the course material',
  hours: 'Checking consultation hours', answer: 'Writing the answer', grade: 'Checking it against the sources',
  rewrite: 'Searching again',
};
const NEXT: Record<string, string> = { guard: 'classify', retrieve: 'answer', hours: 'answer', answer: 'grade', rewrite: 'retrieve' };
const IDEAS = ['How does a while loop work?', 'Hint for the prime number lab task', 'When can I meet my ST on Saturday?'];

/* ---- a small, safe markdown subset: escape first ---- */
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const inline = (s: string) => s
  .replace(/`([^`]+)`/g, '<code class="tc-ic">$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
  .replace(/\s*(\[\d+\])+/g, ''); // citations are for the grader, not the student
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
function renderMd(src: string) {
  const parts = src.split(/```(\w*)\n?([\s\S]*?)```/g);
  let html = '';
  for (let i = 0; i < parts.length; i += 3) {
    html += blocks(parts[i]);
    if (i + 2 < parts.length) html += `<div class="tc-code"><div class="tc-code-head">${esc(parts[i + 1] || 'code')}</div><pre><code>${esc(parts[i + 2].replace(/\n$/, ''))}</code></pre></div>`;
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

function TutorChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false);
  const previous = useRef('');
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [msgs]);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 50); }, [open]);
  useEffect(() => {
    if (!open || !API) return;
    // Free hosting sleeps when idle; tell the student while it wakes instead of a silent wait.
    let done = false;
    const t = setTimeout(() => { if (!done) setWaking(true); }, 1500);
    fetch(`${API}/healthz`).catch(() => {}).finally(() => { done = true; clearTimeout(t); setWaking(false); });
    return () => clearTimeout(t);
  }, [open]);

  if (!API) return null;

  const patch = (fn: (m: Msg) => Msg) => setMsgs(ms => [...ms.slice(0, -1), fn(ms[ms.length - 1])]);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true); setQ('');
    setMsgs(ms => [...ms, { role: 'me', text: question }, { role: 'bot', text: '', pending: true, status: LABEL.guard }]);
    let draft = '', hint = false;
    try {
      const res = await fetch(`${API}/api/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, previous: previous.current }),
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
              const d = draft; patch(m => ({ ...m, text: d, pending: false }));
            }
          } else if (ev.type === 'step') {
            if (ev.node === 'classify' && ev.detail?.intent === 'lab_help') hint = true;
            if (ev.node === 'rewrite') { draft = ''; patch(m => ({ ...m, text: '', pending: true, checking: false, status: LABEL.rewrite })); }
            else if (ev.node === 'answer' && draft && !hint) patch(m => ({ ...m, checking: true }));
            else if (NEXT[ev.node]) patch(m => ({ ...m, status: hint ? 'Writing a hint and checking it' : LABEL[NEXT[ev.node]] }));
          } else if (ev.type === 'done') {
            patch(m => ({ ...m, text: ev.answer, pending: false, checking: false }));
            if (ev.outcome !== 'busy') previous.current = question;
          }
        }
      }
    } catch (err) {
      patch(m => ({ ...m, text: err instanceof Error ? err.message : 'The request failed.', pending: false, checking: false }));
    } finally {
      setBusy(false); input.current?.focus();
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <AnimatePresence>
        {!open && <TutorKey key="key" onOpen={() => setOpen(true)} />}
      </AnimatePresence>
      <AnimatePresence>
      {open && (
        <motion.section
          key="panel"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 40, rotateX: 18 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0, rotateX: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 40, rotateX: 18, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
          style={{ transformOrigin: 'bottom right', transformPerspective: 900 }}
          role="dialog"
          aria-label="CSE110 Tutor chat"
          className="fixed z-50 inset-x-2 bottom-2 top-16 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:h-[min(640px,calc(100vh-6rem))] flex flex-col bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] rounded-xs shadow-2xl"
        >
          <header className="flex items-center justify-between gap-3 px-4 py-3 border-b-2 border-[var(--ink)] bg-[var(--paper-2)]">
            <div className="min-w-0">
              <div className="font-display font-black uppercase tracking-wider text-sm leading-tight">CSE110 Tutor</div>
              <div className="font-mono text-[11px] text-[var(--ink-3)] truncate">Answers from the course material only · beta</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close the tutor" className="w-8 h-8 grid place-items-center border-2 border-[var(--ink)] rounded-xs hover:bg-[var(--paper-card)] cursor-pointer">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-4 space-y-4" aria-live="polite">
            {waking && (
              <p className="font-mono text-[11px] px-3 py-2 border border-[var(--ink)]/30 bg-[var(--paper-card)] rounded-xs">
                Waking the tutor up. It runs on a free server that sleeps when idle, so the first answer can take up to a minute.
              </p>
            )}
            {msgs.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-[var(--ink-2)]">
                  Ask about a CSE110 concept, a lab task (you get hints, not solutions) or when to meet your ST.
                  Answers come only from the course material.
                </p>
                <div className="flex flex-col gap-2">
                  {IDEAS.map(t => (
                    <button key={t} type="button" onClick={() => ask(t)} className="text-left text-sm px-3 py-2 border-2 border-[var(--ink)]/80 rounded-xs bg-[var(--paper-card)] hover:border-[var(--blue)] hover:text-[var(--blue)] transition-colors cursor-pointer">
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => m.role === 'me' ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] px-3 py-2 text-sm bg-[var(--blue)] text-white rounded-xs whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            ) : (
              <div key={i} className="text-sm leading-relaxed">
                {m.pending ? (
                  <p className="flex items-center gap-2 font-mono text-[12px] text-[var(--ink-3)]"><span className="tc-dot" />{m.status}…</p>
                ) : (
                  <div className="tc-answer" dangerouslySetInnerHTML={{ __html: md(m.text) }} />
                )}
                {m.checking && <p className="mt-1 font-mono text-[11px] text-[var(--ink-3)]">Checking it against the course material…</p>}
              </div>
            ))}
          </div>

          <form
            onSubmit={e => { e.preventDefault(); ask(q); }}
            className="flex items-end gap-2 p-3 border-t-2 border-[var(--ink)] bg-[var(--paper-2)]"
          >
            <textarea
              ref={input}
              value={q}
              rows={1}
              maxLength={2000}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(q); } }}
              placeholder="Ask about CSE110"
              aria-label="Your question"
              className="flex-1 resize-none max-h-32 px-3 py-2 text-sm bg-[var(--paper-card)] text-[var(--ink)] border-2 border-[var(--ink)] rounded-xs outline-none focus:border-[var(--blue)]"
            />
            <button type="submit" disabled={busy || !q.trim()} className="px-3 py-2 border-2 border-[var(--ink)] rounded-xs bg-[var(--ink)] text-[var(--paper)] font-display font-black uppercase tracking-wider text-xs disabled:opacity-40 cursor-pointer disabled:cursor-default">
              Ask
            </button>
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
.tc-answer p { margin: 0 0 .6rem; }
.tc-answer ul, .tc-answer ol { margin: 0 0 .6rem; padding-left: 1.2rem; list-style: disc; }
.tc-answer ol { list-style: decimal; }
.tc-answer li { margin: .2rem 0; }
.tc-answer strong { font-weight: 700; }
.tc-answer h4 { font-weight: 800; margin: .8rem 0 .3rem; }
.tc-ic { font-family: var(--mono); font-size: .85em; padding: 1px 4px; background: var(--paper-2); border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent); border-radius: 2px; }
.tc-code { margin: 0 0 .7rem; border: 2px solid var(--ink); border-radius: 2px; overflow: hidden; background: #1e1e1e; }
.tc-code-head { padding: 4px 10px; background: #2d2d2d; color: #c5c5c5; font: 11px var(--mono); text-transform: lowercase; }
.tc-code pre { margin: 0; padding: 10px 12px; overflow-x: auto; color: #d4d4d4; font: 12.5px/1.55 var(--mono); }
.tc-table { margin: 0 0 .7rem; overflow-x: auto; border: 2px solid var(--ink); border-radius: 2px; }
.tc-table table { width: 100%; border-collapse: collapse; font-size: 13px; }
.tc-table th, .tc-table td { padding: 6px 8px; text-align: left; vertical-align: top; border-bottom: 1px solid color-mix(in srgb, var(--ink) 20%, transparent); }
.tc-table th { background: var(--paper-2); font-weight: 800; }
.tc-table tr:last-child td { border-bottom: 0; }
.tc-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--blue); animation: tc-pulse 1s ease-in-out infinite; }
@keyframes tc-pulse { 50% { opacity: .3; } }
.tc-key { filter: drop-shadow(0 10px 14px rgba(0,0,0,.35)); }
.tc-bubble { display: grid; place-items: center; }
.tc-typing { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 1.5px; padding-bottom: 1px; opacity: 0; transition: opacity .2s; }
.tc-typing i { width: 2.5px; height: 2.5px; border-radius: 50%; background: currentColor; animation: tc-typing 1s infinite ease-in-out; }
.tc-typing i:nth-child(2) { animation-delay: .15s; }
.tc-typing i:nth-child(3) { animation-delay: .3s; }
.tc-key:hover .tc-typing { opacity: 1; }
@keyframes tc-typing { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-2px); } }
@media (prefers-reduced-motion: reduce) { .tc-dot, .tc-typing i { animation: none; } }
`;
