import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://minecraft-modpack-site.layero.app/sitemap.xml',
    host: 'https://minecraft-modpack-site.layero.app',
  }
}