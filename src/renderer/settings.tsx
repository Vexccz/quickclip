import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Logo } from './Logo';
import type { Settings } from '@shared/types';

const api = window.quickclip;

function App() {
  const [s, setS] = useState<Settings | null>(null);
  const [hotkeyCapture, setHotkeyCapture] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    api.getSettings().then(setS);
  }, []);

  const update = async (patch: Partial<Settings>) => {
    const next = await api.saveSettings(patch);
    setS(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 900);
  };

  if (!s) return null;

  return (
    <div className="h-screen w-screen qc-gradient flex flex-col">
      {/* custom titlebar */}
      <div className="h-9 flex items-center px-3 titlebar-drag border-b border-qc-border">
        <Logo size={16} />
        <span className="ml-2 text-[11px] text-qc-muted">Settings</span>
        <div className="ml-auto flex items-center gap-1 no-drag">
          <button
            onClick={() => api.minimizeWindow()}
            className="w-7 h-7 text-qc-muted hover:bg-qc-panel2 rounded"
            title="Minimize"
          >
            −
          </button>
          <button
            onClick={() => api.closeWindow()}
            className="w-7 h-7 text-qc-muted hover:bg-red-500/20 hover:text-red-400 rounded"
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto qc-scroll p-6 space-y-5 no-drag">
        <Section title="Hotkey">
          <div className="flex items-center gap-3">
            <div className="qc-card px-3 py-2 rounded-md font-mono text-sm min-w-[180px] text-center">
              {hotkeyCapture ? 'Press keys...' : s.hotkey}
            </div>
            <button
              onClick={() => setHotkeyCapture(true)}
              onKeyDown={(e) => {
                if (!hotkeyCapture) return;
                e.preventDefault();
                if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
                const parts: string[] = [];
                if (e.ctrlKey) parts.push('Ctrl');
                if (e.shiftKey) parts.push('Shift');
                if (e.altKey) parts.push('Alt');
                if (e.metaKey) parts.push('Super');
                const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
                parts.push(key);
                const accel = parts.join('+');
                setHotkeyCapture(false);
                update({ hotkey: accel });
              }}
              className="px-3 py-2 rounded-md bg-qc-accent/20 text-qc-accent border border-qc-accent/30 hover:bg-qc-accent/30 text-sm"
            >
              {hotkeyCapture ? 'Cancel' : 'Change'}
            </button>
            <div className="text-[11px] text-qc-muted">
              Opens the quick-paste window from anywhere.
            </div>
          </div>
        </Section>

        <Section title="History">
          <Row label="Max items">
            <input
              type="number"
              min={10}
              max={5000}
              value={s.maxHistory}
              onChange={(e) => update({ maxHistory: Math.max(10, Number(e.target.value) || 500) })}
              className="bg-qc-panel2 border border-qc-border rounded px-2 py-1 text-sm w-28"
            />
          </Row>
          <Row label="Spawn window at cursor">
            <Toggle
              value={s.spawnAtCursor}
              onChange={(v) => update({ spawnAtCursor: v })}
            />
          </Row>
          <div className="pt-2">
            <button
              onClick={() => {
                if (confirm('Clear all non-pinned clipboard history?')) api.clearAll();
              }}
              className="text-[12px] px-3 py-1.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              Clear history (keep pinned)
            </button>
          </div>
        </Section>

        <Section title="OCR">
          <Row label="Enable OCR on images">
            <Toggle value={s.ocrEnabled} onChange={(v) => update({ ocrEnabled: v })} />
          </Row>
          <Row label="Languages">
            <select
              value={s.ocrLanguages}
              onChange={(e) => update({ ocrLanguages: e.target.value })}
              className="bg-qc-panel2 border border-qc-border rounded px-2 py-1 text-sm"
            >
              <option value="eng">English</option>
              <option value="msa">Malay</option>
              <option value="eng+msa">English + Malay</option>
            </select>
          </Row>
          <p className="text-[11px] text-qc-muted">
            First run downloads ~10MB language pack. Runs in the background via tesseract.js.
          </p>
        </Section>

        <Section title="Link previews">
          <Row label="Fetch og:title and og:image when URL copied">
            <Toggle
              value={s.linkPreviewEnabled}
              onChange={(v) => update({ linkPreviewEnabled: v })}
            />
          </Row>
        </Section>

        <Section title="System">
          <Row label="Launch on startup">
            <Toggle
              value={s.launchOnStartup}
              onChange={(v) => update({ launchOnStartup: v })}
            />
          </Row>
        </Section>

        <div className="text-[11px] text-qc-muted">
          QuickClip v0.1.0 {savedFlash && <span className="text-qc-accent ml-2">Saved ✓</span>}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="qc-card rounded-lg p-4 space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-qc-accent">
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-qc-text">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full relative transition-colors ${
        value ? 'bg-qc-accent' : 'bg-qc-panel2 border border-qc-border'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          value ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
