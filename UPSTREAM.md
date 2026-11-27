# Upstream files

Three files in this repository are copied verbatim from
[`xerj-org/xerj`](https://github.com/xerj-org/xerj) so that the regression test can
run here without the whole upstream tree.

| file | upstream path | why it is here |
| --- | --- | --- |
| `functions/_lib/hub-usage.js` | `functions/_lib/hub-usage.js` | the patched file -- the subject of the change |
| `functions/api/hub-stars.js` | `functions/api/hub-stars.js` | exports `sourceKey()`, imported by `hub-usage.js` |
| `functions/_lib/session.js` | `functions/_lib/session.js` | imported by `hub-stars.js` |

- Source: `xerj-org/xerj`, branch `corpus-hub`
- Commit copied from: `5fdddc2f145bd6a3bcf4eb022a438745a0d8e0f6`
- Upstream licence: Apache-2.0, reproduced in
  [`UPSTREAM-LICENSE.txt`](UPSTREAM-LICENSE.txt)

These three files keep the upstream Apache-2.0 licence. Every other file in this
repository -- the patch, the regression test, the CI workflow and the documentation
-- is MIT licensed; see [`LICENSE`](LICENSE).
