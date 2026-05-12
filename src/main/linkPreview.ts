import * as db from './db';

// Lightweight link preview: fetch the URL, extract og: and <title>.
// We use node-fetch (v2 CJS) for Electron compatibility.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fetch = require('node-fetch') as (url: string, init?: unknown) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  headers: { get: (k: string) => string | null };
}>;

const MAX_BYTES = 512 * 1024; // 512KB is plenty for <head>

function pick(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? decodeEntities(m[1].trim()) : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export async function fetchLinkPreview(
  id: number,
  url: string,
  broadcast: () => void
): Promise<void> {
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 8000);

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) QuickClip/0.1 (+link-preview)',
        Accept: 'text/html,application/xhtml+xml'
      },
      redirect: 'follow',
      // node-fetch v2 accepts AbortSignal despite missing types in older defs
      signal: ac.signal as unknown as undefined
    });
    clearTimeout(to);

    if (!res.ok) {
      db.updateLinkPreview(id, { title: null, description: null, image: null }, 'error');
      broadcast();
      return;
    }

    const ctype = res.headers.get('content-type') || '';
    if (!ctype.includes('html')) {
      db.updateLinkPreview(id, { title: null, description: null, image: null }, 'error');
      broadcast();
      return;
    }

    // Read a bounded chunk
    const fullText = await res.text();
    const html = fullText.slice(0, MAX_BYTES);

    const ogTitle =
      pick(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      pick(html, /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
    const title =
      ogTitle || pick(html, /<title[^>]*>([^<]+)<\/title>/i) || null;

    const description =
      pick(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      null;

    const image =
      pick(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      pick(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      null;

    const absImage = image ? resolveUrl(image, url) : null;

    db.updateLinkPreview(id, { title, description, image: absImage }, 'done');
    broadcast();
  } catch (err) {
    db.updateLinkPreview(id, { title: null, description: null, image: null }, 'error');
    broadcast();
  }
}

function resolveUrl(u: string, base: string): string {
  try {
    return new URL(u, base).toString();
  } catch {
    return u;
  }
}
