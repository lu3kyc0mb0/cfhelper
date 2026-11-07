import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const targets = process.argv.slice(2);
if (!targets.length) targets.push('firefox', 'chromium');
for (const target of targets) {
  if (!['firefox', 'chromium'].includes(target)) throw new Error(`Unknown browser: ${target}`);
  const manifest = JSON.parse(readFileSync(new URL(`../${target}/manifest.json`, import.meta.url)));
  const result = spawnSync(process.execPath, [
    'node_modules/web-ext/bin/web-ext.js', 'build', '--source-dir', target,
    '--artifacts-dir', 'dist', '--filename', `cfhelper-${target}-${manifest.version}.zip`,
    '--overwrite-dest'
  ], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
