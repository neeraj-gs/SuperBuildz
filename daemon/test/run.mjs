/**
 * The test runner. Points the store at a temp directory first, so nothing a
 * test does can land in ~/.superbuilds — then runs every *.test.ts here.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const home = mkdtempSync(join(tmpdir(), 'superbuilds-test-'));
const files = readdirSync(here).filter((f) => f.endsWith('.test.ts')).map((f) => join(here, f));

// The chart ramp is tested from here but lives in templates/site, whose
// package.json has no module type because a Next project does not need one.
// Node warns about that on every run; the warning is not about our code.
const res = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--test', ...files], {
  stdio: 'inherit',
  env: { ...process.env, SUPERBUILDS_HOME: home, SUPERBUILDS_SITES: join(home, 'sites') },
});
process.exit(res.status ?? 1);
