import fs from 'fs';
import path from 'path';

/**
 * Universal PDF Asset Buffer Loader
 * Reliably loads images from Base64 Data URLs, Local Filesystem (public/uploads),
 * Relative URLs, or Remote HTTP(S) Endpoints.
 */
export async function fetchPdfAssetBuffer(url: string | null, reqUrl?: string): Promise<Uint8Array | null> {
  if (!url) return null;
  
  try {
    // 1. Base64 Data URL
    if (url.startsWith('data:')) {
      const base64Data = url.split(',')[1];
      if (base64Data) {
        return new Uint8Array(Buffer.from(base64Data, 'base64'));
      }
    }

    // 2. Local File System Path (e.g. /uploads/pdf-settings/header.png or uploads/...)
    if (url.startsWith('/') || url.startsWith('uploads/')) {
      const cleanPath = url.startsWith('/') ? url.substring(1) : url;
      const localFilePath = path.join(process.cwd(), 'public', cleanPath);
      
      if (fs.existsSync(localFilePath)) {
        const fileBuf = fs.readFileSync(localFilePath);
        return new Uint8Array(fileBuf);
      }
    }

    // 3. Relative URL fallback using request origin
    let fetchUrl = url;
    if (url.startsWith('/') && reqUrl) {
      const baseUrl = new URL(reqUrl).origin;
      fetchUrl = `${baseUrl}${url}`;
    }

    // 4. Remote HTTP/HTTPS fetch
    if (fetchUrl.startsWith('http://') || fetchUrl.startsWith('https://')) {
      const response = await fetch(fetchUrl, {
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });

      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }

    return null;
  } catch (error) {
    console.error(`[PDF Asset Loader] Error fetching asset from ${url}:`, error);
    return null;
  }
}
