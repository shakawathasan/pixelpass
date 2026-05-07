# PixelPass - Offline Image Transfer

## Features
- ✓ Encode images to base64 text chunks (EXACT or OPTIMIZED mode)
- ✓ Copy chunks and send via any chat/SMS
- ✓ Paste chunks to reconstruct image
- ✓ Works completely offline (no internet required)
- ✓ Zero freeze guarantee (async processing)
- ✓ All processing in memory (nothing saved to disk)

## How to Use Offline

### Option 1: Local HTTP Server (Recommended for best offline support)
```bash
# Windows (using Python)
python -m http.server 8000

# Then open: http://localhost:8000
```

The first visit will cache everything. After that, it works offline even if you disconnect.

### Option 2: Direct File Opening
Simply open `index.html` in your browser (file:// protocol).
- Works offline immediately
- No caching benefit, but fully functional
- All processing happens in memory

### Option 3: Install as Web App (if using HTTP Server)
1. Serve via http://localhost:8000
2. Open in Chrome/Edge/Firefox
3. Click "Install" or "Add to Home Screen"
4. Opens offline-ready app

## Modes

**EXACT Mode**
- No compression
- Original image format preserved
- Larger file size
- Identical reconstruction

**OPTIMIZED Mode**
- JPEG compression with quality slider (10-95%)
- Adjustable max resolution (200-1920px)
- Significantly smaller file
- High quality output

## Chunk Format

```
PIXLPASS v1 <mode> <type> <total> <filename>

---PART 1/<total>---
<base64-data>

---PART 2/<total>---
<base64-data>
...
```

- One header at the top
- Chunks separated by part markers
- Easy to copy, paste, and share

## System Requirements
- Modern browser (Chrome, Firefox, Edge, Safari)
- No plugins required
- Works offline after initial load (when using HTTP server)

## Files
- `index.html` - Main app (open this)
- `sw.js` - Service Worker for offline caching
- `manifest.json` - PWA manifest

## Privacy
- All processing happens in your browser
- No server uploads
- No tracking
- No storage
- Images never leave your device
