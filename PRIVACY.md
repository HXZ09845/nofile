# Privacy

NoFile is designed as a local desktop utility.

## What NoFile Accesses

- Watched folders: Desktop and Downloads by default, or the folder path configured in settings.
- Clipboard images: only when clipboard capture is enabled.
- Files added by drag-and-drop.

## What NoFile Stores

- Clipboard images are written as temporary PNG files under the system temp directory.
- Theme preference is stored locally through Electron's app storage.
- Generated build output and packaged installers are not committed to the repository.

## Network Behavior

NoFile does not include a server, account system, analytics SDK, cloud sync, or upload flow.

## Current Limitations

- Watch-folder and virtual-folder persistence are still being improved.
- Packaged builds are currently unsigned, so macOS may show a first-run warning.

## Reporting Concerns

Please report security or privacy concerns through the process in [SECURITY.md](SECURITY.md).
