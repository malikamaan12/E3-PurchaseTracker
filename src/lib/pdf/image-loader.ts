import fs from 'fs';
import path from 'path';

async function fetchFromR2(urlOrKey: string): Promise<Uint8Array | null> {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || 'purchase-tracker-assets';

  if (!endpoint || !accessKeyId || !secretAccessKey) return null;

  let rawKey = urlOrKey;
  if (urlOrKey.includes('attachments/')) {
    const match = urlOrKey.match(/attachments\/[^?]+/);
    if (match) rawKey = match[0];
  }

  try {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    const candidates = Array.from(new Set([
      rawKey,
      decodeURIComponent(rawKey),
      decodeURI(rawKey)
    ]));

    for (const keyToTry of candidates) {
      try {
        const res = await s3.send(new GetObjectCommand({
          Bucket: bucket,
          Key: keyToTry,
        }));
        if (res.Body) {
          const buf = await res.Body.transformToByteArray();
          return new Uint8Array(buf);
        }
      } catch {
        // continue trying next candidate
      }
    }
  } catch (e) {
    console.error('[PDF Asset Loader] R2 direct fetch failed:', e);
  }
  return null;
}

/**
 * Universal PDF Asset Buffer Loader
 * Reliably loads images from Base64 Data URLs, Local Filesystem (public/uploads),
 * Relative URLs, Cloudflare R2 direct S3 storage, or Remote HTTP(S) Endpoints.
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

    // 2. Direct R2 Object Key (e.g. attachments/...)
    if (url.startsWith('attachments/')) {
      const r2Buf = await fetchFromR2(url);
      if (r2Buf) return r2Buf;
    }

    // 3. Local File System Path (e.g. /uploads/pdf-settings/header.png or uploads/...)
    if (url.startsWith('/') || url.startsWith('uploads/')) {
      const cleanPath = url.startsWith('/') ? url.substring(1) : url;
      const localFilePath = path.join(process.cwd(), 'public', cleanPath);
      
      if (fs.existsSync(localFilePath)) {
        const fileBuf = fs.readFileSync(localFilePath);
        return new Uint8Array(fileBuf);
      }
    }

    // 4. Relative URL fallback using request origin
    let fetchUrl = url;
    if (url.startsWith('/') && reqUrl) {
      const baseUrl = new URL(reqUrl).origin;
      fetchUrl = `${baseUrl}${url}`;
    }

    // 5. Cloudflare R2 URL - prefer direct S3 retrieval to bypass expired presigned tokens
    if (fetchUrl.includes('.r2.cloudflarestorage.com') && fetchUrl.includes('attachments/')) {
      const r2Buf = await fetchFromR2(fetchUrl);
      if (r2Buf) return r2Buf;
    }

    // 6. Remote HTTP/HTTPS fetch
    if (fetchUrl.startsWith('http://') || fetchUrl.startsWith('https://')) {
      const response = await fetch(fetchUrl, {
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      }

      // If HTTP fetch failed (e.g. 403 expired presigned URL) and URL has attachments/, try R2 fallback
      if (fetchUrl.includes('attachments/')) {
        const r2Buf = await fetchFromR2(fetchUrl);
        if (r2Buf) return r2Buf;
      }
      return null;
    }

    return null;
  } catch (error) {
    console.error(`[PDF Asset Loader] Error fetching asset from ${url}:`, error);
    // Final fallback attempt if error was during fetch and key might be in R2
    if (url.includes('attachments/')) {
      try {
        return await fetchFromR2(url);
      } catch {
        return null;
      }
    }
    return null;
  }
}
