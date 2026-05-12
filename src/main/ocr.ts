import { BrowserWindow } from 'electron';
import type { NativeImage } from 'electron';
import * as db from './db';

// Tesseract worker is created lazily on first image to avoid startup cost.
// The library is loaded dynamically via require so the main process stays CJS.
type OcrWorker = {
  recognize: (image: Buffer) => Promise<{ data: { text: string; confidence?: number } }>;
  setParameters?: (params: Record<string, string | number>) => Promise<void>;
  terminate: () => Promise<void>;
};

let workerPromise: Promise<OcrWorker | null> | null = null;
let currentLangs = '';

// Minimum average confidence (0-100) to keep OCR output. Below this, treat as no-text image (wallpaper, icon, screenshot without prose).
const MIN_CONFIDENCE = 55;
// Minimum characters to consider worthy as searchable text
const MIN_TEXT_LEN = 3;

async function getWorker(langs: string): Promise<OcrWorker | null> {
  if (workerPromise && currentLangs === langs) return workerPromise;

  if (workerPromise) {
    // language changed, terminate old
    workerPromise
      .then((w) => w?.terminate().catch(() => undefined))
      .catch(() => undefined);
    workerPromise = null;
  }

  currentLangs = langs;
  workerPromise = (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const tesseract = require('tesseract.js');
      const worker = (await tesseract.createWorker(langs.split('+'))) as OcrWorker;
      // PSM 3 = default fully automatic page segmentation. Works for mixed content.
      try {
        await worker.setParameters?.({ tessedit_pageseg_mode: '3' });
      } catch {
        /* ignore */
      }
      return worker;
    } catch (err) {
      console.error('[ocr] failed to init tesseract:', err);
      return null;
    }
  })();
  return workerPromise;
}

export async function runOcr(
  id: number,
  image: NativeImage,
  langs: string,
  broadcast: () => void
): Promise<void> {
  try {
    const worker = await getWorker(langs);
    if (!worker) {
      db.updateOcr(id, '', 'error');
      broadcast();
      return;
    }
    const png = image.toPNG();
    const result = await worker.recognize(png);
    let text = (result?.data?.text ?? '').trim();
    const confidence = result?.data?.confidence ?? 0;

    // Filter out garbage: low confidence, too short, or mostly punctuation/single chars
    const letterCount = (text.match(/[a-zA-Z0-9\u00C0-\uFFFF]/g) || []).length;
    const isGarbage =
      confidence < MIN_CONFIDENCE ||
      text.length < MIN_TEXT_LEN ||
      letterCount < 4 ||
      letterCount / Math.max(text.length, 1) < 0.4;

    if (isGarbage) {
      console.log(`[ocr] skipped low-quality result (conf=${confidence.toFixed(1)}, len=${text.length}, letters=${letterCount})`);
      text = '';
    }

    db.updateOcr(id, text, 'done');
    broadcast();
  } catch (err) {
    console.error('[ocr] failed:', err);
    db.updateOcr(id, '', 'error');
    broadcast();
  }
}

export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return;
  try {
    const w = await workerPromise;
    await w?.terminate();
  } catch {
    /* noop */
  } finally {
    workerPromise = null;
  }
}

// helper to notify all windows
export function broadcastUpdate(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('clips:updated');
  }
}
