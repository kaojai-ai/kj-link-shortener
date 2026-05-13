import {
  DuplicateCodeError,
  type CreateShortLinkInput,
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
      ...(input.expires_at ? { expires_at: input.expires_at } : {}),
      ...(input.ttl_epoch_seconds ? { ttl_epoch_seconds: input.ttl_epoch_seconds } : {}),
    };

    this.links.set(link.code, link);
    return link;
  }

  async get_link(code: string): Promise<ShortLink | null> {
    return this.links.get(code) ?? null;
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
