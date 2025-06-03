// src/services/CommunityRequestService.js
import { auth } from '../config/firebase';
import { Platform } from 'react-native';

// Dynamic API base URL function
export const getApiBaseUrl = () => {   
  if (Platform.OS === "android") {     
    return 'http://10.0.2.2:3001/api';   
  } else {     
    // For iOS or development on Mac     
    return 'http://192.168.1.207:3001/api';   
  } 
};

/**
 * Service for handling community requests
 */
export class CommunityRequestService {

  /**
   * Submit a new community request
   * @param {Object} requestData - Community request data
   * @returns {Promise<Object>} - Response from API
   */
  static async submitCommunityRequest(requestData) {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User must be authenticated to submit requests');
      }

      console.log('🚀 Submitting community request:', requestData);

      // Get Firebase ID token for authentication
      const idToken = await user.getIdToken();

      const requestPayload = {
        user_id: user.uid,
        community_name: requestData.communityName,
        description: requestData.description,
        category: requestData.category || 'General',
        reason: requestData.reason,
        status: 'pending'
      };

      const API_BASE_URL = getApiBaseUrl();
      console.log('📡 Using API URL:', API_BASE_URL);

      const response = await fetch(`${API_BASE_URL}/community-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Community request submitted successfully:', result);

      return {
        success: true,
        data: result,
        message: 'Community request submitted successfully'
      };

    } catch (error) {
      console.error('❌ Error submitting community request:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to submit community request'
      };
    }
  }

  /**
   * Get user's community requests
   * @returns {Promise<Array>} - User's community requests
   */
  static async getUserRequests() {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User must be authenticated');
      }

      console.log('📋 Fetching user community requests');

      const idToken = await user.getIdToken();
      const API_BASE_URL = getApiBaseUrl();

      const response = await fetch(`${API_BASE_URL}/community-requests/user/${user.uid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Fetched user requests:', result.data?.length || 0);

      return result.data || [];

    } catch (error) {
      console.error('❌ Error fetching user requests:', error);
      return [];
    }
  }

  /**
   * Check if user can submit a new request (rate limiting)
   * @returns {Promise<Object>} - Rate limit status
   */
  static async checkRateLimit() {
    try {
      const user = auth.currentUser;
      if (!user) {
        return { canSubmit: false, reason: 'Not authenticated' };
      }

      // Get user's recent requests (last 24 hours)
      const userRequests = await this.getUserRequests();
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const recentRequests = userRequests.filter(request => {
        const requestDate = new Date(request.created_at);
        return requestDate > oneDayAgo;
      });

      // Allow maximum 3 requests per day
      const maxRequestsPerDay = 3;
      const canSubmit = recentRequests.length < maxRequestsPerDay;

      return {
        canSubmit,
        requestsToday: recentRequests.length,
        maxRequests: maxRequestsPerDay,
        reason: canSubmit ? null : 'Daily request limit reached'
      };

    } catch (error) {
      console.error('❌ Error checking rate limit:', error);
      return { canSubmit: false, reason: 'Error checking rate limit' };
    }
  }

  /**
   * Delete a community request
   * @param {string} requestId - ID of the request to delete
   * @returns {Promise<Object>} - Delete result
   */
  static async deleteRequest(requestId) {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User must be authenticated');
      }

      console.log('🗑️ Deleting community request:', requestId);

      const idToken = await user.getIdToken();
      const API_BASE_URL = getApiBaseUrl();

      const response = await fetch(`${API_BASE_URL}/community-requests/${requestId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Request deleted successfully:', result);

      return {
        success: true,
        message: 'Request deleted successfully'
      };

    } catch (error) {
      console.error('❌ Error deleting request:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to delete request'
      };
    }
  }

  /**
   * Get admin requests (admin only)
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Admin requests data
   */
  static async getAdminRequests(options = {}) {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User must be authenticated');
      }

      console.log('📋 Fetching admin requests');

      const idToken = await user.getIdToken();
      const API_BASE_URL = getApiBaseUrl();

      const queryParams = new URLSearchParams({
        status: options.status || 'pending',
        page: options.page || 1,
        limit: options.limit || 20
      });

      const response = await fetch(`${API_BASE_URL}/community-requests/admin?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Fetched admin requests:', result.data?.requests?.length || 0);

      return result.data || { requests: [], pagination: {} };

    } catch (error) {
      console.error('❌ Error fetching admin requests:', error);
      return { requests: [], pagination: {} };
    }
  }

  /**
   * Update request status (admin only)
   * @param {string} requestId - ID of the request
   * @param {string} status - New status ('approved' or 'rejected')
   * @param {string} adminNotes - Optional admin notes
   * @returns {Promise<Object>} - Update result
   */
  static async updateRequestStatus(requestId, status, adminNotes = '') {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User must be authenticated');
      }

      console.log('📝 Updating request status:', { requestId, status });

      const idToken = await user.getIdToken();
      const API_BASE_URL = getApiBaseUrl();

      const response = await fetch(`${API_BASE_URL}/community-requests/${requestId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          status,
          admin_notes: adminNotes
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Request status updated:', result);

      return {
        success: true,
        message: `Request ${status} successfully`
      };

    } catch (error) {
      console.error('❌ Error updating request status:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to update request status'
      };
    }
  }

  /**
   * Get request statistics (admin only)
   * @returns {Promise<Object>} - Statistics data
   */
  static async getRequestStats() {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User must be authenticated');
      }

      console.log('📊 Fetching request statistics');

      const idToken = await user.getIdToken();
      const API_BASE_URL = getApiBaseUrl();

      const response = await fetch(`${API_BASE_URL}/community-requests/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Fetched request stats:', result);

      return result.data || { statusStats: [], categoryStats: [] };

    } catch (error) {
      console.error('❌ Error fetching request stats:', error);
      return { statusStats: [], categoryStats: [] };
    }
  }

  /**
   * Validate community request data
   * @param {Object} requestData - Request data to validate
   * @returns {Object} - Validation result
   */
  static validateRequestData(requestData) {
    const errors = [];

    // Required fields
    if (!requestData.communityName || requestData.communityName.trim().length < 3) {
      errors.push('Community name must be at least 3 characters long');
    }

    if (!requestData.description || requestData.description.trim().length < 10) {
      errors.push('Description must be at least 10 characters long');
    }

    if (!requestData.reason || requestData.reason.trim().length < 10) {
      errors.push('Reason must be at least 10 characters long');
    }

    // Length limits
    if (requestData.communityName && requestData.communityName.length > 255) {
      errors.push('Community name must be less than 255 characters');
    }

    if (requestData.description && requestData.description.length > 1000) {
      errors.push('Description must be less than 1000 characters');
    }

    if (requestData.reason && requestData.reason.length > 1000) {
      errors.push('Reason must be less than 1000 characters');
    }

    // Category validation
    const validCategories = ['Health', 'Learning', 'Work', 'Finance', 'Wellness', 'Repair', 'General'];
    if (requestData.category && !validCategories.includes(requestData.category)) {
      errors.push('Invalid category selected');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get available categories for community requests
   * @returns {Array} - Available categories
   */
  static getAvailableCategories() {
    return [
      { id: 'Health', name: 'Health', description: 'Health and fitness related communities' },
      { id: 'Learning', name: 'Learning', description: 'Educational and skill development' },
      { id: 'Work', name: 'Work', description: 'Professional and career development' },
      { id: 'Finance', name: 'Finance', description: 'Financial planning and advice' },
      { id: 'Wellness', name: 'Wellness', description: 'Mental health and wellbeing' },
      { id: 'Repair', name: 'Repair', description: 'DIY and repair projects' },
      { id: 'General', name: 'General', description: 'General interest communities' }
    ];
  }

  /**
   * Check network connectivity and API availability
   * @returns {Promise<Object>} - Connection status
   */
  static async checkApiConnection() {
    try {
      const API_BASE_URL = getApiBaseUrl();
      console.log('🔍 Testing API connection to:', API_BASE_URL);

      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        timeout: 5000, // 5 second timeout
      });

      return {
        connected: response.ok,
        status: response.status,
        url: API_BASE_URL
      };

    } catch (error) {
      console.error('❌ API connection test failed:', error);
      return {
        connected: false,
        error: error.message,
        url: getApiBaseUrl()
      };
    }
  }
}

export default CommunityRequestService;