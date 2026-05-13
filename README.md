# kj-link-shortener

Small AWS-native URL shortener for custom domains.

The project is designed to be safe as a public open-source repo. It includes reusable code, tests, infrastructure, and sample config only. Keep real API keys, AWS account details, hosted zone IDs, production link data, logs, and generated deployment output outside git.

## Stack

- TypeScript Lambda
- CloudFront in front of a Lambda Function URL
- DynamoDB with TTL cleanup
- AWS CDK for infrastructure
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
- Permanent links do not set a DynamoDB TTL attribute.
- Link creation validates the URL string but does not require the destination to be fetchable.
- Metadata fetch is best-effort and bounded; if it fails or finds nothing, the link is still created with `metadata: null`.
- `PATCH /api/links/{code}` updates the destination URL and refreshes metadata best-effort.
- Metadata fetches block private/local network destinations.
- Social crawler user agents receive a small HTML preview page with stored Open Graph/Twitter tags.
- Preview pages use the configured custom domain as their canonical and `og:url`.
- Redirects use `302`.
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

## Deploy

Deploys require AWS credentials and CDK context values supplied from your shell, CI secrets, or ignored local config.

```bash
pnpm cdk deploy \
  -c domainName=example.com \
  -c hostedZoneDomain=example.com \
  -c hostedZoneId=Z00000000000000000000 \
  -c certificateArn=arn:aws:acm:us-east-1:123456789012:certificate/example \
  -c apiKeySecretName=example/link-shortener/api-key \
  -c lambdaFunctionName=kj-link-shortener
```

`apiKeySecretName` points to an AWS Secrets Manager secret containing the private API key. The repo should contain only placeholder examples.

Deployments create a Lambda alias named `production` by default and publish the latest function version to it.
If `production` is not suitable, pass `-c lambdaAliasName=<alias-name>` when deploying.

## GitHub Actions Deploy

The deploy workflow is manual only and reads production values from the GitHub `production` environment. Do not commit real deployment values.

Create these environment variables:

- `AWS_REGION`: AWS region for Lambda and DynamoDB, for example `ap-southeast-1`.
- `DOMAIN_NAME`: public shortener domain, for example `example.com`.
- `HOSTED_ZONE_DOMAIN`: Route53 hosted zone domain, for example `example.com`.
- `HOSTED_ZONE_ID`: Route53 hosted zone ID.
- `CERTIFICATE_ARN`: ACM certificate ARN in `us-east-1` for CloudFront.
- `API_KEY_SECRET_NAME`: AWS Secrets Manager secret name or ARN containing the private API key.

Create this environment secret:

- `AWS_ROLE_TO_ASSUME`: IAM role ARN trusted by GitHub Actions OIDC for this repository.

Optional environment variables:

- `DEFAULT_TTL_DAYS`
- `TABLE_NAME`
- `LAMBDA_FUNCTION_NAME`, for example `kj-link-shortener`
- `LAMBDA_MEMORY_SIZE`
- `LAMBDA_TIMEOUT_SECONDS`
- `LAMBDA_ALIAS_NAME`, for example `production`
- `LAMBDA_VERSION_DESCRIPTION`, optional text appended to the deployed Lambda version/alias description for traceability

The AWS account must be CDK-bootstrapped before the workflow can deploy:

```bash
pnpm cdk bootstrap aws://ACCOUNT_ID/AWS_REGION
```

Then run **Actions > Deploy > Run workflow**.

## Operator UI

Open `/web` on the deployed shortener domain, for example `https://example.com/web`, to use the built-in operator UI.

The UI is intentionally public-safe:

- It stores the API key only in the operator browser's `localStorage`.
- It calls same-origin private API routes with `x-api-key`.
- It supports create, custom code, TTL, exact expiration timestamps, permanent links, forced upsert, and URL updates.
- No production domain, AWS account value, or API key is committed.

## Required CDK Context

- `domainName`: custom domain for redirects and API, for example `example.com`.
- `hostedZoneDomain`: Route53 hosted zone domain, for example `example.com`.
- `hostedZoneId`: Route53 hosted zone ID. Supply this from local ignored config or CI secrets.
- `certificateArn`: ACM certificate ARN in `us-east-1` for CloudFront.
- `apiKeySecretName`: Secrets Manager secret name or ARN containing the create/manage API key.

Optional context:

- `defaultTtlDays`: default TTL in days, default `30`.
- `tableName`: DynamoDB table name.
- `lambdaFunctionName`: Lambda function name.
- `lambdaMemorySize`: Lambda memory in MB, default `256`.
- `lambdaTimeoutSeconds`: Lambda timeout, default `10`.

## Public Repo Safety

Before publishing:

```bash
git status --short
git ls-files | rg '(^|/)\.env|cdk\.out|\.aws|secret|account'
```

Only `.env.example` should be tracked.
