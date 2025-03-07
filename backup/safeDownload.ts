/**
 * Utility for safely downloading files with multiple fallback methods
 * to ensure maximum browser compatibility
 */

// Log download operations for debugging
const logDownload = (message: string, error?: any) => {
  console.log(`[Download]: ${message}`, error ? error : '');
};

/**
 * Creates a download from a Blob with multiple fallback approaches
 * 
 * @param blob The blob to download
 * @param fileName The name of the file to save
 * @returns Promise that resolves when download is initiated
 */
export async function safeDownload(blob: Blob, fileName: string): Promise<boolean> {
  try {
    logDownload(`Starting download of ${fileName} (${blob.size} bytes)`);
    
    // Method 1: Using the download attribute (most modern browsers)
    try {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        logDownload(`Download initiated via method 1 for ${fileName}`);
      }, 100);
      
      return true;
    } catch (method1Error) {
      logDownload('Method 1 failed, trying fallback', method1Error);
      
      // Method 2: Using the Navigator.msSaveBlob API (for IE/Edge)
      if (window.navigator && window.navigator.msSaveBlob) {
        window.navigator.msSaveBlob(blob, fileName);
        logDownload(`Download initiated via method 2 (msSaveBlob) for ${fileName}`);
        return true;
      }
      
      // Method 3: Open in new window (useful for some mobile browsers)
      const url = window.URL.createObjectURL(blob);
      const newWindow = window.open(url);
      
      if (newWindow) {
        logDownload(`Download initiated via method 3 (new window) for ${fileName}`);
        // Clean up the object URL after a delay
        setTimeout(() => window.URL.revokeObjectURL(url), 100);
        return true;
      }
      
      throw new Error('All download methods failed');
    }
  } catch (error) {
    logDownload(`Download failed for ${fileName}`, error);
    return false;
  }
}

/**
 * Safely initiates a direct download from a URL
 * 
 * @param url The URL to download from
 * @param fileName Optional filename to use
 * @returns Promise that resolves when download is initiated
 */
export async function safeUrlDownload(url: string, fileName?: string): Promise<boolean> {
  try {
    logDownload(`Starting URL download from ${url}`);
    
    // Method 1: Using window.open (simplest approach)
    const newWindow = window.open(url, '_blank');
    
    // If window.open worked, we're done
    if (newWindow && !newWindow.closed) {
      logDownload('Download initiated via window.open');
      return true;
    }
    
    // Method 2: Fetch the file and use safeDownload
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      const downloadFileName = fileName || 
        (contentDisposition && contentDisposition.includes('filename=') 
          ? contentDisposition.split('filename=')[1].replace(/["']/g, '')
          : 'download');
      
      return await safeDownload(blob, downloadFileName);
    } catch (fetchError) {
      logDownload('Fetch-based download failed', fetchError);
      
      // Method 3: Create a hidden iframe (works in some cases where other methods fail)
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      
      // Clean up the iframe after a delay
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 5000);
      
      logDownload('Download attempted via iframe');
      return true;
    }
  } catch (error) {
    logDownload('All URL download methods failed', error);
    return false;
  }
}

/**
 * Safely exports data to a file, handling oversize or binary data
 * 
 * @param data The data to export (string, object, or Blob)
 * @param fileName The name of the file to save
 * @param mimeType The MIME type of the file
 * @returns Promise that resolves when download is initiated
 */
export async function safeExport(
  data: string | object | Blob, 
  fileName: string, 
  mimeType: string = 'application/octet-stream'
): Promise<boolean> {
  try {
    let blob: Blob;
    
    if (data instanceof Blob) {
      blob = data;
    } else if (typeof data === 'object') {
      // Convert object to JSON string
      const jsonString = JSON.stringify(data, null, 2);
      blob = new Blob([jsonString], { type: 'application/json' });
    } else {
      // Handle string data
      blob = new Blob([data], { type: mimeType });
    }
    
    return await safeDownload(blob, fileName);
  } catch (error) {
    logDownload(`Error exporting data to ${fileName}`, error);
    return false;
  }
}