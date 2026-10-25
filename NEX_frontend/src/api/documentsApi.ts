/**
 * Documents API — Medical Document Upload & Management
 * 
 * Backend Endpoints:
 * - GET /documents — list user's documents
 * - POST /documents — upload document (multipart form: file, title, description, category)
 * - GET /documents/{id} — get document metadata
 * - GET /documents/{id}/download — download encrypted document
 * - DELETE /documents/{id} — delete document
 * - POST /documents/share-token — create share token for mobile extensions
 * - POST /documents/share-upload — upload via share token (no JWT required)
 * 
 * Encryption Flow:
 * 1. Client generates ECDH P-256 keypair via cryptoEngine
 * 2. Client registers keypair with /encryption/keypairs/register
 * 3. Client encrypts file content with ChaCha20-Poly1305 (client-side crypto engine)
 * 4. Client uploads encrypted blob to /documents with encryption metadata
 * 5. Server stores encrypted blob; never has access to plaintext or session key
 * 
 * Error Handling:
 * - All errors normalized to ApiError (code, message, statusCode)
 * - File size validation: max 50MB
 * - Retry on network error with 2s delay
 * - Proper Bearer token attachment for all requests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { TOKEN_KEYS, API_BASE_URL } from './client';
import { ApiError } from './types';

// ─── Type Definitions ─────────────────────────────────────────────────────────

export interface DocumentListItem {
  id: string;
  title: string;
  description?: string;
  category: 'medical_report' | 'prescription' | 'lab_report' | 'imaging' | 'insurance' | 'other';
  original_filename: string;
  created_at: string; // ISO 8601
  size_bytes: number;
  content_type: string;
  source_app?: string;
  is_shared_upload?: boolean;
}

export interface DocumentDetail extends DocumentListItem {
  owner_user_id: string;
  file_path: string;
}

export interface UploadDocumentRequest {
  // File can be:
  // - Web: File object from input
  // - React Native: Object with { uri, name, type, size }
  // - expo-document-picker: DocumentResult object
  file: File | { uri: string; name?: string; type?: string; size?: number };
  title: string;
  description?: string;
  category?: string; // 'medical_record', 'prescription', 'lab_result', 'other'
  source_app?: string;
}

export interface UploadDocumentResponse {
  id: string;
  owner_user_id?: string;
  title: string;
  description?: string;
  original_filename?: string;
  content_type?: string;
  size_bytes?: number;
  category?: string;
  source_app?: string;
  is_shared_upload?: boolean;
  created_at: string;
  updated_at?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const API_ENDPOINT = '/documents';
const RETRY_DELAY_MS = 2000;
const RETRY_MAX_ATTEMPTS = 3;

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Validate file before upload
 */
function validateFile(file: File | { uri: string; name?: string; type?: string; size?: number }): void {
  const fileName = (file as any).name || (file as any).uri || 'document';
  const fileSize = (file as any).size || 0;
  
  if (!fileName || fileName.trim().length === 0) {
    throw new Error('File name cannot be empty');
  }

  if (fileSize === 0) {
    throw new Error('File cannot be empty');
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size exceeds ${MAX_FILE_SIZE_MB}MB limit. ` +
      `Current size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`
    );
  }
}

/**
 * Retry wrapper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  attempt = 1
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (attempt < RETRY_MAX_ATTEMPTS && isNetworkError(error)) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY_MS * attempt)
      );
      return retryWithBackoff(fn, attempt + 1);
    }
    throw error;
  }
}

/**
 * Check if error is network-related
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('Network') ||
      error.message.includes('timeout') ||
      error.message.includes('ECONNREFUSED')
    );
  }
  return false;
}

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * List all documents for the current user
 * 
 * Returns a list of documents with metadata. Backend returns documents
 * in descending order by creation date.
 */
export async function listDocuments(): Promise<DocumentDetail[]> {
  try {
    const { data } = await retryWithBackoff(() =>
      apiClient.get<DocumentDetail[]>(API_ENDPOINT)
    );
    return data || [];
  } catch (error) {
    throw normalizeError(error, 'Failed to load documents');
  }
}

/**
 * Get a single document's metadata
 */
export async function getDocument(documentId: string): Promise<DocumentDetail> {
  try {
    if (!documentId || documentId.trim().length === 0) {
      throw new Error('Document ID is required');
    }

    const { data } = await retryWithBackoff(() =>
      apiClient.get<DocumentDetail>(`${API_ENDPOINT}/${documentId}`)
    );
    return data;
  } catch (error) {
    throw normalizeError(error, 'Failed to load document');
  }
}

/**
 * Upload a document
 * 
 * Sends file via multipart form data. Backend returns document metadata.
 * Note: Encryption happens client-side before/after transfer if using
 * the encryption service, but this endpoint accepts already-encrypted
 * or plaintext files depending on your encryption workflow.
 * 
 * For encrypted uploads:
 * 1. Client encrypts file with cryptoEngine.encryptWithSessionKey()
 * 2. Client sends encrypted blob to this endpoint
 * 3. Server stores encrypted blob (never has access to plaintext)
 * 4. Audit log records the upload event
 */
/**
 * Upload a document
 * 
 * CRITICAL: On React Native, we use fetch() directly for multipart uploads
 * because Axios has compatibility issues with FormData in React Native.
 * 
 * Sends file via multipart form data. Backend returns document metadata.
 * Note: Encryption happens client-side before/after transfer if using
 * the encryption service, but this endpoint accepts already-encrypted
 * or plaintext files depending on your encryption workflow.
 * 
 * For encrypted uploads:
 * 1. Client encrypts file with cryptoEngine.encryptWithSessionKey()
 * 2. Client sends encrypted blob to this endpoint
 * 3. Server stores encrypted blob (never has access to plaintext)
 * 4. Audit log records the upload event
 */
export async function uploadDocument(
  request: UploadDocumentRequest
): Promise<UploadDocumentResponse> {
  try {
    const { file, title, description, category, source_app } = request;

    // Validate inputs
    validateFile(file);
    
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new Error('Document title is required and must be a non-empty string');
    }

    const titleValue = title.trim();
    const fileName = (file as any).__filename || (file as any).name || (file as any).uri || 'document';
    
    // Determine MIME type from filename (CRITICAL: fetch() loses content-type from Blob)
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'csv': 'text/csv',
    };
    const mimeType = (file as any).type || mimeTypeMap[fileExtension] || 'application/octet-stream';
    
    console.log('[document_upload] Starting upload:', {
      fileName,
      title: titleValue,
      fileSize: (file as any).size,
      fileType: (file as any).type,
      detectedMimeType: mimeType,
    });

    // Step 1: Convert file to Blob if needed (React Native File compatibility)
    let fileBlob: Blob | any = file;
    if ((file as any).uri && typeof (file as any).uri === 'string') {
      console.log('[document_upload] Converting file URI to Blob...');
      try {
        const response = await fetch((file as any).uri);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        // Create Blob with explicit MIME type
        // fetch().blob() loses the MIME type, so we specify it explicitly
        const arrayBuffer = await response.arrayBuffer();
        fileBlob = new Blob([arrayBuffer], { type: mimeType });
        console.log('[document_upload] Blob created, size:', fileBlob.size, 'type:', fileBlob.type);
      } catch (fetchErr) {
        console.error('[document_upload] Fetch failed:', fetchErr);
        throw fetchErr;
      }
    }

    // Step 2: Use fetch() directly for multipart upload (Axios FormData has issues on RN)
    console.log('[document_upload] Using fetch() for multipart upload (better RN compatibility)');
    
    const formData = new FormData();
    formData.append('file', fileBlob, fileName);
    formData.append('title', titleValue);
    
    if (description && description.trim()) {
      formData.append('description', description.trim());
    }
    if (category) {
      formData.append('category', category);
    }
    if (source_app) {
      formData.append('source_app', source_app);
    }

    console.log('[document_upload] FormData constructed, fields: file, title, description?, category?, source_app?');

    // Get auth token
    const token = await AsyncStorage.getItem(TOKEN_KEYS.ACCESS);
    if (!token) {
      throw new Error('No authentication token found');
    }

    // Make fetch request with proper multipart headers
    const apiUrl = `${API_BASE_URL}/documents`;
    console.log('[document_upload] Sending POST to:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // DO NOT set Content-Type — let fetch auto-detect FormData
      },
      body: formData,
    });

    console.log('[document_upload] Response status:', response.status);

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status}`;
      try {
        // Clone the response to read it
        const clonedResponse = response.clone();
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          const errorData = await clonedResponse.json();
          errorDetail = errorData.detail || JSON.stringify(errorData);
        } else {
          const errorText = await clonedResponse.text();
          errorDetail = errorText || errorDetail;
        }
      } catch (parseErr) {
        console.warn('[document_upload] Could not parse error response:', parseErr);
        // Keep the HTTP status error message
      }
      throw new Error(`Upload failed: ${errorDetail}`);
    }

    const data = await response.json();
    console.log('[document_upload] ✓ Upload successful, response:', data.id);
    return data as UploadDocumentResponse;
  } catch (error) {
    const fileName = ((request.file as any).__filename || (request.file as any).name || (request.file as any).uri || 'document');
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[document_upload] ✗ Upload failed:', errorMsg);
    throw normalizeError(error, `Upload failed for ${fileName}: ${errorMsg}`);
  }
}

/**
 * Download a document
 * 
 * Returns the document file as a downloadable blob. If the document
 * is encrypted, the blob will be in encrypted form. Client must
 * decrypt using the session key before use.
 * 
 * Note: This uses React Native's native Blob which copies data through
 * base64 encoding. For large files (>10MB), consider installing `expo-blob`
 * package for better performance: npx expo install expo-blob
 */
export async function downloadDocument(documentId: string): Promise<Blob> {
  try {
    if (!documentId || documentId.trim().length === 0) {
      throw new Error('Document ID is required');
    }

    const response = await retryWithBackoff(() =>
      apiClient.get(`${API_ENDPOINT}/${documentId}/download`, {
        responseType: 'blob',
      })
    );

    return response.data;
  } catch (error) {
    throw normalizeError(error, 'Failed to download document');
  }
}

/**
 * Delete a document permanently
 * 
 * Removes encrypted blob from storage + all metadata. This action
 * cannot be undone. Deletion is logged to audit trail.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  try {
    if (!documentId || documentId.trim().length === 0) {
      throw new Error('Document ID is required');
    }

    await retryWithBackoff(() =>
      apiClient.delete(`${API_ENDPOINT}/${documentId}`)
    );
  } catch (error) {
    throw normalizeError(error, 'Failed to delete document');
  }
}

/**
 * Create a share token for mobile share extensions
 * 
 * Generates a short-lived token that can be used with shareUpload()
 * without a JWT. This is essential for mobile share extensions which
 * run in sandboxed processes without access to the host app's keychain.
 * 
 * Token expires after 15 minutes (configurable on backend via SHARE_TOKEN_EXPIRE_MINUTES).
 */
export async function createShareToken(): Promise<{ token: string; expires_at: string }> {
  try {
    const { data } = await retryWithBackoff(() =>
      apiClient.post<{ token: string; expires_at: string }>(
        `${API_ENDPOINT}/share-token`,
        {}
      )
    );
    return data;
  } catch (error) {
    throw normalizeError(error, 'Failed to create share token');
  }
}

/**
 * Upload via share token (no JWT required)
 * 
 * Used by mobile share extensions. Requires a valid share token
 * from createShareToken(). Token is marked as used after first successful upload.
 */
export async function shareUpload(
  files: File[],
  shareToken: string,
  options?: { category?: string; source_app?: string }
): Promise<{ uploaded: DocumentListItem[]; total_files: number }> {
  try {
    if (!shareToken || shareToken.trim().length === 0) {
      throw new Error('Share token is required');
    }

    if (!files || files.length === 0) {
      throw new Error('At least one file is required');
    }

    // Validate each file
    files.forEach((f) => validateFile(f.name, f.size));

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('share_token', shareToken);

    if (options?.category) {
      formData.append('category', options.category);
    }
    if (options?.source_app) {
      formData.append('source_app', options.source_app);
    }

    const { data } = await retryWithBackoff(() =>
      apiClient.post<{ uploaded: DocumentListItem[]; total_files: number }>(
        `${API_ENDPOINT}/share-upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )
    );

    return data;
  } catch (error) {
    throw normalizeError(error, 'Share upload failed');
  }
}

// ─── Error Handling ───────────────────────────────────────────────────────────

/**
 * Normalize error into ApiError shape with context
 */
function normalizeError(error: unknown, fallbackMessage: string): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      code: 'DOCUMENTS_ERROR',
      message: error.message || fallbackMessage,
      statusCode: 0,
    };
  }

  return {
    code: 'DOCUMENTS_ERROR',
    message: fallbackMessage,
    statusCode: 0,
  };
}

/**
 * Type guard for ApiError
 */
function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'message' in err &&
    'statusCode' in err
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export const documentsApi = {
  listDocuments,
  getDocument,
  uploadDocument,
  downloadDocument,
  deleteDocument,
  createShareToken,
  shareUpload,
};
