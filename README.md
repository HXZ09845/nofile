# NoFile

NoFile is a small Electron desktop app for temporarily collecting files from the Desktop, Downloads, drag-and-drop, and clipboard screenshots.

It opens as a floating file dock, lets you preview recent files, copy images, reveal items in Finder, drag files back into other apps, and organize items into lightweight virtual folders.

## Tech Stack

- Electron
- electron-vite
- React
- TypeScript
- chokidar

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run package
```

Packaged macOS builds are written to `release/`.

## Project Structure

- `src/main/` - Electron main process, file watcher, clipboard watcher, IPC handlers
- `src/preload/` - safe bridge APIs exposed to the renderer
- `src/renderer/` - React UI for the floating file dock
- `build/` - app icon assets used by electron-builder

## License

MIT
