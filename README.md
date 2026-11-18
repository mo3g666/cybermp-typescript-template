# CyberMP TypeScript Template

[English](README.md) | [Русский](README.ru.md)

Full-stack TypeScript monorepo template for CyberMP gamemodes. Includes Client, Server and CEF UI with live HMR support.

---

## Requirements

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (v9+)

---

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Download CyberMP server binaries

Downloads the required server binaries specified in `package.json`:

```bash
pnpm download
# or for a specific platform:
pnpm download:win
pnpm download:linux
```

### 3. Build resources

```bash
# One-time production build of all resources (browser -> server & client)
pnpm build

# Watch mode with dev server for CEF browser UI
pnpm watch

# Watch mode for server & client only (browser built once as static files)
pnpm watch:no-browser

# Target a specific resource only:
node scripts/build.mjs --filter=gamemode
node scripts/build.mjs --watch --filter=gamemode
```

> **Note on CEF UI development:** In `pnpm watch` mode, the browser package's dev server (`pnpm run dev`) starts automatically with live reload / HMR. The build script dynamically points `cef_url` in `resources/<name>/resource.toml` to the local dev server (e.g. `http://localhost:5173`), enabling instant UI updates. Running `pnpm build` restores `cef_url` back to static files.

### 4. Run server

#### Development mode (with hotreload support):

```bash
# Auto-detect OS
pnpm dev

# Or platform-specific:
pnpm dev:win
pnpm dev:linux
```

#### Production mode (hotreload disabled):

```bash
# Auto-detect OS
pnpm start # or pnpm prod

# Or platform-specific:
pnpm prod:win
pnpm prod:linux
```

#### Running with Docker:

```bash
# Development mode (live watch & hotreload via volumes)
pnpm dev:docker

# Production mode
pnpm docker

# Stop dev container
pnpm docker:down
```

---

## Project Structure

```
cybermp-typescript-template/
├── mp/              # Downloaded CyberMP binaries (ignored by git)
├── packages/        # Source code
│   └── gamemode/
│       ├── client/  # Client-side TypeScript
│       ├── server/  # Server-side TypeScript
│       ├── shared/  # Shared code & types (TypeScript)
│       ├── browser/ # CEF UI (Vue 3 / Vite)
│       └── resource.toml # Resource manifest
├── resources/       # CyberMP resources
│   ├── gamemode/    # Built gamemode resource (ignored by git)
│   └── hotreload/   # Hot-reload development utility
├── scripts/         # Build, download & server runner scripts
└── server.toml      # CyberMP server configuration
```

---

## Resource Architecture & Build System

The build script (`scripts/build.mjs`) is universal and automatically discovers resources:

1. **Automatic Discovery via `resource.toml`:**
   - Any folder under `packages/*` containing a `resource.toml` manifest is treated as an independent CyberMP resource.
   - The compiled output is automatically placed in `resources/<package_name>/`.
   - Packages without a `resource.toml` (e.g. shared libraries or utility modules) are treated as internal workspace packages.

2. **Modular Structure `{server, client, browser}`:**
   - Each resource package can contain any combination of:
     - `server/` (entry: `src/index.ts`) — Bundled via esbuild into `resources/<name>/server.js`.
     - `client/` (entry: `src/index.ts`) — Bundled via esbuild into `resources/<name>/client.js`.
     - `browser/` — Bundler- and framework-agnostic UI (Vue, React, Svelte, or static HTML): runs the package's build script, extracts the `dist/` output, and copies it to `resources/<name>/browser/` (or starts the local dev server with automatic `cef_url` redirection in `watch` mode).
   - All three folders are optional: a resource can be server-only, client-only, UI-only, or full-stack.

---

## Credits & Acknowledgements

This project uses and is powered by official [CyberMP](https://github.com/Cyber-MP) tools and community resources:

- [CyberMP Server Releases](https://github.com/Cyber-MP/CyberMP-Server-Releases) — Server binaries.
- [CyberMP Types](https://github.com/Cyber-MP/CyberMP-Types) — TypeScript definitions for client and server runtime.
- [CyberMP RPC](https://github.com/Cyber-MP/CyberMP-RPC) — Remote Procedure Call library.
- [CyberMP Hotreload Resource](https://github.com/Cyber-MP/CyberMP-Hotreload-Resource) — Development hot-reload resource (included in `resources/hotreload`).

---

## Author

- **Nikita Kudiyarov** — [@mo3g666](https://github.com/mo3g666) — [n.kudiyarov@outlook.com](mailto:n.kudiyarov@outlook.com)

---

## License

This project is open-source and licensed under the [MIT License](LICENSE).
