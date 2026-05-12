import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import Fuse from 'fuse.js';
import type { ClipItem } from '@shared/types';
import { Logo } from './Logo';
import { Chip, timeAgo, itemSubtitle } from './components';

const api = window.quickclip;

function useClips() {
  const [items, setItems] = useState<ClipItem[]>([]);
  const [query, setQuery] = useState('');

  const refresh = async () => {
    const list = await api.list();
    setItems(list);
  };

  useEffect(() => {
    refresh();
    const off = api.onUpdate(() => refresh());
    return () => off();
  }, []);

  const fuse = useMemo(() => {
    return new Fuse(items, {
      keys: [
        { name: 'content', weight: 0.5 },
        { name: 'preview', weight: 0.2 },
        { name: 'ocrText', weight: 0.6 },
        { name: 'linkTitle', weight: 0.5 },
        { name: 'linkDescription', weight: 0.3 }
      ],
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true
    });
  }, [items]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const results = fuse.search(query.trim()).map((r) => r.item);
    // keep pinned on top even during search
    const pinned = results.filter((c) => c.pinned);
    const rest = results.filter((c) => !c.pinned);
    return [...pinned, ...rest];
  }, [items, fuse, query]);

  return { items: filtered, query, setQuery, refresh };
}

function Preview({ clip }: { clip: ClipItem | null }) {
  if (!clip) return (
    <div className="h-full flex items-center justify-center text-xs text-qc-muted">
      Select an item to preview
    </div>
  );

  if (clip.type === 'image' && clip.imageDataUrl) {
    return (
      <div className="p-3 space-y-2 h-full overflow-auto qc-scroll">
        <img
          src={clip.imageDataUrl}
          alt="clip"
          className="w-full rounded border border-qc-border object-contain max-h-52"
        />
        {clip.ocrStatus === 'pending' && (
          <div className="text-[11px] text-qc-muted italic">Running OCR...</div>
        )}
        {clip.ocrText && (
          <div className="text-[11px] text-qc-muted whitespace-pre-wrap leading-relaxed">
            {clip.ocrText}
          </div>
        )}
      </div>
    );
  }

  if ((clip.type === 'url' || clip.category === 'url') && clip.linkStatus !== 'none') {
    return (
      <div className="p-3 space-y-2 h-full overflow-auto qc-scroll">
        {clip.linkImage && (
          <img
            src={clip.linkImage}
            alt=""
            className="w-full rounded border border-qc-border object-cover max-h-40"
            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          />
        )}
        <div className="text-sm font-medium">{clip.linkTitle || clip.content}</div>
        {clip.linkDescription && (
          <div className="text-[11px] text-qc-muted leading-relaxed">{clip.linkDescription}</div>
        )}
        <div className="text-[10px] text-qc-accent break-all">{clip.content}</div>
        {clip.linkStatus === 'pending' && (
          <div className="text-[11px] text-qc-muted italic">Fetching preview...</div>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 h-full overflow-auto qc-scroll">
      <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono text-qc-text">
        {clip.content}
      </pre>
    </div>
  );
}

function Row({
  clip,
  active,
  onClick,
  onPaste,
  onPin,
  onDelete
}: {
  clip: ClipItem;
  active: boolean;
  onClick: () => void;
  onPaste: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onPaste}
      className={`qc-card rounded-md px-2.5 py-2 cursor-pointer transition-colors
        hover:border-qc-accent/40 ${active ? 'qc-row-active' : ''}`}
    >
      <div className="flex items-center gap-2">
        {clip.type === 'image' && clip.imageDataUrl ? (
          <img
            src={clip.imageDataUrl}
            alt=""
            className="w-8 h-8 object-cover rounded border border-qc-border shrink-0"
          />
        ) : (
          <div className="shrink-0">
            <Chip category={clip.category} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] truncate text-qc-text">
            {clip.type === 'image'
              ? clip.ocrText?.trim() || 'Image'
              : (clip.preview ?? clip.content ?? '').replace(/\s+/g, ' ').slice(0, 100) || '(empty)'}
          </div>
          <div className="text-[10px] text-qc-muted truncate">
            {itemSubtitle(clip)}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-qc-muted">{timeAgo(clip.updatedAt)}</span>
          <button
            title={clip.pinned ? 'Unpin' : 'Pin'}
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
            className={`text-xs w-5 h-5 rounded hover:bg-qc-panel2 flex items-center justify-center
              ${clip.pinned ? 'text-qc-accent' : 'text-qc-muted hover:text-qc-text'}`}
          >
            ★
          </button>
          <button
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-xs w-5 h-5 rounded hover:bg-qc-panel2 text-qc-muted hover:text-red-400 flex items-center justify-center"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { items, query, setQuery } = useClips();
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const focusInput = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
      setActiveIdx(0);
    };
    focusInput();
    const off = api.onUpdate(() => {
      // when window shown we get quickpaste:shown too
    });
    window.addEventListener('focus', focusInput);
    return () => {
      off();
      window.removeEventListener('focus', focusInput);
    };
  }, []);

  useEffect(() => {
    // clamp activeIdx
    if (activeIdx >= items.length) setActiveIdx(Math.max(0, items.length - 1));
  }, [items.length, activeIdx]);

  useEffect(() => {
    // scroll active row into view
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const paste = (id: number) => api.paste(id);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      api.hide();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[activeIdx];
      if (item) paste(item.id);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Delete') {
      e.preventDefault();
      const item = items[activeIdx];
      if (item) api.delete(item.id);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      const item = items[activeIdx];
      if (item) api.togglePin(item.id);
    } else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      api.openSettings();
    }
  };

  const active = items[activeIdx] ?? null;

  return (
    <div
      onKeyDown={handleKey}
      className="h-screen w-screen qc-gradient flex flex-col border border-qc-border rounded-lg overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-qc-border titlebar-drag">
        <Logo size={16} />
        <div className="ml-auto no-drag flex items-center gap-2">
          <span className="qc-kbd">↑↓</span>
          <span className="qc-kbd">Enter</span>
          <span className="qc-kbd">Esc</span>
          <button
            onClick={() => api.openSettings()}
            className="text-[11px] text-qc-muted hover:text-qc-text px-1.5 py-0.5 rounded no-drag"
            title="Settings (Ctrl+,)"
          >
            ⚙
          </button>
        </div>
      </div>

      <div className="p-2 border-b border-qc-border">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search history, OCR text, link titles..."
          className="w-full bg-qc-panel2 border border-qc-border focus:border-qc-accent outline-none
                     text-[13px] px-3 py-2 rounded-md text-qc-text placeholder:text-qc-muted"
          autoFocus
        />
      </div>

      <div className="flex-1 flex min-h-0">
        <div
          ref={listRef}
          className="flex-1 overflow-auto qc-scroll p-2 space-y-1.5 min-w-0"
        >
          {items.length === 0 ? (
            <div className="text-center text-xs text-qc-muted py-8">
              {query ? 'No matches.' : 'Clipboard history is empty. Copy something.'}
            </div>
          ) : (
            items.map((clip, i) => (
              <div key={clip.id} data-idx={i}>
                <Row
                  clip={clip}
                  active={i === activeIdx}
                  onClick={() => setActiveIdx(i)}
                  onPaste={() => paste(clip.id)}
                  onPin={() => api.togglePin(clip.id)}
                  onDelete={() => api.delete(clip.id)}
                />
              </div>
            ))
          )}
        </div>

        <div className="w-[210px] border-l border-qc-border bg-qc-panel/40 shrink-0">
          <Preview clip={active} />
        </div>
      </div>

      <div className="px-3 py-1.5 border-t border-qc-border flex items-center gap-3 text-[10px] text-qc-muted">
        <span>{items.length} items</span>
        <span className="ml-auto flex items-center gap-1">
          <span className="qc-kbd">Ctrl</span>+<span className="qc-kbd">P</span> pin
          <span className="mx-1">·</span>
          <span className="qc-kbd">Ctrl</span>+<span className="qc-kbd">Del</span> delete
        </span>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
