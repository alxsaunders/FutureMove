// src/services/ImageService.ts
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

class ImageService {
  private storage = getStorage();

  /**
   * Generate a unique filename for Firebase Storage
   */
  generateUniqueFileName(prefix: string = 'post'): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 15);
    return `${prefix}_${timestamp}_${randomSuffix}.jpg`;
  }

  /**
   * Convert URI to Blob for Firebase upload
   */
  async uriToBlob(uri: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        reject(new Error('Failed to convert image to blob'));
      };
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  }

  /**
   * Validate image before upload
   */
  async validateImage(imageUri: string): Promise<void> {
    if (!imageUri || imageUri.trim() === '') {
      throw new Error('Invalid image URI');
    }

    try {
      const blob = await this.uriToBlob(imageUri);
      
      // Check file size (limit to 5MB)
      if (blob.size > 5 * 1024 * 1024) {
        throw new Error('Image is too large (over 5MB)');
      }

      // Check if it's actually an image
      if (!blob.type.startsWith('image/')) {
        throw new Error('File is not an image');
      }

      console.log('✅ Image validation passed');
    } catch (error) {
      console.error('❌ Image validation failed:', error);
      throw error;
    }
  }

  /**
   * Upload image to Firebase Storage
   */
  async uploadImage(
    imageUri: string,
    folder: string,
    userId: string,
    fileName?: string
  ): Promise<string> {
    try {
      console.log(`🔄 Starting image upload to Firebase Storage: ${folder}/`);

      // Convert image URI to blob
      const blob = await this.uriToBlob(imageUri);
      
      // Generate filename if not provided
      const finalFileName = fileName || this.generateUniqueFileName();
      
      // Create reference to the specified folder
      const imageRef = ref(this.storage, `${folder}/${finalFileName}`);
      
      console.log(`📁 Uploading to: ${folder}/${finalFileName}`);

      // Upload the blob
      const uploadResult = await uploadBytes(imageRef, blob);

      // Get download URL
      const downloadURL = await getDownloadURL(uploadResult.ref);

      console.log("✅ Image uploaded successfully:", downloadURL);
      return downloadURL;

    } catch (error) {
      console.error("❌ Error uploading image:", error);
      throw error;
    }
  }

  /**
   * Delete image from Firebase Storage
   */
  async deleteImage(imageUrl: string): Promise<boolean> {
    try {
      if (!imageUrl || !imageUrl.includes('firebasestorage.googleapis.com')) {
        console.warn('⚠️ Invalid Firebase Storage URL for deletion');
        return false;
      }

      // Extract the path from Firebase Storage URL
      const urlParts = imageUrl.split('/o/');
      if (urlParts.length < 2) {
        console.warn('❌ Invalid Firebase Storage URL format');
        return false;
      }

      const pathWithQuery = urlParts[1];
      const path = decodeURIComponent(pathWithQuery.split('?')[0]);
      
      console.log(`🗑️ Attempting to delete image at path: ${path}`);

      const imageRef = ref(this.storage, path);
      await deleteObject(imageRef);
      
      console.log(`✅ Successfully deleted image: ${path}`);
      return true;
      
    } catch (error) {
      // If the image doesn't exist, that's okay
      if (error instanceof Error && error.message.includes('object-not-found')) {
        console.log('ℹ️ Image not found in storage (already deleted)');
        return true;
      }
      
      console.error(`❌ Error deleting image: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Check if URL is a Firebase Storage URL
   */
  isFirebaseStorageUrl(url: string): boolean {
    return url && url.includes('firebasestorage.googleapis.com');
  }

  /**
   * Clean and validate image URLs
   */
  cleanImageUrl(url: string | undefined | null): string | undefined {
    if (!url) return undefined;
    
    const cleanUrl = url.trim();
    if (!cleanUrl) return undefined;

    // Remove local file paths
    if (cleanUrl.includes("/ImagePicker/") || cleanUrl.includes("file://") || cleanUrl.startsWith("ph://")) {
      console.warn("🚫 Removing local image path:", cleanUrl);
      return undefined;
    }

    // Validate Firebase Storage URLs
    if (cleanUrl.includes("firebasestorage.googleapis.com")) {
      try {
        new URL(cleanUrl); // Validate URL format
        console.log("✅ Valid Firebase Storage URL:", cleanUrl);
        return cleanUrl;
      } catch (error) {
        console.warn("❌ Invalid Firebase Storage URL:", cleanUrl);
        return undefined;
      }
    }

    // For other valid URLs
    if (cleanUrl.startsWith("https://") || cleanUrl.startsWith("http://")) {
      console.log("✅ Valid HTTP(S) URL:", cleanUrl);
      return cleanUrl;
    }

    console.warn("🚫 Unrecognized URL format:", cleanUrl);
    return undefined;
  }
}

// Export a singleton instance
const imageService = new ImageService();
export default imageService;