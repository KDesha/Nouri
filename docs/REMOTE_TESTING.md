# Test Nouri away from home

Nouri's remote test setup has two independent parts:

1. The Express API runs as a Netlify Function at `https://nouri-api.netlify.app/api`.
2. Expo EAS creates an installable preview app with the JavaScript bundle included.

The preview app does not need Metro, Xcode, or the development Mac after installation.

## Netlify API

The repository's `netlify.toml` builds the backend and exposes all existing Express routes below `/api`. The health check is:

```text
https://nouri-api.netlify.app/api/health
```

These private environment variables must be configured in Netlify and must never be committed:

- `DATABASE_URL`
- `FDC_API_KEY`
- `JWT_SECRET`
- `EDAMAM_ENABLED`
- `EDAMAM_APP_ID`
- `EDAMAM_APP_KEY`

Deploy the linked project from the repository root:

```bash
npx netlify-cli@latest deploy --build --prod
```

After deployment, check `/api/health`, run a food search, and confirm that account login still reaches PostgreSQL.

## Installable iPhone preview

The `preview` profile in `mobile/eas.json` points to the public Netlify API and uses internal distribution. It is not a development-client build, so Metro is not required.

Register each test iPhone once:

```bash
cd mobile
npx eas-cli@latest device:create
```

Then create the iOS preview:

```bash
npx eas-cli@latest build --platform ios --profile preview
```

EAS provides an installation page when the build finishes. Open that page on a registered iPhone and tap **Install**. Apple ad hoc distribution requires a paid Apple Developer Program team and includes only devices registered in the provisioning profile.

## Production

The `production` EAS profile uses the same public API URL, but it creates a store build instead of an internal preview. Before store submission, confirm the final privacy policy, support URL, medical disclaimer, account-deletion flow, API monitoring, database backups, and provider terms.
