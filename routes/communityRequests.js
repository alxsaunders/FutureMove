// routes/communityRequests.js
// Updated to match your existing route pattern

module.exports = (pool, authenticateFirebaseToken) => {
  const express = require('express');
  const router = express.Router();

  /**
   * POST /api/community-requests
   * Submit a new community request
   */
  router.post('/', authenticateFirebaseToken, async (req, res) => {
    try {
      const { user_id, community_name, description, category } = req.body;
      
      // Validate required fields
      if (!user_id || !community_name || !description) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: user_id, community_name, description'
        });
      }

      // Validate field lengths
      if (community_name.length > 255) {
        return res.status(400).json({
          success: false,
          message: 'Community name must be less than 255 characters'
        });
      }

      if (description.length > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Description must be less than 1000 characters'
        });
      }

      // Check rate limiting (max 3 requests per day per user)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [rateLimitCheck] = await pool.execute(
        'SELECT COUNT(*) as count FROM community_requests WHERE user_id = ? AND created_at > ?',
        [user_id, oneDayAgo]
      );

      if (rateLimitCheck[0].count >= 3) {
        return res.status(429).json({
          success: false,
          message: 'Daily request limit exceeded. Maximum 3 requests per day.'
        });
      }

      // Check for duplicate requests (same name by same user in last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [duplicateCheck] = await pool.execute(
        'SELECT COUNT(*) as count FROM community_requests WHERE user_id = ? AND community_name = ? AND created_at > ?',
        [user_id, community_name, sevenDaysAgo]
      );

      if (duplicateCheck[0].count > 0) {
        return res.status(409).json({
          success: false,
          message: 'You have already requested this community recently.'
        });
      }

      // Insert the request
      const [result] = await pool.execute(
        `INSERT INTO community_requests 
         (user_id, community_name, description, category, status, created_at) 
         VALUES (?, ?, ?, ?, 'pending', NOW())`,
        [user_id, community_name, description, category || 'General']
      );

      // Log the request for admin review
      console.log(`📝 New community request submitted:`, {
        id: result.insertId,
        user_id,
        community_name,
        category: category || 'General'
      });

      res.status(201).json({
        success: true,
        data: {
          id: result.insertId,
          message: 'Community request submitted successfully'
        }
      });

    } catch (error) {
      console.error('❌ Error creating community request:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

  /**
   * GET /api/community-requests/user/:userId
   * Get all requests for a specific user
   */
  router.get('/user/:userId', authenticateFirebaseToken, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Ensure user can only access their own requests
      if (req.user.uid !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own requests.'
        });
      }

      const [requests] = await pool.execute(
        `SELECT id, community_name, description, category, status, 
                admin_notes, created_at, updated_at 
         FROM community_requests 
         WHERE user_id = ? 
         ORDER BY created_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        data: requests
      });

    } catch (error) {
      console.error('❌ Error fetching user requests:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

  /**
   * GET /api/community-requests/admin
   * Get all requests for admin review (admin only)
   */
  router.get('/admin', authenticateFirebaseToken, requireAdmin, async (req, res) => {
    try {
      const { status = 'pending', page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // Get requests with basic info (adjust based on your user table structure)
      const [requests] = await pool.execute(
        `SELECT cr.*, 
                cr.user_id as user_email,
                cr.user_id as user_name
         FROM community_requests cr
         WHERE cr.status = ?
         ORDER BY cr.created_at DESC
         LIMIT ? OFFSET ?`,
        [status, parseInt(limit), parseInt(offset)]
      );

      // Get total count for pagination
      const [countResult] = await pool.execute(
        'SELECT COUNT(*) as total FROM community_requests WHERE status = ?',
        [status]
      );

      res.json({
        success: true,
        data: {
          requests,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult[0].total,
            totalPages: Math.ceil(countResult[0].total / limit)
          }
        }
      });

    } catch (error) {
      console.error('❌ Error fetching admin requests:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

  /**
   * PUT /api/community-requests/:id/status
   * Update request status (admin only)
   */
  router.put('/:id/status', authenticateFirebaseToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, admin_notes } = req.body;

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be "approved" or "rejected".'
        });
      }

      const [result] = await pool.execute(
        `UPDATE community_requests 
         SET status = ?, admin_notes = ?, processed_by = ?, processed_at = NOW()
         WHERE id = ?`,
        [status, admin_notes || null, req.user.uid, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }

      // If approved, you might want to automatically create the community
      if (status === 'approved') {
        // await createCommunityFromRequest(id);
        console.log(`✅ Community request ${id} approved - consider auto-creating community`);
      }

      console.log(`📋 Community request ${id} ${status} by admin ${req.user.uid}`);

      res.json({
        success: true,
        message: `Request ${status} successfully`
      });

    } catch (error) {
      console.error('❌ Error updating request status:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

  /**
   * GET /api/community-requests/stats
   * Get request statistics (admin only)
   */
  router.get('/stats', authenticateFirebaseToken, requireAdmin, async (req, res) => {
    try {
      const [stats] = await pool.execute(`
        SELECT 
          status,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM community_requests 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY status, DATE(created_at)
        ORDER BY date DESC
      `);

      const [categoryStats] = await pool.execute(`
        SELECT 
          category,
          COUNT(*) as count
        FROM community_requests 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY category
        ORDER BY count DESC
      `);

      res.json({
        success: true,
        data: {
          statusStats: stats,
          categoryStats: categoryStats
        }
      });

    } catch (error) {
      console.error('❌ Error fetching stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

  /**
   * DELETE /api/community-requests/:id
   * Delete a community request (user can delete their own, admin can delete any)
   */
  router.delete('/:id', authenticateFirebaseToken, async (req, res) => {
    try {
      const { id } = req.params;
      
      // First, get the request to check ownership
      const [request] = await pool.execute(
        'SELECT user_id, status FROM community_requests WHERE id = ?',
        [id]
      );

      if (request.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }

      // Check if user owns the request or is admin
      const isOwner = request[0].user_id === req.user.uid;
      const isAdmin = req.user.isAdmin || false; // Adjust based on your admin logic

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only delete your own requests.'
        });
      }

      // Don't allow deletion of approved requests
      if (request[0].status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete approved requests'
        });
      }

      const [result] = await pool.execute(
        'DELETE FROM community_requests WHERE id = ?',
        [id]
      );

      res.json({
        success: true,
        message: 'Request deleted successfully'
      });

    } catch (error) {
      console.error('❌ Error deleting request:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

  // Middleware to check if user is admin
  function requireAdmin(req, res, next) {
    // Implement your admin check logic here
    // This could check Firebase custom claims, database table, etc.
    
    // Example: Check Firebase custom claims
    if (req.user.admin === true) {
      next();
      return;
    }

    // Example: Check if user is in admin list (simple approach)
    const adminUsers = ['admin@yourapp.com', 'admin_user_id']; // Replace with your admin identifiers
    if (adminUsers.includes(req.user.email) || adminUsers.includes(req.user.uid)) {
      req.user.isAdmin = true;
      next();
      return;
    }

    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  return router;
};