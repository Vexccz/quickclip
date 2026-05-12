export type ClipType = 'text' | 'image' | 'file' | 'url';
export type Category = 'code' | 'url' | 'email' | 'phone' | 'image' | 'text' | 'file';

export interface ClipItem {
  id: number;
  type: ClipType;
  category: Category;
  content: string;           // text content, OCR text for images, file path for files
  preview: string | null;    // short preview
  imageDataUrl: string | null; // base64 data URL for images (thumbnails)
  ocrText: string | null;
  ocrStatus: 'none' | 'pending' | 'done' | 'error';
  linkTitle: string | null;
  linkDescription: string | null;
  linkImage: string | null;
  linkStatus: 'none' | 'pending' | 'done' | 'error';
  pinned: 0 | 1;
  createdAt: number;
  updatedAt: number;
  hash: string;
}

export interface Settings {
  hotkey: string;
  maxHistory: number;
  ocrEnabled: boolean;
  ocrLanguages: string; // 'eng+msa'
  linkPreviewEnabled: boolean;
  launchOnStartup: boolean;
  spawnAtCursor: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  hotkey: 'Ctrl+Shift+V',
  maxHistory: 500,
  ocrEnabled: true,
  ocrLanguages: 'eng+msa',
  linkPreviewEnabled: true,
  launchOnStartup: false,
  spawnAtCursor: true
};

export interface QuickClipAPI {
  list: (query?: string) => Promise<ClipItem[]>;
  paste: (id: number) => Promise<void>;
  togglePin: (id: number) => Promise<void>;
  delete: (id: number) => Promise<void>;
  clearAll: () => Promise<void>;
  hide: () => Promise<void>;
  getSettings: () => Promise<Settings>;
  saveSettings: (s: Partial<Settings>) => Promise<Settings>;
  onUpdate: (cb: () => void) => () => void;
  openSettings: () => Promise<void>;
  closeWindow: () => Promise<void>;
  minimizeWindow: () => Promise<void>;
}

declare global {
  interface Window {
    quickclip: QuickClipAPI;
  }
}
