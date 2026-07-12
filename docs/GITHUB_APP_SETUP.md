# GitHub App Setup

Create a GitHub App with the minimum repository metadata read permission.

Configure the setup/callback URL:

```text
https://<your-app-domain>/api/github/installations/callback
```

Configure webhook URL:

```text
https://<your-app-domain>/api/webhooks/github
```

Set these variables:

```text
GITHUB_APP_ID
GITHUB_APP_SLUG
GITHUB_APP_CLIENT_ID
GITHUB_APP_CLIENT_SECRET
GITHUB_APP_PRIVATE_KEY
GITHUB_WEBHOOK_SECRET
```

`GITHUB_APP_SLUG` is the slug in the public GitHub App URL, for example
`https://github.com/apps/<slug>`. The app uses it to build the installation
URL and uses `GITHUB_APP_CLIENT_SECRET` to sign the short-lived installation
state token.

The flow has two server-validated legs: Rudo Quest starts a signed state and
GitHub user authorization, then redirects the user to install the GitHub App.
The callback verifies the persisted nonce, expiration, current Rudo user, and
that GitHub reports the installation in that user's installations before the
state is atomically consumed. Replaying the callback or using an installation
owned by another Rudo user fails.

The server generates short-lived app JWTs and installation tokens. Installation
tokens are never stored and never sent to the browser. The temporary GitHub
user token is encrypted at rest and removed when the state is consumed. Rudo
Quest stores verified installation metadata and one repository connection per
project. V1 does not import issues and does not perform two-way synchronization.
