// Firebase Storage Security Rules
// Add these rules to your Firebase Console > Storage > Rules

/*
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Allow authenticated users to upload images to their own folder
    match /posts/{userId}/{fileName} {
      allow read: if true; // Anyone can read post images
      allow write: if request.auth != null 
                   && request.auth.uid == userId 
                   && isImage()
                   && isValidSize();
    }
    
    // Allow authenticated users to upload profile images to their own folder
    match /profiles/{userId}/{fileName} {
      allow read: if true; // Anyone can read profile images
      allow write: if request.auth != null 
                   && request.auth.uid == userId 
                   && isImage()
                   && isValidSize();
    }
    
    // Allow authenticated users to upload community images (if they're admin/moderator)
    match /communities/{communityId}/{fileName} {
      allow read: if true; // Anyone can read community images
      allow write: if request.auth != null 
                   && isImage()
                   && isValidSize();
      // Add additional community admin checks here if needed
    }
    
    // Helper functions
    function isImage() {
      return request.resource.contentType.matches('image/.*');
    }
    
    function isValidSize() {
      return request.resource.size < 5 * 1024 * 1024; // 5MB limit
    }
    
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }
  }
}
*/

// src/utils/FirebaseStorageConfig.js
import { auth } from '../config/firebase';

/**
 * Configuration and utilities for Firebase Storage
 */
export class FirebaseStorageConfig {
  
  // Storage folder structure
  static FOLDERS = {
    POSTS: 'posts',
    PROFILES: 'profiles', 
    COMMUNITIES: 'communities',
    TEMP: 'temp', // For temporary uploads
  };

  // File size limits (in bytes)
  static LIMITS = {
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_PROFILE_SIZE: 2 * 1024 * 1024, // 2MB
  };

  // Allowed file types
  static ALLOWED_TYPES = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
  ];

  /**
   * Check if user is authenticated for upload
   */
  static isUserAuthenticated() {
    return auth.currentUser !== null;
  }

  /**
   * Get current user ID
   */
  static getCurrentUserId() {
    return auth.currentUser?.uid || null;
  }

  /**
   * Validate file before upload
   */
  static validateFile(file, maxSize = this.LIMITS.MAX_IMAGE_SIZE) {
    const errors = [];

    // Check if user is authenticated
    if (!this.isUserAuthenticated()) {
      errors.push('User must be authenticated to upload files');
    }

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size (${this.formatFileSize(file.size)}) exceeds limit (${this.formatFileSize(maxSize)})`);
    }

    // Check file type
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate storage path for different content types
   */
  static getStoragePath(folder, userId, fileName) {
    return `${folder}/${userId}/${fileName}`;
  }

  /**
   * Get optimized image path with transformation parameters
   * Note: Requires Firebase Extensions like "Resize Images"
   */
  static getOptimizedPath(originalPath, transformations = {}) {
    const { width, height, quality = 80 } = transformations;
    
    if (!width && !height) return originalPath;
    
    const pathParts = originalPath.split('/');
    const fileName = pathParts.pop();
    const directory = pathParts.join('/');
    
    let optimizedFileName = fileName;
    
    if (width && height) {
      optimizedFileName = `thumb_${width}x${height}_${fileName}`;
    } else if (width) {
      optimizedFileName = `thumb_w${width}_${fileName}`;
    } else if (height) {
      optimizedFileName = `thumb_h${height}_${fileName}`;
    }
    
    return `${directory}/${optimizedFileName}`;
  }

  /**
   * Clean up temporary files (call this periodically)
   */
  static async cleanupTempFiles() {
    try {
      // Implementation depends on your backend or Cloud Functions
      console.log('🧹 Cleaning up temporary files...');
      // This would typically be handled by a Cloud Function
    } catch (error) {
      console.error('❌ Error cleaning up temp files:', error);
    }
  }

  /**
   * Get CORS configuration for Firebase Storage
   */
  static getCORSConfig() {
    return [
      {
        "origin": ["*"],
        "method": ["GET", "POST", "PUT", "DELETE"],
        "maxAgeSeconds": 3600,
        "responseHeader": ["Content-Type", "Authorization"]
      }
    ];
  }

  /**
   * Setup Firebase Storage bucket (for initial configuration)
   */
  static async setupStorageBucket() {
    console.log('📦 Setting up Firebase Storage bucket...');
    console.log('1. Go to Firebase Console > Storage');
    console.log('2. Add the security rules from the comments above');
    console.log('3. Configure CORS if needed for web access');
    console.log('4. Consider adding Firebase Extensions:');
    console.log('   - Resize Images (for automatic thumbnails)');
    console.log('   - Delete User Data (for GDPR compliance)');
    console.log('   - Storage Image Converter (for format optimization)');
  }

  /**
   * Error handling for common Storage errors
   */
  static handleStorageError(error) {
    console.error('Firebase Storage Error:', error);
    
    switch (error.code) {
      case 'storage/unauthorized':
        return 'You do not have permission to upload files. Please log in.';
      
      case 'storage/canceled':
        return 'Upload was cancelled.';
      
      case 'storage/quota-exceeded':
        return 'Storage quota exceeded. Please try again later.';
      
      case 'storage/invalid-format':
        return 'Invalid file format. Please upload a valid image.';
      
      case 'storage/server-file-wrong-size':
        return 'File size is too large. Please choose a smaller image.';
      
      case 'storage/unknown':
        return 'An unknown error occurred. Please try again.';
      
      default:
        return error.message || 'Upload failed. Please try again.';
    }
  }

  /**
   * Monitor upload progress (for UI feedback)
   */
  static createProgressHandler(onProgress) {
    return (snapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      onProgress?.(progress);
      
      switch (snapshot.state) {
        case 'paused':
          console.log('⏸️ Upload paused');
          break;
        case 'running':
          console.log(`📤 Upload is ${progress.toFixed(2)}% done`);
          break;
      }
    };
  }
}

export default FirebaseStorageConfig;