# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in SEOAgent, **please do not open a public GitHub issue.**

Report it privately by emailing the maintainer or using [GitHub's private vulnerability reporting](https://github.com/yagomp/seoagent/security/advisories/new).

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You can expect an acknowledgement within 48 hours and a resolution or status update within 7 days.

## Scope

Security issues we care about most:

- **Credential leakage** — API keys (DataForSEO, Anthropic, OpenAI, Google) stored in `~/.seoagent/config.json` must not be exposed via CLI output, MCP responses, logs, or error messages
- **Path traversal** — project slugs used in file paths must be sanitized
- **Command injection** — any user-supplied input passed to shell commands
- **SSRF** — the crawler fetches arbitrary URLs; filters should prevent fetching internal/cloud metadata endpoints
- **SQLite injection** — all queries use parameterized statements

## Out of Scope

- Vulnerabilities in third-party APIs (DataForSEO, Google, Anthropic) — report those upstream
- Rate limiting / DoS against your own DataForSEO account
- Issues only reproducible with a malicious `~/.seoagent/config.json` that the attacker already controls

## Disclosure Policy

We follow coordinated disclosure. Once a fix is released, we'll publish a security advisory crediting the reporter (unless they prefer to remain anonymous).
