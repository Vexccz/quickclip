# Changelog

All notable changes to QuickClip are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-05-12

### Fixed
- OCR no longer emits garbage output (for example `& M4. /`) when copying wallpapers, icons, or screenshots without readable text. Results are dropped when Tesseract confidence is below 55% or the text has fewer than 4 meaningful letter characters.
- Thumbnail resolution raised from 320px to 640px so image previews are legible in the history panel.
- Tesseract is now explicitly configured for Page Segmentation Mode 3 (automatic with fully-automatic page segmentation) which is more robust for mixed-content clipboard images.

### Changed
- OCR failures are logged with confidence, length, and letter count so the filter decisions are transparent during development.

## [0.1.0] - 2026-05-12

### Added
- Global `Ctrl+Shift+V` hotkey to open the quick-paste panel at the cursor.
- Clipboard watcher with 500ms polling, deduplicated by SHA-1 content hash.
- Local history stored in SQLite at `%APPDATA%/quickclip/history.db`.
- Lazy-loaded Tesseract OCR on pasted images (English + Malay language packs).
- Automatic link preview for copied URLs (extracts `og:title`, `og:image`, `og:description`).
- Auto-categorization by heuristic: text, code, url, email, phone, image, file.
- Pin items to keep them at the top of history.
- Fuzzy search across text, OCR output, and link titles.
- System tray menu with open, clear, settings, and quit.
- NSIS installer target producing a single `.exe`.
