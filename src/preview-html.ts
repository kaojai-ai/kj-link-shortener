import type { ShortLink } from './link-store.js';

const CRAWLER_USER_AGENT_PATTERNS = [
  /facebookexternalhit/i,
  /facebot/i,
  /twitterbot/i,
  /linkedinbot/i,
  /slackbot/i,
  /discordbot/i,
  /telegrambot/i,
  /whatsapp/i,
  /line/i,
  /skypeuripreview/i,
  /googlebot/i,
  /bingbot/i,
];

export function is_preview_crawler(user_agent: string | undefined): boolean {
  return Boolean(user_agent && CRAWLER_USER_AGENT_PATTERNS.some((pattern) => pattern.test(user_agent)));
}

export function render_preview_html(link: ShortLink, short_url: string): string {
  const title = link.metadata?.title ?? link.destination_url;
  const description = link.metadata?.description;
  const image = link.metadata?.image;

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex">',
    `<title>${escape_html_text(title)}</title>`,
    `<link rel="canonical" href="${escape_html_attribute(short_url)}">`,
    `<meta property="og:url" content="${escape_html_attribute(short_url)}">`,
    `<meta property="og:title" content="${escape_html_attribute(title)}">`,
    `<meta name="twitter:title" content="${escape_html_attribute(title)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    description ? `<meta name="description" content="${escape_html_attribute(description)}">` : '',
    description ? `<meta property="og:description" content="${escape_html_attribute(description)}">` : '',
    description ? `<meta name="twitter:description" content="${escape_html_attribute(description)}">` : '',
    image ? `<meta property="og:image" content="${escape_html_attribute(image)}">` : '',
    image ? `<meta name="twitter:image" content="${escape_html_attribute(image)}">` : '',
    `<meta http-equiv="refresh" content="0;url=${escape_html_attribute(link.destination_url)}">`,
    '</head>',
    '<body>',
    `<a href="${escape_html_attribute(link.destination_url)}">${escape_html_text(link.destination_url)}</a>`,
    '</body>',
    '</html>',
  ].filter(Boolean).join('');
}

function escape_html_text(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escape_html_attribute(value: string): string {
  return escape_html_text(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
