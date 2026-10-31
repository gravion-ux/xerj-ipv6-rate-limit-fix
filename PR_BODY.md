## What this changes, and why

The Corpus Hub rate limiter is supposed to count one **source**, where a source is an IPv4
address or an IPv6 **/64**. It did not.

`functions/_lib/hub-usage.js` built its bucket key by taking the first four
colon-separated fields of the address:

```js
const key = ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;
```

For an address written without `::` that happens to be the /64. For a compressed address
whose zero run starts before the fourth group, the host bits are still inside those four
fields, so `2001:db8::1` and `2001:db8::2` — the same /64 — produced **different** keys.
One /64 could therefore pass the per-source limit once per host address, which is what the
limit exists to prevent. The same address written two ways
(`2001:dba::1` vs `2001:0dba:0000:0000:0000:0000:0000:0001`) also produced two keys.

Root cause: the key was computed from the *text* of the address instead of from its /64.
The helper that does this correctly already existed in the repository — `sourceKey(ip)` in
`functions/api/hub-stars.js`, which expands the address, takes the first four groups and
appends `::/64`. The traffic route already used it (`functions/_lib/hub-traffic.js:20`);
the usage limiter had its own, weaker copy.

The change is one import, one line, and a comment that records why the helper is the
right one:

```diff
+import { sourceKey } from '../api/hub-stars.js';
+
 export async function overRate(request) {
   const ip = String(request.headers.get('CF-Connecting-IP') || '');
-  const key = ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;
+  // sourceKey() folds an IPv6 address to its /64 and leaves an IPv4 address as is.
+  // It is the same helper the stars and traffic routes use, so every rate limit
+  // on the hub buckets a source the same way. Splitting the address on ':' here
+  // instead would keep the host bits whenever '::' sits before the fourth group,
+  // which lets one /64 pass the limit many times over.
+  const key = sourceKey(ip);
```

All three hub rate limits now bucket a source the same way, and there is no second copy of
the IPv6 logic to drift. No import cycle: `hub-stars.js` imports only `../_lib/session.js`.

The change is JavaScript only — no Rust crate, no `engine/` file and no workflow is touched.

## Evidence

New test: `tools/corpus-hub-site/test_hub_usage_rate.mjs`. It freezes `Date.now` so the
minute bucket cannot reset mid-test and turn the assertion into a timing question.

**Before the fix** (the two IPv6 tests fail; the two control tests pass):

```
$ node tools/corpus-hub-site/test_hub_usage_rate.mjs
✖ a second host in the same IPv6 /64 shares the bucket of the first (23.5975ms)
✖ one IPv6 address written two ways shares one bucket (3.6308ms)
✔ two different IPv6 /64s keep separate buckets (2.9318ms)
✔ an IPv4 address keeps its own bucket (2.0038ms)
ℹ tests 4
ℹ pass 2
ℹ fail 2
```

**After the fix:**

```
$ node tools/corpus-hub-site/test_hub_usage_rate.mjs
✔ a second host in the same IPv6 /64 shares the bucket of the first (21.99ms)
✔ one IPv6 address written two ways shares one bucket (2.7419ms)
✔ two different IPv6 /64s keep separate buckets (3.0827ms)
✔ an IPv4 address keeps its own bucket (2.3646ms)
ℹ tests 4
ℹ pass 4
ℹ fail 0
```

**No regression** — every corpus-hub suite, run against the patched tree:

| suite | tests | pass | fail |
| --- | --- | --- | --- |
| `test_corpus_feedback` | 13 | 13 | 0 |
| `test_hub_404` | 3 | 3 | 0 |
| `test_hub_add_repos` | 6 | 6 | 0 |
| `test_hub_auth` | 14 | 14 | 0 |
| `test_hub_details` | 4 | 4 | 0 |
| `test_hub_stars` | 7 | 7 | 0 |
| `test_hub_traffic` | 9 | 9 | 0 |
| `test_hub_usage` | 14 | 14 | 0 |
| `test_hub_usage_rate` (new) | 4 | 4 | 0 |
| **total** | **74** | **74** | **0** |

Base branch: `corpus-hub`. This branch is based on `dc602af`; upstream `corpus-hub` has
since advanced to `d1c248c`, and `functions/_lib/hub-usage.js` is byte-identical at both
commits (blob `ca0103c`), so the defect and this patch are unchanged.

## Checks

Every Rust-side check below is **not applicable**: this diff contains no Rust file, so none
of them can observe it. On the machine this was prepared on `cargo` also could not fetch
crates from crates.io, so no Rust build was run at all. Nothing in this diff depends on a
Rust build. The JavaScript corpus-hub suites were run instead, and their output is in
**Evidence** above.

- [ ] `cargo fmt --all` — **not applicable**: this change touches no Rust file, so there is
      nothing for rustfmt to reformat.
- [ ] Scoped release build of the crates touched: `cargo build --release -j 32 -p <crate>` —
      **not applicable**: no crate is touched.
- [ ] `cargo test -p <crate>` passes — **not applicable**: no crate is touched.
- [ ] ES-YAML conformance suite at **0 failed** — **not applicable**: this is a Cloudflare
      Pages Functions change; no file under `engine/` changed, so the engine gate cannot be
      affected by this diff.
- [ ] New ES-compatible behaviour has a matching YAML case under
      `engine/tests/es-compat-yaml/yaml/` — **not applicable**: this change does not alter
      any ES wire behaviour.
- [ ] Docs updated if user-visible behaviour changed — **not applicable**: no document
      describes this limiter. The 60-requests-per-minute token bucket in
      `docs/CORPUS_HUB_V2_IMPLEMENTATION.md` is the separate Rust `xerj-api` limiter; this
      Pages Functions limiter (`RATE_PER_MIN = 30`) is not documented anywhere, and the fix
      restores the behaviour the comment above the changed line already describes
      ("IPv4 address / IPv6 /64"), so there is no stale documentation to correct.
- [ ] For non-trivial changes: the applicable audit in
      [`docs/CONTRIBUTION_REVIEW.md`](../docs/CONTRIBUTION_REVIEW.md) — **not applicable**:
      this is a one-line JavaScript change in a Pages Function with a two-case regression
      test. It changes no operational document and no runnable recipe, which is the
      precondition of that audit.
- [ ] For non-trivial changes: if this PR changes an operational document or runnable
      recipe, complete the operational audit in
      [`docs/CONTRIBUTION_REVIEW.md`](../docs/CONTRIBUTION_REVIEW.md) — **not applicable**
      for the same reason: no operational document and no runnable recipe is changed.

**Not run:** `cargo fmt --all`, `cargo build --release -j 32 -p <crate>`,
`cargo test -p <crate>` and the ES-YAML conformance suite — because this diff contains no
Rust file, and because `cargo` could not fetch crates from crates.io from the machine this
was prepared on, so no Rust build or test run was possible at all.

## Provenance

- Prepared and reviewed by @gravion-ux (Priyanshu Kumar Thakur).
- **Verified** (commands run, output observed):
  - `node tools/corpus-hub-site/test_hub_usage_rate.mjs` fails on the unpatched
    `functions/_lib/hub-usage.js` (2 of 4 failing) and passes on the patched file (4 of 4
    passing). The failing-before run was produced by checking out only
    `functions/_lib/hub-usage.js` back to `HEAD`, so the test file was byte-identical in
    both runs.
  - All nine corpus-hub suites pass on the patched tree: 74 tests, 74 pass, 0 fail.
  - `hub-stars.js` imports only `../_lib/session.js`, and `hub-traffic.js` already imported
    `sourceKey` from `hub-stars.js` before this change, so the new import introduces no
    cycle. Read from the files, not inferred.
  - The change is confined to one file plus one new test file: `git diff --stat` reports
    `functions/_lib/hub-usage.js | 10 +++++++++-` (9 insertions, 1 deletion) plus one
    new test file of 79 lines.
  - The defect is still present at the current tip of `corpus-hub` (`d1c248c`):
    `functions/_lib/hub-usage.js` is byte-identical to the `dc602af` version this branch
    was built on (both are blob `ca0103c`), and the quoted line was read from that file,
    not from an older checkout.
  - The base branch of this pull request is `corpus-hub`; the head branch is based on
    `dc602af`, which is an ancestor of the current `corpus-hub` tip.
- **Assumed** (not tested, and what would falsify it):
  - The intended unit of the limit is the /64. The comment above the original line says
    *"IPv4 address / IPv6 /64"*, `sourceKey()` in `hub-stars.js` implements the /64 rule,
    and the traffic limit uses it. I did not find a separate specification document for the
    usage limit, so this is read from the code's own stated intent. Falsified if the
    maintainers state the limit is per-host rather than per-/64 — in which case
    `sourceKey()` is the wrong helper, and the stars and traffic limits would need the
    same reconsideration.
  - The limit is 30 requests per minute per source (`RATE_PER_MIN = 30`). Read from the
    constant; unchanged by this patch.
  - That a single Cloudflare-facing endpoint is what a /64 is meant to protect.
