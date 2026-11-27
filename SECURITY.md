# Security Policy

This repository is a patch record for the xerj Corpus Hub IPv6 /64
rate-limit fix. It contains the patch, a regression test, and copied
upstream files needed to run that test.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability in this patch
record. Report it privately through GitHub private vulnerability
reporting:
<https://github.com/gravion-ux/xerj-ipv6-rate-limit-fix/security/advisories/new>

Email: priyanshukumarthakur937@gmail.com

Include the affected file, the impact you believe it has, and the
smallest reproduction you have. Never include credentials or private
traffic data in a report.

## Scope

In scope:

- A bypass of the IPv6 /64 bucketing fix in the copied rate-limit code.
- A regression test that passes while the bucketing defect remains.
- Accidental exposure of private data in this repository.

Out of scope:

- Vulnerabilities in the wider xerj project that are unrelated to this
  patch. Report those to the xerj maintainers through their normal
  security route.

## Repository hygiene

GitHub secret scanning and push protection are enabled for this
repository. Dependabot checks GitHub Actions dependencies weekly, and
CodeQL runs on pushes, pull requests, and a weekly schedule.
