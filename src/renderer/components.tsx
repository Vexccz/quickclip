import React from 'react';
import type { ClipItem } from '@shared/types';

export function Chip({ category }: { category: ClipItem['category'] }) {
  const label = category.toUpperCase();
  return <span className={`qc-chip qc-chip-${category}`}>{label}</span>;
}

export function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString();
}

export function itemSubtitle(clip: ClipItem): string {
  if (clip.type === 'image') {
    if (clip.ocrStatus === 'pending') return 'Running OCR...';
    if (clip.ocrText && clip.ocrText.length) return `OCR: ${clip.ocrText.slice(0, 120)}`;
    return 'Image';
  }
  if (clip.type === 'url' || clip.category === 'url') {
    if (clip.linkStatus === 'pending') return 'Fetching preview...';
    if (clip.linkTitle) return clip.linkTitle;
  }
  if (clip.type === 'file') return clip.preview ?? 'File';
  return (clip.preview ?? clip.content ?? '').replace(/\s+/g, ' ').slice(0, 160);
}
