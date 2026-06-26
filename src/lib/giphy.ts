import { GiphyFetch } from '@giphy/js-fetch-api';

// Use environment variable for API key
const gf = new GiphyFetch(process.env.NEXT_PUBLIC_GIPHY_API_KEY || 'dc6zaTOxFJmzC');

export interface GifResult {
  id: string;
  title: string;
  url: string;
  mp4Url: string;
  previewUrl: string;
  width: number;
  height: number;
}

export async function searchGifs(query: string, limit = 20, offset = 0): Promise<GifResult[]> {
  try {
    const results = await gf.search(query, { limit, offset, rating: 'g' });
    return results.data.map((gif: any) => ({
      id: String(gif.id),
      title: gif.title,
      url: gif.images.original.url,
      mp4Url: gif.images.original.mp4 || gif.images.original.url,
      previewUrl: gif.images.fixed_width.url,
      width: gif.images.original.width,
      height: gif.images.original.height
    }));
  } catch (error) {
    console.error('Giphy search error:', error);
    return [];
  }
}

export async function getTrendingGifs(limit = 20): Promise<GifResult[]> {
  try {
    const results = await gf.trending({ limit, rating: 'g' });
    return results.data.map((gif: any) => ({
      id: String(gif.id),
      title: gif.title,
      url: gif.images.original.url,
      mp4Url: gif.images.original.mp4 || gif.images.original.url,
      previewUrl: gif.images.fixed_width.url,
      width: gif.images.original.width,
      height: gif.images.original.height
    }));
  } catch (error) {
    console.error('Giphy trending error:', error);
    return [];
  }
}

export async function getGifById(id: string): Promise<GifResult | null> {
  try {
    const result = await gf.gif(id);
    const gif = result.data;
    return {
      id: String(gif.id),
      title: gif.title,
      url: gif.images.original.url,
      mp4Url: gif.images.original.mp4 || gif.images.original.url,
      previewUrl: gif.images.fixed_width.url,
      width: gif.images.original.width,
      height: gif.images.original.height
    };
  } catch (error) {
    console.error('Giphy fetch error:', error);
    return null;
  }
}
