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

Create a custom permanent short link:

```bash
curl -X POST "https://example.com/api/links" \
  -H "content-type: application/json" \
  -H "x-api-key: $SHORTENER_API_KEY" \
  -d '{"url":"https://example.org/docs","code":"docs","permanent":true}'
```

Redirect:

```bash
curl -i "https://example.com/docs"
```

## Behavior

- Generated codes use 6 base62 characters.
- Custom codes must match `[A-Za-z0-9_-]{3,64}`.
- Reserved paths are `api`, `health`, `admin`, and `www`.
- Default TTL is 30 days.
- Permanent links do not set a DynamoDB TTL attribute.
- Redirects use `302`.
- Missing, expired, or disabled links return `404`.
- DynamoDB TTL eventually deletes expired items, but the Lambda checks expiry on every redirect.

## Local Development

```bash
pnpm install
pnpm test
pnpm lint
```

Use `.env.example` as a template for local values. Do not commit real `.env` files.

## Deploy

Deploys require AWS credentials and CDK context values supplied from your shell, CI secrets, or ignored local config.

```bash
pnpm cdk deploy \
  -c domainName=example.com \
  -c hostedZoneDomain=example.com \
  -c hostedZoneId=Z00000000000000000000 \
  -c certificateArn=arn:aws:acm:us-east-1:123456789012:certificate/example \
  -c apiKeySecretName=/example/link-shortener/api-key
```

`apiKeySecretName` points to an AWS Secrets Manager secret containing the private API key. The repo should contain only placeholder examples.

## Required CDK Context

- `domainName`: custom domain for redirects and API, for example `example.com`.
- `hostedZoneDomain`: Route53 hosted zone domain, for example `example.com`.
- `hostedZoneId`: Route53 hosted zone ID. Supply this from local ignored config or CI secrets.
- `certificateArn`: ACM certificate ARN in `us-east-1` for CloudFront.
- `apiKeySecretName`: Secrets Manager secret name or ARN containing the create/manage API key.

Optional context:

- `defaultTtlDays`: default TTL in days, default `30`.
- `tableName`: DynamoDB table name.
- `lambdaMemorySize`: Lambda memory in MB, default `256`.
- `lambdaTimeoutSeconds`: Lambda timeout, default `10`.

## Public Repo Safety

Before publishing:

```bash
git status --short
git ls-files | rg '(^|/)\.env|cdk\.out|\.aws|secret|account'
```

Only `.env.example` should be tracked.
