# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Instead, please report them by:

1. Opening a private security advisory on GitHub
2. Or emailing the maintainer directly

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **Acknowledgment:** Within 48 hours
- **Initial assessment:** Within 1 week
- **Fix timeline:** Depends on severity (critical: ASAP, high: 2 weeks, medium: 1 month)

## Security Best Practices

When using this project:

### Credentials

- Never commit OCI credentials
- Use OCI config file authentication (`~/.oci/config`)
- Set appropriate IAM policies with least privilege

### Environment Variables

- Use `.env` files for local development only
- Never commit `.env` files (already in `.gitignore`)
- Use proper secret management in production

### API Keys

- Rotate credentials regularly
- Use separate credentials for dev/prod
- Monitor usage for anomalies

## Disclosure Policy

We follow coordinated disclosure. We ask that you:

- Give us reasonable time to fix issues before public disclosure
- Avoid accessing or modifying data that isn't yours
- Act in good faith

Thank you for helping keep this project secure.
