/**
 * Clean Architecture: Image URL Utility
 * Handles construction of full image URLs with proper backend URL prepending
 */

import { API_BASE_URL } from '@/lib/api-config';

/**
 * Constructs a full image URL from a relative or absolute path
 * @param url - The image URL (can be null, undefined, relative, or absolute)
 * @returns Full URL or null if input is invalid
 */
export function getImageUrl(url: string | null | undefined): string | null {
  console.log('🖼️ getImageUrl called with:', { url, urlType: typeof url });
  
  if (!url) {
    console.log('🖼️ No URL provided, returning null');
    return null;
  }
  
  if (url.startsWith('http')) {
    console.log('🖼️ URL is already full HTTP URL:', url);
    return url;
  }
  
  const finalUrl = `${API_BASE_URL}${url.startsWith('/') ? url : '/' + url}`;
  console.log('🖼️ Constructed full URL:', finalUrl);
  return finalUrl;
}

/**
 * Gets image props for React img elements with CORS compliance
 * @param url - The image URL
 * @returns Props object with src and crossOrigin
 */
export function getImageProps(url: string | null | undefined) {
  const imageUrl = getImageUrl(url);
  return {
    src: imageUrl || '',
    crossOrigin: 'anonymous' as const,
    alt: 'Product image'
  };
}
