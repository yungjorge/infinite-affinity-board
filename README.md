# Affinity — Infinite Board

An infinite canvas for organizing sticky notes by affinity. Local-first, no accounts needed.

**Live:** [infinite-affinity-board.vercel.app](https://infinite-affinity-board.vercel.app)

## Features

- Infinite canvas with pan and zoom
- Sticky notes in 7 soft pastel colors with paper-like textures
- Group notes into corkboard, markerboard, or chalkboard frames
- Multi-select, rubber-band selection, shift+click
- Undo/redo (50 steps)
- Dark mode and light mode
- Export/import as JSON
- Share boards via link (board state encoded in URL)

## Keyboard Shortcuts

| Key | Action |
|---|---|
| N | New note |
| Ctrl+D | Duplicate selected |
| G | Group selected notes |
| Del / Backspace | Delete selected |
| Esc | Clear selection |
| Space + drag | Pan |
| Scroll | Zoom |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl++/- | Zoom in/out |
| Ctrl+0 | Fit all |

## Tech

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- localStorage persistence
- Vercel deployment

## Development

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```
