import { useState } from 'react';
import { SkullSharp, Archive, Undo, BookOpen } from 'pixelarticons/react';
import type { NoteRow } from '../lib/notesDb';

const CARD_W = 192;
const CARD_H = 264;
export const MEMO_RADIUS = CARD_H / 2 + 520;
export const MEMO_ANGLE_STEP = 11;
const R = MEMO_RADIUS;
const ANGLE_STEP = MEMO_ANGLE_STEP;
const FONT = "var(--font-main), var(--font-kr), monospace";
const d2r = (d: number) => (d * Math.PI) / 180;
function fmtStamp(ts: string): string {
  const utc = ts.endsWith('Z') || ts.includes('+') ? ts : ts.replace(' ', 'T') + 'Z';
  const d = new Date(utc);
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const hm  = `${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
  return `[${ymd}--${hm}]`;
}

interface CardProps {
  memo:       NoteRow;
  absIdx:     number;
  selIdx:     number;
  isEditing:  boolean;
  draft:      string;
  onDraft:    (v: string) => void;
  onClick:    () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onPromote?: () => void;
  onDelete:   () => void;
  onDblClick: () => void;
}

export function MemoCard({ memo, absIdx, selIdx, isEditing, draft, onDraft, onClick, onArchive, onRestore, onPromote, onDelete, onDblClick }: CardProps) {
  const offset   = absIdx - selIdx;
  const absOff   = Math.abs(offset);
  const isSel    = offset === 0;
  const arcAngle = absIdx * ANGLE_STEP;
  const rad      = d2r(arcAngle);
  const cardLeft = R * Math.sin(rad) - CARD_W / 2;
  const cardTop  = -R * Math.cos(rad) - CARD_H / 2;

  const scale     = isSel ? 1.28 : Math.max(0.74, 1 - absOff * 0.09);
  const localXfrm = `rotate(${arcAngle}deg) scale(${scale})`;

  const brightness = isSel ? 1 : Math.max(0.28, 1 - absOff * 0.22);
  const zIndex     = 100 - absOff * 10;
  const bgL        = Math.max(78, 95 - absOff * 7);
  const bg      = isSel ? '#f0f0f0' : `hsl(0,0%,${bgL}%)`;
  const shadow  = isSel
    ? '0 12px 48px rgba(0,0,0,0.7), 0 3px 12px rgba(0,0,0,0.4)'
    : `0 ${3 + absOff * 2}px ${10 + absOff * 6}px rgba(0,0,0,${0.2 + absOff * 0.07})`;

  return (
    <div
      onClick={isSel ? undefined : onClick}
      onDoubleClick={isSel ? onDblClick : undefined}
      style={{
        position:        'absolute',
        width:           CARD_W,
        height:          CARD_H,
        left:            cardLeft,
        top:             cardTop,
        transform:       localXfrm,
        transformOrigin: 'center center',
        transition:      'transform 0.46s cubic-bezier(0.22, 1, 0.36, 1), filter 0.46s cubic-bezier(0.22, 1, 0.36, 1)',
        filter:          isSel ? 'none' : `brightness(${brightness})`,
        zIndex,
        cursor:          isSel ? 'default' : 'pointer',
        userSelect:      'none',
        background:      bg,
        boxShadow:       shadow,
        border:          '1px solid rgba(0,0,0,0.12)',
        display:         'flex',
        flexDirection:   'column',
        overflow:        'hidden',
        boxSizing:       'border-box',
      }}
    >
      {/* Timestamp — centered blue */}
      <div style={{
        fontFamily: FONT, fontSize: '1rem', color: '#2244bb',
        padding: '10px 11px 3px', letterSpacing: 0.3,
        flexShrink: 0, lineHeight: 1, textAlign: 'center',
      }}>
        {fmtStamp(memo.created_at)}
      </div>

      {/* Thin separator */}
      <div style={{ height: 1, background: 'rgba(34,68,187,0.15)', margin: '4px 10px 0' }} />

      {/* Body */}
      {isEditing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={e => onDraft(e.target.value)}
          onClick={e => e.stopPropagation()}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            resize: 'none', fontFamily: FONT, fontSize: '1.2rem', color: '#111',
            padding: '8px 12px 8px', lineHeight: 1.45,
          }}
        />
      ) : (
        <div style={{
          flex: 1, fontFamily: FONT, fontSize: '1.2rem', color: '#111',
          padding: '8px 12px 8px', lineHeight: 1.45,
          overflow: 'hidden', wordBreak: 'break-word', whiteSpace: 'pre-wrap',
        }}>
          {memo.content_plain || <span style={{ color: '#bbb' }}>empty</span>}
        </div>
      )}

      {/* Action bar — always visible on selected card */}
      {isSel && (
        <div
          style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            borderTop: '1px solid rgba(0,0,0,0.09)',
            flexShrink: 0,
            background: 'rgba(0,0,0,0.05)',
          }}
        >
            {/* Left: Archive / Restore */}
            {onArchive && (
              <IconBtn
                onClick={onArchive}
                color="#777"
                title="archive"
              >
                <Archive width={15} height={15} />
              </IconBtn>
            )}
            {onRestore && (
              <IconBtn
                onClick={onRestore}
                color="#00c4a7"
                title="restore"
              >
                <Undo width={15} height={15} />
              </IconBtn>
            )}
            {!onArchive && !onRestore && <div style={{ width: 26 }} />}

            {/* Center: Turn into doc (active view only) */}
            {onPromote ? (
              <button
                onClick={e => { e.stopPropagation(); onPromote(); }}
                style={{
                  fontFamily: FONT, fontSize: '0.78rem', letterSpacing: 0.4,
                  background: 'transparent',
                  border: '1px solid #22bb77',
                  color: '#22bb77',
                  padding: '2px 7px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 3,
                  transition: 'background 0.12s, color 0.12s',
                  lineHeight: 1.4,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#22bb7722';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <BookOpen width={12} height={12} />
                doc
              </button>
            ) : (
              <div style={{ width: 44 }} />
            )}

            {/* Right: Delete */}
            <IconBtn
              onClick={onDelete}
              color="#bb2222"
              title="delete"
            >
              <SkullSharp width={15} height={15} />
            </IconBtn>
        </div>
      )}
    </div>
  );
}

function IconBtn({ onClick, color, title, children }: {
  onClick: () => void;
  color: string;
  title: string;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={title}
      style={{
        background: hov ? `${color}22` : 'transparent',
        border: `1px solid ${hov ? color : 'transparent'}`,
        color,
        padding: '2px 4px',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.12s, border-color 0.12s',
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}
