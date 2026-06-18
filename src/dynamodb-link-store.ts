import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  DuplicateCodeError,
  type CreateShortLinkInput,
  type LinkExpiryUpdate,
  type LinkMetadata,
  type LinkStore,
  type ShortLink,
} from './link-store.js';

type DynamoDbError = Error & {
  name?: string;
};

export class DynamoDbLinkStore implements LinkStore {
  private readonly client: DynamoDBDocumentClient;

  constructor(private readonly table_name: string, client?: DynamoDBDocumentClient) {
    this.client = client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async create_link(input: CreateShortLinkInput): Promise<ShortLink> {
    const now_iso = input.now.toISOString();
    const item: ShortLink = {
      code: input.code,
      destination_url: input.destination_url,
      created_at: now_iso,
      updated_at: now_iso,
      is_permanent: input.is_permanent,
      visit_count: 0,
      ...(input.metadata ? { metadata: input.metadata } : {}),
      ...(input.owner_context ? { owner_context: input.owner_context } : {}),
      ...(input.expires_at ? { expires_at: input.expires_at } : {}),
      ...(input.ttl_epoch_seconds ? { ttl_epoch_seconds: input.ttl_epoch_seconds } : {}),
    };

    try {
      await this.client.send(new PutCommand({
        TableName: this.table_name,
        Item: item,
        ConditionExpression: 'attribute_not_exists(#code)',
        ExpressionAttributeNames: {
          '#code': 'code',
        },
      }));
    } catch (error) {
      if (is_conditional_check_failed(error)) {
        throw new DuplicateCodeError(input.code);
      }

      throw error;
    }

    return item;
  }

  async get_link(code: string): Promise<ShortLink | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.table_name,
      Key: { code },
    }));

    return result.Item ? (result.Item as ShortLink) : null;
  }

  async update_code(code: string, next_code: string, now: Date): Promise<ShortLink | null> {
    const link = await this.get_link(code);

    if (!link) {
      return null;
    }

    if (code === next_code) {
      return link;
    }

    const updated_link: ShortLink = {
      ...link,
      code: next_code,
      updated_at: now.toISOString(),
    };

    try {
      await this.client.send(new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.table_name,
              Item: updated_link,
              ConditionExpression: 'attribute_not_exists(#code)',
              ExpressionAttributeNames: {
                '#code': 'code',
              },
            },
          },
          {
            Delete: {
              TableName: this.table_name,
              Key: { code },
              ConditionExpression: 'attribute_exists(#code)',
              ExpressionAttributeNames: {
                '#code': 'code',
              },
            },
          },
        ],
      }));
    } catch (error) {
      if (is_conditional_check_failed(error) || is_transaction_cancelled(error)) {
        throw new DuplicateCodeError(next_code);
      }

      throw error;
    }

    return updated_link;
  }

  async update_url(
    code: string,
    destination_url: string,
    metadata: LinkMetadata | undefined,
    now: Date,
    expiry?: LinkExpiryUpdate,
  ): Promise<ShortLink | null> {
    const set_expressions = ['destination_url = :destination_url', 'updated_at = :updated_at'];
    const remove_expressions = ['disabled_at'];
    const expression_attribute_names: Record<string, string> = {
      '#code': 'code',
      '#metadata': 'metadata',
    };
    const expression_attribute_values: Record<string, unknown> = {
      ':destination_url': destination_url,
      ':updated_at': now.toISOString(),
    };

    if (metadata) {
      set_expressions.push('#metadata = :metadata');
      expression_attribute_values[':metadata'] = metadata;
    } else {
      remove_expressions.push('#metadata');
    }

    if (expiry) {
      set_expressions.push('is_permanent = :is_permanent');
      expression_attribute_values[':is_permanent'] = expiry.is_permanent;

      if (expiry.is_permanent) {
        remove_expressions.push('expires_at', 'ttl_epoch_seconds');
      } else {
        set_expressions.push('expires_at = :expires_at', 'ttl_epoch_seconds = :ttl_epoch_seconds');
        expression_attribute_values[':expires_at'] = expiry.expires_at;
        expression_attribute_values[':ttl_epoch_seconds'] = expiry.ttl_epoch_seconds;
      }
    }

    try {
      const result = await this.client.send(new UpdateCommand({
        TableName: this.table_name,
        Key: { code },
        UpdateExpression: `set ${set_expressions.join(', ')} remove ${remove_expressions.join(', ')}`,
        ConditionExpression: 'attribute_exists(#code)',
        ExpressionAttributeNames: expression_attribute_names,
        ExpressionAttributeValues: expression_attribute_values,
        ReturnValues: 'ALL_NEW',
      }));

      return result.Attributes ? (result.Attributes as ShortLink) : null;
    } catch (error) {
      if (is_conditional_check_failed(error)) {
        return null;
      }

      throw error;
    }
  }

  async disable_link(code: string, now: Date): Promise<boolean> {
    try {
      await this.client.send(new UpdateCommand({
        TableName: this.table_name,
        Key: { code },
        UpdateExpression: 'set disabled_at = :disabled_at, updated_at = :updated_at',
        ConditionExpression: 'attribute_exists(#code) and attribute_not_exists(disabled_at)',
        ExpressionAttributeNames: {
          '#code': 'code',
        },
        ExpressionAttributeValues: {
          ':disabled_at': now.toISOString(),
          ':updated_at': now.toISOString(),
        },
      }));

      return true;
    } catch (error) {
      if (is_conditional_check_failed(error)) {
        return false;
      }

      throw error;
    }
  }

  async record_visit(code: string, now: Date): Promise<void> {
    await this.client.send(new UpdateCommand({
      TableName: this.table_name,
      Key: { code },
      UpdateExpression: 'set last_accessed_at = :last_accessed_at add visit_count :one',
      ExpressionAttributeValues: {
        ':last_accessed_at': now.toISOString(),
        ':one': 1,
      },
    }));
  }
}

function is_conditional_check_failed(error: unknown): boolean {
  const dynamo_error = error as DynamoDbError;
  return dynamo_error.name === 'ConditionalCheckFailedException';
}

function is_transaction_cancelled(error: unknown): boolean {
  const dynamo_error = error as DynamoDbError;
  return dynamo_error.name === 'TransactionCanceledException';
}
