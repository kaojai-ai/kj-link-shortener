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
  ): Promise<ShortLink | null> {
    try {
      const result = await this.client.send(new UpdateCommand({
        TableName: this.table_name,
        Key: { code },
        UpdateExpression: metadata
          ? 'set destination_url = :destination_url, #metadata = :metadata, updated_at = :updated_at remove disabled_at'
          : 'set destination_url = :destination_url, updated_at = :updated_at remove #metadata, disabled_at',
        ConditionExpression: 'attribute_exists(#code)',
        ExpressionAttributeNames: {
          '#code': 'code',
          '#metadata': 'metadata',
        },
        ExpressionAttributeValues: {
          ':destination_url': destination_url,
          ...(metadata ? { ':metadata': metadata } : {}),
          ':updated_at': now.toISOString(),
        },
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
