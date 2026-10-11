// Fails if any JS file under src/ does not parse (regression guard for the
// literal "\n" corruption that broke src/services/multiModelRouter.js).
const { readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });
}

let failed = 0;
for (const file of walk(join(__dirname, '..', 'src'))) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed++;
    console.error(`SYNTAX FAIL ${file}\n${err.stderr}`);
  }
}
if (failed) process.exit(1);
console.log('syntax ok');
