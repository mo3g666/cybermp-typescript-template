import { spawn } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const packagesDir = resolve(rootDir, 'packages');
const resourcesDir = resolve(rootDir, 'resources');

const isWatch = process.argv.includes('--watch');
const noBrowser = process.argv.includes('--no-browser');
const filterArg = process.argv.find((arg) => arg.startsWith('--filter='));
const filterName = filterArg ? filterArg.split('=')[1] : null;

// Clean ANSI escape codes from terminal output
function stripAnsi(str) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: needed to strip ANSI color codes from terminal output
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

// Find all resources with a resource.toml in packages/
function findResources() {
  if (!existsSync(packagesDir)) return [];

  const entries = readdirSync(packagesDir, { withFileTypes: true });
  const resources = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (filterName && entry.name !== filterName) continue;

    const pkgDir = resolve(packagesDir, entry.name);
    const tomlPath = resolve(pkgDir, 'resource.toml');

    if (existsSync(tomlPath)) {
      resources.push({
        name: entry.name,
        dir: pkgDir,
        outDir: resolve(resourcesDir, entry.name),
        tomlPath,
      });
    }
  }

  return resources;
}

const resources = findResources();

if (resources.length === 0) {
  console.log(
    filterName
      ? `[Build] No resource found with name "${filterName}".`
      : '[Build] No packages with resource.toml found.',
  );
  process.exit(0);
}

const commonConfig = {
  bundle: true,
  sourcemap: false,
  target: 'esnext',
};

const activeProcesses = [];
const esbuildContexts = [];

function killChild(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32' && child.pid) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    } catch {
      try {
        child.kill('SIGTERM');
      } catch {}
    }
  } else {
    try {
      child.kill('SIGTERM');
    } catch {}
  }
}

function cleanup() {
  for (const proc of activeProcesses) {
    killChild(proc);
  }
  for (const ctx of esbuildContexts) {
    try {
      ctx.dispose();
    } catch {}
  }
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

// Copy resource.toml
function copyResourceToml(res) {
  mkdirSync(res.outDir, { recursive: true });
  copyFileSync(res.tomlPath, resolve(res.outDir, 'resource.toml'));
  console.log(`[${res.name}] Copied resource.toml -> resources/${res.name}/resource.toml`);
}

// Build browser for production
function buildBrowser(res) {
  const browserDir = resolve(res.dir, 'browser');
  if (!existsSync(browserDir)) return Promise.resolve();

  const pkgJsonPath = resolve(browserDir, 'package.json');
  let buildScript = 'build';

  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      if (pkg.scripts && !pkg.scripts.build) {
        buildScript = null;
      }
    } catch {}
  } else {
    buildScript = null;
  }

  return new Promise((resolvePromise, rejectPromise) => {
    if (buildScript) {
      console.log(`[${res.name}:browser] Building via "pnpm run ${buildScript}"...`);
      const child = spawn(`pnpm run ${buildScript}`, {
        cwd: browserDir,
        shell: true,
        stdio: 'inherit',
      });

      child.on('error', rejectPromise);
      child.on('exit', (code) => {
        if (code !== 0) {
          rejectPromise(new Error(`[${res.name}:browser] Build failed with exit code ${code}`));
          return;
        }

        const distDir = resolve(browserDir, 'dist');
        const targetBrowserDir = resolve(res.outDir, 'browser');

        if (existsSync(distDir)) {
          rmSync(targetBrowserDir, { recursive: true, force: true });
          mkdirSync(targetBrowserDir, { recursive: true });
          cpSync(distDir, targetBrowserDir, { recursive: true });
          console.log(`[${res.name}:browser] Copied dist -> resources/${res.name}/browser`);
        }
        resolvePromise();
      });
    } else {
      // If no build script, copy static browser files if any
      const targetBrowserDir = resolve(res.outDir, 'browser');
      rmSync(targetBrowserDir, { recursive: true, force: true });
      mkdirSync(targetBrowserDir, { recursive: true });
      cpSync(browserDir, targetBrowserDir, { recursive: true });
      console.log(`[${res.name}:browser] Copied static files -> resources/${res.name}/browser`);
      resolvePromise();
    }
  });
}

// Watch browser in dev mode
function watchBrowser(res) {
  const browserDir = resolve(res.dir, 'browser');
  if (!existsSync(browserDir)) return;

  const pkgJsonPath = resolve(browserDir, 'package.json');
  let devScript = 'dev';

  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      if (pkg.scripts?.dev) {
        devScript = 'dev';
      } else if (pkg.scripts?.watch) {
        devScript = 'watch';
      } else {
        devScript = null;
      }
    } catch {}
  }

  if (!devScript) {
    console.log(`[${res.name}:browser] No dev/watch script found in ${browserDir}/package.json`);
    return;
  }

  console.log(`[${res.name}:browser] Starting dev server via "pnpm run ${devScript}"...`);
  const child = spawn(`pnpm run ${devScript}`, {
    cwd: browserDir,
    shell: true,
  });

  activeProcesses.push(child);

  let outputBuffer = '';
  let urlFound = false;

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    process.stdout.write(`[${res.name}:browser] ${text}`);

    if (!urlFound) {
      outputBuffer += text;
      const clean = stripAnsi(outputBuffer);
      const match = clean.match(/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+/i);
      if (match) {
        urlFound = true;
        const devUrl = match[0];
        try {
          const outTomlPath = resolve(res.outDir, 'resource.toml');
          if (existsSync(outTomlPath)) {
            let toml = readFileSync(outTomlPath, 'utf-8');
            toml = toml.replace(/cef_url\s*=\s*["'][^"']+["']/, `cef_url = "${devUrl}"`);
            writeFileSync(outTomlPath, toml, 'utf-8');
            console.log(
              `[${res.name}] Updated resources/${res.name}/resource.toml cef_url -> ${devUrl}`,
            );
          }
        } catch (err) {
          console.error(`[${res.name}] Failed to update resource.toml cef_url:`, err);
        }
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${res.name}:browser] ${chunk.toString()}`);
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${res.name}:browser] Exited with code ${code}`);
    }
  });
}

// Prepare esbuild configs for client and server
const esbuildConfigs = [];

for (const res of resources) {
  copyResourceToml(res);

  const clientEntry = resolve(res.dir, 'client/src/index.ts');
  if (existsSync(clientEntry)) {
    esbuildConfigs.push({
      ...commonConfig,
      entryPoints: [clientEntry],
      outfile: resolve(res.outDir, 'client.js'),
      format: 'iife',
      platform: 'browser',
    });
  }

  const serverEntry = resolve(res.dir, 'server/src/index.ts');
  if (existsSync(serverEntry)) {
    esbuildConfigs.push({
      ...commonConfig,
      entryPoints: [serverEntry],
      outfile: resolve(res.outDir, 'server.js'),
      format: 'cjs',
      platform: 'node',
    });
  }
}

if (isWatch) {
  if (noBrowser) {
    // 1. One-time production build for browser first
    const browserPromises = resources.map((res) => buildBrowser(res));
    await Promise.all(browserPromises);

    // 2. Then start esbuild watch for client & server
    const contextPromises = esbuildConfigs.map(async (config) => {
      const ctx = await esbuild.context(config);
      esbuildContexts.push(ctx);
      return ctx.watch();
    });
    await Promise.all(contextPromises);

    console.log(
      '[Build] Watching for changes (server & client, browser built without dev server)...',
    );
  } else {
    // Start dev servers for browser
    for (const res of resources) {
      watchBrowser(res);
    }

    // Start esbuild watch for client & server
    const contextPromises = esbuildConfigs.map(async (config) => {
      const ctx = await esbuild.context(config);
      esbuildContexts.push(ctx);
      return ctx.watch();
    });
    await Promise.all(contextPromises);

    console.log('[Build] Watching for changes across resources...');
  }
} else {
  // Production build: first browser, then server and client
  const browserPromises = resources.map((res) => buildBrowser(res));
  await Promise.all(browserPromises);

  if (esbuildConfigs.length > 0) {
    console.log('[Build] Building server and client...');
    const esbuildPromises = esbuildConfigs.map((config) => esbuild.build(config));
    await Promise.all(esbuildPromises);
  }

  console.log('[Build] Build completed successfully.');
}
