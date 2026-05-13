import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  DuplicateCodeError,
  type CreateShortLinkInput,
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
