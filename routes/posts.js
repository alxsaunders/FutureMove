const express = require('express');
const router = express.Router();

// Helper functions
const handleError = (res, error, message = 'Server error') => {
  console.error(`${message}:`, error);
  res.status(500).json({ error: message, details: error.message });
};

module.exports = (pool, authenticateFirebaseToken) => {
  // Apply authentication middleware
  router.use(authenticateFirebaseToken);

  // GET - User's feed (posts from joined communities)
  router.get('/feed', async (req, res) => {
    try {
      const userId = req.user ? req.user.uid : req.query.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      // Get posts for the user's feed
      const [rows] = await pool.execute('CALL get_feed_posts(?)', [userId]);
      
      res.json(rows[0]);
    } catch (error) {
      handleError(res, error, 'Error fetching feed posts');
    }
  });

  // GET - Trending posts
  router.get('/trending', async (req, res) => {
    try {
      const userId = req.user ? req.user.uid : req.query.userId;
      const limit = parseInt(req.query.limit) || 10;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      // Get trending posts
      const [rows] = await pool.execute('CALL get_trending_posts(?, ?)', [limit, userId]);
      
      res.json(rows[0]);
    } catch (error) {
      handleError(res, error, 'Error fetching trending posts');
    }
  });

  // GET - Search posts
  router.get('/search', async (req, res) => {
    try {
      const query = req.query.q || '';
      const userId = req.user ? req.user.uid : req.query.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      if (!query) {
        return res.json([]);
      }
      
      const searchPattern = `%${query}%`;
      
      const [rows] = await pool.execute(
        `SELECT 
          p.post_id,
          p.community_id,
          c.name as community_name,
          p.user_id,
          u.username as user_name,
          u.profile_image as user_avatar,
          p.content,
          p.image_url,
          p.created_at,
          COUNT(DISTINCT pl_all.user_id) as likes_count,
          COUNT(DISTINCT com.comment_id) as comments_count,
          MAX(CASE WHEN pl_user.user_id IS NOT NULL THEN 1 ELSE 0 END) as is_liked
        FROM posts p
        JOIN communities c ON p.community_id = c.community_id
        JOIN users u ON p.user_id = u.user_id
        LEFT JOIN post_likes pl_all ON p.post_id = pl_all.post_id
        LEFT JOIN post_likes pl_user ON p.post_id = pl_user.post_id AND pl_user.user_id = ?
        LEFT JOIN comments com ON p.post_id = com.post_id
        WHERE p.content LIKE ?
        GROUP BY p.post_id, p.community_id, c.name, p.user_id, u.username, u.profile_image, p.content, p.image_url, p.created_at
        ORDER BY p.created_at DESC`,
        [userId, searchPattern]
      );
      
      res.json(rows);
    } catch (error) {
      handleError(res, error, 'Error searching posts');
    }
  });

  // GET - A single post by ID
  router.get('/:id', async (req, res) => {
    try {
      const postId = req.params.id;
      const userId = req.user ? req.user.uid : req.query.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      // Get post details
      const [rows] = await pool.execute(
        `SELECT 
          p.post_id,
          p.community_id,
          c.name as community_name,
          p.user_id,
          u.username as user_name,
          u.profile_image as user_avatar,
          p.content,
          p.image_url,
          p.created_at,
          COUNT(DISTINCT pl_all.user_id) as likes_count,
          COUNT(DISTINCT com.comment_id) as comments_count,
          MAX(CASE WHEN pl_user.user_id IS NOT NULL THEN 1 ELSE 0 END) as is_liked
        FROM posts p
        JOIN communities c ON p.community_id = c.community_id
        JOIN users u ON p.user_id = u.user_id
        LEFT JOIN post_likes pl_all ON p.post_id = pl_all.post_id
        LEFT JOIN post_likes pl_user ON p.post_id = pl_user.post_id AND pl_user.user_id = ?
        LEFT JOIN comments com ON p.post_id = com.post_id
        WHERE p.post_id = ?
        GROUP BY p.post_id, p.community_id, c.name, p.user_id, u.username, u.profile_image, p.content, p.image_url, p.created_at`,
        [userId, postId]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      res.json(rows[0]);
    } catch (error) {
      handleError(res, error, 'Error fetching post');
    }
  });

  // POST - Create a new post
  router.post('/', async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
      const { community_id, content, image_url } = req.body;
      const userId = req.user ? req.user.uid : req.body.user_id;
      
      if (!userId) {
        connection.release();
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      if (!community_id || !content) {
        connection.release();
        return res.status(400).json({ error: 'Community ID and content are required' });
      }
      
      await connection.beginTransaction();
      
      // Check if user exists
      const [userCheck] = await connection.execute(
        'SELECT COUNT(*) as count FROM users WHERE user_id = ?',
        [userId]
      );
      
      if (userCheck[0].count === 0) {
        // Create user if they don't exist
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
      
      // Check if community exists
      const [communityCheck] = await connection.execute(
        'SELECT COUNT(*) as count FROM communities WHERE community_id = ?',
        [community_id]
      );
      
      if (communityCheck[0].count === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: 'Community not found' });
      }
      
      // Create the post
      const [result] = await connection.execute(
        'INSERT INTO posts (community_id, user_id, content, image_url) VALUES (?, ?, ?, ?)',
        [community_id, userId, content, image_url || null]
      );
      
      const postId = result.insertId;
      
      // Get the created post with all details
      const [postRows] = await connection.execute(
        `SELECT 
          p.post_id,
          p.community_id,
          c.name as community_name,
          p.user_id,
          u.username as user_name,
          u.profile_image as user_avatar,
          p.content,
          p.image_url,
          p.created_at,
          0 as likes_count,
          0 as comments_count,
          0 as is_liked
        FROM posts p
        JOIN communities c ON p.community_id = c.community_id
        JOIN users u ON p.user_id = u.user_id
        WHERE p.post_id = ?`,
        [postId]
      );
      
      await connection.commit();
      
      res.status(201).json(postRows[0]);
    } catch (error) {
      await connection.rollback();
      handleError(res, error, 'Error creating post');
    } finally {
      connection.release();
    }
  });

  // PUT - Update a post
  router.put('/:id', async (req, res) => {
    try {
      const postId = req.params.id;
      const { content, image_url } = req.body;
      const userId = req.user ? req.user.uid : req.body.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      
      // Check if post exists and belongs to the user
      const [postRows] = await pool.execute(
        'SELECT user_id FROM posts WHERE post_id = ?',
        [postId]
      );
      
      if (postRows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      if (postRows[0].user_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to update this post' });
      }
      
      // Update the post
      await pool.execute(
        'UPDATE posts SET content = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE post_id = ?',
        [content, image_url || null, postId]
      );
      
      // Get the updated post with all details
      const [updatedRows] = await pool.execute(
        `SELECT 
          p.post_id,
          p.community_id,
          c.name as community_name,
          p.user_id,
          u.username as user_name,
          u.profile_image as user_avatar,
          p.content,
          p.image_url,
          p.created_at,
          p.updated_at,
          COUNT(DISTINCT pl.user_id) as likes_count,
          COUNT(DISTINCT com.comment_id) as comments_count,
          MAX(CASE WHEN pl_user.user_id IS NOT NULL THEN 1 ELSE 0 END) as is_liked
        FROM posts p
        JOIN communities c ON p.community_id = c.community_id
        JOIN users u ON p.user_id = u.user_id
        LEFT JOIN post_likes pl ON p.post_id = pl.post_id
        LEFT JOIN post_likes pl_user ON p.post_id = pl_user.post_id AND pl_user.user_id = ?
        LEFT JOIN comments com ON p.post_id = com.post_id
        WHERE p.post_id = ?
        GROUP BY p.post_id, p.community_id, c.name, p.user_id, u.username, u.profile_image, p.content, p.image_url, p.created_at, p.updated_at`,
        [userId, postId]
      );
      
      res.json(updatedRows[0]);
    } catch (error) {
      handleError(res, error, 'Error updating post');
    }
  });

  // DELETE - Delete a post
  router.delete('/:id', async (req, res) => {
    try {
      const postId = req.params.id;
      const userId = req.user ? req.user.uid : req.body.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      // Check if post exists and belongs to the user
      const [postRows] = await pool.execute(
        'SELECT user_id FROM posts WHERE post_id = ?',
        [postId]
      );
      
      if (postRows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      if (postRows[0].user_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to delete this post' });
      }
      
      // Delete the post (will cascade delete comments and likes via foreign keys)
      await pool.execute('DELETE FROM posts WHERE post_id = ?', [postId]);
      
      res.status(200).json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
      handleError(res, error, 'Error deleting post');
    }
  });

  // POST - Like a post
  router.post('/:id/like', async (req, res) => {
    try {
      const postId = req.params.id;
      const userId = req.user ? req.user.uid : req.body.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      // Check if post exists
      const [postRows] = await pool.execute(
        'SELECT post_id FROM posts WHERE post_id = ?',
        [postId]
      );
      
      if (postRows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      // Check if already liked
      const [likeRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM post_likes WHERE post_id = ? AND user_id = ?',
        [postId, userId]
      );
      
      if (likeRows[0].count > 0) {
        return res.status(200).json({ message: 'Post already liked' });
      }
      
      // Add the like
      await pool.execute(
        'INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)',
        [postId, userId]
      );
      
      res.status(200).json({ success: true, message: 'Post liked successfully' });
    } catch (error) {
      handleError(res, error, 'Error liking post');
    }
  });

  // POST - Unlike a post
  router.post('/:id/unlike', async (req, res) => {
    try {
      const postId = req.params.id;
      const userId = req.user ? req.user.uid : req.body.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      // Check if post exists
      const [postRows] = await pool.execute(
        'SELECT post_id FROM posts WHERE post_id = ?',
        [postId]
      );
      
      if (postRows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      // Check if liked
      const [likeRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM post_likes WHERE post_id = ? AND user_id = ?',
        [postId, userId]
      );
      
      if (likeRows[0].count === 0) {
        return res.status(200).json({ message: 'Post not liked' });
      }
      
      // Remove the like
      await pool.execute(
        'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?',
        [postId, userId]
      );
      
      res.status(200).json({ success: true, message: 'Post unliked successfully' });
    } catch (error) {
      handleError(res, error, 'Error unliking post');
    }
  });

  // GET - Comments for a post
  router.get('/:id/comments', async (req, res) => {
    try {
      const postId = req.params.id;
      const userId = req.user ? req.user.uid : req.query.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      // Check if post exists
      const [postRows] = await pool.execute(
        'SELECT post_id FROM posts WHERE post_id = ?',
        [postId]
      );
      
      if (postRows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      // Get comments for the post
      const [rows] = await pool.execute('CALL get_post_comments(?, ?)', [postId, userId]);
      
      res.json(rows[0]);
    } catch (error) {
      handleError(res, error, 'Error fetching comments');
    }
  });

  // POST - Create a comment on a post
  router.post('/:id/comments', async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
      const postId = req.params.id;
      const { content } = req.body;
      const userId = req.user ? req.user.uid : req.body.user_id;
      
      if (!userId) {
        connection.release();
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      if (!content) {
        connection.release();
        return res.status(400).json({ error: 'Content is required' });
      }
      
      await connection.beginTransaction();
      
      // Check if user exists
      const [userCheck] = await connection.execute(
        'SELECT COUNT(*) as count FROM users WHERE user_id = ?',
        [userId]
      );
      
      if (userCheck[0].count === 0) {
        // Create user if they don't exist
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
      
      // Check if post exists
      const [postCheck] = await connection.execute(
        'SELECT post_id FROM posts WHERE post_id = ?',
        [postId]
      );
      
      if (postCheck.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: 'Post not found' });
      }
      
      // Create the comment
      const [result] = await connection.execute(
        'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
        [postId, userId, content]
      );
      
      const commentId = result.insertId;
      
      // Get the created comment with user details
      const [rows] = await connection.execute(
        `SELECT 
          c.comment_id,
          c.post_id,
          c.user_id,
          u.username as user_name,
          u.profile_image as user_avatar,
          c.content,
          c.created_at,
          0 as likes_count,
          0 as is_liked
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
        WHERE c.comment_id = ?`,
        [commentId]
      );
      
      await connection.commit();
      
      res.status(201).json(rows[0]);
    } catch (error) {
      await connection.rollback();
      handleError(res, error, 'Error creating comment');
    } finally {
      connection.release();
    }
  });

  // POST - Report a post
  router.post('/:id/report', async (req, res) => {
    try {
      const postId = req.params.id;
      const { reason } = req.body;
      const userId = req.user ? req.user.uid : req.body.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      if (!reason) {
        return res.status(400).json({ error: 'Reason is required' });
      }
      
      // Check if post exists
      const [postRows] = await pool.execute(
        'SELECT post_id FROM posts WHERE post_id = ?',
        [postId]
      );
      
      if (postRows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      // Check if already reported
      const [reportRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM post_reports WHERE post_id = ? AND user_id = ?',
        [postId, userId]
      );
      
      if (reportRows[0].count > 0) {
        return res.status(200).json({ message: 'You have already reported this post' });
      }
      
      // Create the report
      await pool.execute(
        'INSERT INTO post_reports (post_id, user_id, reason) VALUES (?, ?, ?)',
        [postId, userId, reason]
      );
      
      res.status(201).json({ success: true, message: 'Post reported successfully' });
    } catch (error) {
      handleError(res, error, 'Error reporting post');
    }
  });

  return router;
};