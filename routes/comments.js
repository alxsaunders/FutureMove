const express = require('express');
const router = express.Router();

// Helper functions
const handleError = (res, error, message = 'Server error') => {
  console.error(`${message}:`, error);
  res.status(500).json({ error: message, details: error.message, success: false });
};

module.exports = (pool, authenticateFirebaseToken) => {
  // Apply authentication middleware
  router.use(authenticateFirebaseToken);

  // GET all communities with membership status for the current user
  router.get('/', async (req, res) => {
    try {
      const userId = req.user ? req.user.uid : req.query.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', success: false });
      }
      
      const [rows] = await pool.execute('CALL get_communities_with_membership(?)', [userId]);
      
      res.json(rows[0]);
    } catch (error) {
      handleError(res, error, 'Error fetching communities');
    }
  });

  // GET a single community by ID
  router.get('/:id', async (req, res) => {
    try {
      const communityId = req.params.id;
      const userId = req.user ? req.user.uid : req.query.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', success: false });
      }
      
      const [communityRows] = await pool.execute(
        `SELECT 
          c.community_id,
          c.name,
          c.description,
          c.category,
          c.image_url,
          c.created_by,
          COUNT(DISTINCT cm.user_id) as members_count,
          COUNT(DISTINCT p.post_id) as posts_count,
          MAX(CASE WHEN cm_user.user_id IS NOT NULL THEN 1 ELSE 0 END) as is_joined
        FROM communities c
        LEFT JOIN community_members cm ON c.community_id = cm.community_id
        LEFT JOIN community_members cm_user ON c.community_id = cm_user.community_id AND cm_user.user_id = ?
        LEFT JOIN posts p ON c.community_id = p.community_id
        WHERE c.community_id = ?
        GROUP BY c.community_id, c.name, c.description, c.category, c.image_url, c.created_by`,
        [userId, communityId]
      );

      if (communityRows.length === 0) {
        return res.status(404).json({ error: 'Community not found', success: false });
      }

      res.json(communityRows[0]);
    } catch (error) {
      handleError(res, error, 'Error fetching community');
    }
  });

  // POST - Create a new community
  router.post('/', async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
      const { name, description, category, image_url } = req.body;
      const userId = req.user ? req.user.uid : req.body.created_by;
      
      if (!userId) {
        connection.release();
        return res.status(400).json({ error: 'User ID is required', success: false });
      }
      
      if (!name || !category) {
        connection.release();
        return res.status(400).json({ error: 'Name and category are required', success: false });
      }
      
      await connection.beginTransaction();
      
      // Check if user exists
      const [userCheck] = await connection.execute(
        'SELECT COUNT(*) as count FROM users WHERE user_id = ?',
        [userId]
      );
      
      if (userCheck[0].count === 0) {
        // Create new user
        await connection.execute(
          `INSERT INTO users (user_id, username, name, email, profile_image, level, xp_points, future_coins, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId, 
            userId.substring(0, 20),
            'User',
            `${userId}@example.com`,
            null,
            1, 0, 0, new Date()
          ]
        );
      }
      
      // Create the community
      const [result] = await connection.execute(
        'INSERT INTO communities (name, description, category, image_url, created_by) VALUES (?, ?, ?, ?, ?)',
        [name, description || '', category, image_url || null, userId]
      );
      
      const communityId = result.insertId;
      
      // Add the creator as a member
      await connection.execute(
        'INSERT INTO community_members (community_id, user_id) VALUES (?, ?)',
        [communityId, userId]
      );
      
      // Get the created community
      const [communityRows] = await connection.execute(
        `SELECT 
          c.community_id,
          c.name,
          c.description,
          c.category,
          c.image_url,
          c.created_by,
          1 as members_count,
          0 as posts_count,
          1 as is_joined
        FROM communities c
        WHERE c.community_id = ?`,
        [communityId]
      );
      
      await connection.commit();
      
      res.status(201).json({ ...communityRows[0], success: true });
    } catch (error) {
      await connection.rollback();
      handleError(res, error, 'Error creating community');
    } finally {
      connection.release();
    }
  });

  // POST - Join a community
  router.post('/:id/join', async (req, res) => {
    try {
      const communityId = req.params.id;
      const userId = req.user ? req.user.uid : req.body.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', success: false });
      }
      
      // Check if community exists
      const [communityRows] = await pool.execute(
        'SELECT community_id FROM communities WHERE community_id = ?',
        [communityId]
      );
      
      if (communityRows.length === 0) {
        return res.status(404).json({ error: 'Community not found', success: false });
      }
      
      // Check if already a member
      const [memberRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM community_members WHERE community_id = ? AND user_id = ?',
        [communityId, userId]
      );
      
      if (memberRows[0].count > 0) {
        return res.status(200).json({ message: 'Already a member of this community', success: true });
      }
      
      // Join the community
      await pool.execute(
        'INSERT INTO community_members (community_id, user_id) VALUES (?, ?)',
        [communityId, userId]
      );
      
      res.status(200).json({ success: true, message: 'Successfully joined community' });
    } catch (error) {
      handleError(res, error, 'Error joining community');
    }
  });

  // POST - Leave a community
  router.post('/:id/leave', async (req, res) => {
    try {
      const communityId = req.params.id;
      const userId = req.user ? req.user.uid : req.body.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', success: false });
      }
      
      // Check if community exists
      const [communityRows] = await pool.execute(
        'SELECT community_id FROM communities WHERE community_id = ?',
        [communityId]
      );
      
      if (communityRows.length === 0) {
        return res.status(404).json({ error: 'Community not found', success: false });
      }
      
      // Check if user is a member
      const [memberRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM community_members WHERE community_id = ? AND user_id = ?',
        [communityId, userId]
      );
      
      if (memberRows[0].count === 0) {
        return res.status(200).json({ message: 'Not a member of this community', success: true });
      }
      
      // Leave the community
      await pool.execute(
        'DELETE FROM community_members WHERE community_id = ? AND user_id = ?',
        [communityId, userId]
      );
      
      res.status(200).json({ success: true, message: 'Successfully left community' });
    } catch (error) {
      handleError(res, error, 'Error leaving community');
    }
  });

  // GET - Search communities
  router.get('/search', async (req, res) => {
    try {
      const query = req.query.q || '';
      const userId = req.user ? req.user.uid : req.query.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', success: false });
      }
      
      if (!query) {
        return res.json([]);
      }
      
      const searchPattern = `%${query}%`;
      
      const [rows] = await pool.execute(
        `SELECT 
          c.community_id,
          c.name,
          c.description,
          c.category,
          c.image_url,
          c.created_by,
          COUNT(DISTINCT cm.user_id) as members_count,
          COUNT(DISTINCT p.post_id) as posts_count,
          CASE WHEN cm_user.user_id IS NOT NULL THEN 1 ELSE 0 END as is_joined
        FROM communities c
        LEFT JOIN community_members cm ON c.community_id = cm.community_id
        LEFT JOIN community_members cm_user ON c.community_id = cm_user.community_id AND cm_user.user_id = ?
        LEFT JOIN posts p ON c.community_id = p.community_id
        WHERE c.name LIKE ? OR c.description LIKE ?
        GROUP BY c.community_id
        ORDER BY c.name`,
        [userId, searchPattern, searchPattern]
      );
      
      res.json(rows);
    } catch (error) {
      handleError(res, error, 'Error searching communities');
    }
  });

  // GET - Fetch all posts for a community
  router.get('/:id/posts', async (req, res) => {
    try {
      const communityId = req.params.id;
      const userId = req.user ? req.user.uid : req.query.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', success: false });
      }
      
      // Check if community exists
      const [communityRows] = await pool.execute(
        'SELECT community_id FROM communities WHERE community_id = ?',
        [communityId]
      );
      
      if (communityRows.length === 0) {
        return res.status(404).json({ error: 'Community not found', success: false });
      }
      
      // Get posts for the community
      const [rows] = await pool.execute('CALL get_community_posts(?, ?)', [communityId, userId]);
      
      res.json(rows[0]);
    } catch (error) {
      handleError(res, error, 'Error fetching community posts');
    }
  });

  // GET - Fetch all joined communities for a user
  router.get('/user/:userId/joined', async (req, res) => {
    try {
      const userId = req.params.userId;
      
      // Check for authentication
      if (req.user && req.user.uid !== userId) {
        return res.status(403).json({ error: 'Unauthorized access', success: false });
      }
      
      // Get joined communities
      const [rows] = await pool.execute('CALL get_user_joined_communities(?)', [userId]);
      
      res.json(rows[0]);
    } catch (error) {
      handleError(res, error, 'Error fetching joined communities');
    }
  });

  return router;
};