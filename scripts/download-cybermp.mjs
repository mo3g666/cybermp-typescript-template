import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const tmpDir = path.join(rootDir, 'tmp');

const REPO = 'Cyber-MP/CyberMP-Server-Releases';

const TARGET_CONFIG = {
  win: {
    dir: path.join(rootDir, 'mp', 'win'),
    assetName: (tag) => `cybermp-server-win64-build-${tag}.zip`,
    label: 'Windows (win64)',
  },
  linux: {
    dir: path.join(rootDir, 'mp', 'linux'),
    assetName: (tag) => `cybermp-server-linux-build-${tag}.zip`,
    label: 'Linux',
  },
};

function cleanupTmpDir() {
  if (fs.existsSync(tmpDir)) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

// Clean up tmp on termination signals
process.on('SIGINT', () => {
  cleanupTmpDir();
  process.exit(130);
});

process.on('SIGTERM', () => {
  cleanupTmpDir();
  process.exit(143);
});

function readPackageJson() {
  const pkgPath = path.join(rootDir, 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
}

function updatePackageJsonVersion(newVersion) {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.cybermp = pkg.cybermp || {};
  pkg.cybermp.version = newVersion;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log(`[CyberMP] Updated cybermp.version in package.json to "${newVersion}"`);
}

async function getLatestReleaseTag() {
  console.log(`[CyberMP] Fetching latest release tag from GitHub (${REPO})...`);
  const headers = { 'User-Agent': 'CyberMP-Downloader' };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch latest release: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.tag_name;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let target = 'all';
  let version = null;
  let updatePkg = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === 'win' || arg === 'linux' || arg === 'all') {
      target = arg;
    } else if (arg === '--update' || arg === '--save') {
      updatePkg = true;
    } else if (arg.startsWith('--version=')) {
      version = arg.split('=')[1];
    } else if (arg === '--version' && i + 1 < args.length) {
      version = args[++i];
    } else if (arg === '--latest') {
      version = 'latest';
    } else if (!arg.startsWith('-') && !version) {
      version = arg;
    }
  }

  return { target, version, updatePkg };
}

async function resolveVersion(requestedVersion) {
  if (requestedVersion === 'latest') {
    return await getLatestReleaseTag();
  }

  if (requestedVersion) {
    return requestedVersion.startsWith('v') ? requestedVersion : `v${requestedVersion}`;
  }

  if (process.env.CYBERMP_VERSION) {
    const v = process.env.CYBERMP_VERSION;
    return v === 'latest' ? await getLatestReleaseTag() : v.startsWith('v') ? v : `v${v}`;
  }

  const pkg = readPackageJson();
  if (pkg.cybermp?.version) {
    const v = pkg.cybermp.version;
    return v === 'latest' ? await getLatestReleaseTag() : v.startsWith('v') ? v : `v${v}`;
  }

  console.log('[CyberMP] No version specified in package.json or CLI, resolving latest release...');
  return await getLatestReleaseTag();
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed with HTTP ${res.status}: ${res.statusText}`);
  }

  const totalBytes = Number(res.headers.get('content-length')) || 0;
  let downloadedBytes = 0;
  let lastReportedPct = -1;

  const fileStream = fs.createWriteStream(destPath);
  const stream = Readable.fromWeb(res.body);

  stream.on('data', (chunk) => {
    downloadedBytes += chunk.length;
    if (totalBytes > 0) {
      const pct = Math.floor((downloadedBytes / totalBytes) * 100);
      if (pct !== lastReportedPct && pct % 10 === 0) {
        lastReportedPct = pct;
        const mbReceived = (downloadedBytes / 1024 / 1024).toFixed(1);
        const mbTotal = (totalBytes / 1024 / 1024).toFixed(1);
        process.stdout.write(`\r  Progress: ${pct}% (${mbReceived} MB / ${mbTotal} MB)`);
      }
    }
  });

  await finished(stream.pipe(fileStream));
  process.stdout.write('\r  Download complete!                   \n');
}

async function downloadAndExtractTarget(targetKey, version) {
  const config = TARGET_CONFIG[targetKey];
  if (!config) throw new Error(`Unknown target: ${targetKey}`);

  const assetName = config.assetName(version);
  const downloadUrl = `https://github.com/${REPO}/releases/download/${version}/${assetName}`;

  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  const tempZipPath = path.join(tmpDir, assetName);

  console.log(`\n========================================`);
  console.log(`Target: ${config.label}`);
  console.log(`Version: ${version}`);
  console.log(`Asset: ${assetName}`);
  console.log(`Temp location: tmp/${assetName}`);
  console.log(`Destination: ${path.relative(rootDir, config.dir)}`);
  console.log(`========================================`);

  try {
    console.log(`Downloading from ${downloadUrl}...`);
    await downloadFile(downloadUrl, tempZipPath);

    console.log(`Extracting to ${config.dir}...`);
    if (!fs.existsSync(config.dir)) {
      fs.mkdirSync(config.dir, { recursive: true });
    }

    const zip = new AdmZip(tempZipPath);
    zip.extractAllTo(config.dir, /* overwrite */ true);

    // Save version info inside destination directory
    fs.writeFileSync(
      path.join(config.dir, '.cybermp-version'),
      JSON.stringify(
        { version, target: targetKey, downloadedAt: new Date().toISOString() },
        null,
        2,
      ),
      'utf8',
    );

    // Set executable permissions for linux binaries if running on posix
    if (targetKey === 'linux' && process.platform !== 'win32') {
      try {
        const binFile = path.join(config.dir, 'cybermp-server');
        if (fs.existsSync(binFile)) {
          fs.chmodSync(binFile, 0o755);
        }
      } catch (err) {
        console.warn('Warning: Could not set executable permissions:', err.message);
      }
    }

    console.log(
      `✓ Successfully downloaded and unpacked ${config.label} to ${path.relative(rootDir, config.dir)}/`,
    );
  } finally {
    if (fs.existsSync(tempZipPath)) {
      try {
        fs.unlinkSync(tempZipPath);
      } catch {
        // ignore
      }
    }
  }
}

async function main() {
  try {
    const { target, version: requestedVersion, updatePkg } = parseArgs();
    const version = await resolveVersion(requestedVersion);

    console.log(`[CyberMP] Selected version: ${version}`);

    if (updatePkg || (!requestedVersion && !readPackageJson().cybermp?.version)) {
      updatePackageJsonVersion(version);
    }

    const targets = target === 'all' ? ['win', 'linux'] : [target];

    for (const t of targets) {
      await downloadAndExtractTarget(t, version);
    }

    console.log('\n[CyberMP] All requested binaries are ready!');
  } finally {
    cleanupTmpDir();
  }
}

main().catch((err) => {
  cleanupTmpDir();
  console.error('\n[CyberMP Error]:', err.message);
  process.exitCode = 1;
});
