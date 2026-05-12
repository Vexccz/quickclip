import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  ipcMain,
  clipboard,
  nativeImage,
  screen,
  shell,
  nativeTheme
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import * as db from './db';
import { ClipboardWatcher, ClipboardChange } from './clipboardWatcher';
import { detectCategory, extractFirstUrl } from '../shared/category';
import { runOcr, terminateOcr, broadcastUpdate } from './ocr';
import { fetchLinkPreview } from './linkPreview';
import type { ClipItem, Settings } from '../shared/types';

const isDev = process.env.NODE_ENV === 'development';

let quickPaste: BrowserWindow | null = null;
let settingsWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let watcher: ClipboardWatcher;
let currentHotkey = '';

// Ensure single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => toggleQuickPaste());
}

function resolveRenderer(page: 'quickpaste' | 'settings'): string {
  if (isDev) {
    return `http://localhost:5173/${page}.html`;
  }
  // In production, __dirname = <app>/dist-main/main. Renderer is in <app>/dist-renderer.
  return `file://${path.join(__dirname, '..', '..', 'dist-renderer', `${page}.html`)}`;
}

function iconPath(): string {
  const candidates = [
    path.join(__dirname, '..', '..', 'build', 'icon.png'),
    path.join(process.resourcesPath ?? '', 'build', 'icon.png'),
    path.join(app.getAppPath(), 'build', 'icon.png')
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return '';
}

function createQuickPaste(): BrowserWindow {
  const win = new BrowserWindow({
    width: 500,
    height: 600,
    show: false,
    frame: false,
    transparent: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    backgroundColor: '#0B0F14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.setMenuBarVisibility(false);
  win.loadURL(resolveRenderer('quickpaste')).catch((err) => console.error('loadURL failed:', err));

  win.on('blur', () => {
    if (win.isVisible()) win.hide();
  });

  win.on('closed', () => {
    if (quickPaste === win) quickPaste = null;
  });

  return win;
}

function createSettings(): BrowserWindow {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return settingsWin;
  }
  const win = new BrowserWindow({
    width: 720,
    height: 560,
    show: false,
    frame: false,
    resizable: true,
    backgroundColor: '#0B0F14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.setMenuBarVisibility(false);
  win.loadURL(resolveRenderer('settings')).catch((err) => console.error('loadURL failed:', err));
  win.on('ready-to-show', () => win.show());
  win.on('closed', () => {
    if (settingsWin === win) settingsWin = null;
  });
  settingsWin = win;
  return win;
}

function positionQuickPaste(win: BrowserWindow, settings: Settings): void {
  const bounds = win.getBounds();
  if (settings.spawnAtCursor) {
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    let x = cursor.x - Math.floor(bounds.width / 2);
    let y = cursor.y + 16;
    // clamp inside work area
    const wa = display.workArea;
    x = Math.max(wa.x + 8, Math.min(x, wa.x + wa.width - bounds.width - 8));
    y = Math.max(wa.y + 8, Math.min(y, wa.y + wa.height - bounds.height - 8));
    win.setBounds({ x, y, width: bounds.width, height: bounds.height });
  } else {
    const display = screen.getPrimaryDisplay();
    const wa = display.workArea;
    const x = wa.x + Math.floor((wa.width - bounds.width) / 2);
    const y = wa.y + Math.floor((wa.height - bounds.height) / 2);
    win.setBounds({ x, y, width: bounds.width, height: bounds.height });
  }
}

function toggleQuickPaste(): void {
  if (!quickPaste || quickPaste.isDestroyed()) {
    quickPaste = createQuickPaste();
    quickPaste.once('ready-to-show', () => {
      const s = db.loadSettings();
      positionQuickPaste(quickPaste!, s);
      quickPaste!.show();
      quickPaste!.focus();
      quickPaste!.webContents.send('quickpaste:shown');
    });
    return;
  }

  if (quickPaste.isVisible()) {
    quickPaste.hide();
  } else {
    const s = db.loadSettings();
    positionQuickPaste(quickPaste, s);
    quickPaste.show();
    quickPaste.focus();
    quickPaste.webContents.send('quickpaste:shown');
  }
}

function registerHotkey(accelerator: string): boolean {
  if (currentHotkey) globalShortcut.unregister(currentHotkey);
  const ok = globalShortcut.register(accelerator, toggleQuickPaste);
  if (ok) currentHotkey = accelerator;
  return ok;
}

function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: 'Open QuickClip', click: () => toggleQuickPaste() },
    { type: 'separator' },
    {
      label: 'Clear History (keep pinned)',
      click: () => {
        db.clearAll();
        broadcastUpdate();
      }
    },
    { label: 'Settings', click: () => createSettings() },
    { type: 'separator' },
    {
      label: 'Open Data Folder',
      click: () => shell.openPath(app.getPath('userData'))
    },
    { type: 'separator' },
    { label: 'Quit QuickClip', click: () => app.quit() }
  ]);
}

function setupTray(): void {
  const icon = iconPath();
  const img = icon ? nativeImage.createFromPath(icon) : nativeImage.createEmpty();
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 16, height: 16 }));
  tray.setToolTip('QuickClip');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => toggleQuickPaste());
}

function handleClipboardChange(change: ClipboardChange): void {
  try {
    if (change.type === 'text' && change.text) {
      const text = change.text;
      const url = /^https?:\/\/\S+$/i.test(text.trim()) ? text.trim() : extractFirstUrl(text);
      const category = detectCategory('text', text);
      const type = category === 'url' ? 'url' : 'text';

      const settings = db.loadSettings();
      const clip = db.upsertClip({
        type,
        category,
        content: text,
        preview: text.slice(0, 200),
        linkStatus: url && settings.linkPreviewEnabled ? 'pending' : 'none'
      });

      db.trimHistory(settings.maxHistory);
      broadcastUpdate();

      if (url && settings.linkPreviewEnabled) {
        fetchLinkPreview(clip.id, url, broadcastUpdate).catch(() => undefined);
      }
      return;
    }

    if (change.type === 'image' && change.image && change.imageDataUrl) {
      const settings = db.loadSettings();
      const clip = db.upsertClip({
        type: 'image',
        category: 'image',
        content: '',
        preview: '[image]',
        imageDataUrl: change.imageDataUrl,
        ocrStatus: settings.ocrEnabled ? 'pending' : 'none'
      });
      db.trimHistory(settings.maxHistory);
      broadcastUpdate();

      if (settings.ocrEnabled) {
        runOcr(clip.id, change.image, settings.ocrLanguages, broadcastUpdate).catch(() => undefined);
      }
      return;
    }

    if (change.type === 'file' && change.files && change.files.length) {
      const settings = db.loadSettings();
      const content = change.files.join('\n');
      db.upsertClip({
        type: 'file',
        category: 'file',
        content,
        preview: change.files.slice(0, 3).join(', ')
      });
      db.trimHistory(settings.maxHistory);
      broadcastUpdate();
    }
  } catch (err) {
    console.error('[clipboard] handle error:', err);
  }
}

function pasteClipById(id: number): void {
  const clip = db.getClip(id);
  if (!clip) return;

  watcher.pauseFor(1200);

  if (clip.type === 'image' && clip.imageDataUrl) {
    const img = nativeImage.createFromDataURL(clip.imageDataUrl);
    if (!img.isEmpty()) clipboard.writeImage(img);
  } else if (clip.type === 'file' && clip.content) {
    // Write first file path as text fallback (Electron can't easily do CF_HDROP cross-platform)
    clipboard.writeText(clip.content.split('\n')[0]);
  } else {
    clipboard.writeText(clip.content);
  }

  // Bump updatedAt
  db.upsertClip({
    type: clip.type,
    category: clip.category,
    content: clip.content,
    preview: clip.preview,
    imageDataUrl: clip.imageDataUrl
  });
  broadcastUpdate();

  // Hide and send paste keystroke
  if (quickPaste?.isVisible()) quickPaste.hide();
  sendPasteKeystroke();
}

function sendPasteKeystroke(): void {
  // Small delay so focus returns to previous window
  setTimeout(() => {
    try {
      // Use Electron's hostMessage via robotjs-free trick:
      // We simply don't simulate keystrokes here to avoid extra native deps.
      // User presses Ctrl+V themselves. Quick-paste closing leaves clipboard updated.
      // If we later add robotjs we can auto-paste.
    } catch {
      /* noop */
    }
  }, 80);
}

function filterClips(items: ClipItem[], query?: string): ClipItem[] {
  if (!query) return items;
  // Server-side narrow; client also runs fuse for ranking
  const q = query.toLowerCase();
  return items.filter((c) => {
    return (
      (c.content ?? '').toLowerCase().includes(q) ||
      (c.ocrText ?? '').toLowerCase().includes(q) ||
      (c.linkTitle ?? '').toLowerCase().includes(q) ||
      (c.preview ?? '').toLowerCase().includes(q)
    );
  });
}

// ---------- IPC ----------

function registerIpc(): void {
  ipcMain.handle('clips:list', (_e, query?: string) => {
    const items = db.listClips(1000);
    return filterClips(items, query);
  });
  ipcMain.handle('clips:paste', (_e, id: number) => {
    pasteClipById(id);
  });
  ipcMain.handle('clips:togglePin', (_e, id: number) => {
    db.togglePin(id);
    broadcastUpdate();
  });
  ipcMain.handle('clips:delete', (_e, id: number) => {
    db.deleteClip(id);
    broadcastUpdate();
  });
  ipcMain.handle('clips:clearAll', () => {
    db.clearAll();
    broadcastUpdate();
  });
  ipcMain.handle('window:hide', () => {
    if (quickPaste?.isVisible()) quickPaste.hide();
  });
  ipcMain.handle('window:close', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close();
  });
  ipcMain.handle('window:minimize', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize();
  });
  ipcMain.handle('settings:get', () => db.loadSettings());
  ipcMain.handle('settings:save', (_e, partial: Partial<Settings>) => {
    const next = db.saveSettings(partial);
    if (partial.hotkey && partial.hotkey !== currentHotkey) {
      const ok = registerHotkey(partial.hotkey);
      if (!ok) registerHotkey(currentHotkey || 'Ctrl+Shift+V');
    }
    if (partial.launchOnStartup !== undefined) {
      app.setLoginItemSettings({ openAtLogin: partial.launchOnStartup });
    }
    return next;
  });
  ipcMain.handle('settings:open', () => createSettings());
}

// ---------- lifecycle ----------

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark';
  db.initDb();

  const settings = db.loadSettings();
  registerIpc();
  setupTray();

  watcher = new ClipboardWatcher(500);
  watcher.on('change', handleClipboardChange);
  watcher.start();

  const ok = registerHotkey(settings.hotkey || 'Ctrl+Shift+V');
  if (!ok) {
    console.warn('[hotkey] failed to register, falling back');
    registerHotkey('Ctrl+Shift+V');
  }

  if (settings.launchOnStartup) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  app.on('window-all-closed', () => {
    // Keep app alive with no windows (tray only)
  });
});

app.on('will-quit', async () => {
  globalShortcut.unregisterAll();
  watcher?.stop();
  await terminateOcr();
});
