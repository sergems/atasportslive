export const CF_STREAM_HOST = 'customer-g6v4ltgbn9y6fl7a.cloudflarestream.com';

/** Prefer the saved unsigned manifest URL; fall back to the live input UID. */
export function cfHlsUrl(uid: string, savedUrl?: string): string {
  if (savedUrl && /^https?:\/\//.test(savedUrl)) return savedUrl;
  return `https://${CF_STREAM_HOST}/${uid}/manifest/video.m3u8`;
}
