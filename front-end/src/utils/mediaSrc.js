/**
 * Shared resolver for stored media paths (/uploads/...) — used by avatars and post media.
 * Extracted into a plain .js util so component files export only components
 * and React Fast Refresh can work correctly.
 */
export function getAvatarSrc(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return `${baseUrl}${url}`;
}
