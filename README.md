# kj-link-shortener

Small AWS-native URL shortener for custom domains.

The project is designed to be safe as a public open-source repo. It includes reusable code, tests, infrastructure, and sample config only. Keep real API keys, AWS account details, hosted zone IDs, production link data, logs, and generated deployment output outside git.

## Stack

- TypeScript Lambda
- CloudFront in front of a Lambda Function URL
- DynamoDB with TTL cleanup
- Firehose to S3 JSONL analytics with Glue/Athena query metadata
- Terraform-owned infrastructure
- Private create/manage API with `x-api-key`

## API

Create a short link:

```bash
curl -X POST "https://example.com/api/links" \
  -H "content-type: application/json" \
  -H "x-api-key: $SHORTENER_API_KEY" \
  -d '{"url":"https://example.org/docs","ttl_days":30}'
```

Create a short link that expires at an exact timestamp:

```bash
curl -X POST "https://example.com/api/links" \
  -H "content-type: application/json" \
  -H "x-api-key: $SHORTENER_API_KEY" \
  -d '{"url":"https://example.org/docs","expires_at":"2026-06-01T10:15:00.000Z"}'
```

Create a custom permanent short link:

```bash
curl -X POST "https://example.com/api/links" \
  -H "content-type: application/json" \
  -H "x-api-key: $SHORTENER_API_KEY" \
  -d '{"url":"https://example.org/docs","code":"docs","permanent":true}'
```

Create a booking-owned link with tenant-ready ownership metadata:

```bash
curl -X POST "https://example.com/api/links" \
  -H "content-type: application/json" \
  -H "x-api-key: $SHORTENER_API_KEY" \
  -d '{
    "url":"https://example.org/docs?utm_source=line&utm_medium=social&utm_campaign=spring-sale",
    "expires_at":"2026-06-01T10:15:00.000Z",
    "owner_context":{
      "tenant_id":"tenant-123",
      "source_kind":"booking_public_link",
      "created_by_user_id":"user-456"
    }
  }'
```

Upsert an existing custom code:

```bash
curl -X POST "https://example.com/api/links" \
  -H "content-type: application/json" \
  -H "x-api-key: $SHORTENER_API_KEY" \
  -d '{"url":"https://example.org/new-docs","code":"docs","force":true}'
```

Update the destination URL for an existing code:

```bash
curl -X PATCH "https://example.com/api/links/docs" \
  -H "content-type: application/json" \
  -H "x-api-key: $SHORTENER_API_KEY" \
  -d '{"url":"https://example.org/new-docs"}'
```

Redirect:

```bash
curl -i "https://example.com/docs"
```

The create response includes the generated short URL and stored preview metadata:

```json
{
  "code": "docs",
  "url": "https://example.org/docs",
  "short_url": "https://example.com/docs",
  "expires_at": null,
  "permanent": true,
  "metadata": {
    "title": "Example Docs",
    "description": "Documentation preview text",
    "image": "https://example.org/og.png",
    "fetched_at": "2026-05-13T00:00:00.000Z"
  }
}
```

## Behavior

- Generated codes use 6 base62 characters.
- Custom codes must match `[A-Za-z0-9_-]{3,64}`.
- Duplicate custom-code creates return `409` unless `force: true` is supplied.
- `force: true` on `POST /api/links` upserts an existing custom code by updating its destination URL and reactivating it if disabled.
- Reserved paths are `api`, `health`, `admin`, and `www`.
- Default TTL is 30 days.
- Create requests can use `expires_at` as an ISO 8601 timestamp instead of `ttl_days` when the link needs an exact expiration time.
- Create requests can attach optional `owner_context` so the link can be attributed to a tenant or application workflow later.
- Permanent links do not set a DynamoDB TTL attribute.
- Link creation validates the URL string but does not require the destination to be fetchable.
- Metadata fetch is best-effort and bounded; if it fails or finds nothing, the link is still created with `metadata: null`.
- `PATCH /api/links/{code}` updates the destination URL and refreshes metadata best-effort.
- Metadata fetches block private/local network destinations.
- Social crawler user agents receive a small HTML preview page with stored Open Graph/Twitter tags.
- Preview pages use the configured custom domain as their canonical and `og:url`.
- Redirects use `302`.
- Successful human redirects emit best-effort `link_opened.v1` analytics events to Firehose/S3.
- Preview crawler requests do not emit redirect analytics events.
- Missing, expired, or disabled links return `404`.
- DynamoDB TTL eventually deletes expired items, but the Lambda checks expiry on every redirect.

## Local Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm lint
```

Use `.env.example` as a template for local values. Do not commit real `.env` files.

The operator UI is served by the Lambda at `/web`. It asks for the API key in the browser and stores it only in local browser storage; no API key is compiled into the app.

`pnpm dev` runs a local HTTP wrapper around the Lambda handler with an in-memory link store. It watches TypeScript changes, rebuilds `dist`, restarts the local server automatically, and refreshes the browser page on localhost after a restart.

- URL: `http://localhost:8787/web`
- API key: `dev-api-key`
- Custom API key: `SHORTENER_DEV_API_KEY=your-key pnpm dev`
- Custom port: `PORT=3000 pnpm dev`
- Custom host: `HOST=0.0.0.0 pnpm dev`

Local links exist only while the dev server is running.

To test as a user:

1. Open `http://localhost:8787/web`.
2. Enter `dev-api-key`.
3. Create a link such as `https://example.org/docs`.
4. Open the generated short URL to confirm the redirect.

For VS Code breakpoints, add `.vscode/launch.json` locally:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Local Shortener UI",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "env": {
        "SHORTENER_DEV_API_KEY": "dev-api-key",
        "PORT": "8787"
      },
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist-dev/**/*.js"],
      "serverReadyAction": {
        "pattern": "running at (http://.*)",
        "uriFormat": "%s",
        "action": "openExternally"
      },
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Handler Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["exec", "vitest", "run", "test/handler.test.ts", "--inspect-brk", "--no-coverage"],
      "console": "integratedTerminal",
      "autoAttachChildProcesses": true,
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

Useful breakpoint files:

- `dev/dev-server.ts`: local HTTP event conversion.
- `src/handler.ts`: routing, API handling, redirect handling.
- `src/create-link.ts`: create/upsert behavior.
- `src/metadata.ts`: metadata fetch behavior.

## Runtime configuration

Production infrastructure is owned by the KaoJai `infra` Terraform stack. The Lambda loads configuration at cold start from:

- SSM `/kj/production/apps/kj-link-shortener/config/*` for table, stream, TTL, and public URL.
- Secrets Manager `/kj/production/all/secrets` for `KJ_LINK_SHORTENER_API_KEY` and `KJ_LINK_SHORTENER_ANALYTICS_IP_HASH_SALT`.

Only `KJ_RUNTIME_ENVIRONMENT=production` is stored directly in the Lambda environment.

## GitHub Actions Deploy

The manual deploy workflow builds the runtime bootstrap artifact, publishes an immutable Lambda version, moves the Terraform-owned `production` alias, checks `/health`, and prunes old versions.

It refuses to deploy while `KjLinkShortenerStack` still exists in CloudFormation or while the Lambda role lacks canonical runtime-config access.

Create this environment secret:

- `AWS_ROLE_TO_ASSUME`: IAM role ARN trusted by GitHub Actions OIDC for this repository.

## Analytics Outputs

Deployments now output the internal analytics resources needed for Athena and Grafana:

- `ShortenerAnalyticsBucketName`
- `ShortenerAnalyticsDeliveryStreamName`
- `ShortenerAnalyticsDatabaseName`
- `ShortenerAnalyticsTableName`

The Glue table uses S3 partition projection over:

- `link-opened/year=YYYY/month=MM/day=DD/`

Then run **Actions > Deploy > Run workflow**.

## Operator UI

Open `/web` on the deployed shortener domain, for example `https://example.com/web`, to use the built-in operator UI.

The UI is intentionally public-safe:

- It stores the API key only in the operator browser's `localStorage`.
- It calls same-origin private API routes with `x-api-key`.
- It supports create, custom code, TTL, exact expiration timestamps, permanent links, forced upsert, and URL updates.
- No production domain, AWS account value, or API key is committed.

## Public Repo Safety

Before publishing:

```bash
git status --short
git ls-files | rg '(^|/)\.env|cdk\.out|\.aws|secret|account'
```

Only `.env.example` should be tracked.
