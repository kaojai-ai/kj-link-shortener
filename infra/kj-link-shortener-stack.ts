import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
  aws_lambda_nodejs as lambdaNodejs,
  aws_logs as logs,
  aws_route53 as route53,
  aws_route53_targets as route53Targets,
  aws_secretsmanager as secretsmanager,
} from 'aws-cdk-lib';
import type { Construct } from 'constructs';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export class KjLinkShortenerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const domain_name = get_required_context(this, 'domainName');
    const hosted_zone_domain = get_required_context(this, 'hostedZoneDomain');
    const hosted_zone_id = get_required_context(this, 'hostedZoneId');
    const certificate_arn = get_required_context(this, 'certificateArn');
    const api_key_secret_name = get_required_context(this, 'apiKeySecretName');
    const table_name = get_optional_context(this, 'tableName');
    const lambda_function_name = get_optional_context(this, 'lambdaFunctionName');
    const lambda_alias_name = get_optional_context(this, 'lambdaAliasName') ?? 'production';
    const lambda_version_description = get_optional_context(this, 'lambdaVersionDescription');
    const default_ttl_days = get_number_context(this, 'defaultTtlDays', 30);
    const lambda_memory_size = get_number_context(this, 'lambdaMemorySize', 256);
    const lambda_timeout_seconds = get_number_context(this, 'lambdaTimeoutSeconds', 10);

    const table = new dynamodb.Table(this, 'ShortLinksTable', {
      tableName: table_name,
      partitionKey: {
        name: 'code',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl_epoch_seconds',
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const api_key_secret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'ApiKeySecret',
      api_key_secret_name,
    );

    const function_log_group = new logs.LogGroup(this, 'ShortenerFunctionLogGroup', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const redirect_function = new lambdaNodejs.NodejsFunction(this, 'ShortenerFunction', {
      entry: path.join(dirname, '..', 'src', 'handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      functionName: lambda_function_name,
      memorySize: lambda_memory_size,
      timeout: Duration.seconds(lambda_timeout_seconds),
      logGroup: function_log_group,
      currentVersionOptions: {
        description: lambda_version_description,
      },
      bundling: {
        target: 'node22',
        format: lambdaNodejs.OutputFormat.CJS,
        sourceMap: true,
        minify: true,
      },
      environment: {
        NODE_ENV: 'production',
        SHORTENER_TABLE_NAME: table.tableName,
        SHORTENER_DEFAULT_TTL_DAYS: String(default_ttl_days),
        SHORTENER_API_KEY_SECRET_ID: api_key_secret.secretName,
        SHORTENER_PUBLIC_BASE_URL: `https://${domain_name}`,
      },
    });

    table.grantReadWriteData(redirect_function);
    api_key_secret.grantRead(redirect_function);

    const function_alias = redirect_function.addAlias(lambda_alias_name, {
      description: lambda_version_description,
    });

    const function_url = function_alias.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    const certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', certificate_arn);

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      domainNames: [domain_name],
      certificate,
      defaultBehavior: {
        origin: new origins.FunctionUrlOrigin(function_url),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    });

    const hosted_zone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: hosted_zone_id,
      zoneName: hosted_zone_domain,
    });

    new route53.ARecord(this, 'DomainAliasRecord', {
      zone: hosted_zone,
      recordName: domain_name,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
    });

    new CfnOutput(this, 'ShortenerDomain', {
      value: `https://${domain_name}`,
    });

    new CfnOutput(this, 'ShortenerTableName', {
      value: table.tableName,
    });

    new CfnOutput(this, 'ShortenerFunctionAlias', {
      value: function_alias.functionArn,
    });

    new CfnOutput(this, 'ShortenerFunctionVersion', {
      value: redirect_function.currentVersion.version,
    });
  }
}

function get_required_context(scope: Construct, key: string): string {
  const value = scope.node.tryGetContext(key);

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required CDK context "${key}"`);
  }

  return value.trim();
}

function get_optional_context(scope: Construct, key: string): string | undefined {
  const value = scope.node.tryGetContext(key);

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed_value = value.trim();
  return trimmed_value === '' ? undefined : trimmed_value;
}

function get_number_context(scope: Construct, key: string, default_value: number): number {
  const value = get_optional_context(scope, key);

  if (!value) {
    return default_value;
  }

  const parsed_value = Number(value);

  if (!Number.isInteger(parsed_value) || parsed_value <= 0) {
    throw new Error(`CDK context "${key}" must be a positive integer`);
  }

  return parsed_value;
}
