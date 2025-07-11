// routes/achievements.js - Complete updated version with badge check functionality
const express = require('express');
const router = express.Router();

// Helper functions
const handleError = (res, error, message = 'Server error') => {
  console.error(`${message}:`, error);
  res.status(500).json({ error: message, details: error.message, success: false });
};

module.exports = (pool, authenticateFirebaseToken) => {
  // Apply authentication middleware to all routes
  router.use(authenticateFirebaseToken);

  // Achievement categories and milestones
  const ACHIEVEMENT_CATEGORIES = ['Personal', 'Work', 'Learning', 'Health', 'Repair', 'Finance'];
  const ACHIEVEMENT_MILESTONES = [7, 14, 30, 90];

  // Achievement titles mapping - Epic titles as specified
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

  // Helper function to get achievement data
  const getAchievementInfo = (category, milestone) => {
    const title = ACHIEVEMENT_TITLES[category]?.[milestone] || `${category} Achievement`;
    
    return {
      id: `${category.toLowerCase()}_${milestone}`,
      category,
      milestone,
      title,
      description: `Complete ${milestone} goals in ${category}`,
      imageName: title.replace(/\s+/g, '_'), // Convert title to filename format
    };
  };

  // GET /api/achievements/test - Test endpoint to verify routes are working
  router.get('/test', (req, res) => {
    res.json({ 
      message: 'Achievement routes are working!', 
      categories: ACHIEVEMENT_CATEGORIES,
      milestones: ACHIEVEMENT_MILESTONES,
      user: req.user ? req.user.uid : 'No user authenticated',
      success: true
    });
  });

  // ✅ NEW ENDPOINT: Check if user has a specific achievement
  router.get('/users/:userId/achievements/has', async (req, res) => {
    try {
      const { userId } = req.params;
      const { category, milestone } = req.query;

      // Check authorization
      if (req.user && req.user.uid !== userId) {
        return res.status(403).json({ error: 'Unauthorized access', success: false });
      }

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', success: false });
      }

      if (!category || !milestone) {
        return res.status(400).json({ error: 'Category and milestone are required', success: false });
      }

      console.log(`[HAS ACHIEVEMENT] Checking if user ${userId} has achievement: ${category} ${milestone}`);

      // Check if user already has this specific achievement in the database
      const hasAchievementQuery = `
        SELECT COUNT(*) as count 
        FROM user_achievements 
        WHERE user_id = ? 
          AND category = ? 
          AND milestone = ?
          AND unlocked_at IS NOT NULL
      `;

      const [result] = await pool.execute(hasAchievementQuery, [userId, category, parseInt(milestone)]);
      const hasAchievement = result[0].count > 0;

      console.log(`[HAS ACHIEVEMENT] User ${userId} ${hasAchievement ? 'HAS' : 'DOES NOT HAVE'} achievement: ${category} ${milestone}`);

      res.json({
        hasAchievement,
        userId,
        category,
        milestone: parseInt(milestone),
        success: true
      });

    } catch (error) {
      handleError(res, error, 'Error checking if user has achievement');
    }
  });

  // ✅ NEW ENDPOINT: Unlock a specific achievement for a user
  router.post('/users/:userId/achievements/unlock', async (req, res) => {
    try {
      const { userId } = req.params;
      const { category, milestone } = req.body;

      // Check authorization
      if (req.user && req.user.uid !== userId) {
        return res.status(403).json({ error: 'Unauthorized access', success: false });
      }

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', success: false });
      }

      if (!category || !milestone) {
        return res.status(400).json({ error: 'Category and milestone are required', success: false });
      }

      if (!ACHIEVEMENT_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'Invalid category', success: false });
      }

      if (!ACHIEVEMENT_MILESTONES.includes(milestone)) {
        return res.status(400).json({ error: 'Invalid milestone', success: false });
      }

      console.log(`[UNLOCK ACHIEVEMENT] Unlocking achievement for user ${userId}: ${category} ${milestone}`);

      // Check if user already has this achievement
      const existingQuery = `
        SELECT id FROM user_achievements 
        WHERE user_id = ? AND category = ? AND milestone = ?
      `;

      const [existing] = await pool.execute(existingQuery, [userId, category, milestone]);

      if (existing.length > 0) {
        console.log(`[UNLOCK ACHIEVEMENT] User ${userId} already has achievement: ${category} ${milestone}`);
        return res.json({
          success: true,
          message: 'Achievement already unlocked',
          alreadyUnlocked: true
        });
      }

      // Verify user qualifies for this achievement
      const completedGoalsQuery = `
        SELECT COUNT(*) as count 
        FROM goals 
        WHERE user_id = ? 
          AND category = ? 
          AND progress = 100
      `;

      const [completedResult] = await pool.execute(completedGoalsQuery, [userId, category]);
      const completedGoals = completedResult[0].count;

      if (completedGoals < milestone) {
        console.log(`[UNLOCK ACHIEVEMENT] User ${userId} does not qualify for ${category} ${milestone} (${completedGoals} < ${milestone})`);
        return res.status(400).json({
          error: 'User does not qualify for this achievement',
          completedGoals,
          requiredGoals: milestone,
          success: false
        });
      }

      // Get achievement info
      const achievementInfo = getAchievementInfo(category, milestone);

      // Insert the achievement
      const insertQuery = `
        INSERT INTO user_achievements (user_id, category, milestone, achievement_id, title, unlocked_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `;

      await pool.execute(insertQuery, [
        userId,
        category,
        milestone,
        achievementInfo.id,
        achievementInfo.title
      ]);

      console.log(`[UNLOCK ACHIEVEMENT] ✅ Successfully unlocked achievement: ${achievementInfo.title} for user ${userId}`);

      res.json({
        success: true,
        message: 'Achievement unlocked successfully',
        achievement: {
          ...achievementInfo,
          isUnlocked: true,
          completedGoals,
          unlockedAt: new Date()
        }
      });

    } catch (error) {
      handleError(res, error, 'Error unlocking achievement');
    }
  });

  // ✅ NEW ENDPOINT: Sync achievement status after goal resets
  router.post('/users/:userId/achievements/sync', async (req, res) => {
    try {
      const { userId } = req.params;

      // Check authorization
      if (req.user && req.user.uid !== userId) {
        return res.status(403).json({ error: 'Unauthorized access', success: false });
      }

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', success: false });
      }

      console.log(`[SYNC ACHIEVEMENTS] Syncing achievement status for user: ${userId}`);

      // Get current completed goals by category
      const completedGoalsQuery = `
        SELECT 
          category,
          COUNT(*) as completed_goals
        FROM goals 
        WHERE user_id = ? 
          AND progress = 100
        GROUP BY category
      `;

      const [categoryStats] = await pool.execute(completedGoalsQuery, [userId]);

      // Get user's existing achievements
      const existingAchievementsQuery = `
        SELECT category, milestone FROM user_achievements 
        WHERE user_id = ?
      `;

      const [existingAchievements] = await pool.execute(existingAchievementsQuery, [userId]);

      let syncedCount = 0;
      let newAchievements = [];

      // Check each category for missing achievements
      for (const category of ACHIEVEMENT_CATEGORIES) {
        const stats = categoryStats.find(stat => stat.category === category);
        const completedGoals = stats ? stats.completed_goals : 0;

        console.log(`[SYNC] ${category}: ${completedGoals} completed goals`);

        for (const milestone of ACHIEVEMENT_MILESTONES) {
          if (completedGoals >= milestone) {
            // User qualifies for this achievement
            const hasAchievement = existingAchievements.some(
              a => a.category === category && a.milestone === milestone
            );

            if (!hasAchievement) {
              // User qualifies but doesn't have it - add it
              const achievementInfo = getAchievementInfo(category, milestone);
              
              try {
                const insertQuery = `
                  INSERT INTO user_achievements (user_id, category, milestone, achievement_id, title, unlocked_at)
                  VALUES (?, ?, ?, ?, ?, NOW())
                `;

                await pool.execute(insertQuery, [
                  userId,
                  category,
                  milestone,
                  achievementInfo.id,
                  achievementInfo.title
                ]);

                newAchievements.push(achievementInfo);
                syncedCount++;

                console.log(`[SYNC] ✅ Added missing achievement: ${achievementInfo.title}`);
              } catch (insertError) {
                console.error(`[SYNC] ❌ Error adding achievement ${category} ${milestone}:`, insertError);
              }
            }
          }
        }
      }

      console.log(`[SYNC] Completed sync for user ${userId}. Added ${syncedCount} missing achievements.`);

      res.json({
        success: true,
        message: `Sync completed. Added ${syncedCount} missing achievements.`,
        addedAchievements: newAchievements,
        syncedCount
      });

    } catch (error) {
      handleError(res, error, 'Error syncing achievement status');
    }
  });

  // GET /api/achievements/users/:userId/achievements - Get ALL user's achievements (locked and unlocked)
  router.get('/users/:userId/achievements', async (req, res) => {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user ? req.user.uid : req.query.userId;

      // Check authorization - user can only access their own achievements
      if (req.user && req.user.uid !== userId) {
        return res.status(403).json({ error: 'Unauthorized access', success: false });
      }

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', success: false });
      }

      console.log(`[ACHIEVEMENTS API] Fetching ALL achievements for user: ${userId}`);

      // ✅ FIXED: Query to get goal completion counts by category (removed is_deleted)
      const categoryStatsQuery = `
        SELECT 
          category,
          COUNT(*) as completed_goals
        FROM goals 
        WHERE user_id = ? 
          AND progress = 100
        GROUP BY category
      `;

      // Query to get user's unlocked achievements
      const achievementsQuery = `
        SELECT * FROM user_achievements 
        WHERE user_id = ?
        ORDER BY unlocked_at DESC
      `;

      // Execute queries
      const [categoryStats] = await pool.execute(categoryStatsQuery, [userId]);
      const [userAchievements] = await pool.execute(achievementsQuery, [userId]);

      console.log(`[ACHIEVEMENTS API] Found ${categoryStats.length} category stats and ${userAchievements.length} unlocked achievements for user ${userId}`);

      // Build category statistics
      const categories = {};
      ACHIEVEMENT_CATEGORIES.forEach(category => {
        const stats = categoryStats.find(stat => stat.category === category);
        categories[category] = {
          completed: stats ? stats.completed_goals : 0,
          total: stats ? stats.completed_goals : 0
        };
      });

      // Calculate total achievements
      const totalAchievements = ACHIEVEMENT_CATEGORIES.length * ACHIEVEMENT_MILESTONES.length;
      const unlockedAchievements = userAchievements.length;

      // ✅ NEW: Build ALL achievements (locked and unlocked) for each category
      const allAchievements = [];
      
      ACHIEVEMENT_CATEGORIES.forEach(category => {
        const categoryCompletedGoals = categories[category].completed;
        console.log(`[ACHIEVEMENTS API] ${category}: ${categoryCompletedGoals} completed goals`);
        
        ACHIEVEMENT_MILESTONES.forEach(milestone => {
          const achievementInfo = getAchievementInfo(category, milestone);
          
          // Check if this achievement exists in user_achievements table (permanently unlocked)
          const unlockedAchievement = userAchievements.find(
            a => a.category === category && a.milestone === milestone
          );
          
          // ✅ FIXED: Achievement is unlocked if it exists in DB OR if user currently qualifies
          // This preserves unlocked status even after goal resets
          const isUnlocked = !!unlockedAchievement || (categoryCompletedGoals >= milestone);
          
          console.log(`[ACHIEVEMENTS API] ${category} ${milestone}: DB=${!!unlockedAchievement}, Current=${categoryCompletedGoals >= milestone}, Final=${isUnlocked}`);
          
          allAchievements.push({
            ...achievementInfo,
            isUnlocked,
            completedGoals: categoryCompletedGoals,
            progress: Math.min(Math.round((categoryCompletedGoals / milestone) * 100), 100),
            unlockedAt: unlockedAchievement ? unlockedAchievement.unlocked_at : null,
            // Add database ID if it exists
            dbId: unlockedAchievement ? unlockedAchievement.id : null,
            // Flag to indicate if this was unlocked from database vs current progress
            unlockedFromDatabase: !!unlockedAchievement
          });
        });
      });

      console.log(`[ACHIEVEMENTS API] Built ${allAchievements.length} total achievements`);
      console.log(`[ACHIEVEMENTS API] Unlocked achievements: ${allAchievements.filter(a => a.isUnlocked).length}`);
      console.log(`[ACHIEVEMENTS API] Locked achievements: ${allAchievements.filter(a => !a.isUnlocked).length}`);

      const response = {
        categories,
        totalAchievements,
        unlockedAchievements: allAchievements.filter(a => a.isUnlocked).length, // Count based on logic, not DB
        achievements: allAchievements, // ✅ Now returns ALL achievements with proper status
        success: true
      };

      res.json(response);
    } catch (error) {
      handleError(res, error, 'Error fetching user achievements');
    }
  });

  // POST /api/achievements/users/:userId/achievements/check - Check for new achievements when goal is completed
  router.post('/users/:userId/achievements/check', async (req, res) => {
    try {
      const { userId } = req.params;
      const { category } = req.body;

      // Check authorization
      if (req.user && req.user.uid !== userId) {
        return res.status(403).json({ error: 'Unauthorized access', success: false });
      }

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', success: false });
      }

      console.log(`[ACHIEVEMENT CHECK] Checking achievements for user ${userId} in category ${category}`);

      if (!category || !ACHIEVEMENT_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'Invalid category', success: false });
      }

      // ✅ FIXED: Get current completed goals count for this category (removed is_deleted)
      const completedGoalsQuery = `
        SELECT COUNT(*) as count 
        FROM goals 
        WHERE user_id = ? 
          AND category = ? 
          AND progress = 100
      `;

      const [result] = await pool.execute(completedGoalsQuery, [userId, category]);
      const completedGoals = result[0].count;

      console.log(`[ACHIEVEMENT CHECK] User ${userId} has completed ${completedGoals} goals in ${category}`);

      // Get user's existing achievements for this category
      const existingAchievementsQuery = `
        SELECT milestone 
        FROM user_achievements 
        WHERE user_id = ? AND category = ?
      `;

      const [existingAchievements] = await pool.execute(existingAchievementsQuery, [userId, category]);
      const existingMilestones = existingAchievements.map(a => a.milestone);

      console.log(`[ACHIEVEMENT CHECK] User ${userId} already has achievements for milestones:`, existingMilestones);

      // Check which milestones are newly achieved
      const newAchievements = [];
      
      for (const milestone of ACHIEVEMENT_MILESTONES) {
        if (completedGoals >= milestone && !existingMilestones.includes(milestone)) {
          // User has earned a new achievement!
          const achievementInfo = getAchievementInfo(category, milestone);
          
          console.log(`[ACHIEVEMENT CHECK] 🏆 NEW ACHIEVEMENT: ${achievementInfo.title} for user ${userId}`);
          
          // Insert into database
          const insertAchievementQuery = `
            INSERT INTO user_achievements (user_id, category, milestone, achievement_id, title, unlocked_at)
            VALUES (?, ?, ?, ?, ?, NOW())
          `;
          
          try {
            await pool.execute(insertAchievementQuery, [
              userId,
              category,
              milestone,
              achievementInfo.id,
              achievementInfo.title
            ]);

            newAchievements.push({
              ...achievementInfo,
              isUnlocked: true,
              completedGoals,
              unlockedAt: new Date()
            });

            console.log(`[ACHIEVEMENT CHECK] ✅ Successfully saved achievement: ${achievementInfo.title}`);
          } catch (insertError) {
            console.error(`[ACHIEVEMENT CHECK] ❌ Error inserting achievement:`, insertError);
            // Continue with other achievements even if one fails
          }
        }
      }

      console.log(`[ACHIEVEMENT CHECK] Found ${newAchievements.length} new achievements for user ${userId}`);

      res.json({
        newAchievements,
        totalCompleted: completedGoals,
        category,
        message: newAchievements.length > 0 ? 
          `Congratulations! You unlocked ${newAchievements.length} new achievement${newAchievements.length > 1 ? 's' : ''}!` : 
          'No new achievements unlocked.',
        success: true
      });

    } catch (error) {
      handleError(res, error, 'Error checking achievements');
    }
  });

  // GET /api/achievements/users/:userId/achievements/summary - Get achievement summary for dashboard
  router.get('/users/:userId/achievements/summary', async (req, res) => {
    try {
      const { userId } = req.params;

      // Check authorization
      if (req.user && req.user.uid !== userId) {
        return res.status(403).json({ error: 'Unauthorized access', success: false });
      }

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', success: false });
      }

      console.log(`[ACHIEVEMENT SUMMARY] Fetching summary for user: ${userId}`);

      // Get goal completion counts by category
      const categoryStatsQuery = `
        SELECT 
          category,
          COUNT(*) as completed_goals
        FROM goals 
        WHERE user_id = ? 
          AND progress = 100
        GROUP BY category
      `;

      // Get unlocked achievements count from database
      const unlockedCountQuery = `
        SELECT COUNT(*) as count
        FROM user_achievements
        WHERE user_id = ?
      `;

      const [categoryStats] = await pool.execute(categoryStatsQuery, [userId]);
      const [unlockedResult] = await pool.execute(unlockedCountQuery, [userId]);

      // ✅ Use database count for unlocked achievements (preserves achievements after resets)
      const unlockedCount = unlockedResult[0].count;
      const totalPossible = ACHIEVEMENT_CATEGORIES.length * ACHIEVEMENT_MILESTONES.length;
      const progressPercentage = Math.round((unlockedCount / totalPossible) * 100);

      console.log(`[ACHIEVEMENT SUMMARY] User ${userId}: ${unlockedCount}/${totalPossible} achievements (${progressPercentage}%)`);

      // Get recent achievements (last 5)
      const recentQuery = `
        SELECT ua.*, 
          DATE_FORMAT(ua.unlocked_at, '%M %d, %Y') as formatted_date
        FROM user_achievements ua
        WHERE ua.user_id = ?
        ORDER BY ua.unlocked_at DESC
        LIMIT 5
      `;

      const [recentAchievements] = await pool.execute(recentQuery, [userId]);

      // Add achievement details to recent achievements
      const recentWithDetails = recentAchievements.map(achievement => {
        const achievementInfo = getAchievementInfo(achievement.category, achievement.milestone);
        return {
          ...achievement,
          ...achievementInfo,
          formattedDate: achievement.formatted_date
        };
      });

      res.json({
        unlockedAchievements: unlockedCount,
        totalAchievements: totalPossible,
        progressPercentage,
        recentAchievements: recentWithDetails,
        success: true
      });

    } catch (error) {
      handleError(res, error, 'Error fetching achievement summary');
    }
  });

  // GET /api/achievements/users/:userId/achievements/category/:category - Get achievements for specific category
  router.get('/users/:userId/achievements/category/:category', async (req, res) => {
    try {
      const { userId, category } = req.params;

      // Check authorization
      if (req.user && req.user.uid !== userId) {
        return res.status(403).json({ error: 'Unauthorized access', success: false });
      }

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', success: false });
      }

      if (!ACHIEVEMENT_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'Invalid category', success: false });
      }

      console.log(`[CATEGORY ACHIEVEMENTS] Fetching ${category} achievements for user: ${userId}`);

      // ✅ FIXED: Get completed goals count for this category (removed is_deleted)
      const completedGoalsQuery = `
        SELECT COUNT(*) as count 
        FROM goals 
        WHERE user_id = ? 
          AND category = ? 
          AND progress = 100
      `;

      // Get unlocked achievements for this category
      const achievementsQuery = `
        SELECT * FROM user_achievements 
        WHERE user_id = ? AND category = ?
        ORDER BY milestone ASC
      `;

      const [completedResult] = await pool.execute(completedGoalsQuery, [userId, category]);
      const [achievements] = await pool.execute(achievementsQuery, [userId, category]);

      const completedGoals = completedResult[0].count;
      const unlockedMilestones = achievements.map(a => a.milestone);

      console.log(`[CATEGORY ACHIEVEMENTS] ${category}: ${completedGoals} completed goals, ${achievements.length} unlocked achievements`);

      // Build complete achievement list for this category
      const categoryAchievements = ACHIEVEMENT_MILESTONES.map(milestone => {
        const achievementInfo = getAchievementInfo(category, milestone);
        const achievement = achievements.find(a => a.milestone === milestone);
        
        // ✅ FIXED: Achievement is unlocked if it exists in DB OR if user currently qualifies
        const isUnlocked = !!achievement || (completedGoals >= milestone);

        return {
          ...achievementInfo,
          isUnlocked,
          completedGoals,
          progress: completedGoals >= milestone ? 100 : Math.round((completedGoals / milestone) * 100),
          unlockedAt: achievement ? achievement.unlocked_at : null,
          unlockedFromDatabase: !!achievement
        };
      });

      res.json({
        category,
        completedGoals,
        achievements: categoryAchievements,
        totalAchievements: ACHIEVEMENT_MILESTONES.length,
        unlockedAchievements: categoryAchievements.filter(a => a.isUnlocked).length,
        success: true
      });

    } catch (error) {
      handleError(res, error, 'Error fetching category achievements');
    }
  });

  // POST /api/achievements/seed - Seed/initialize achievement data (development only)
  router.post('/seed', async (req, res) => {
    try {
      // This endpoint can be used to verify all achievement combinations
      const allAchievements = [];
      
      ACHIEVEMENT_CATEGORIES.forEach(category => {
        ACHIEVEMENT_MILESTONES.forEach(milestone => {
          const achievementInfo = getAchievementInfo(category, milestone);
          allAchievements.push(achievementInfo);
        });
      });

      res.json({
        message: 'Achievement system structure',
        totalAchievements: allAchievements.length,
        categories: ACHIEVEMENT_CATEGORIES.length,
        milestonesPerCategory: ACHIEVEMENT_MILESTONES.length,
        achievements: allAchievements,
        success: true
      });
    } catch (error) {
      handleError(res, error, 'Error generating achievement structure');
    }
  });

  // GET /api/achievements/structure - Get achievement system structure (for frontend reference)
  router.get('/structure', (req, res) => {
    const structure = {
      categories: ACHIEVEMENT_CATEGORIES,
      milestones: ACHIEVEMENT_MILESTONES,
      titles: ACHIEVEMENT_TITLES,
      totalAchievements: ACHIEVEMENT_CATEGORIES.length * ACHIEVEMENT_MILESTONES.length,
      success: true
    };
    
    res.json(structure);
  });

  // GET /api/achievements/user/:userId/joined - Get user's joined communities for achievement context
  router.get('/user/:userId/joined', async (req, res) => {
    try {
      const { userId } = req.params;

      // Check authorization
      if (req.user && req.user.uid !== userId) {
        return res.status(403).json({ error: 'Unauthorized access', success: false });
      }

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', success: false });
      }

      // Get joined communities (for achievement context)
      const [rows] = await pool.execute('CALL get_user_joined_communities(?)', [userId]);
      
      res.json({ communities: rows[0], success: true });
    } catch (error) {
      handleError(res, error, 'Error fetching joined communities for achievements');
    }
  });

  // DEBUG ENDPOINT: Get detailed user stats for troubleshooting
  router.get('/users/:userId/debug', async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', success: false });
      }

      console.log(`[DEBUG] Getting detailed stats for user: ${userId}`);

      // Get all goals for user
      const allGoalsQuery = `
        SELECT category, progress, COUNT(*) as count
        FROM goals 
        WHERE user_id = ?
        GROUP BY category, progress
        ORDER BY category, progress
      `;

      const [allGoals] = await pool.execute(allGoalsQuery, [userId]);

      // Get completed goals by category
      const completedGoalsQuery = `
        SELECT category, COUNT(*) as completed_count
        FROM goals 
        WHERE user_id = ? AND progress = 100
        GROUP BY category
      `;

      const [completedGoals] = await pool.execute(completedGoalsQuery, [userId]);

      // Get user achievements
      const userAchievementsQuery = `
        SELECT * FROM user_achievements 
        WHERE user_id = ?
        ORDER BY category, milestone
      `;

      const [userAchievements] = await pool.execute(userAchievementsQuery, [userId]);

      res.json({
        userId,
        allGoals,
        completedGoals,
        userAchievements,
        achievementCategories: ACHIEVEMENT_CATEGORIES,
        achievementMilestones: ACHIEVEMENT_MILESTONES,
        success: true
      });

    } catch (error) {
      handleError(res, error, 'Error fetching debug information');
    }
  });

  return router;
};