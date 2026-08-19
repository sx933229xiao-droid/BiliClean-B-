# Security Policy

Thank you for helping keep BiliClean and its users safe.

BiliClean is a browser extension that interacts with Bilibili web pages, local extension storage, content scripts, and browser extension APIs. Security reports are taken seriously, especially when an issue could affect user data, extension privileges, or the integrity of pages where BiliClean is active.

## Supported Versions

BiliClean is currently in active early development.

| Version | Supported |
| --- | --- |
| Latest stable release | ✅ Yes |
| Older releases | ⚠️ Best effort |
| Unreleased or modified third-party builds | ❌ No |

Users are encouraged to reproduce security issues using the latest official release or the current `main` branch whenever possible.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

Use GitHub's **Private Vulnerability Reporting** feature for this repository whenever possible.

When submitting a report, please include as much of the following information as possible:

- A clear description of the vulnerability
- The affected BiliClean version
- Browser name and version
- Affected Bilibili page or feature
- Steps required to reproduce the issue
- Expected behavior
- Actual behavior
- Security impact
- Proof-of-concept code or screenshots, if applicable
- Any suggested mitigation or fix

Please remove or redact personal information, authentication credentials, cookies, tokens, and other sensitive account data before submitting a report.

## Security Issues of Interest

Examples of security issues that are particularly useful to report include:

- Script injection or cross-site scripting caused by BiliClean
- Unsafe DOM manipulation that allows page-controlled content to execute privileged behavior
- Unauthorized access to extension state or stored data
- Extension message validation bypasses
- Unexpected privilege or permission escalation
- Malicious configuration imports that can compromise extension behavior
- Exposure of locally stored user data
- Security-sensitive bypasses in extension-to-page or extension-to-extension communication
- Vulnerabilities that allow a website or another extension to trigger privileged BiliClean functionality unexpectedly

This list is not exhaustive.

## Out of Scope

The following are generally not considered security vulnerabilities in BiliClean:

- Vulnerabilities in Bilibili itself that are unrelated to BiliClean
- Normal content-filtering false positives or false negatives
- Cosmetic or layout issues without security impact
- Feature requests
- General performance problems without a security consequence
- Social engineering attacks that do not exploit BiliClean
- Issues that require a deliberately modified or malicious third-party build of BiliClean

These issues can instead be reported through normal GitHub Issues when appropriate.

## Coordinated Disclosure

Please allow reasonable time for the issue to be investigated and, when necessary, fixed before publicly disclosing vulnerability details.

For a valid security report, the general process will be:

1. The report is reviewed and reproduced where possible.
2. The affected code and supported versions are identified.
3. A fix or mitigation is developed.
4. The fix is tested.
5. A patched release is published when necessary.
6. Public disclosure can follow after users have had a reasonable opportunity to update.

BiliClean is currently maintained by a small project, so response times may vary depending on the complexity of the report.

## Security Design Principles

BiliClean aims to follow several basic security principles:

- Request only browser permissions required for core functionality.
- Keep filtering and statistics processing local whenever possible.
- Validate data received through extension messaging.
- Validate imported settings and stored state.
- Avoid exposing authentication credentials or Bilibili account secrets.
- Treat page content as untrusted input.
- Prefer minimal privileges over unnecessary browser access.

## Sensitive Information

Never include any of the following in a public issue:

- Bilibili cookies
- Session tokens
- Browser authentication data
- Passwords
- API keys
- Private access tokens
- Personally identifiable information that is not necessary to reproduce the issue

If sensitive information is required to demonstrate a vulnerability, include it only through an appropriate private reporting channel and redact everything that is not necessary.

## Acknowledgements

Responsible security research and coordinated disclosure are appreciated.

Researchers who provide useful vulnerability reports may be credited in release notes or a security advisory if they wish to be acknowledged.
