# OAuth Setup Guide

This repository now includes everything that is needed to turn on OAuth
support except for your actual client IDs and secrets. Follow the steps below
to finish the configuration in your own environment.

## 1. Enable the OAuth feature flag

1. Decide where you keep your runtime overrides (for example
   `/etc/sharelatex/settings.js`, a docker-compose `.env`, or a Helm chart).
2. Set the `OVERLEAF_ENABLE_OAUTH` environment variable to `true`.
   This toggles `Settings.oauth`, which drives `Features.hasFeature('oauth')`
   in `services/web/app/src/infrastructure/Features.mjs`.

Restart the `web` service after changing the environment so the new flag is
picked up.

## 2. Provide OAuth provider metadata

The frontend linking UI is populated from `Settings.oauthProviders`. The
defaults file now loads provider definitions from either:

- `OVERLEAF_OAUTH_PROVIDERS_FILE` – an absolute path to a JSON file, or
- `OVERLEAF_OAUTH_PROVIDERS_JSON` – an inline JSON string in the environment.

To save you some typing we ship `config/oauth-providers.example.json`; copy it
to a safe location (for example `/etc/sharelatex/oauth-providers.json`), fill
in your real `clientID`, `clientSecret`, and callback URLs, then point
`OVERLEAF_OAUTH_PROVIDERS_FILE` at that path.

Each provider entry must match the type in
`services/web/types/oauth-providers.ts`. You can hide providers when a user
is already linked by setting `hideWhenNotLinked: true`, and you can add
provider-specific URLs via `descriptionOptions`.

Restart the `web` service whenever you change the JSON so the metadata is
reloaded.

## 3. Register OAuth applications in MongoDB

Use the built-in scripts so that client secrets are hashed consistently:

```bash
# Create/update an application
cd services/web
node scripts/oauth/register_client.mjs my-client-id \
  --name="My Client" \
  --secret=CHANGEME \
  --grant=authorization_code \
  --scope=writefull git_bridge \
  --redirect-uri=https://example.com/oauth/callback

# Remove an application (supports --commit)
node scripts/oauth/remove_client.mjs my-client-id

# Seed access/refresh tokens if you need bootstrap credentials
node scripts/oauth/create_token.mjs --application-id=<mongoObjectId> \
  --user-id=<userObjectId> \
  --token=<access-token> \
  --refresh-token=<refresh-token> \
  --scope="git_bridge" \
  --expiry-date="2030-01-01T00:00:00.000Z"
```

Remember to insert the real `--secret` and redirect URIs yourself. The scripts
live under `services/web/scripts/oauth` if you need to inspect additional
options (e.g. `--enable-pkce`).

## 4. Configure Git Bridge (optional)

If you run `git-bridge`, configure `/conf/runtime.json` (or use
`services/git-bridge/conf/envsubst_template.json` as a base) so that
`oauth2Server` points to your `web` host. Then register the companion OAuth
client exactly as shown in `services/git-bridge/README.md` (grant type
`password`, scope `git_bridge`). Once that client exists, restart the
`git-bridge` service.

## 5. Issue personal access tokens (optional)

For users who need API access without a browser redirect, run:

```bash
node services/web/scripts/create_oauth_personal_access_token.mjs \
  --user-id=<userObjectId>
```

Record the printed token securely; it cannot be retrieved later.

## 6. Fill in API keys and restart

At this point the repository is ready to accept real client IDs, secrets, and
provider endpoints. Provide those values via your preferred secret store or
environment variable mechanism, restart the affected services (`web`,
`git-bridge`, etc.), and test the `/user/settings` linking UI plus any API
endpoints wrapped in `AuthenticationController.requireOauth`.
