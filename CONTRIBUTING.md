# Contributing

This repository is maintained as a patch record: the fix, the
regression test, and the upstream pull-request text should stay in
sync.

## Before opening a pull request

- Keep the patch narrow. Do not rewrite copied upstream files beyond
  what the rate-limit fix requires.
- Run the repository checks:

```bash
node --check tools/corpus-hub-site/test_hub_usage_rate.mjs
node tools/check_repo.mjs
node --test tools/corpus-hub-site/test_hub_usage_rate.mjs
```

- If you change the patch, update `patches/corpus-hub-ipv6-rate-limit.patch`,
  the copied patched file, and the README evidence together.
- Use synthetic IP addresses in tests and examples.

## Licensing

Copied upstream files remain under the upstream Apache-2.0 licence;
see `UPSTREAM.md`. Other repository material is MIT licensed.
