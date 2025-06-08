// routes/profile.js - Updated with Achievement Badges Support and Command Feature
const express = require('express');

module.exports = (pool, authenticateFirebaseToken) => {
  const router = express.Router();

  // Achievement titles mapping (same as in achievements.js)
  const ACHIEVEMENT_TITLES = {
    Personal: {
      7: "Personal Pioneer",
      14: "Self Sovereign", 
      30: "Identity Architect",
      90: "Legendary Life Curator",
    },
    Work: {
      7: "Productivity Prodigy",
      14: "Workflow Wizard",
      30: "Career Cornerstone", 
      90: "Executive Excellence",
    },
    Learning: {
      7: "Knowledge Seeker",
      14: "Wisdom Weaver",
      30: "Skill Sculptor",
      90: "Grand Scholar",
    },
    Health: {
      7: "Vitality Voyager",
      14: "Wellness Warrior",
      30: "Health Harmonizer",
      90: "Peak Performance Paragon",
    },
    Repair: {
      7: "Fixer Fledgling",
      14: "Restoration Ranger",
      30: "Mending Master",
      90: "Legendary Rebuilder",
    },
    Finance: {
      7: "Fiscal Foundling",
      14: "Wealth Warden",
      30: "Money Maestro",
      90: "Fortune Forger",
    },
  };

  // Helper function to get achievement badge info
  const getAchievementBadgeInfo = (category, milestone) => {
    const title = ACHIEVEMENT_TITLES[category]?.[milestone] || `${category} Achievement`;
    const badgeImageName = title.replace(/\s+/g, '_') + '_Badge';
    
    return {
      id: `badge_${category.toLowerCase()}_${milestone}`,
      name: title,
      description: `Complete ${milestone} goals in ${category}`,
      category: category,
      milestone: milestone,
      icon: badgeImageName, // This will be mapped to actual image in frontend
      type: 'achievement'
    };
  };

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

      // Ensure we have a current user ID for proper authentication context
      if (!currentUserId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      console.log(`[PROFILE] Fetching profile for ${userId}, requested by ${currentUserId}`);

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

      // ✅ NEW: Get badge count from user achievements
      let badgeCount = 0;
      try {
        const [badgeRows] = await pool.execute(
          `SELECT COUNT(*) as count FROM user_achievements WHERE user_id = ?`,
          [userId]
        );
        badgeCount = badgeRows[0].count;
      } catch (badgeError) {
        console.warn('Error fetching badge count:', badgeError.message);
        // If table doesn't exist, use 0
      }

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
        badgeCount: badgeCount, // ✅ Now returns actual badge count
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
      const { name, username, bio, location, website } = req.body;

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

      // Add the new fields
      if (bio) {
        if (updateFields) updateFields += ', ';
        updateFields += 'bio = ?';
        updateValues.push(bio);
      }

      if (location) {
        if (updateFields) updateFields += ', ';
        updateFields += 'location = ?';
        updateValues.push(location);
      }

      if (website) {
        if (updateFields) updateFields += ', ';
        updateFields += 'website = ?';
        updateValues.push(website);
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

  // Send command to a user
  router.post('/:userId/commands', authenticateFirebaseToken, async (req, res) => {
    try {
      const toUserId = req.params.userId;
      const { command, fromUserId } = req.body;
      const authenticatedUserId = req.user?.uid;

      // Use the authenticated user ID or the provided fromUserId
      const actualFromUserId = authenticatedUserId || fromUserId;

      if (!actualFromUserId) {
        return res.status(400).json({ error: 'From user ID is required' });
      }

      if (!command || command.trim().length === 0) {
        return res.status(400).json({ error: 'Command text is required' });
      }

      if (command.length > 280) {
        return res.status(400).json({ error: 'Command text too long (max 280 characters)' });
      }

      if (actualFromUserId === toUserId) {
        return res.status(400).json({ error: 'Cannot send command to yourself' });
      }

      // Check if target user exists
      const [targetUser] = await pool.execute(
        'SELECT user_id, name FROM users WHERE user_id = ?',
        [toUserId]
      );

      if (targetUser.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Create user_commands table if it doesn't exist
      try {
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS user_commands (
            id INT AUTO_INCREMENT PRIMARY KEY,
            from_user_id VARCHAR(255) NOT NULL,
            to_user_id VARCHAR(255) NOT NULL,
            command_text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_read BOOLEAN DEFAULT FALSE,
            INDEX idx_to_user_created (to_user_id, created_at),
            INDEX idx_from_user_created (from_user_id, created_at),
            FOREIGN KEY (from_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
            FOREIGN KEY (to_user_id) REFERENCES users(user_id) ON DELETE CASCADE
          )
        `);
      } catch (tableError) {
        console.error('Error creating user_commands table:', tableError);
        // Continue anyway
      }

      // Insert the command into database
      const [result] = await pool.execute(
        `INSERT INTO user_commands (
          from_user_id, 
          to_user_id, 
          command_text, 
          created_at,
          is_read
        ) VALUES (?, ?, ?, NOW(), FALSE)`,
        [actualFromUserId, toUserId, command.trim()]
      );

      // Optional: Create activity log entry
      try {
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS activity_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            action_type VARCHAR(100) NOT NULL,
            target_user_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
          )
        `);
        
        await pool.execute(
          `INSERT INTO activity_logs (
            user_id, 
            action_type, 
            target_user_id, 
            created_at
          ) VALUES (?, 'sent_command', ?, NOW())`,
          [actualFromUserId, toUserId]
        );
      } catch (activityError) {
        console.warn('Could not log activity:', activityError.message);
        // Continue without activity logging
      }

      res.json({
        success: true,
        message: 'Command sent successfully',
        commandId: result.insertId
      });

    } catch (error) {
      console.error('Error sending command:', error);
      res.status(500).json({ 
        error: 'Internal server error', 
        details: error.message,
        success: false
      });
    }
  });

  // Get commands for the authenticated user
  router.get('/commands', authenticateFirebaseToken, async (req, res) => {
    try {
      const userId = req.user?.uid;
      const { limit = 20, offset = 0 } = req.query;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      try {
        const [commands] = await pool.execute(
          `SELECT 
            uc.id,
            uc.command_text,
            uc.created_at,
            uc.is_read,
            u.user_id as from_user_id,
            u.name as from_user_name,
            u.username as from_user_username,
            u.profile_image as from_user_image
          FROM user_commands uc
          JOIN users u ON uc.from_user_id = u.user_id
          WHERE uc.to_user_id = ?
          ORDER BY uc.created_at DESC
          LIMIT ? OFFSET ?`,
          [userId, parseInt(limit), parseInt(offset)]
        );

        res.json({
          commands,
          total: commands.length
        });
      } catch (tableError) {
        console.warn('Error fetching commands:', tableError.message);
        // If table doesn't exist yet
        res.json({
          commands: [],
          total: 0
        });
      }

    } catch (error) {
      console.error('Error fetching commands:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Mark command as read
  router.patch('/commands/:commandId/read', authenticateFirebaseToken, async (req, res) => {
    try {
      const { commandId } = req.params;
      const userId = req.user?.uid;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      try {
        // Update command to mark as read (only if it belongs to the user)
        const [result] = await pool.execute(
          `UPDATE user_commands 
           SET is_read = TRUE 
           WHERE id = ? AND to_user_id = ?`,
          [commandId, userId]
        );

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Command not found' });
        }

        res.json({ success: true, message: 'Command marked as read' });
      } catch (tableError) {
        console.warn('Error marking command as read:', tableError.message);
        res.status(404).json({ error: 'Command not found' });
      }

    } catch (error) {
      console.error('Error marking command as read:', error);
      res.status(500).json({ error: 'Internal server error' });
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

  // ✅ UPDATED: Get user achievement badges
  router.get('/:userId/badges', authenticateFirebaseToken, verifyOrCreateUser, async (req, res) => {
    try {
      const userId = req.params.userId;

      console.log(`[PROFILE BADGES] Fetching badges for user: ${userId}`);

      // Get user's unlocked achievements from user_achievements table
      try {
        const [achievementRows] = await pool.execute(
          `SELECT 
            ua.category, 
            ua.milestone, 
            ua.title, 
            ua.unlocked_at,
            ua.achievement_id
           FROM user_achievements ua
           WHERE ua.user_id = ?
           ORDER BY ua.unlocked_at DESC`,
          [userId]
        );

        console.log(`[PROFILE BADGES] Found ${achievementRows.length} achievements for user ${userId}`);

        // Transform achievements into badge format
        const badges = achievementRows.map(achievement => {
          const badgeInfo = getAchievementBadgeInfo(achievement.category, achievement.milestone);
          
          return {
            id: badgeInfo.id,
            name: achievement.title || badgeInfo.name,
            description: badgeInfo.description,
            category: achievement.category,
            milestone: achievement.milestone,
            icon: badgeInfo.icon, // Frontend will map this to actual image
            type: 'achievement',
            earned_at: achievement.unlocked_at,
            achievement_id: achievement.achievement_id
          };
        });

        console.log(`[PROFILE BADGES] Returning ${badges.length} badges`);
        res.json(badges);

      } catch (achievementError) {
        console.warn('Error fetching achievement badges:', achievementError.message);
        
        // If user_achievements table doesn't exist yet, return empty array
        res.json([]);
      }

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