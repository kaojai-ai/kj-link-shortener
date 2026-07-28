import {
  DuplicateCodeError,
  type CreateShortLinkInput,
  type LinkExpiryUpdate,
  type LinkMetadata,
  type LinkStore,
  type ShortLink,
} from '../src/link-store.js';

export class MemoryLinkStore implements LinkStore {
  readonly links = new Map<string, ShortLink>();

  async create_link(input: CreateShortLinkInput): Promise<ShortLink> {
    if (this.links.has(input.code)) {
      throw new DuplicateCodeError(input.code);
    }

    const now_iso = input.now.toISOString();
    const link: ShortLink = {
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

    this.links.set(link.code, link);
    return link;
  }

  async get_link(code: string): Promise<ShortLink | null> {
    return this.links.get(code) ?? null;
  }

  async list_recent_links(limit: number): Promise<ShortLink[]> {
    return [...this.links.values()]
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .slice(0, limit);
  }

  async update_code(code: string, next_code: string, now: Date): Promise<ShortLink | null> {
    const link = this.links.get(code);

    if (!link) {
      return null;
    }

    if (code === next_code) {
      return link;
    }

    if (this.links.has(next_code)) {
      throw new DuplicateCodeError(next_code);
    }

    const updated_link = {
      ...link,
      code: next_code,
      updated_at: now.toISOString(),
    };

    this.links.delete(code);
    this.links.set(next_code, updated_link);
    return updated_link;
  }

  async update_url(
    code: string,
    destination_url: string,
    metadata: LinkMetadata | undefined,
    now: Date,
    expiry?: LinkExpiryUpdate,
  ): Promise<ShortLink | null> {
    const link = this.links.get(code);

    if (!link) {
      return null;
    }

    const updated_link: ShortLink = {
      ...link,
      destination_url,
      updated_at: now.toISOString(),
      ...(expiry ? { is_permanent: expiry.is_permanent } : {}),
      ...(metadata ? { metadata } : {}),
    };

    if (expiry?.is_permanent) {
      delete updated_link.expires_at;
      delete updated_link.ttl_epoch_seconds;
    } else if (expiry) {
      updated_link.expires_at = expiry.expires_at;
      updated_link.ttl_epoch_seconds = expiry.ttl_epoch_seconds;
    }

    if (!metadata) {
      delete updated_link.metadata;
    }

    delete updated_link.disabled_at;

    this.links.set(code, updated_link);
    return updated_link;
  }

  async update_metadata(
    code: string,
    metadata: LinkMetadata | undefined,
    now: Date,
  ): Promise<ShortLink | null> {
    const link = this.links.get(code);

    if (!link) {
      return null;
    }

    const updated_link: ShortLink = {
      ...link,
      updated_at: now.toISOString(),
      ...(metadata ? { metadata } : {}),
    };

    if (!metadata) {
      delete updated_link.metadata;
    }

    this.links.set(code, updated_link);
    return updated_link;
  }

  async disable_link(code: string, now: Date): Promise<boolean> {
    const link = this.links.get(code);

    if (!link || link.disabled_at) {
      return false;
    }

    this.links.set(code, {
      ...link,
      disabled_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    return true;
  }

  async record_visit(code: string, now: Date): Promise<void> {
    const link = this.links.get(code);

    if (!link) {
      return;
    }

    this.links.set(code, {
      ...link,
      last_accessed_at: now.toISOString(),
      visit_count: link.visit_count + 1,
    });
  }
}
