// routes/profile.js
const express = require('express');

module.exports = (pool, authenticateFirebaseToken) => {
  const router = express.Router();

  // Middleware to verify user exists or create a basic user record
  const verifyOrCreateUser = async (req, res, next) => {
    try {
      const userId = req.params.userId || req.query.userId;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Check if user exists
      const [userCheck] = await pool.execute(
        `SELECT COUNT(*) as count FROM users WHERE user_id = ?`,
        [userId]
      );

      if (userCheck[0].count === 0) {
        // User doesn't exist, create a basic user record
        try {
          await pool.execute(
            `INSERT INTO users (user_id, username, name, email, level, xp_points, future_coins, created_at, commends)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              userId,
              userId.substring(0, 20),
              'User',
              `${userId}@example.com`,
              1, // Default level
              0, // Default XP
              100, // Default coins
              new Date(), // Current timestamp
              0 // Default commends
            ]
          );

          console.log(`Created user: ${userId} during profile access`);
        } catch (createError) {
          console.error('Error creating user during profile access:', createError);
          // Continue anyway to prevent blocking the request
        }
      }

      next();
    } catch (error) {
      console.error('Error in verifyOrCreateUser middleware:', error);
      next(error);
    }
  };

  // Get profile data
  router.get('/:userId', authenticateFirebaseToken, verifyOrCreateUser, async (req, res) => {
    try {
      const userId = req.params.userId;
      const currentUserId = req.query.userId || req.user?.uid;

      // Get user basic info
      const [userRows] = await pool.execute(
        `SELECT * FROM users WHERE user_id = ?`,
        [userId]
      );

      if (userRows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userData = userRows[0];

      // Get streak count
      let streakCount = 0;
      try {
        const [streakRows] = await pool.execute(
          `SELECT current_streak FROM streaks WHERE user_id = ? ORDER BY streak_id DESC LIMIT 1`,
          [userId]
        );
        streakCount = streakRows.length > 0 ? streakRows[0].current_streak : 0;
      } catch (streakError) {
        console.warn('Error fetching streak data:', streakError.message);
        // If table doesn't exist or other issue, use 0
      }

      // Get completed goals count
      let completedGoalsCount = 0;
      try {
        const [goalRows] = await pool.execute(
          `SELECT COUNT(*) as count FROM goals WHERE user_id = ? AND is_completed = 1`,
          [userId]
        );
        completedGoalsCount = goalRows[0].count;
      } catch (goalsError) {
        console.warn('Error fetching goals data:', goalsError.message);
        // If table doesn't exist or other issue, use 0
      }

      // Get community count (communities user is a member of)
      let communityCount = 0;
      try {
        const [communityRows] = await pool.execute(
          `SELECT COUNT(*) as count FROM community_members WHERE user_id = ?`,
          [userId]
        );
        communityCount = communityRows[0].count;
      } catch (communityError) {
        console.warn('Error fetching community count:', communityError.message);
        // If table doesn't exist yet, just use 0 as the count
      }

      // Get badge count (placeholder - you'll need to implement badges table)
      const badgeCount = 0; // Placeholder

      // Check if current user has commended this user
      let hasCommended = false;
      if (currentUserId) {
        try {
          const [commendRows] = await pool.execute(
            `SELECT COUNT(*) as count FROM user_commends 
             WHERE from_user_id = ? AND to_user_id = ?`,
            [currentUserId, userId]
          );
          hasCommended = commendRows[0].count > 0;
        } catch (commendError) {
          console.warn('Error checking commends:', commendError.message);
          // If table doesn't exist, just use false
        }
      }

      // Assemble extended profile data
      const profileData = {
        ...userData,
        streakCount: streakCount,
        badgeCount: badgeCount,
        completedGoalsCount: completedGoalsCount,
        communityCount: communityCount,
        hasCommended: hasCommended
      };

      res.json(profileData);
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });

  // Get user stats
  router.get('/:userId/stats', authenticateFirebaseToken, verifyOrCreateUser, async (req, res) => {
    try {
      const userId = req.params.userId;

      // Get total goals
      let totalGoals = 0;
      let completedGoals = 0;
      try {
        const [totalGoalsRows] = await pool.execute(
          `SELECT COUNT(*) as count FROM goals WHERE user_id = ?`,
          [userId]
        );
        totalGoals = totalGoalsRows[0].count;

        // Get completed goals
        const [completedGoalsRows] = await pool.execute(
          `SELECT COUNT(*) as count FROM goals WHERE user_id = ? AND is_completed = 1`,
          [userId]
        );
        completedGoals = completedGoalsRows[0].count;
      } catch (goalsError) {
        console.warn('Error fetching goals stats:', goalsError.message);
        // If table doesn't exist, use defaults
      }

      // Get streak data
      let currentStreak = 0;
      let longestStreak = 0;
      try {
        const [streakRows] = await pool.execute(
          `SELECT current_streak, longest_streak FROM streaks 
           WHERE user_id = ? ORDER BY streak_id DESC LIMIT 1`,
          [userId]
        );
        if (streakRows.length > 0) {
          currentStreak = streakRows[0].current_streak;
          longestStreak = streakRows[0].longest_streak;
        }
      } catch (streakError) {
        console.warn('Error fetching streak stats:', streakError.message);
        // If table doesn't exist, use defaults
      }

      // Get post count
      let postCount = 0;
      try {
        const [postRows] = await pool.execute(
          `SELECT COUNT(*) as count FROM posts WHERE user_id = ?`,
          [userId]
        );
        postCount = postRows[0].count;
      } catch (postError) {
        console.warn('Error fetching post count:', postError.message);
        // If table doesn't exist, use default
      }

      // Get comment count
      let commentCount = 0;
      try {
        const [commentRows] = await pool.execute(
          `SELECT COUNT(*) as count FROM comments WHERE user_id = ?`,
          [userId]
        );
        commentCount = commentRows[0].count;
      } catch (commentError) {
        console.warn('Error fetching comment count:', commentError.message);
        // If table doesn't exist, use default
      }

      const stats = {
        totalGoals: totalGoals,
        completedGoals: completedGoals,
        completionRate: totalGoals > 0
          ? Math.round((completedGoals / totalGoals) * 100)
          : 0,
        currentStreak: currentStreak,
        longestStreak: longestStreak,
        postCount: postCount,
        commentCount: commentCount
      };

      res.json(stats);
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });

  // Update profile image
  router.put('/:userId/profile-image', authenticateFirebaseToken, async (req, res) => {
    try {
      const userId = req.params.userId;
      const { imageUrl } = req.body;

      // Verify user is allowed to update this profile
      if (req.user && req.user.uid !== userId) {
        return res.status(403).json({ error: 'Unauthorized: Cannot update another user\'s profile' });
      }

      if (!imageUrl) {
        return res.status(400).json({ error: 'Image URL is required' });
      }

      // Update the profile image
      await pool.execute(
        `UPDATE users SET profile_image = ? WHERE user_id = ?`,
        [imageUrl, userId]
      );

      res.json({ success: true, message: 'Profile image updated successfully' });
    } catch (error) {
      console.error('Error updating profile image:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });

  // Update profile info
  router.put('/:userId', authenticateFirebaseToken, async (req, res) => {
    try {
      const userId = req.params.userId;
      const { name, username } = req.body;

      // Verify user is allowed to update this profile
      if (req.user && req.user.uid !== userId) {
        return res.status(403).json({ error: 'Unauthorized: Cannot update another user\'s profile' });
      }

      // Build update query based on provided fields
      let updateFields = '';
      const updateValues = [];

      if (name) {
        updateFields += 'name = ?';
        updateValues.push(name);
      }

      if (username) {
        if (updateFields) updateFields += ', ';
        updateFields += 'username = ?';
        updateValues.push(username);
      }

      // If nothing to update, return early
      if (!updateFields) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // Add userId to values array
      updateValues.push(userId);

      // Execute update
      await pool.execute(
        `UPDATE users SET ${updateFields} WHERE user_id = ?`,
        updateValues
      );

      // Get updated user data
      const [rows] = await pool.execute(
        `SELECT * FROM users WHERE user_id = ?`,
        [userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'User not found after update' });
      }

      res.json(rows[0]);
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });

  // Add commend to a user
  router.post('/:userId/commend', authenticateFirebaseToken, async (req, res) => {
    try {
      const toUserId = req.params.userId;
      const fromUserId = req.body.userId || req.user?.uid;

      if (!fromUserId) {
        return res.status(400).json({ error: 'From user ID is required' });
      }

      // Can't commend yourself
      if (fromUserId === toUserId) {
        return res.status(400).json({ error: 'Cannot commend yourself' });
      }

      // Check if user_commends table exists, create if it doesn't
      try {
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS user_commends (
            commend_id INT AUTO_INCREMENT PRIMARY KEY,
            from_user_id VARCHAR(255) NOT NULL,
            to_user_id VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_commend (from_user_id, to_user_id),
            FOREIGN KEY (from_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
            FOREIGN KEY (to_user_id) REFERENCES users(user_id) ON DELETE CASCADE
          )
        `);
      } catch (tableError) {
        console.error('Error creating user_commends table:', tableError);
        // Continue anyway
      }

      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        // Check if commend already exists
        const [checkRows] = await connection.execute(
          `SELECT COUNT(*) as count FROM user_commends 
           WHERE from_user_id = ? AND to_user_id = ?`,
          [fromUserId, toUserId]
        );

        if (checkRows[0].count > 0) {
          await connection.rollback();
          return res.status(400).json({
            error: 'Already commended this user',
            success: false
          });
        }

        // Add commend record
        await connection.execute(
          `INSERT INTO user_commends (from_user_id, to_user_id) VALUES (?, ?)`,
          [fromUserId, toUserId]
        );

        // Increment commend count
        await connection.execute(
          `UPDATE users SET commends = commends + 1 WHERE user_id = ?`,
          [toUserId]
        );

        // Get updated commend count
        const [countRows] = await connection.execute(
          `SELECT commends FROM users WHERE user_id = ?`,
          [toUserId]
        );

        await connection.commit();

        res.json({
          success: true,
          commends: countRows[0].commends
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error commending user:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message,
        success: false
      });
    }
  });

  // Remove commend from a user
  router.delete('/:userId/commend', authenticateFirebaseToken, async (req, res) => {
    try {
      const toUserId = req.params.userId;
      const fromUserId = req.query.userId || req.user?.uid;

      if (!fromUserId) {
        return res.status(400).json({ error: 'From user ID is required' });
      }

      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        // Check if commend exists
        const [checkRows] = await connection.execute(
          `SELECT COUNT(*) as count FROM user_commends 
           WHERE from_user_id = ? AND to_user_id = ?`,
          [fromUserId, toUserId]
        );

        if (checkRows[0].count === 0) {
          await connection.rollback();
          return res.status(400).json({
            error: 'No commend found to remove',
            success: false
          });
        }

        // Remove commend record
        await connection.execute(
          `DELETE FROM user_commends WHERE from_user_id = ? AND to_user_id = ?`,
          [fromUserId, toUserId]
        );

        // Decrement commend count
        await connection.execute(
          `UPDATE users SET commends = GREATEST(commends - 1, 0) WHERE user_id = ?`,
          [toUserId]
        );

        // Get updated commend count
        const [countRows] = await connection.execute(
          `SELECT commends FROM users WHERE user_id = ?`,
          [toUserId]
        );

        await connection.commit();

        res.json({
          success: true,
          commends: countRows[0].commends
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error removing commend:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message,
        success: false
      });
    }
  });

  // Get users who commended a specific user
  router.get('/:userId/commenders', authenticateFirebaseToken, verifyOrCreateUser, async (req, res) => {
    try {
      const userId = req.params.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      // Check if table exists
      try {
        // Get commenders with pagination
        const [commenderRows] = await pool.execute(
          `SELECT u.user_id, u.username, u.name, u.profile_image, uc.created_at
           FROM user_commends uc
           JOIN users u ON uc.from_user_id = u.user_id
           WHERE uc.to_user_id = ?
           ORDER BY uc.created_at DESC
           LIMIT ? OFFSET ?`,
          [userId, limit, offset]
        );

        // Get total count for pagination
        const [countRows] = await pool.execute(
          `SELECT COUNT(*) as total FROM user_commends WHERE to_user_id = ?`,
          [userId]
        );

        const totalCommenders = countRows[0].total;
        const totalPages = Math.ceil(totalCommenders / limit);

        res.json({
          commenders: commenderRows,
          pagination: {
            total: totalCommenders,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        });
      } catch (tableError) {
        // If table doesn't exist or other error
        console.warn('Error with commenders query:', tableError.message);
        res.json({
          commenders: [],
          pagination: {
            total: 0,
            page: 1,
            limit,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          }
        });
      }
    } catch (error) {
      console.error('Error fetching commenders:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });

  // Get user badges (placeholder - you'll need to implement badges table)
  router.get('/:userId/badges', authenticateFirebaseToken, verifyOrCreateUser, async (req, res) => {
    try {
      // This is a placeholder implementation until you create a badges system
      res.json([
        // Example badge format for frontend to use
        /*
        {
          id: 1,
          name: 'Goal Achiever',
          description: 'Completed 5 goals',
          icon: 'https://example.com/badges/goal-achiever.png',
          earned_at: '2024-05-01T12:00:00Z'
        }
        */
      ]);
    } catch (error) {
      console.error('Error fetching badges:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });

  // Get user goals
  router.get('/:userId/goals', authenticateFirebaseToken, verifyOrCreateUser, async (req, res) => {
    try {
      const userId = req.params.userId;
      const includeCompleted = req.query.includeCompleted === 'true';

      try {
        // Build query based on whether to include completed goals
        let query = `SELECT * FROM goals WHERE user_id = ?`;
        const queryParams = [userId];

        if (!includeCompleted) {
          query += ` AND is_completed = 0`;
        }

        query += ` ORDER BY target_date ASC`;

        const [rows] = await pool.execute(query, queryParams);

        // Transform the database rows to match the frontend Goal type
        const goals = rows.map(goal => ({
          id: goal.goal_id,
          title: goal.title,
          description: goal.description,
          category: goal.category,
          isCompleted: goal.is_completed === 1,
          isDaily: goal.is_daily === 1,
          progress: goal.progress,
          startDate: goal.target_date ? new Date(goal.target_date).toISOString().split('T')[0] : null,
          userId: goal.user_id,
          coinReward: goal.coin_reward,
          routineDays: goal.routine_days ? JSON.parse(goal.routine_days) : [],
          type: goal.is_daily === 1 ? 'recurring' : 'one-time',
          targetDate: goal.target_date ? new Date(goal.target_date).toISOString().split('T')[0] : null
        }));

        res.json(goals);
      } catch (goalsError) {
        console.warn('Error fetching goals:', goalsError.message);
        // If table doesn't exist or other error
        res.json([]);
      }
    } catch (error) {
      console.error('Error fetching user goals:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });

  return router;
};