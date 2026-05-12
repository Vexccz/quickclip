import { clipboard, nativeImage, NativeImage } from 'electron';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { ClipType } from '../shared/types';

export interface ClipboardChange {
  type: ClipType;
  text?: string;
  image?: NativeImage;
  imageDataUrl?: string;
  files?: string[];
}

export class ClipboardWatcher extends EventEmitter {
  private lastTextHash = '';
  private lastImageHash = '';
  private lastFilesHash = '';
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number;
  private paused = false;

  constructor(intervalMs = 500) {
    super();
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.timer) return;
    // prime current state so we don't emit initial clipboard content
    this.snapshot(false);
    this.timer = setInterval(() => {
      if (!this.paused) this.snapshot(true);
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Pause briefly so our own writeText doesn't re-trigger history. */
  pauseFor(ms: number): void {
    this.paused = true;
    setTimeout(() => {
      // re-prime to current contents so paste is ignored
      this.snapshot(false);
      this.paused = false;
    }, ms);
  }

  private snapshot(emit: boolean): void {
    try {
      // Prefer files > image > text
      const formats = clipboard.availableFormats();

      // Files (Windows: 'CF_HDROP' shows up as 'FileNameW' / custom; try readBuffer fallback)
      const files = this.readFilesSafe(formats);
      if (files && files.length) {
        const hash = crypto.createHash('sha1').update(files.join('|')).digest('hex');
        if (hash !== this.lastFilesHash) {
          this.lastFilesHash = hash;
          this.lastTextHash = '';
          this.lastImageHash = '';
          if (emit) this.emit('change', { type: 'file', files } as ClipboardChange);
        }
        return;
      }

      const hasImage = formats.some((f) => f.startsWith('image/'));
      if (hasImage) {
        const img = clipboard.readImage();
        if (!img.isEmpty()) {
          const png = img.toPNG();
          const hash = crypto.createHash('sha1').update(png).digest('hex');
          if (hash !== this.lastImageHash) {
            this.lastImageHash = hash;
            this.lastFilesHash = '';
            this.lastTextHash = '';
            if (emit) {
              // thumbnail for storage, original for OCR
              const thumb = img.resize({ width: 320 });
              const dataUrl = thumb.toDataURL();
              this.emit('change', {
                type: 'image',
                image: img,
                imageDataUrl: dataUrl
              } as ClipboardChange);
            }
          }
          return;
        }
      }

      const text = clipboard.readText();
      if (text && text.length > 0) {
        const hash = crypto.createHash('sha1').update(text).digest('hex');
        if (hash !== this.lastTextHash) {
          this.lastTextHash = hash;
          this.lastImageHash = '';
          this.lastFilesHash = '';
          if (emit) this.emit('change', { type: 'text', text } as ClipboardChange);
        }
      }
    } catch (err) {
      // swallow - clipboard access can race
    }
  }

  private readFilesSafe(formats: string[]): string[] | null {
    try {
      // Windows file drop via clipboard.read('FileNameW') is unreliable in Electron.
      // Use the 'public.file-url' on mac, and a text-url fallback.
      if (formats.includes('text/uri-list')) {
        const uri = clipboard.read('text/uri-list');
        if (uri) {
          const list = uri
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter((s) => s && !s.startsWith('#'));
          if (list.length) return list;
        }
      }
    } catch {
      /* noop */
    }
    return null;
  }
}

// re-export to silence unused import warning when bundling
export { nativeImage };
