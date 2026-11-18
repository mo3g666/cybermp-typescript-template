import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const isProd =
  process.argv.includes('prod') ||
  process.argv.includes('--prod') ||
  process.argv.includes('production') ||
  process.env.NODE_ENV === 'production';

const nodeEnv = isProd ? 'production' : 'development';

const isWin = process.platform === 'win32';
const serverBinary = isWin
  ? resolve(rootDir, 'mp/win/cybermp-server.exe')
  : resolve(rootDir, 'mp/linux/cybermp-server');
const resourcesDir = resolve(rootDir, 'resources');

if (!existsSync(serverBinary)) {
  console.error(
    `[CyberMP] Server binary not found at: ${serverBinary}\nPlease run "pnpm download" first.`,
  );
  process.exit(1);
}

const args = ['-run', `-rdir=${resourcesDir}`];

console.log(
  `[CyberMP] Starting server in ${nodeEnv.toUpperCase()} mode (${isWin ? 'Windows' : 'Linux'})...`,
);

const child = spawn(serverBinary, args, {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: nodeEnv,
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else if (code !== null) {
    process.exit(code);
  }
});
