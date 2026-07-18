# GitHub App Setup

Create a GitHub App with the minimum repository metadata read permission.

Configure the user authorization **Callback URL**:

```text
https://<your-app-domain>/api/github/installations/callback
```

Configure the post-install **Setup URL** to the same endpoint:

```text
https://<your-app-domain>/api/github/installations/callback
```

GitHub treats these as separate settings. The app intentionally omits the
optional OAuth `redirect_uri`, so GitHub uses the registered Callback URL
exactly and does not reject the flow when a stale deployment URL is present in
an environment variable. Update both GitHub App fields whenever the production
domain changes.

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
