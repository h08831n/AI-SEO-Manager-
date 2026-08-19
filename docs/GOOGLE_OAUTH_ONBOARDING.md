# Google OAuth 2.0 & Cloud Integration Onboarding Guide

## Architecture Overview
The Autonomous AI SEO Manager integrates directly with Google Search Console (GSC) and Google Analytics 4 (GA4) via Google's official REST APIs:
- **Google Search Console API v3** (`webmasters/v3`)
- **Google Analytics Data API v1beta & Admin API v1beta**

### Single Multi-Tenant OAuth Application Model
- **Centralized OAuth Client**: One OAuth 2.0 Application registered in the platform's Google Cloud project manages all customer authorization flows.
- **Zero-Friction for End Users**: Workspace users do **not** need to create Google Cloud projects or API keys. They simply click **"Connect Google"** and approve read-only permissions on their existing Google Account.
- **Tenant Isolation**: Authorized tokens and property bindings are encrypted (`AES-256-GCM`) and partitioned strictly by `websiteId` and `workspaceId`.

---

## Required Environment Variables

When provisioning live Google OAuth credentials, provide the following standard configuration in the server environment:

```bash
# 1. Google OAuth Client Credentials
GOOGLE_CLIENT_ID="<YOUR_OAUTH_CLIENT_ID>.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="<YOUR_OAUTH_CLIENT_SECRET>"

# 2. Redirect URI (Authorized Redirect URI in Google Cloud Console)
GOOGLE_OAUTH_REDIRECT_URI="https://your-domain.com/api/integrations/google/callback"

# 3. AES-256-GCM Master Key for credential encryption at rest (64 hex characters / 32 bytes)
ENCRYPTION_MASTER_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

---

## Authorized Google OAuth Scopes

The application requests **strictly read-only** scopes:

| Scope | Purpose |
|---|---|
| `https://www.googleapis.com/auth/webmasters.readonly` | List verified Search Console properties and query search analytics (Clicks, Impressions, CTR, Position). |
| `https://www.googleapis.com/auth/analytics.readonly` | List accessible GA4 accounts/properties and run landing page & channel conversion reports. |
| `openid` | OpenID Connect token authentication. |
| `email` | Retrieve user email for connection display and audit trail. |
| `profile` | User display metadata. |

---

## Google Cloud Console Configuration Checklist

1. Navigate to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Enable APIs in Library:
   - **Google Search Console API** (`webmasters.googleapis.com`)
   - **Google Analytics Data API** (`analyticsdata.googleapis.com`)
   - **Google Analytics Admin API** (`analyticsadmin.googleapis.com`)
3. Create OAuth 2.0 Client ID:
   - Application Type: **Web application**
   - Authorized Javascript Origins: `https://your-domain.com` (and `http://localhost:3000` for development)
   - Authorized Redirect URIs: `https://your-domain.com/api/integrations/google/callback` (and `http://localhost:3000/api/integrations/google/callback`)
4. Configure OAuth Consent Screen:
   - Publishing Status: **Production** (or **Testing** with invited test users)
   - User Type: **External**

---

## Runtime Status Semantics
- **Without live credentials**: The application runs completely in offline/deterministic mode. Status: `BLOCKED_EXTERNAL_CREDENTIALS`. All crawler, database, analytics calculation, and testing engines run with zero blockers.
- **With live credentials**: The status transitions to `CONNECTED` upon user authentication, and data is ingested via background worker queues.
