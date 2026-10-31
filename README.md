# XERJ Corpus Hub — IPv6 /64 rate-limit fix

A collaboration contribution to [xerj-org/xerj](https://github.com/xerj-org/xerj), prepared
by [gravion-ux](https://github.com/gravion-ux) (Priyanshu Kumar Thakur) after Ivan N asked
for collaboration on the project.

**This repository contains no upstream code.** It holds the patch, the regression test and
the pull-request text, so that the change can be reviewed as a unit and applied to the
upstream `corpus-hub` branch with one command.

## The defect

The Corpus Hub rate limiter is meant to count **one source**, where a source is an IPv4
address or an IPv6 **/64**. `functions/_lib/hub-usage.js` built its bucket key like this:

```js
const key = ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;
```

Its own comment above it says *"IPv4 address / IPv6 /64"* — but the code does not compute
a /64. It takes the **first four colon-separated fields** of whatever string arrived.

That is only a /64 when the address is written in full, with no `::`. For a compressed
address whose zero run starts before the fourth group, the host bits are still inside those
four fields:

| address | first four fields | the address itself |
| --- | --- | --- |
| `2001:db8:0:0:0:0:0:1` | `2001:db8:0:0` | /64 `2001:db8:0:0` |
| `2001:db8::1` | `2001:db8::1` | /64 `2001:db8:0:0` |
| `2001:db8::2` | `2001:db8::2` | /64 `2001:db8:0:0` |

So `2001:db8::1` and `2001:db8::2` land in **different** buckets even though they are the
same /64. A single /64 can therefore pass the per-source limit once per host address, which
is exactly what the limit exists to prevent. The same address written two ways —
`2001:dba::1` and `2001:0dba:0000:0000:0000:0000:0000:0001` — also landed in two
different buckets.

## The fix

The repository already had the correct helper. `functions/api/hub-stars.js` exports
`sourceKey(ip)`, which expands the address, takes the first four groups and appends
`::/64` — and the traffic route already used it:

```js
// functions/_lib/hub-traffic.js:20
import { sourceKey } from '../api/hub-stars.js';
```

The patch makes the rate limiter use the same helper, so all three hub rate limits bucket a
source identically:

```js
// functions/_lib/hub-usage.js
import { sourceKey } from '../api/hub-stars.js';

export async function overRate(request) {
  const ip = String(request.headers.get('CF-Connecting-IP') || '');
  const key = sourceKey(ip);
  ...
}
```

No new IPv6 parsing is introduced, so the limiter cannot drift from the stars and traffic
limits. There is no import cycle: `hub-stars.js` imports only `../_lib/session.js`.

## Evidence

The regression test is `tools/corpus-hub-site/test_hub_usage_rate.mjs`. It freezes
`Date.now` so the minute bucket cannot reset mid-test and make the assertion
timing-dependent.

**Before the fix** — the two IPv6 tests fail, the two control tests pass:

```
$ node tools/corpus-hub-site/test_hub_usage_rate.mjs
✖ a second host in the same IPv6 /64 shares the bucket of the first (24.5427ms)
✖ one IPv6 address written two ways shares one bucket (3.3223ms)
✔ two different IPv6 /64s keep separate buckets (3.5219ms)
✔ an IPv4 address keeps its own bucket (1.9279ms)
ℹ tests 4
ℹ pass 2
ℹ fail 2
```

**After the fix** — all four pass:

```
$ node tools/corpus-hub-site/test_hub_usage_rate.mjs
✔ a second host in the same IPv6 /64 shares the bucket of the first (22.5473ms)
✔ one IPv6 address written two ways shares one bucket (3.5312ms)
✔ two different IPv6 /64s keep separate buckets (2.9292ms)
✔ an IPv4 address keeps its own bucket (1.7289ms)
ℹ tests 4
ℹ pass 4
ℹ fail 0
```

**No regression** — all nine corpus-hub suites, run against the patched tree:

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

## Layout

```
functions/_lib/hub-usage.js                      the patched file (verbatim)
tools/corpus-hub-site/test_hub_usage_rate.mjs   the new regression test (verbatim)
patches/corpus-hub-ipv6-rate-limit.patch        git diff against the branch tip
PR_BODY.md                                       the pull-request text
```

## Applying the patch

Against a checkout of `xerj-org/xerj` on the `corpus-hub` branch:

```bash
git checkout corpus-hub
git apply --3way patches/corpus-hub-ipv6-rate-limit.patch
cp tools/corpus-hub-site/test_hub_usage_rate.mjs tools/corpus-hub-site/
node tools/corpus-hub-site/test_hub_usage_rate.mjs
```

The pull request is based on `dc602af`. The patch's pre-image is blob `ca0103c`, and that
blob is unchanged at every `corpus-hub` tip from `dc602af` through the current tip
`28e67cb0` — so the patch applies to the branch as it stands.

## The upstream pull request

The pull request is open upstream: [xerj-org/xerj#2872](https://github.com/xerj-org/xerj/pull/2872).

Its body splits what was **verified** from what was **assumed**, and quotes only numbers
that came from a command that was actually run. The field report the upstream contribution
guide asks for is filed in a second, single-file pull request against `main`.

No direct commit is made to `xerj-org/xerj` from this repository — the change is contributed
as a pull request from the fork, and the branch here carries the same patch.

## Licence

The patch and the test are offered under the MIT licence in [`LICENSE`](LICENSE). The
upstream project keeps its own licence.
