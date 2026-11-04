import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://minecraft-modpack-site-ser-gorlachev7-p7b9.onreza.app';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/catalog`, // Если у тебя есть отдельные страницы, их тоже можно добавить
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }
  ];
}