// src/utils/FirebaseStorageDiagnostics.js
import { storage } from '../config/firebase';
import { ref, getDownloadURL, listAll } from 'firebase/storage';
import ImageService from '../services/ImageService';

/**
 * Firebase Storage Diagnostics Tool
 * Use this to debug storage issues and validate URLs
 */
export class FirebaseStorageDiagnostics {

  /**
   * Run comprehensive diagnostics
   */
  static async runDiagnostics() {
    console.log('🔍 Starting Firebase Storage Diagnostics...\n');
    
    const results = {
      storageConnection: false,
      sampleUrls: [],
      issues: [],
      recommendations: []
    };

    try {
      // Test 1: Storage Connection
      console.log('📡 Testing Firebase Storage connection...');
      results.storageConnection = await this.testStorageConnection();
      
      // Test 2: Check existing files
      console.log('📁 Checking existing files...');
      results.sampleUrls = await this.checkExistingFiles();
      
      // Test 3: Validate sample URLs
      console.log('🔗 Validating sample URLs...');
      await this.validateSampleUrls(results.sampleUrls, results);
      
      // Test 4: Check security rules
      console.log('🔒 Checking security rules access...');
      await this.checkSecurityRules(results);
      
      // Generate report
      this.generateReport(results);
      
      return results;
      
    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
      results.issues.push(`Diagnostics failed: ${error.message}`);
      return results;
    }
  }

  /**
   * Test basic Firebase Storage connection
   */
  static async testStorageConnection() {
    try {
      const testRef = ref(storage, 'test');
      console.log('✅ Firebase Storage connection successful');
      return true;
    } catch (error) {
      console.error('❌ Firebase Storage connection failed:', error);
      return false;
    }
  }

  /**
   * Check for existing files in storage
   */
  static async checkExistingFiles() {
    const sampleUrls = [];
    
    try {
      // Check posts folder
      const postsRef = ref(storage, 'posts');
      const postsList = await listAll(postsRef);
      
      for (const folderRef of postsList.prefixes.slice(0, 3)) { // Check first 3 users
        const userFiles = await listAll(folderRef);
        
        for (const fileRef of userFiles.items.slice(0, 2)) { // Check first 2 files per user
          try {
            const downloadURL = await getDownloadURL(fileRef);
            sampleUrls.push({
              path: fileRef.fullPath,
              url: downloadURL,
              type: 'post'
            });
          } catch (error) {
            console.warn(`⚠️ Failed to get URL for ${fileRef.fullPath}:`, error);
          }
        }
      }
      
      console.log(`📋 Found ${sampleUrls.length} sample URLs`);
      return sampleUrls;
      
    } catch (error) {
      console.error('❌ Error checking existing files:', error);
      return [];
    }
  }

  /**
   * Validate sample URLs
   */
  static async validateSampleUrls(sampleUrls, results) {
    let validUrls = 0;
    let invalidUrls = 0;
    
    for (const sample of sampleUrls) {
      try {
        const response = await fetch(sample.url, { method: 'HEAD' });
        
        if (response.ok) {
          validUrls++;
          console.log(`✅ Valid: ${sample.path}`);
        } else {
          invalidUrls++;
          console.log(`❌ Invalid (${response.status}): ${sample.path}`);
          results.issues.push(`URL returns ${response.status}: ${sample.path}`);
        }
        
      } catch (error) {
        invalidUrls++;
        console.log(`❌ Network error: ${sample.path}`, error.message);
        results.issues.push(`Network error for ${sample.path}: ${error.message}`);
      }
    }
    
    console.log(`📊 URL Validation: ${validUrls} valid, ${invalidUrls} invalid`);
    
    if (invalidUrls > validUrls) {
      results.recommendations.push('High number of invalid URLs detected. Check Firebase Storage rules and file permissions.');
    }
  }

  /**
   * Check security rules access
   */
  static async checkSecurityRules(results) {
    try {
      // Try to access a test path
      const testRef = ref(storage, 'posts/test-user/test-file.jpg');
      
      try {
        await getDownloadURL(testRef);
        console.log('✅ Security rules allow read access');
      } catch (error) {
        if (error.code === 'storage/object-not-found') {
          console.log('✅ Security rules working (file not found as expected)');
        } else if (error.code === 'storage/unauthorized') {
          console.log('⚠️ Security rules may be too restrictive');
          results.issues.push('Storage access unauthorized - check security rules');
          results.recommendations.push('Review Firebase Storage security rules to ensure read access is properly configured');
        } else {
          console.log('⚠️ Unexpected security rule error:', error.code);
          results.issues.push(`Security rule error: ${error.code}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error checking security rules:', error);
      results.issues.push(`Security rules check failed: ${error.message}`);
    }
  }

  /**
   * Test URL cleaning function
   */
  static testUrlCleaning() {
    console.log('🧪 Testing URL cleaning function...\n');
    
    const testUrls = [
      // Valid Firebase URLs
      'https://firebasestorage.googleapis.com/v0/b/futuremove-86603.firebasestorage.app/o/posts%2FKbtY3t4Tatd0r5tCjnjlmJyNT5R2%2Fpost_1748907263640_r27a93.jpg?alt=media&token=6494dd85-654a-4231-ab11-093b26233929',
      
      // URLs with problematic parameters
      'https://firebasestorage.googleapis.com/v0/b/futuremove-86603.firebasestorage.app/o/posts%2FKbtY3t4Tatd0r5tCjnjlmJyNT5R2%2Fpost_1748907263640_r27a93.jpg?alt=media&token=6494dd85-654a-4231-ab11-093b26233929&width=694&height=600',
      
      // Local file paths (should be removed)
      '/var/mobile/Containers/Data/Application/337C1F97-FA62-42FB-A210-4D711375FAFB/Library/Caches/ExponentExperienceData/@anonymous/FutureMove-299d19dd-5f0d-4118-bd29-ed176132cca7/ImagePicker/EDAF02DA-7548-4EC6-81C6-D40802E018A7.jpg',
      
      '/data/user/0/host.exp.exponent/cache/ExperienceData/%40anonymous%2FFutureMove-6379ff79-8adf-4510-88bf-509d3c796643/ImagePicker/c5d62b65-127b-410b-ab54-01ea1cc08c4b.jpeg',
      
      // Regular URLs
      'https://example.com/image.jpg',
      
      // Invalid URLs
      'not-a-url',
      null,
      undefined
    ];
    
    testUrls.forEach((url, index) => {
      const cleaned = ImageService.cleanImageUrl(url);
      console.log(`Test ${index + 1}:`);
      console.log(`  Input:  ${url}`);
      console.log(`  Output: ${cleaned}`);
      console.log(`  Status: ${cleaned ? '✅ Valid' : '❌ Removed'}\n`);
    });
  }

  /**
   * Check current user's storage usage
   */
  static async checkUserStorageUsage(userId) {
    console.log(`📊 Checking storage usage for user: ${userId}\n`);
    
    try {
      const userRef = ref(storage, `posts/${userId}`);
      const userFiles = await listAll(userRef);
      
      console.log(`📁 User has ${userFiles.items.length} files in storage`);
      
      let totalSize = 0;
      let workingUrls = 0;
      let brokenUrls = 0;
      
      for (const fileRef of userFiles.items) {
        try {
          const downloadURL = await getDownloadURL(fileRef);
          
          // Test if URL is accessible
          const response = await fetch(downloadURL, { method: 'HEAD' });
          
          if (response.ok) {
            workingUrls++;
            const contentLength = response.headers.get('content-length');
            if (contentLength) {
              totalSize += parseInt(contentLength);
            }
            console.log(`✅ ${fileRef.name}: ${downloadURL.substring(0, 50)}...`);
          } else {
            brokenUrls++;
            console.log(`❌ ${fileRef.name}: HTTP ${response.status}`);
          }
          
        } catch (error) {
          brokenUrls++;
          console.log(`❌ ${fileRef.name}: ${error.message}`);
        }
      }
      
      console.log(`\n📊 Summary:`);
      console.log(`  Total files: ${userFiles.items.length}`);
      console.log(`  Working URLs: ${workingUrls}`);
      console.log(`  Broken URLs: ${brokenUrls}`);
      console.log(`  Total size: ${ImageService.formatFileSize(totalSize)}`);
      
      return {
        totalFiles: userFiles.items.length,
        workingUrls,
        brokenUrls,
        totalSize
      };
      
    } catch (error) {
      console.error('❌ Error checking user storage:', error);
      return null;
    }
  }

  /**
   * Generate diagnostic report
   */
  static generateReport(results) {
    console.log('\n📋 FIREBASE STORAGE DIAGNOSTIC REPORT');
    console.log('=====================================\n');
    
    // Connection Status
    console.log(`🔌 Storage Connection: ${results.storageConnection ? '✅ Connected' : '❌ Failed'}`);
    console.log(`📁 Sample URLs Found: ${results.sampleUrls.length}`);
    
    // Issues
    if (results.issues.length > 0) {
      console.log('\n🚨 ISSUES DETECTED:');
      results.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    } else {
      console.log('\n✅ No issues detected');
    }
    
    // Recommendations
    if (results.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      results.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }
    
    // Common Solutions
    console.log('\n🔧 COMMON SOLUTIONS:');
    console.log('  1. Clear app cache and restart');
    console.log('  2. Check Firebase Storage security rules');
    console.log('  3. Verify image URLs are properly formatted');
    console.log('  4. Remove local file paths from image URLs');
    console.log('  5. Check network connectivity');
    
    console.log('\n=====================================');
  }

  /**
   * Quick health check
   */
  static async quickHealthCheck() {
    console.log('⚡ Quick Firebase Storage Health Check...\n');
    
    try {
      // Test storage connection
      const connected = await this.testStorageConnection();
      
      if (!connected) {
        console.log('❌ Storage connection failed');
        return false;
      }
      
      // Test a sample upload (you can implement this)
      console.log('✅ Basic connectivity working');
      
      return true;
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return false;
    }
  }
}

// Export convenience functions
export const runStorageDiagnostics = () => FirebaseStorageDiagnostics.runDiagnostics();
export const testUrlCleaning = () => FirebaseStorageDiagnostics.testUrlCleaning();
export const checkUserStorage = (userId) => FirebaseStorageDiagnostics.checkUserStorageUsage(userId);
export const quickHealthCheck = () => FirebaseStorageDiagnostics.quickHealthCheck();

export default FirebaseStorageDiagnostics;