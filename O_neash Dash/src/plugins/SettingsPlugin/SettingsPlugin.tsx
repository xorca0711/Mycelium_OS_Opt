import { useState, useEffect, useRef } from 'react';
import { WidgetStudio } from './sections/WidgetStudio';
import { ArcVisibility } from './sections/ArcVisibility';
import { Appearance } from './sections/Appearance';
import { PersonalSettings } from './sections/PersonalSettings';

type Section = 'personal' | 'widgets' | 'general' | 'appearance';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'personal',    label: 'PERSONAL'      },
  { id: 'widgets',     label: 'WIDGET STUDIO' },
  { id: 'general',     label: 'ARC VISIBILITY'},
  { id: 'appearance',  label: 'APPEARANCE'    },
];

function SettingsPlugin() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = SECTIONS[activeIdx].id;
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
      const target = e.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, button, a, [contenteditable="true"], [role="combobox"], [role="textbox"]'))) return;

      const numIdx = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1;
      if (!isNaN(numIdx) && numIdx >= 0 && numIdx < SECTIONS.length) {
        setActiveIdx(numIdx);
        return;
      }
      if (e.key === 'ArrowRight') setActiveIdx(i => Math.min(i + 1, SECTIONS.length - 1));
      if (e.key === 'ArrowLeft')  setActiveIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      fontFamily: "var(--font-main), var(--font-kr), monospace", boxSizing: 'border-box',
      padding: 'clamp(24px, 5vh, 48px) clamp(20px, 6vw, 90px)', minHeight: 0, minWidth: 0,
    }}>
      <style>{`.settings-tabs button:focus-visible { outline: 2px solid #00c4a7; outline-offset: 6px; border-radius: 2px; }`}</style>

      {/* ── Top nav — same pattern as LaunchMenu category row ── */}
      <div className="settings-tabs" role="tablist" aria-label="Settings sections" onKeyDown={event => {
        if (!(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'tab') return;
        const next = event.key === 'ArrowRight' ? (activeIdx + 1) % SECTIONS.length
          : event.key === 'ArrowLeft' ? (activeIdx - 1 + SECTIONS.length) % SECTIONS.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? SECTIONS.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        setActiveIdx(next);
        tabs.current[next]?.focus();
      }} style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.25rem',
        paddingBottom: '0.8rem',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        {SECTIONS.map((s, i) => {
          const sel = activeIdx === i;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`settings-tab-${s.id}`}
              aria-selected={sel}
              aria-controls={`settings-panel-${s.id}`}
              tabIndex={sel ? 0 : -1}
              ref={element => { tabs.current[i] = element; }}
              onClick={() => setActiveIdx(i)}
              style={{
                background: 'none', border: 'none', padding: 0,
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: '0.4rem', lineHeight: 1, transition: 'all 0.12s ease',
              }}
            >
              <span style={{
                fontSize: '1.2rem',
                color: sel ? '#00c4a7' : 'rgba(255,255,255,0.22)',
                transition: 'color 0.12s ease',
              }}>
                {i + 1}
              </span>
              <span style={{
                fontSize:      'clamp(1.15rem, 2vw, 1.65rem)',
                color:         sel ? '#fff' : 'rgba(255,255,255,0.28)',
                textTransform: sel ? 'uppercase' : 'lowercase',
                letterSpacing: '1.5px',
                transition: 'font-size 0.12s ease, color 0.12s ease',
              }}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, marginTop: '1.5rem', overflowY: 'auto', overflowX: 'hidden', padding: '4px' }}>
        <div id="settings-panel-personal" role="tabpanel" aria-labelledby="settings-tab-personal" hidden={active !== 'personal'}><PersonalSettings /></div>
        {active !== 'personal' && <div id={`settings-panel-${active}`} role="tabpanel" aria-labelledby={`settings-tab-${active}`} style={{ height: '100%' }}>
          {active === 'widgets' && <WidgetStudio />}
          {active === 'general' && <ArcVisibility />}
          {active === 'appearance' && <Appearance />}
        </div>}
      </div>

    </div>
  );
}

export default SettingsPlugin;
