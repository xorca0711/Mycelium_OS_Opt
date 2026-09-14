import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { MemoCard, MEMO_RADIUS as R, MEMO_ANGLE_STEP as ANGLE_STEP } from '../components/MemoCard';
import { toast } from '@/components/ui/sonner';
import { useNotesStore } from '../store/useNotesStore';
import { loadNotes } from '../lib/notesDb';
import type { NoteRow } from '../lib/notesDb';
import { ArcProjectModal } from '../components/ArcProjectModal';

// ── constants ────────────────────────────────────────────────────────────────
const MAX_MEMOS  = 50;
const WINDOW     = 3;
const FONT       = "var(--font-main), var(--font-kr), monospace";

// ── helpers ───────────────────────────────────────────────────────────────────

function barColor(pct: number) {
  if (pct < 0.6) return '#00c4a7';
  if (pct < 0.85) return '#f5c842';
  return '#ff3b3b';
}

function memoToTipTapJson(content: string): string {
  const paragraphs = content.split('\n').map(line => ({
    type: 'paragraph',
    content: line.trim() ? [{ type: 'text', text: line }] : [],
  }));
  return JSON.stringify({ type: 'doc', content: paragraphs });
}

// ── AnimatedPlaceholder ───────────────────────────────────────────────────────

const PLACEHOLDER_CHARS = "speak your mind".split('');
const STAGGER           = 0.045;
const CHAR_DUR          = 0.22;
const STAGGER_TOTAL     = PLACEHOLDER_CHARS.length * STAGGER + CHAR_DUR + 0.05;

function AnimatedPlaceholder({ visible }: { visible: boolean }) {
  const [waving, setWaving] = useState(false);

  useEffect(() => {
    if (!visible) { setWaving(false); return; }
    const t = setTimeout(() => setWaving(true), STAGGER_TOTAL * 1000);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          style={{
            position: 'absolute', left: 14, top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex', pointerEvents: 'none',
            fontFamily: FONT, fontSize: '1.2rem', letterSpacing: 1,
          }}
        >
          {PLACEHOLDER_CHARS.map((ch, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={waving ? {
                y:       [0, -3, 0],
                opacity: ch === ' ' ? 0 : [0.5, 0.8, 0.5],
              } : {
                opacity: ch === ' ' ? 0 : 0.65,
                y: 0,
              }}
              transition={waving ? {
                y:       { duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.09, repeatDelay: 2 },
                opacity: { duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.09, repeatDelay: 2 },
              } : {
                delay: i * STAGGER, duration: CHAR_DUR, ease: 'easeOut',
              }}
              style={{ display: 'inline-block', color: 'rgba(255,255,255,0.65)' }}
            >
              {ch === ' ' ? '\u00a0' : ch}
            </motion.span>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── MemoPool ──────────────────────────────────────────────────────────────────
interface MemoPoolProps {
  onPromoteToDoc?: (doc: NoteRow) => void;
  pendingMemoId?:  string | null;
  onMemoFocused?:  () => void;
}

function reportMemoSaveError(error: unknown): void {
  toast.error('Memo changes could not be saved. Your draft is retained.', {
    description: String(error), duration: Infinity,
    action: { label: 'Retry save', onClick: () => { void useNotesStore.getState().flushAllDocuments().catch(reportMemoSaveError); } },
  });
}

export default function MemoPool({ onPromoteToDoc, pendingMemoId, onMemoFocused }: MemoPoolProps) {
  const {
    memos, archivedMemos,
    loadMemos, loadArchivedMemos,
    createMemo, updateMemo,
    archiveMemo, restoreMemo, deleteNote,
    createDocument, updateDocument, flushMemo, flushAllDocuments, saveStates,
  } = useNotesStore();
  const [view, setView] = useState<'active' | 'archived'>('active');
  const visibleMemos = view === 'active' ? memos : archivedMemos;

  const [selIdx,      setSelIdx]      = useState(0);
  const [input,       setInput]       = useState('');
  const [editId,      setEditId]      = useState<string | null>(null);
  const draft = memos.find(memo => memo.id === editId)?.content_plain ?? '';
  const [focused,     setFocused]     = useState(false);
  const [pulseKey,    setPulseKey]    = useState(0);
  const [launchItem,  setLaunchItem]  = useState<{ text: string; x: number; y: number } | null>(null);
  const [promoteMemo, setPromoteMemo] = useState<NoteRow | null>(null);
  const boxRef       = useRef<HTMLDivElement>(null);
  const squishCtrl   = useAnimationControls();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerH, setContainerH] = useState(560);
  useEffect(() => {
    void Promise.all([loadMemos(), loadArchivedMemos()]).catch(reportMemoSaveError);
    return () => { void flushAllDocuments().catch(reportMemoSaveError); };
  }, [loadMemos, loadArchivedMemos, flushAllDocuments]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setContainerH(e.contentRect.height));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (visibleMemos.length === 0) { setSelIdx(0); return; }
    setSelIdx(i => Math.min(i, visibleMemos.length - 1));
  }, [visibleMemos.length]);

  useEffect(() => {
    if (!pendingMemoId || memos.length === 0) return;
    const idx = memos.findIndex(m => m.id === pendingMemoId);
    if (idx !== -1) {
      setView('active');
      setSelIdx(idx);
      onMemoFocused?.();
    }
  }, [pendingMemoId, memos]);

  const pivotY = containerH * 0.42 + R;

  const startEdit = useCallback((id: string) => {
    setEditId(id);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editId) return;
    void flushMemo(editId).catch(reportMemoSaveError);
    setEditId(null);
  }, [editId, flushMemo]);

  const handleDraft = (val: string) => {
    if (!editId) return;
    void updateMemo(editId, val).catch(error => {
      if (useNotesStore.getState().saveStates[editId]?.status === 'error') reportMemoSaveError(error);
    });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft')  { setSelIdx(i => Math.max(0, i - 1)); setEditId(null); }
      if (e.key === 'ArrowRight') { setSelIdx(i => Math.min(visibleMemos.length - 1, i + 1)); setEditId(null); }
      if (e.key === 'Escape')     { commitEdit(); }
      if (e.key === 'Enter' && visibleMemos.length > 0 && !editId) {
        const m = visibleMemos[selIdx];
        if (m) startEdit(m.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visibleMemos, selIdx, editId, startEdit, commitEdit]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text) return;

    const rect = boxRef.current?.getBoundingClientRect();
    const lx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const ly = rect ? rect.top + rect.height / 2 : window.innerHeight * 0.75;

    squishCtrl.start({
      scaleY: [1, 0.78, 1.07, 1],
      scaleX: [1, 1.05, 0.97, 1],
      transition: { duration: 0.42, times: [0, 0.28, 0.65, 1], ease: 'easeOut' },
    });
    setLaunchItem({ text, x: lx, y: ly });

    setInput('');
    await createMemo(text);
    setSelIdx(0);
  };

  const handleArchive = async (id: string) => {
    commitEdit();
    try { await archiveMemo(id); setSelIdx(i => Math.max(0, i - 1)); }
    catch (error) { reportMemoSaveError(error); }
  };

  const handleDelete = async (id: string) => {
    commitEdit();
    try { await deleteNote(id); setSelIdx(i => Math.max(0, i - 1)); }
    catch (error) { reportMemoSaveError(error); }
  };

  const handlePromoteConfirm = async (arcId: string | null, projectId: string | null) => {
    if (!promoteMemo) return;
    await flushMemo(promoteMemo.id);
    const content = useNotesStore.getState().memos.find(memo => memo.id === promoteMemo.id)?.content_plain ?? '';
    const title = content.split('\n')[0].trim().slice(0, 80) || 'Untitled';
    const contentJson = memoToTipTapJson(content);

    // Create the new document
    const newDocId = await createDocument(title, arcId, projectId);
    await updateDocument(newDocId, title, contentJson);
    // Archive the original memo
    await archiveMemo(promoteMemo.id);

    setPromoteMemo(null);
    setSelIdx(i => Math.max(0, i - 1));

    // Open the new doc in DocumentsView
    if (onPromoteToDoc) {
      const docs = await loadNotes('document');
      const newDoc = docs.find(d => d.id === newDocId) ?? null;
      if (newDoc) onPromoteToDoc(newDoc);
    }
  };

  const startIdx = Math.max(0, selIdx - WINDOW);
  const endIdx   = Math.min(visibleMemos.length - 1, selIdx + WINDOW);

  const pct    = memos.length / MAX_MEMOS;
  const bColor = barColor(pct);
  const selectedId = visibleMemos[selIdx]?.id;
  const saveState = selectedId ? saveStates[selectedId] : undefined;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000' }}
      onClick={() => { if (editId) commitEdit(); }}
    >
      {/* ── Promote modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {promoteMemo && (
          <ArcProjectModal
            title="turn into doc"
            subtitle={`"${(promoteMemo.content_plain ?? '').split('\n')[0].trim().slice(0, 60) || 'Untitled'}"`}
            confirmLabel="create doc →"
            onConfirm={(arcId, projectId) => { void handlePromoteConfirm(arcId, projectId).catch(reportMemoSaveError); }}
            onCancel={() => setPromoteMemo(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Storage indicator ─────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 22, left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 20,
        zIndex: 200, pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        <div style={{ textAlign: 'center', lineHeight: 1 }}>
          <div style={{ fontFamily: FONT, fontSize: '2.6rem', color: '#fff', letterSpacing: 1, lineHeight: 1 }}>
            {memos.length}
          </div>
          <div style={{ fontFamily: FONT, fontSize: '1.3rem', color: 'rgba(255,255,255,0.38)', letterSpacing: 2, marginTop: 1 }}>
            memos
          </div>
        </div>
        <div>
          <div style={{ fontFamily: FONT, fontSize: '0.9rem', color: 'rgba(255,255,255,0.45)', letterSpacing: 1, marginBottom: 5 }}>
            memo pool storage: <span style={{ color: bColor, fontSize: '1.3rem' }}>{Math.round(pct * 100)}%</span>
          </div>
          <div style={{ width: 180, height: 7, background: 'rgba(255,255,255,0.1)' }}>
            <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: bColor, transition: 'width 0.4s, background 0.4s' }} />
          </div>
        </div>
      </div>

      {/* ── View toggle ───────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 110, left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', zIndex: 200,
      }}>
        {(['active', 'archived'] as const).map(v => (
          <button
            key={v}
            onClick={() => { setView(v); setSelIdx(0); setEditId(null); }}
            style={{
              fontFamily: FONT, fontSize: '0.82rem', letterSpacing: 1.5,
              background: view === v ? 'rgba(255,255,255,0.08)' : 'transparent',
              border: `1px solid ${view === v ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
              color: view === v ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.28)',
              padding: '2px 14px', cursor: 'pointer', textTransform: 'uppercase',
              transition: 'all 0.15s',
            }}
          >
            {v === 'active' ? 'pool' : `archive${archivedMemos.length > 0 ? ` (${archivedMemos.length})` : ''}`}
          </button>
        ))}
      </div>

      {saveState && saveState.status !== 'saved' && <div role={saveState.status === 'error' ? 'alert' : 'status'} style={{ position: 'absolute', top: 143, left: '50%', transform: 'translateX(-50%)', zIndex: 201, color: saveState.status === 'error' ? '#ff9999' : '#aaa', fontFamily: FONT, maxWidth: '90%', textAlign: 'center' }}>
        {saveState.status === 'error' ? <>Memo save failed. Draft retained. <button type="button" onClick={event => { event.stopPropagation(); if (selectedId) void flushMemo(selectedId).catch(reportMemoSaveError); }}>Retry save</button></> : 'Saving memo…'}
      </div>}

      {/* ── Arc pivot div ─────────────────────────────────────────── */}
      <div style={{
        position:   'absolute',
        left:       '50%',
        top:        pivotY,
        width:      0,
        height:     0,
        transform:  `rotate(${-selIdx * ANGLE_STEP}deg)`,
        transition: 'transform 0.46s cubic-bezier(0.22, 1, 0.36, 1)',
        zIndex:     100,
      }}>
        {visibleMemos.slice(startIdx, endIdx + 1).map((memo, localIdx) => {
          const absIdx = startIdx + localIdx;
          return (
            <MemoCard
              key={memo.id}
              memo={memo}
              absIdx={absIdx}
              selIdx={selIdx}
              isEditing={absIdx === selIdx && editId === memo.id}
              draft={draft}
              onDraft={handleDraft}
              onClick={() => { setSelIdx(absIdx); setEditId(null); }}
              onDblClick={() => view === 'active' ? startEdit(memo.id) : undefined}
              onArchive={view === 'active' ? () => handleArchive(memo.id) : undefined}
              onRestore={view === 'archived' ? () => { void restoreMemo(memo.id).then(() => setSelIdx(i => Math.max(0, i - 1))).catch(reportMemoSaveError); } : undefined}
              onPromote={view === 'active' ? () => setPromoteMemo(memo) : undefined}
              onDelete={() => handleDelete(memo.id)}
            />
          );
        })}
      </div>

      {visibleMemos.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontFamily: FONT, color: 'rgba(255,255,255,0.1)', fontSize: '1.1rem', letterSpacing: 3 }}>
            {view === 'active' ? 'the pool is empty' : 'no archived memos'}
          </span>
        </div>
      )}

      {view === 'active' && (<>
      {/* ── Launch ghost ──────────────────────────────────────────── */}
      {launchItem && createPortal(
        <motion.div
          initial={{ opacity: 1, scale: 1, y: 0 }}
          animate={{ opacity: 0, scale: 0.55, y: -260 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={() => setLaunchItem(null)}
          style={{
            position: 'fixed',
            left: launchItem.x, top: launchItem.y,
            translateX: '-50%', translateY: '-50%',
            fontFamily: FONT, fontSize: '1.2rem', letterSpacing: 1,
            color: '#00c4a7',
            textShadow: '0 0 22px rgba(0,196,167,0.7)',
            pointerEvents: 'none', zIndex: 9999,
            whiteSpace: 'nowrap',
          }}
        >
          {launchItem.text}
        </motion.div>,
        document.body
      )}

      {/* ── Input bar ─────────────────────────────────────────────── */}
      <motion.div
        ref={boxRef}
        animate={squishCtrl}
        style={{
          position: 'absolute', bottom: 155, left: '50%',
          translateX: '-50%', zIndex: 300,
        }}
      >
      <motion.div
        animate={{
          borderColor:     focused ? 'rgba(0,196,167,0.55)' : 'rgba(255,255,255,0.2)',
          boxShadow:       focused
            ? '0 0 0 1px rgba(0,196,167,0.2), 0 0 28px rgba(0,196,167,0.15)'
            : '0 0 0 0px rgba(0,196,167,0)',
          backgroundColor: focused ? 'rgba(0,12,10,0.96)' : 'rgba(0,0,0,0.92)',
          width:           focused ? 480 : 440,
          y:               focused ? -6  : 0,
        }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: 'flex', alignItems: 'stretch',
          border: '1px solid rgba(255,255,255,0.2)',
          overflow: 'hidden',
        }}>

        {/* Keystroke pulse overlay */}
        <AnimatePresence>
          <motion.div
            key={pulseKey}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            style={{
              position: 'absolute', inset: -1,
              border: '2px solid rgba(0,196,167,1)',
              boxShadow: '0 0 18px rgba(0,196,167,0.55), inset 0 0 12px rgba(0,196,167,0.15)',
              pointerEvents: 'none', zIndex: 10,
            }}
          />
        </AnimatePresence>

        {/* Input + animated placeholder */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <AnimatedPlaceholder visible={!focused && !input} />
          <input
            value={input}
            onChange={e => { setInput(e.target.value); setPulseKey(k => k + 1); }}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder=""
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: 'rgba(255,255,255,0.72)', fontFamily: FONT,
              fontSize: '1.2rem', padding: '9px 14px', letterSpacing: 1, outline: 'none',
              width: '100%',
            }}
          />
        </div>

        {/* Animated arrow button */}
        <button
          onClick={handleSubmit}
          style={{
            background: 'none', border: 'none',
            borderLeft: '1px solid rgba(255,255,255,0.14)',
            color: 'rgba(255,255,255,0.4)',
            padding: '0 14px', cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            transition: 'color 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M8 13V3M3 8l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
            </svg>
          </motion.div>
        </button>
      </motion.div>
      </motion.div>
      </>)}
    </div>
  );
}
