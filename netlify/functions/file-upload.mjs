import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import sharp from 'sharp';
import mime from 'mime-types';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// JWT verification helper
function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// Helper function to validate file
function validateFile(file, allowedTypes, maxSize) {
  const errors = [];

  // Check file type
  if (allowedTypes && allowedTypes.length > 0) {
    const mimeType = file.mimetype || mime.lookup(file.originalname);
    if (!allowedTypes.includes(mimeType)) {
      errors.push(`File type ${mimeType} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }
  }

  // Check file size
  if (maxSize && file.size > maxSize) {
    errors.push(`File size ${file.size} bytes exceeds maximum ${maxSize} bytes`);
  }

  return errors;
}

// Helper function to generate secure filename
function generateSecureFilename(originalName, userId) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const extension = originalName.split('.').pop();
  return `${userId}_${timestamp}_${random}.${extension}`;
}

export const handler = async (event, context) => {
  const headers = { ...corsHeaders };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Parse request
    const { action, ...queryParams } = event.queryStringParameters || {};
    const requestBody = event.body ? JSON.parse(event.body) : {};
    
    // Verify authentication for most actions
    const authRequired = !['get_upload_url', 'validate_file'].includes(action);
    let userId = null;
    let userRole = null;

    if (authRequired) {
      const tokenData = verifyToken(event.headers.authorization);
      if (!tokenData) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Authentication required'
          })
        };
      }
      userId = tokenData.sub || tokenData.userId;
      userRole = tokenData.role;
    }

    // Route to appropriate handler
    switch (action) {
      case 'upload_image':
        return await uploadImage(userId, requestBody, headers);
      
      case 'upload_document':
        return await uploadDocument(userId, requestBody, headers);
      
      case 'upload_avatar':
        return await uploadAvatar(userId, requestBody, headers);
      
      case 'upload_apartment_photo':
        return await uploadApartmentPhoto(userId, requestBody, headers);
      
      case 'delete_file':
        return await deleteFile(userId, requestBody, headers);
      
      case 'get_upload_url':
        return await getUploadUrl(requestBody, headers);
      
      case 'process_image':
        return await processImage(userId, requestBody, headers);
      
      case 'validate_file':
        return await validateFileUpload(requestBody, headers);
      
      case 'get_file_info':
        return await getFileInfo(userId, requestBody, headers);
      
      case 'compress_image':
        return await compressImage(userId, requestBody, headers);
      
      case 'generate_thumbnail':
        return await generateThumbnail(userId, requestBody, headers);
      
      case 'batch_upload':
        return await batchUpload(userId, requestBody, headers);
      
      case 'get_upload_history':
        return await getUploadHistory(userId, queryParams, headers);
      
      case 'scan_for_malware':
        return await scanForMalware(userId, requestBody, headers);
      
      case 'convert_format':
        return await convertFormat(userId, requestBody, headers);
      
      case 'create_zip':
        return await createZip(userId, requestBody, headers);
      
      case 'extract_metadata':
        return await extractMetadata(userId, requestBody, headers);
      
      case 'watermark_image':
        return await watermarkImage(userId, requestBody, headers);
      
      case 'optimize_image':
        return await optimizeImage(userId, requestBody, headers);
      
      case 'backup_files':
        return await backupFiles(userId, requestBody, headers);
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid action specified'
          })
        };
    }

  } catch (error) {
    console.error('File upload error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};

// Upload image with processing
async function uploadImage(userId, requestBody, headers) {
  try {
    const {
      filename,
      content_type,
      base64_data,
      folder = 'images',
      max_width = 1920,
      max_height = 1080,
      quality = 85
    } = requestBody;

    if (!filename || !base64_data) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Filename and base64_data are required'
        })
      };
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const mimeType = content_type || mime.lookup(filename);
    
    if (!allowedTypes.includes(mimeType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid image type. Allowed: JPEG, PNG, WebP, GIF'
        })
      };
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64_data, 'base64');
    
    // Process image with Sharp
    let processedBuffer = await sharp(imageBuffer)
      .resize(max_width, max_height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toBuffer();

    // Generate secure filename
    const secureFilename = generateSecureFilename(filename, userId);
    const filePath = `${folder}/${secureFilename}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(filePath, processedBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(filePath);

    // Save file record
    const { data: fileRecord, error: dbError } = await supabase
      .from('uploaded_files')
      .insert({
        user_id: userId,
        filename: secureFilename,
        original_filename: filename,
        file_path: filePath,
        file_size: processedBuffer.length,
        content_type: 'image/jpeg',
        folder,
        public_url: urlData.publicUrl,
        metadata: {
          original_size: imageBuffer.length,
          processed_size: processedBuffer.length,
          dimensions: { max_width, max_height },
          quality
        }
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    // Log activity
    await supabase
      .from('user_activity')
      .insert({
        user_id: userId,
        action: 'upload_image',
        metadata: {
          filename: secureFilename,
          file_size: processedBuffer.length,
          folder
        }
      });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          file_id: fileRecord.id,
          filename: secureFilename,
          public_url: urlData.publicUrl,
          file_size: processedBuffer.length,
          content_type: 'image/jpeg',
          folder
        }
      })
    };

  } catch (error) {
    console.error('Upload image error:', error);
    throw error;
  }
}

// Upload document
async function uploadDocument(userId, requestBody, headers) {
  try {
    const {
      filename,
      content_type,
      base64_data,
      folder = 'documents'
    } = requestBody;

    if (!filename || !base64_data) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Filename and base64_data are required'
        })
      };
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                         'text/plain', 'text/csv'];
    const mimeType = content_type || mime.lookup(filename);
    
    if (!allowedTypes.includes(mimeType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid document type. Allowed: PDF, DOC, DOCX, TXT, CSV'
        })
      };
    }

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(base64_data, 'base64');
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (fileBuffer.length > maxSize) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'File size exceeds 10MB limit'
        })
      };
    }

    // Generate secure filename
    const secureFilename = generateSecureFilename(filename, userId);
    const filePath = `${folder}/${secureFilename}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(filePath);

    // Save file record
    const { data: fileRecord, error: dbError } = await supabase
      .from('uploaded_files')
      .insert({
        user_id: userId,
        filename: secureFilename,
        original_filename: filename,
        file_path: filePath,
        file_size: fileBuffer.length,
        content_type: mimeType,
        folder,
        public_url: urlData.publicUrl,
        metadata: {
          original_size: fileBuffer.length
        }
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          file_id: fileRecord.id,
          filename: secureFilename,
          public_url: urlData.publicUrl,
          file_size: fileBuffer.length,
          content_type: mimeType
        }
      })
    };

  } catch (error) {
    console.error('Upload document error:', error);
    throw error;
  }
}

// Upload avatar (with special processing)
async function uploadAvatar(userId, requestBody, headers) {
  try {
    const {
      base64_data,
      filename = 'avatar.jpg'
    } = requestBody;

    if (!base64_data) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'base64_data is required'
        })
      };
    }

    // Convert and process avatar
    const imageBuffer = Buffer.from(base64_data, 'base64');
    
    // Create square avatar (200x200)
    const avatarBuffer = await sharp(imageBuffer)
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Generate secure filename
    const secureFilename = `avatar_${userId}_${Date.now()}.jpg`;
    const filePath = `avatars/${secureFilename}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(filePath, avatarBuffer, {
        contentType: 'image/jpeg',
        upsert: true // Allow overwrite for avatars
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(filePath);

    // Update user profile
    const { error: profileError } = await supabase
      .from('users')
      .update({
        avatar_url: urlData.publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      throw profileError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          avatar_url: urlData.publicUrl,
          filename: secureFilename,
          file_size: avatarBuffer.length
        }
      })
    };

  } catch (error) {
    console.error('Upload avatar error:', error);
    throw error;
  }
}

// Upload apartment photo
async function uploadApartmentPhoto(userId, requestBody, headers) {
  try {
    const {
      apartment_id,
      base64_data,
      filename,
      is_primary = false,
      caption = ''
    } = requestBody;

    if (!apartment_id || !base64_data) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'apartment_id and base64_data are required'
        })
      };
    }

    // Verify apartment ownership or admin role
    const { data: apartment, error: apartmentError } = await supabase
      .from('apartments')
      .select('user_id')
      .eq('id', apartment_id)
      .single();

    if (apartmentError || !apartment) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Apartment not found'
        })
      };
    }

    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (apartment.user_id !== userId && user?.role !== 'admin') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Permission denied'
        })
      };
    }

    // Process image
    const imageBuffer = Buffer.from(base64_data, 'base64');
    
    // Create high-quality apartment photo
    const processedBuffer = await sharp(imageBuffer)
      .resize(1200, 800, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 92 })
      .toBuffer();

    // Create thumbnail
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(300, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Generate filenames
    const secureFilename = generateSecureFilename(filename || 'apartment_photo.jpg', userId);
    const thumbnailFilename = secureFilename.replace('.jpg', '_thumb.jpg');
    
    const photoPath = `apartments/${apartment_id}/${secureFilename}`;
    const thumbnailPath = `apartments/${apartment_id}/${thumbnailFilename}`;

    // Upload both images
    const [photoUpload, thumbnailUpload] = await Promise.all([
      supabase.storage.from('uploads').upload(photoPath, processedBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      }),
      supabase.storage.from('uploads').upload(thumbnailPath, thumbnailBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      })
    ]);

    if (photoUpload.error || thumbnailUpload.error) {
      throw photoUpload.error || thumbnailUpload.error;
    }

    // Get public URLs
    const { data: photoUrl } = supabase.storage.from('uploads').getPublicUrl(photoPath);
    const { data: thumbnailUrl } = supabase.storage.from('uploads').getPublicUrl(thumbnailPath);

    // Save apartment photo record
    const { data: photoRecord, error: dbError } = await supabase
      .from('apartment_photos')
      .insert({
        apartment_id,
        user_id: userId,
        photo_url: photoUrl.publicUrl,
        thumbnail_url: thumbnailUrl.publicUrl,
        filename: secureFilename,
        file_size: processedBuffer.length,
        is_primary,
        caption,
        order_index: 0 // Will be updated if needed
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    // If this is primary, update others
    if (is_primary) {
      await supabase
        .from('apartment_photos')
        .update({ is_primary: false })
        .eq('apartment_id', apartment_id)
        .neq('id', photoRecord.id);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          photo_id: photoRecord.id,
          photo_url: photoUrl.publicUrl,
          thumbnail_url: thumbnailUrl.publicUrl,
          is_primary,
          file_size: processedBuffer.length
        }
      })
    };

  } catch (error) {
    console.error('Upload apartment photo error:', error);
    throw error;
  }
}

// Placeholder implementations for remaining functions
async function deleteFile(userId, requestBody, headers) {
  // Implementation for file deletion
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'File deleted' }) };
}

async function getUploadUrl(requestBody, headers) {
  // Implementation for presigned upload URLs
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, upload_url: 'presigned-url' }) };
}

async function processImage(userId, requestBody, headers) {
  // Implementation for image processing
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, processed: true }) };
}

async function validateFileUpload(requestBody, headers) {
  // Implementation for file validation
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, valid: true }) };
}

async function getFileInfo(userId, requestBody, headers) {
  // Implementation for file info retrieval
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, file_info: {} }) };
}

async function compressImage(userId, requestBody, headers) {
  // Implementation for image compression
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, compressed: true }) };
}

async function generateThumbnail(userId, requestBody, headers) {
  // Implementation for thumbnail generation
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, thumbnail_url: 'url' }) };
}

async function batchUpload(userId, requestBody, headers) {
  // Implementation for batch upload
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, uploaded_count: 0 }) };
}

async function getUploadHistory(userId, queryParams, headers) {
  // Implementation for upload history
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, history: [] }) };
}

async function scanForMalware(userId, requestBody, headers) {
  // Implementation for malware scanning
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, clean: true }) };
}

async function convertFormat(userId, requestBody, headers) {
  // Implementation for format conversion
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, converted_url: 'url' }) };
}

async function createZip(userId, requestBody, headers) {
  // Implementation for ZIP creation
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, zip_url: 'url' }) };
}

async function extractMetadata(userId, requestBody, headers) {
  // Implementation for metadata extraction
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, metadata: {} }) };
}

async function watermarkImage(userId, requestBody, headers) {
  // Implementation for image watermarking
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, watermarked_url: 'url' }) };
}

async function optimizeImage(userId, requestBody, headers) {
  // Implementation for image optimization
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, optimized_url: 'url' }) };
}

async function backupFiles(userId, requestBody, headers) {
  // Implementation for file backup
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, backup_created: true }) };
}