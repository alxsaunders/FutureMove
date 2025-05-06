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

  // PUT - Update a comment
  router.put('/:id', async (req, res) => {
    try {
      const commentId = req.params.id;
      const { content } = req.body;
      const userId = req.user ? req.user.uid : req.body.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      
      // Check if comment exists and belongs to the user
      const [commentRows] = await pool.execute(
        'SELECT user_id FROM comments WHERE comment_id = ?',
        [commentId]
      );
      
      if (commentRows.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      if (commentRows[0].user_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to update this comment' });
      }
      
      // Update the comment
      await pool.execute(
        'UPDATE comments SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE comment_id = ?',
        [content, commentId]
      );
      
      // Get the updated comment with user details
      const [rows] = await pool.execute(
        `SELECT 
          c.comment_id,
          c.post_id,
          c.user_id,
          u.username as user_name,
          u.profile_image as user_avatar,
          c.content,
          c.created_at,
          c.updated_at,
          COUNT(DISTINCT cl.user_id) as likes_count,
          MAX(CASE WHEN cl_user.user_id IS NOT NULL THEN 1 ELSE 0 END) as is_liked
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
        LEFT JOIN comment_likes cl ON c.comment_id = cl.comment_id
        LEFT JOIN comment_likes cl_user ON c.comment_id = cl_user.comment_id AND cl_user.user_id = ?
        WHERE c.comment_id = ?
        GROUP BY c.comment_id, c.post_id, c.user_id, u.username, u.profile_image, c.content, c.created_at, c.updated_at`,
        [userId, commentId]
      );
      
      res.json(rows[0]);
    } catch (error) {
      handleError(res, error, 'Error updating comment');
    }
  });

  // DELETE - Delete a comment
  router.delete('/:id', async (req, res) => {
    try {
      const commentId = req.params.id;
      const userId = req.user ? req.user.uid : req.body.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      // Check if comment exists and belongs to the user
      const [commentRows] = await pool.execute(
        'SELECT user_id FROM comments WHERE comment_id = ?',
        [commentId]
      );
      
      if (commentRows.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      if (commentRows[0].user_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to delete this comment' });
      }
      
      // Delete the comment (will cascade delete likes via foreign keys)
      await pool.execute('DELETE FROM comments WHERE comment_id = ?', [commentId]);
      
      res.status(200).json({ success: true, message: 'Comment deleted successfully' });
    } catch (error) {
      handleError(res, error, 'Error deleting comment');
    }
  });

  // POST - Like a comment
  router.post('/:id/like', async (req, res) => {
    try {
      const commentId = req.params.id;
      const userId = req.user ? req.user.uid : req.body.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      // Check if comment exists
      const [commentRows] = await pool.execute(
        'SELECT comment_id FROM comments WHERE comment_id = ?',
        [commentId]
      );
      
      if (commentRows.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      // Check if already liked
      const [likeRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ? AND user_id = ?',
        [commentId, userId]
      );
      
      if (likeRows[0].count > 0) {
        return res.status(200).json({ message: 'Comment already liked' });
      }
      
      // Add the like
      await pool.execute(
        'INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)',
        [commentId, userId]
      );
      
      res.status(200).json({ success: true, message: 'Comment liked successfully' });
    } catch (error) {
      handleError(res, error, 'Error liking comment');
    }
  });

  // POST - Unlike a comment
  router.post('/:id/unlike', async (req, res) => {
    try {
      const commentId = req.params.id;
      const userId = req.user ? req.user.uid : req.body.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      // Check if comment exists
      const [commentRows] = await pool.execute(
        'SELECT comment_id FROM comments WHERE comment_id = ?',
        [commentId]
      );
      
      if (commentRows.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      // Check if liked
      const [likeRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ? AND user_id = ?',
        [commentId, userId]
      );
      
      if (likeRows[0].count === 0) {
        return res.status(200).json({ message: 'Comment not liked' });
      }
      
      // Remove the like
      await pool.execute(
        'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?',
        [commentId, userId]
      );
      
      res.status(200).json({ success: true, message: 'Comment unliked successfully' });
    } catch (error) {
      handleError(res, error, 'Error unliking comment');
    }
  });

  // POST - Report a comment
  router.post('/:id/report', async (req, res) => {
    try {
      const commentId = req.params.id;
      const { reason } = req.body;
      const userId = req.user ? req.user.uid : req.body.userId;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      if (!reason) {
        return res.status(400).json({ error: 'Reason is required' });
      }
      
      // Check if comment exists
      const [commentRows] = await pool.execute(
        'SELECT comment_id FROM comments WHERE comment_id = ?',
        [commentId]
      );
      
      if (commentRows.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      // Check if already reported
      const [reportRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM comment_reports WHERE comment_id = ? AND user_id = ?',
        [commentId, userId]
      );
      
      if (reportRows[0].count > 0) {
        return res.status(200).json({ message: 'You have already reported this comment' });
      }
      
      // Create the report
      await pool.execute(
        'INSERT INTO comment_reports (comment_id, user_id, reason) VALUES (?, ?, ?)',
        [commentId, userId, reason]
      );
      
      res.status(201).json({ success: true, message: 'Comment reported successfully' });
    } catch (error) {
      handleError(res, error, 'Error reporting comment');
    }
  });

  return router;
};