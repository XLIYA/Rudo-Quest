# GitHub App Setup

Create a GitHub App with the minimum repository metadata read permission. Configure callback URL:

```text
NEXT_PUBLIC_APP_URL/api/github/installations/callback
```

Configure webhook URL:

```text
NEXT_PUBLIC_APP_URL/api/webhooks/github
```

Set these variables:

```text
GITHUB_APP_ID
GITHUB_APP_CLIENT_ID
GITHUB_APP_CLIENT_SECRET
GITHUB_APP_PRIVATE_KEY
GITHUB_WEBHOOK_SECRET
```

The server generates short-lived app JWTs and installation tokens. Installation tokens are never stored and never sent to the browser. Rudo Quest stores installation metadata and one repository connection per project. V1 does not import issues and does not perform two-way synchronization.
