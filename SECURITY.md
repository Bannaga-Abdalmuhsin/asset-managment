# Security baseline and production boundary

This GitHub Pages build is an interface prototype. It is public static hosting and must not be treated as an STC-approved production system or used for confidential operational data.

## Controls included in the prototype

- Restrictive Content Security Policy and no-framing/no-indexing directives
- No credentials, API keys, or embedded secrets
- Session-only map cache rather than persistent local storage
- Validated site identifiers and DOM text rendering for CMDB values
- Pinned third-party library versions and HTTPS-only resources
- External links isolated with `noopener`, `noreferrer`, and a no-referrer policy

## Mandatory production architecture

1. Host on an STC-approved private platform behind the corporate WAF.
2. Authenticate with STC SSO using OIDC/SAML and MFA.
3. Enforce server-side RBAC and regional/data-field authorization. Frontend hiding is not access control.
4. Replace the browser-direct Google Sheet connection with an authenticated CMDB API gateway that returns only authorized fields and records.
5. Keep service credentials in the approved secrets vault; rotate them and never ship them to browsers.
6. Use TLS 1.2/1.3, HSTS, strict response security headers, request limits, throttling, and abuse detection.
7. Send authentication, authorization, data-access, export, and administrator events to the approved audit/SIEM platform without logging secrets.
8. Apply secure SDLC gates: dependency/SBOM scanning, SAST/DAST, secret scanning, code review, penetration testing, patch SLAs, backups, and incident runbooks.
9. Define data classification, retention, masking, export controls, and non-production data rules with STC cybersecurity and CMDB owners.
10. Obtain formal architecture, privacy, cybersecurity, and production-readiness approval before integration.

Production response headers must include CSP (including `frame-ancestors 'none'`), HSTS, `X-Content-Type-Options: nosniff`, a restrictive Permissions Policy, and an appropriate cache policy for sensitive records. HTML meta tags are defense-in-depth and cannot replace server headers.
