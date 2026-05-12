import { BrowserWindow } from 'electron';
import type { NativeImage } from 'electron';
import * as db from './db';

// Tesseract worker is created lazily on first image to avoid startup cost.
// The library is loaded dynamically via require so the main process stays CJS.
type OcrWorker = {
  recognize: (image: Buffer) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
};

let workerPromise: Promise<OcrWorker | null> | null = null;
let currentLangs = '';

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
      const worker = await tesseract.createWorker(langs.split('+'));
      return worker as OcrWorker;
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
    const text = (result?.data?.text ?? '').trim();
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
