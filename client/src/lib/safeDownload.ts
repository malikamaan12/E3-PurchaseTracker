/**
 * Utility for safely downloading files with multiple fallback methods
 * to ensure maximum browser compatibility
 */

// Log download operations for debugging
const logDownload = (message: string, error?: any) => {
  console.log(`[Download]: ${message}`, error ? error : '');
};

// Check if user is on mobile device
const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Check if user is on Safari
const isSafari = (): boolean => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
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
    // Log download details including file size
    const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    logDownload(`Starting download of ${fileName} (${fileSizeMB}MB)`);
    
    // Check for mobile or Safari browsers
    const mobile = isMobileDevice();
    const safari = isSafari();
    
    if (mobile) {
      logDownload('Mobile device detected, adapting download strategy');
    }
    
    if (safari) {
      logDownload('Safari browser detected, adapting download strategy');
    }
    
    // For very large files, warn in logs
    if (blob.size > 100 * 1024 * 1024) { // 100MB
      logDownload('Warning: Downloading large file (>100MB), may cause browser issues');
    }
    
    // Method 1: FileSaver.js library (most reliable cross-browser solution)
    try {
      const { saveAs } = await import('file-saver');
      saveAs(blob, fileName);
      logDownload(`Download initiated via FileSaver for ${fileName}`);
      return true;
    } catch (error) {
      logDownload('FileSaver method failed, trying method 2', error);
    }
    
    // Method 2: Using the download attribute (modern browsers)
    try {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      
      // For iOS Safari in particular, we need to use a different approach
      if (safari && mobile) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        logDownload('Using mobile Safari specific approach');
      }
      
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      logDownload(`Download initiated via method 2 (download attribute) for ${fileName}`);
      return true;
    } catch (error) {
      logDownload('Method 2 failed, trying method 3', error);
    }
    
    // Method 3: Using msSaveBlob (for older IE/Edge)
    if (!mobile) { // Skip on mobile as this is IE/Edge specific
      try {
        if (window.navigator && 'msSaveBlob' in window.navigator) {
          // @ts-ignore - msSaveBlob may not be recognized in types
          window.navigator.msSaveBlob(blob, fileName);
          logDownload(`Download initiated via method 3 (msSaveBlob) for ${fileName}`);
          return true;
        }
      } catch (error) {
        logDownload('Method 3 failed, trying method 4', error);
      }
    }
    
    // Method 4: Open in new window (can be better for mobile)
    try {
      const url = window.URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank');
      
      if (newWindow) {
        // Clean up the object URL after a delay
        setTimeout(() => window.URL.revokeObjectURL(url), 100);
        logDownload(`Download initiated via method 4 (new window) for ${fileName}`);
        return true;
      }
    } catch (error) {
      logDownload('Method 4 failed', error);
    }
    
    // Method 5: Create a temporary download link in the visible DOM (for mobile especially)
    if (mobile) {
      try {
        const url = window.URL.createObjectURL(blob);
        
        // Create a visible link for better mobile browser compatibility
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = fileName;
        downloadLink.textContent = `Click here to download ${fileName}`;
        downloadLink.style.display = 'block';
        downloadLink.style.padding = '10px';
        downloadLink.style.margin = '10px auto';
        downloadLink.style.backgroundColor = '#f0f0f0';
        downloadLink.style.border = '1px solid #ccc';
        downloadLink.style.borderRadius = '4px';
        downloadLink.style.textAlign = 'center';
        downloadLink.style.color = '#333';
        
        // Add at the top of the document
        if (document.body.firstChild) {
          document.body.insertBefore(downloadLink, document.body.firstChild);
        } else {
          document.body.appendChild(downloadLink);
        }
        
        // Remove after 30 seconds
        setTimeout(() => {
          try {
            document.body.removeChild(downloadLink);
            window.URL.revokeObjectURL(url);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }, 30000);
        
        logDownload('Created visible download link for mobile browsers');
        // Still return true even though user needs to click
        return true;
      } catch (error) {
        logDownload('Mobile fallback method failed', error);
      }
    }
    
    throw new Error('All download methods failed');
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
    
    // Check for mobile or Safari browsers
    const mobile = isMobileDevice();
    const safari = isSafari();
    
    if (mobile) {
      logDownload('Mobile device detected, adapting URL download strategy');
    }
    
    if (safari) {
      logDownload('Safari browser detected, adapting URL download strategy');
    }
    
    // Method 1: Using window.open (simplest approach)
    try {
      // On mobile, it's best to open in the same window for downloads
      const target = mobile ? '_self' : '_blank';
      const newWindow = window.open(url, target);
      
      // If window.open worked, we're done
      if (newWindow && !newWindow.closed) {
        logDownload('Download initiated via window.open');
        return true;
      }
    } catch (error) {
      logDownload('Window.open method failed, trying fetch', error);
    }
    
    // Method 2: Fetch the file and use safeDownload
    try {
      logDownload('Attempting to fetch file first and convert to blob');
      
      // Set timeout for fetch to avoid long-hanging connections
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, { 
        signal: controller.signal,
        // Include credentials if on same origin
        credentials: url.startsWith(window.location.origin) ? 'same-origin' : 'omit'
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      // Get proper file name
      const contentDisposition = response.headers.get('content-disposition');
      let downloadFileName = fileName;
      
      if (!downloadFileName && contentDisposition) {
        // Extract filename from content-disposition
        if (contentDisposition.includes('filename=')) {
          downloadFileName = contentDisposition.split('filename=')[1].replace(/["']/g, '').trim();
        } else if (contentDisposition.includes('filename*=')) {
          // Handle extended syntax (RFC 5987)
          const match = contentDisposition.match(/filename\*=([^']*)'[^']*'([^;]*)/);
          if (match) {
            try {
              downloadFileName = decodeURIComponent(match[2]);
            } catch (e) {
              downloadFileName = match[2];
            }
          }
        }
      }
      
      // Fallback filename if still not set
      if (!downloadFileName) {
        // Try to extract from URL
        const urlParts = url.split('/');
        let urlFileName = urlParts[urlParts.length - 1];
        
        // Remove query parameters
        urlFileName = urlFileName.split('?')[0];
        
        if (urlFileName && urlFileName.length > 0 && urlFileName.indexOf('.') !== -1) {
          downloadFileName = urlFileName;
        } else {
          downloadFileName = 'download';
        }
      }
      
      const blob = await response.blob();
      logDownload(`Fetched file as blob (${(blob.size / 1024).toFixed(2)}KB), filename: ${downloadFileName}`);
      
      return await safeDownload(blob, downloadFileName);
    } catch (error) {
      logDownload('Fetch-based download failed, trying alternate methods', error);
    }
    
    // Method 3: Create a link for the user (especially for mobile)
    if (mobile) {
      try {
        // Create a visible link for better mobile browser compatibility
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.target = '_blank';
        downloadLink.rel = 'noopener noreferrer';
        downloadLink.textContent = `Click here to download ${fileName || 'file'}`;
        downloadLink.style.display = 'block';
        downloadLink.style.padding = '10px';
        downloadLink.style.margin = '10px auto';
        downloadLink.style.backgroundColor = '#f0f0f0';
        downloadLink.style.border = '1px solid #ccc';
        downloadLink.style.borderRadius = '4px';
        downloadLink.style.textAlign = 'center';
        downloadLink.style.color = '#333';
        
        // Add at the top of the document
        if (document.body.firstChild) {
          document.body.insertBefore(downloadLink, document.body.firstChild);
        } else {
          document.body.appendChild(downloadLink);
        }
        
        // Remove after 30 seconds
        setTimeout(() => {
          try {
            document.body.removeChild(downloadLink);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }, 30000);
        
        logDownload('Created visible download link for mobile browsers');
        return true;
      } catch (error) {
        logDownload('Mobile fallback method failed', error);
      }
    } else {
      // Method 4: Create a hidden iframe (desktop browsers)
      try {
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
      } catch (error) {
        logDownload('Iframe method failed', error);
      }
    }
    
    throw new Error('All URL download methods failed');
  } catch (error) {
    logDownload('URL download failed completely', error);
    return false;
  }
}

/**
 * Safely exports data to a file, handling oversize or binary data
 * 
 * @param data The data to export (string, object, or Blob)
 * @param fileName The name of the file to save
 * @param mimeType The MIME type of the file
 * @param options Additional export options
 * @returns Promise that resolves when download is initiated
 */
export async function safeExport(
  data: string | object | Blob | Uint8Array | ArrayBuffer, 
  fileName: string, 
  mimeType: string = 'application/octet-stream',
  options: {
    addBom?: boolean;           // Add UTF-8 BOM for better Excel compatibility
    formatJson?: boolean;       // Pretty print JSON with indentation 
    csvDelimiter?: string;      // For CSV data, specify delimiter
    fallbackCharset?: string;   // Fallback character encoding
    maxStringLength?: number;   // Maximum string length to process
    addTimestamp?: boolean;     // Add timestamp to filename
  } = {}
): Promise<boolean> {
  try {
    let blob: Blob;
    const {
      addBom = false,
      formatJson = true,
      csvDelimiter = ',',
      fallbackCharset = 'utf-8',
      maxStringLength = 100000000, // 100MB string limit
      addTimestamp = true
    } = options;
    
    // Add timestamp to filename if requested
    let processedFileName = fileName;
    if (addTimestamp) {
      const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
      const fileExt = fileName.includes('.') ? fileName.split('.').pop() : '';
      const baseName = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
      processedFileName = `${baseName}-${timestamp}${fileExt ? `.${fileExt}` : ''}`;
    }
    
    // Process different data types
    if (data instanceof Blob) {
      // If already a blob, use as is
      blob = data;
    } else if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      // Handle binary data
      blob = new Blob([data], { type: mimeType });
    } else if (typeof data === 'object') {
      // Convert object to JSON
      try {
        const jsonString = JSON.stringify(data, null, formatJson ? 2 : 0);
        
        // Enforce size limit
        if (jsonString.length > maxStringLength) {
          logDownload(`Warning: JSON string exceeds size limit (${jsonString.length} > ${maxStringLength}), may cause browser issues`);
        }
        
        blob = new Blob([jsonString], { type: 'application/json' });
      } catch (jsonError) {
        logDownload('Error stringifying JSON object', jsonError);
        // Fallback to string representation
        const fallbackString = `Error serializing data: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`;
        blob = new Blob([fallbackString], { type: 'text/plain' });
      }
    } else if (typeof data === 'string') {
      // Process string data
      try {
        // Check if it's CSV and needs BOM
        if (addBom && (mimeType === 'text/csv' || processedFileName.endsWith('.csv'))) {
          // Add BOM (Byte Order Mark) for better Excel compatibility
          const bomPrefix = new Uint8Array([0xEF, 0xBB, 0xBF]);
          const textEncoder = new TextEncoder();
          const stringData = textEncoder.encode(data);
          
          // Combine BOM and CSV content
          const finalContent = new Uint8Array(bomPrefix.length + stringData.length);
          finalContent.set(bomPrefix);
          finalContent.set(stringData, bomPrefix.length);
          
          blob = new Blob([finalContent], { type: 'text/csv;charset=utf-8' });
        } else {
          // Regular string blob
          blob = new Blob([data], { type: mimeType });
        }
      } catch (stringError) {
        logDownload('Error processing string data', stringError);
        blob = new Blob([`Error processing data: ${stringError instanceof Error ? stringError.message : 'Unknown error'}`], { type: 'text/plain' });
      }
    } else {
      // Handle any other types by converting to string
      try {
        const stringData = String(data);
        blob = new Blob([stringData], { type: 'text/plain' });
      } catch (error) {
        logDownload('Error converting data to string', error);
        blob = new Blob(['Error: Could not convert data to exportable format'], { type: 'text/plain' });
      }
    }
    
    logDownload(`Prepared ${processedFileName} for export (${(blob.size / 1024).toFixed(2)}KB)`);
    
    return await safeDownload(blob, processedFileName);
  } catch (error) {
    logDownload(`Error exporting data to ${fileName}`, error);
    return false;
  }
}