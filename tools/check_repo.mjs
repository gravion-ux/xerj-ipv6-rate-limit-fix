import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const readme = read('README.md');
const banner = read('assets/banner.svg');
const usage = read('functions/_lib/hub-usage.js');
const patch = read('patches/corpus-hub-ipv6-rate-limit.patch');
const regressionTest = read('tools/corpus-hub-site/test_hub_usage_rate.mjs');
const licence = read('LICENSE');

assert.match(readme, /!\[xerj-ipv6-rate-limit-fix banner\]\(assets\/banner\.svg\)/);
assert.match(banner, /^<svg\b/);
assert.match(banner, /xerj-ipv6-rate-limit-fix/);
assert.match(banner, /<\/svg>\s*$/);

assert.match(usage, /import \{ sourceKey \} from '\.\.\/api\/hub-stars\.js';/);
assert.match(usage, /const key = sourceKey\(ip\);/);
assert.doesNotMatch(usage, /const key = ip\.includes\(':'\) \? ip\.split\(':'\)\.slice\(0, 4\)/);

const addedPatchLines = patch
  .split('\n')
  .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
  .join('\n');
const removedPatchLines = patch
  .split('\n')
  .filter((line) => line.startsWith('-') && !line.startsWith('---'))
  .join('\n');
assert.match(addedPatchLines, /import \{ sourceKey \} from '\.\.\/api\/hub-stars\.js';/);
assert.match(addedPatchLines, /const key = sourceKey\(ip\);/);
assert.match(removedPatchLines, /ip\.split\(':'\)\.slice\(0, 4\)/);

for (const testName of [
  'a second host in the same IPv6 /64 shares the bucket of the first',
  'one IPv6 address written two ways shares one bucket',
  'two different IPv6 /64s keep separate buckets',
  'an IPv4 address keeps its own bucket',
]) {
  assert.ok(regressionTest.includes(testName), `missing regression case: ${testName}`);
}

assert.match(licence, /Copyright \(c\) 2026 Priyanshu Kumar Thakur/);

console.log('repository checks passed');
