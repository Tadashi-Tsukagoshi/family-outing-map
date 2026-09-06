import type { MetadataRoute } from 'next'

const AI_CRAWLER_USER_AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'CCBot',
  'anthropic-ai',
  'Claude-Web',
  'Google-Extended',
  'FacebookBot',
  'Bytespider',
  'Applebot-Extended',
  'PerplexityBot',
  'Amazonbot',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: AI_CRAWLER_USER_AGENTS,
        disallow: '/',
      },
      {
        userAgent: ['Googlebot', 'bingbot'],
        allow: '/',
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/ota-admin'],
      },
    ],
    sitemap: 'https://gunma-odekakemap.jp/sitemap.xml',
  }
}
