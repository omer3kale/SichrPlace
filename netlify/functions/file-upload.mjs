import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import sharp from 'sharp';
import mime from 'mime-types';

// Supabase configuration with service role
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper functions
const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Origin, Authorization, Content-Type',
});

const respond = (statusCode, body) => ({
  statusCode,
  headers: buildHeaders(),
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const httpError = (status, message, details = null) => {
  const error = { error: { message, status } };
  if (details && process.env.NODE_ENV !== 'production') {
    error.error.details = details;
  }
  return { status, ...error };
};

// Supabase error checking
const isMissingTableError = (error) => {
  return error?.code === 'PGRST116' || error?.message?.includes('relation') && error?.message?.includes('does not exist');
};

// Authentication helper
const getAuthContext = async (event) => {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw httpError(401, 'Authorization token required');
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authData?.user?.id) {
      throw httpError(401, 'Invalid or expired token');
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, role, status, account_status, is_blocked')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      if (isMissingTableError(profileError)) {
        throw httpError(503, 'User profile service unavailable');
      }
      throw httpError(403, 'User profile not found');
    }

    if (!profile) {
      throw httpError(403, 'User profile not found');
    }

    if (profile.is_blocked || 
        profile.status === 'suspended' || 
        ['suspended', 'deleted'].includes(profile.account_status)) {
      throw httpError(403, 'Account access restricted');
    }

    return {
      userId: authData.user.id,
      profile,
      isAdmin: profile.role === 'admin'
    };
  } catch (error) {
    if (error.status) throw error;
    console.error('Authentication error:', error);
    throw httpError(401, 'Authentication failed');
  }
};

// File validation with comprehensive security checks
const validateFile = (file, options = {}) => {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxSize = 10 * 1024 * 1024, // 10MB default
    minSize = 1024, // 1KB minimum
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
  } = options;

  const errors = [];

  if (!file) {
    errors.push('No file provided');
    return { isValid: false, errors };
  }

  // Validate file size
  if (file.size > maxSize) {
    errors.push(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum ${(maxSize / 1024 / 1024).toFixed(2)}MB`);
  }

  if (file.size < minSize) {
    errors.push(`File size ${file.size} bytes is below minimum ${minSize} bytes`);
  }

  // Validate MIME type
  const mimeType = file.mimetype || mime.lookup(file.originalname);
  if (!allowedTypes.includes(mimeType)) {
    errors.push(`File type '${mimeType}' not allowed. Allowed: ${allowedTypes.join(', ')}`);
  }

  // Validate file extension
  const ext = file.originalname ? file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.')) : '';
  if (!allowedExtensions.includes(ext)) {
    errors.push(`File extension '${ext}' not allowed. Allowed: ${allowedExtensions.join(', ')}`);
  }

  // Basic filename validation
  if (file.originalname && !/^[a-zA-Z0-9._-]+$/.test(file.originalname.replace(/\.[^/.]+$/, ""))) {
    errors.push('Filename contains invalid characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    mimeType,
    extension: ext
  };
};

// Safe image processing with error handling
const processImage = async (buffer, options = {}) => {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 85,
    format = 'jpeg'
  } = options;

  try {
    let processor = sharp(buffer);
    
    // Get metadata first
    const metadata = await processor.metadata();
    
    // Only resize if image is larger than max dimensions
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      processor = processor.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Apply format and quality
    if (format === 'jpeg') {
      processor = processor.jpeg({ quality, mozjpeg: true });
    } else if (format === 'png') {
      processor = processor.png({ quality });
    } else if (format === 'webp') {
      processor = processor.webp({ quality });
    }

    const processedBuffer = await processor.toBuffer();
    
    return {
      buffer: processedBuffer,
      metadata: {
        ...metadata,
        processedSize: processedBuffer.length,
        format
      }
    };
  } catch (error) {
    console.error('Image processing error:', error);
    throw httpError(400, 'Invalid image file or processing failed', error.message);
  }
};

// Generate secure filename
const generateSecureFilename = (originalName, userId) => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const ext = originalName ? originalName.toLowerCase().substring(originalName.lastIndexOf('.')) : '';
  return `${userId}_${timestamp}_${randomSuffix}${ext}`;
};

// Safe database operations
const safeInsert = async (table, data) => {
  try {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        throw httpError(503, `File storage service unavailable`);
      }
      throw error;
    }

    return result;
  } catch (error) {
    if (error.status) throw error;
    console.error(`Database insert error for ${table}:`, error);
    throw httpError(500, 'Database operation failed', error.message);
  }
};

const safeSelect = async (query) => {
  try {
    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) {
        return { data: [], error: null };
      }
      throw error;
    }
    return { data, error: null };
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// File upload configurations
const UPLOAD_CONFIGS = {
  apartment_images: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 15 * 1024 * 1024, // 15MB
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 85,
    path: 'apartments'
  },
  profile_images: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
    maxWidth: 800,
    maxHeight: 800,
    quality: 90,
    path: 'profiles'
  },
  documents: {
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSize: 10 * 1024 * 1024, // 10MB
    path: 'documents'
  }
};

// Action handlers
const handleUploadImage = async (userId, body, uploadType = 'apartment_images') => {
  const config = UPLOAD_CONFIGS[uploadType];
  if (!config) {
    throw httpError(400, 'Invalid upload type');
  }

  const { fileData, fileName, apartmentId, description } = body;
  
  if (!fileData || !fileName) {
    throw httpError(400, 'File data and filename are required');
  }

  // Convert base64 to buffer
  let buffer;
  try {
    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    buffer = Buffer.from(base64Data, 'base64');
  } catch (error) {
    throw httpError(400, 'Invalid file data format');
  }

  // Create mock file object for validation
  const mockFile = {
    originalname: fileName,
    size: buffer.length,
    mimetype: mime.lookup(fileName) || 'application/octet-stream'
  };

  // Validate file
  const validation = validateFile(mockFile, {
    allowedTypes: config.allowedTypes,
    maxSize: config.maxSize
  });

  if (!validation.isValid) {
    throw httpError(400, 'File validation failed', { errors: validation.errors });
  }

  try {
    // Process image if needed
    let finalBuffer = buffer;
    let metadata = {};

    if (config.maxWidth || config.maxHeight) {
      const processed = await processImage(buffer, {
        maxWidth: config.maxWidth,
        maxHeight: config.maxHeight,
        quality: config.quality,
        format: 'jpeg'
      });
      finalBuffer = processed.buffer;
      metadata = processed.metadata;
    }

    // Generate secure filename
    const secureFilename = generateSecureFilename(fileName, userId);
    const filePath = `${config.path}/${secureFilename}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('files')
      .upload(filePath, finalBuffer, {
        contentType: validation.mimeType,
        duplex: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw httpError(500, 'File upload failed', uploadError.message);
    }

    // Save file record to database
    const fileRecord = await safeInsert('files', {
      id: crypto.randomUUID(),
      user_id: userId,
      apartment_id: apartmentId || null,
      filename: secureFilename,
      original_filename: fileName,
      file_path: filePath,
      file_size: finalBuffer.length,
      mime_type: validation.mimeType,
      description: description || null,
      metadata: metadata,
      upload_type: uploadType,
      status: 'active',
      created_at: new Date().toISOString()
    });

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('files')
      .getPublicUrl(filePath);

    return respond(200, {
      success: true,
      data: {
        id: fileRecord.id,
        filename: secureFilename,
        originalFilename: fileName,
        url: publicUrl,
        size: finalBuffer.length,
        mimeType: validation.mimeType,
        uploadType,
        metadata
      },
      message: 'File uploaded successfully'
    });

  } catch (error) {
    if (error.status) throw error;
    console.error('Upload processing error:', error);
    throw httpError(500, 'Upload processing failed', error.message);
  }
};

const handleGetFiles = async (userId, queryParams) => {
  const { 
    apartment_id, 
    upload_type,
    limit = '20',
    offset = '0'
  } = queryParams || {};

  const safeLimit = Math.min(parseInt(limit) || 20, 100);
  const safeOffset = Math.max(parseInt(offset) || 0, 0);

  let query = supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (apartment_id) {
    query = query.eq('apartment_id', apartment_id);
  }

  if (upload_type && UPLOAD_CONFIGS[upload_type]) {
    query = query.eq('upload_type', upload_type);
  }

  const { data: files } = await safeSelect(query);

  // Add public URLs
  const filesWithUrls = files.map(file => ({
    ...file,
    url: supabase.storage.from('files').getPublicUrl(file.file_path).data.publicUrl
  }));

  return respond(200, {
    success: true,
    data: {
      files: filesWithUrls,
      pagination: {
        limit: safeLimit,
        offset: safeOffset,
        total: files.length
      }
    }
  });
};

const handleDeleteFile = async (userId, body, isAdmin = false) => {
  const { fileId } = body;

  if (!fileId) {
    throw httpError(400, 'File ID is required');
  }

  // Get file record
  let query = supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .eq('status', 'active')
    .single();

  // Only allow users to delete their own files, unless admin
  if (!isAdmin) {
    query = query.eq('user_id', userId);
  }

  const { data: file } = await safeSelect(query);

  if (!file || file.length === 0) {
    throw httpError(404, 'File not found or access denied');
  }

  const fileRecord = Array.isArray(file) ? file[0] : file;

  try {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('files')
      .remove([fileRecord.file_path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with database deletion even if storage fails
    }

    // Mark as deleted in database
    const { error: dbError } = await supabase
      .from('files')
      .update({ 
        status: 'deleted',
        deleted_at: new Date().toISOString()
      })
      .eq('id', fileId);

    if (dbError) {
      console.error('Database deletion error:', dbError);
      throw httpError(500, 'File deletion failed', dbError.message);
    }

    return respond(200, {
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    if (error.status) throw error;
    console.error('File deletion error:', error);
    throw httpError(500, 'File deletion failed', error.message);
  }
};

export const handler = async (event) => {
  console.log('File upload handler called:', {
    method: event.httpMethod,
    action: event.queryStringParameters?.action
  });

  // Handle OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return respond(200, '');
  }

  try {
    const { action, ...queryParams } = event.queryStringParameters || {};
    
    if (!action) {
      throw httpError(400, 'Action parameter is required', {
        availableActions: ['upload_image', 'get_files', 'delete_file']
      });
    }

    // Get authentication context
    const { userId, profile, isAdmin } = await getAuthContext(event);

    // Parse request body for POST operations
    let body = {};
    if (event.body && ['POST', 'PUT', 'DELETE'].includes(event.httpMethod)) {
      try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch (error) {
        throw httpError(400, 'Invalid JSON in request body');
      }
    }

    // Route to appropriate handler
    switch (action) {
      case 'upload_image':
        if (event.httpMethod !== 'POST') {
          throw httpError(405, 'Method not allowed', { allowed: ['POST'] });
        }
        return await handleUploadImage(userId, body, body.uploadType);
        
      case 'get_files':
        if (event.httpMethod !== 'GET') {
          throw httpError(405, 'Method not allowed', { allowed: ['GET'] });
        }
        return await handleGetFiles(userId, queryParams);
        
      case 'delete_file':
        if (event.httpMethod !== 'DELETE') {
          throw httpError(405, 'Method not allowed', { allowed: ['DELETE'] });
        }
        return await handleDeleteFile(userId, body, isAdmin);
        
      default:
        throw httpError(400, 'Invalid action', {
          availableActions: ['upload_image', 'get_files', 'delete_file']
        });
    }

  } catch (error) {
    console.error('File upload handler error:', error);

    const status = error.status || 500;
    const message = status === 500 ? 'File operation failed' : error.message;
    
    const errorResponse = httpError(status, message, error.details);
    return respond(status, errorResponse);
  }
};
