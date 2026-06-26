# Contributing

Thanks for taking a look at NoFile. The project is small, so the best contributions are focused and easy to review.

## Setup

```bash
git clone https://github.com/HXZ09845/nofile.git
cd nofile
npm install
npm run dev
```

## Before Opening A Pull Request

Run:

```bash
npm run build
```

Also check that generated folders are not committed:

```bash
git status --short
```

## Good First Contributions

- Improve README clarity or add real screenshots.
- Fix small UI bugs.
- Improve settings behavior.
- Add tests around file type detection.
- Reduce production debug logging.
- Improve accessibility labels and keyboard flows.

## Pull Request Guidelines

- Keep the change focused.
- Explain what changed and why.
- Include screenshots or screen recordings for UI changes when possible.
- Mention the verification commands you ran.
- Do not commit `node_modules/`, `dist/`, `out/`, or `release/`.

## Reporting Bugs

Use the bug report issue template and include:

- macOS version
- Node.js version if running from source
- What you expected
- What happened instead
- Steps to reproduce
