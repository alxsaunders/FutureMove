// src/services/ImageService.js
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';
import { Platform } from 'react-native';

/**
 * Enhanced service for handling image uploads and downloads with Firebase Storage
 * Includes better error handling and URL validation
 */
export class ImageService {
  
  /**
   * Upload an image to Firebase Storage
   * @param {string} imageUri - Local image URI from ImagePicker
   * @param {string} folder - Storage folder (e.g., 'posts', 'profiles', 'communities')
   * @param {string} userId - User ID for organizing files
   * @param {string} fileName - Optional custom file name
   * @returns {Promise<string>} - Download URL of uploaded image
   */
  static async uploadImage(imageUri, folder = 'posts', userId, fileName = null) {
    try {
      if (!imageUri || !userId) {
        throw new Error('Image URI and User ID are required');
      }

      // Validate that the image URI is accessible
      await this.validateImageUri(imageUri);

      console.log(`🔄 Starting image upload to ${folder}/${userId}`);
      
      // Generate unique filename if not provided
      const timestamp = Date.now();
      const extension = this.getFileExtension(imageUri) || 'jpg';
      const finalFileName = fileName || `image_${timestamp}.${extension}`;
      
      // Create storage reference
      const storageRef = ref(storage, `${folder}/${userId}/${finalFileName}`);
      
      // Convert image URI to blob for upload
      const blob = await this._uriToBlob(imageUri);
      
      // Set metadata
      const metadata = {
        contentType: this._getContentType(extension),
        customMetadata: {
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
          platform: Platform.OS,
          originalUri: imageUri, // For debugging
        }
      };
      
      // Upload the blob
      console.log(`📤 Uploading image: ${finalFileName}`);
      const snapshot = await uploadBytes(storageRef, blob, metadata);
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // Validate the download URL works
      await this.validateFirebaseUrl(downloadURL);
      
      console.log(`✅ Image uploaded successfully: ${downloadURL}`);
      return downloadURL;
      
    } catch (error) {
      console.error('❌ Error uploading image:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Validate that an image URI is accessible
   * @param {string} imageUri - Image URI to validate
   */
  static async validateImageUri(imageUri) {
    try {
      const response = await fetch(imageUri, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Image not accessible: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Image URI validation failed:', error);
      throw new Error('Image file is not accessible');
    }
  }

  /**
   * Validate that a Firebase Storage URL is accessible
   * @param {string} url - Firebase Storage URL to validate
   */
  static async validateFirebaseUrl(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Firebase URL not accessible: ${response.status}`);
      }
    } catch (error) {
      console.warn('⚠️ Firebase URL validation failed:', error);
      // Don't throw here as the upload might still be processing
    }
  }

  /**
   * Get file extension from URI
   * @param {string} uri - File URI
   * @returns {string} - File extension
   */
  static getFileExtension(uri) {
    if (!uri) return null;
    
    // Remove query parameters and fragments
    const cleanUri = uri.split('?')[0].split('#')[0];
    const parts = cleanUri.split('.');
    
    if (parts.length > 1) {
      return parts.pop().toLowerCase();
    }
    
    return null;
  }

  /**
   * Clean and validate image URLs to prevent 404 errors
   * @param {string} url - Original image URL
   * @returns {string|null} - Cleaned URL or null if invalid
   */
  static cleanImageUrl(url) {
    if (!url) return null;
    
    // Remove local file paths (they won't work after app restart)
    if (url.includes('/ImagePicker/') || 
        url.includes('file://') || 
        url.includes('/Library/Caches/') ||
        url.includes('/cache/')) {
      console.warn('🗑️ Removing invalid local image path:', url);
      return null;
    }
    
    // Handle Firebase Storage URLs
    if (url.includes('firebasestorage.googleapis.com')) {
      try {
        const urlObj = new URL(url);
        
        // Remove problematic parameters that might cause 404s
        const paramsToRemove = ['width', 'height', 'quality'];
        paramsToRemove.forEach(param => {
          urlObj.searchParams.delete(param);
        });
        
        const cleanedUrl = urlObj.toString();
        console.log('🧹 Cleaned Firebase URL:', cleanedUrl);
        return cleanedUrl;
        
      } catch (error) {
        console.warn('⚠️ Invalid Firebase Storage URL:', url);
        return null;
      }
    }
    
    // For other URLs (external), validate format
    try {
      new URL(url);
      return url;
    } catch {
      console.warn('⚠️ Invalid URL format:', url);
      return null;
    }
  }

  /**
   * Delete an image from Firebase Storage
   * @param {string} imageUrl - Full download URL of the image
   * @returns {Promise<boolean>} - Success status
   */
  static async deleteImage(imageUrl) {
    try {
      if (!imageUrl || !this.isFirebaseStorageUrl(imageUrl)) {
        console.warn('⚠️ Invalid Firebase Storage URL for deletion:', imageUrl);
        return true;
      }

      // Extract storage path from download URL
      const storageRef = ref(storage, imageUrl);
      
      console.log(`🗑️ Deleting image from storage`);
      await deleteObject(storageRef);
      
      console.log('✅ Image deleted successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Error deleting image:', error);
      // Don't throw error for deletion failures to avoid blocking other operations
      return false;
    }
  }

  /**
   * Get optimized image URL with size parameters
   * Note: This requires Firebase Extensions like "Resize Images"
   * @param {string} originalUrl - Original Firebase Storage URL
   * @param {number} width - Desired width
   * @param {number} height - Desired height
   * @returns {string} - Optimized image URL
   */
  static getOptimizedImageUrl(originalUrl, width = 400, height = 400) {
    if (!originalUrl || !this.isFirebaseStorageUrl(originalUrl)) {
      return originalUrl;
    }
    
    try {
      const url = new URL(originalUrl);
      
      // Only add optimization parameters for Firebase Storage URLs
      // and only if the resize extension is enabled
      if (this.isResizeExtensionEnabled()) {
        url.searchParams.set('width', width.toString());
        url.searchParams.set('height', height.toString());
      }
      
      return url.toString();
    } catch (error) {
      console.warn('⚠️ Could not optimize image URL, returning original:', originalUrl);
      return originalUrl;
    }
  }

  /**
   * Check if Firebase Resize Images extension is enabled
   * This is a simplified check - in practice you'd want to verify this
   * through your Firebase configuration or by testing a sample URL
   * @returns {boolean}
   */
  static isResizeExtensionEnabled() {
    // For now, return false to avoid 404 errors
    // Set to true if you have the Resize Images extension installed
    return false;
  }

  /**
   * Check if an image URL is from Firebase Storage
   * @param {string} url - Image URL to check
   * @returns {boolean} - True if Firebase Storage URL
   */
  static isFirebaseStorageUrl(url) {
    if (!url) return false;
    return url.includes('firebasestorage.googleapis.com') || 
           url.includes('storage.googleapis.com');
  }

  /**
   * Create a fallback image URL for broken images
   * @param {string} type - Type of image ('avatar', 'post', 'community')
   * @returns {string} - Fallback image URL
   */
  static getFallbackImageUrl(type = 'post') {
    const fallbacks = {
      avatar: 'https://via.placeholder.com/100x100/e2e8f0/64748b?text=User',
      post: 'https://via.placeholder.com/400x300/e2e8f0/64748b?text=Image+Not+Available',
      community: 'https://via.placeholder.com/200x200/e2e8f0/64748b?text=Community',
    };
    
    return fallbacks[type] || fallbacks.post;
  }

  /**
   * Convert image URI to Blob for upload
   * @private
   */
  static async _uriToBlob(uri) {
    try {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Validate blob
      if (!blob || blob.size === 0) {
        throw new Error('Invalid or empty image file');
      }
      
      console.log(`📊 Image blob size: ${this.formatFileSize(blob.size)}`);
      return blob;
      
    } catch (error) {
      console.error('❌ Error converting URI to blob:', error);
      throw error;
    }
  }

  /**
   * Get content type based on file extension
   * @private
   */
  static _getContentType(extension) {
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'heic': 'image/heic',
      'heif': 'image/heif',
    };
    
    return mimeTypes[extension.toLowerCase()] || 'image/jpeg';
  }

  /**
   * Generate a unique filename for image uploads
   * @param {string} prefix - File prefix (optional)
   * @param {string} extension - File extension
   * @returns {string} - Unique filename
   */
  static generateUniqueFileName(prefix = 'img', extension = 'jpg') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}.${extension}`;
  }

  /**
   * Validate image file
   * @param {string} uri - Image URI
   * @param {number} maxSizeBytes - Maximum file size in bytes (default: 5MB)
   * @returns {Promise<boolean>} - True if valid
   */
  static async validateImage(uri, maxSizeBytes = 5 * 1024 * 1024) {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Check file size
      if (blob.size > maxSizeBytes) {
        throw new Error(`Image too large. Maximum size: ${this.formatFileSize(maxSizeBytes)}`);
      }
      
      // Check file type
      if (!blob.type.startsWith('image/')) {
        throw new Error('File is not a valid image');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Image validation failed:', error);
      throw error;
    }
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
   * Batch clean multiple image URLs
   * @param {string[]} urls - Array of image URLs
   * @returns {string[]} - Array of cleaned URLs (nulls removed)
   */
  static cleanImageUrls(urls) {
    return urls
      .map(url => this.cleanImageUrl(url))
      .filter(url => url !== null);
  }

  /**
   * Get image dimensions from URL (if possible)
   * @param {string} imageUrl - Image URL
   * @returns {Promise<{width: number, height: number}>} - Image dimensions
   */
  static async getImageDimensions(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = imageUrl;
    });
  }
}

export default ImageService;