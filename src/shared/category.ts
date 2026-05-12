import type { Category, ClipType } from './types';

export function detectCategory(type: ClipType, content: string): Category {
  if (type === 'image') return 'image';
  if (type === 'file') return 'file';

  const text = content.trim();
  if (!text) return 'text';

  // URL
  if (/^https?:\/\/\S+$/i.test(text)) return 'url';

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return 'email';

  // Phone (simple: optional +, digits/spaces/dashes/parens, 7-20 chars)
  if (/^\+?[\d][\d\s\-()]{6,20}\d$/.test(text) && (text.match(/\d/g)?.length ?? 0) >= 7) {
    return 'phone';
  }

  // Code: contains common code patterns
  if (isLikelyCode(text)) return 'code';

  return 'text';
}

function isLikelyCode(text: string): boolean {
  const codeSignals = [
    /\bfunction\s+\w+\s*\(/,
    /\bconst\s+\w+\s*=/,
    /\blet\s+\w+\s*=/,
    /\bvar\s+\w+\s*=/,
    /\bimport\s+.+from\s+['"]/,
    /\bclass\s+\w+/,
    /\bdef\s+\w+\s*\(/,
    /\bpublic\s+(static\s+)?\w+/,
    /=>\s*[{(]/,
    /^\s*<\w+[\s>]/m,
    /\b(if|else|for|while|return)\b.*[{;]/,
    /^\s*#include\s+</m,
    /^\s*SELECT\s+.+FROM/im
  ];
  const matches = codeSignals.filter((re) => re.test(text)).length;
  // 2+ signals or one strong signal with braces/semicolons and multiple lines
  if (matches >= 2) return true;
  if (matches >= 1 && /[{};]/.test(text) && text.split('\n').length >= 2) return true;
  return false;
}

export function extractFirstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s)>\]"']+/i);
  return m ? m[0] : null;
}
