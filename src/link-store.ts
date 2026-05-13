export type ShortLink = {
  code: string;
  destination_url: string;
  metadata?: LinkMetadata;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  ttl_epoch_seconds?: number;
  is_permanent: boolean;
  disabled_at?: string;
  last_accessed_at?: string;
  visit_count: number;
};

export type LinkMetadata = {
  title?: string;
  description?: string;
  image?: string;
  fetched_at: string;
};

export type CreateShortLinkInput = {
  code: string;
  destination_url: string;
  metadata?: LinkMetadata;
  expires_at?: string;
  ttl_epoch_seconds?: number;
  is_permanent: boolean;
  now: Date;
};

export class DuplicateCodeError extends Error {
  constructor(code: string) {
    super(`Short code already exists: ${code}`);
    this.name = 'DuplicateCodeError';
  }
}

export interface LinkStore {
  create_link(input: CreateShortLinkInput): Promise<ShortLink>;
  get_link(code: string): Promise<ShortLink | null>;
  update_code(code: string, next_code: string, now: Date): Promise<ShortLink | null>;
  update_url(code: string, destination_url: string, metadata: LinkMetadata | undefined, now: Date): Promise<ShortLink | null>;
  disable_link(code: string, now: Date): Promise<boolean>;
  record_visit(code: string, now: Date): Promise<void>;
}

export function is_link_active(link: ShortLink, now: Date): boolean {
  if (link.disabled_at) {
    return false;
  }

  if (link.is_permanent || !link.expires_at) {
    return true;
  }

  return Date.parse(link.expires_at) > now.getTime();
}
