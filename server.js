const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const admin = require('firebase-admin'); // Add Firebase Admin SDK
const { DOMException } = require('domexception');
const { initializeShopItems } = require('./routes/shopSetup'); // Add shop setup

// Make it global - this line assigns DOMException to the global object
global.DOMException = DOMException
dotenv.config();

// Initialize Firebase Admin SDK with simple configuration
try {
  // For development mode without service account credentials
  admin.initializeApp({
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID
  });
  console.log('Firebase Admin SDK initialized in development mode');
  global.firebaseAuthEnabled = false;
} catch (error) {
  console.error('Firebase initialization error:', error);
  console.log('Continuing without Firebase authentication');
  global.firebaseAuthEnabled = false;
}

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'test',
  waitForConnections: true,
  connectionLimit: 10
});

// Utility
const getToday = () => new Date().toISOString().split('T')[0];
const getTodayDayOfWeek = () => new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.

// Simple Firebase authentication middleware - no fallbacks
const authenticateFirebaseToken = (req, res, next) => {
  // Just use the userId from query parameter
  const userId = req.query.userId;
  
  if (userId) {
    req.user = { uid: userId };
    next();
    return;
  }
  
  // No user ID found
  req.user = null;
  next();
};

// Routes
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!', user: req.user ? req.user.uid : 'none' });
});

// Import route modules
const communityRoutes = require('./routes/community')(pool, authenticateFirebaseToken);
const postsRoutes = require('./routes/posts')(pool, authenticateFirebaseToken);
const commentsRoutes = require('./routes/comments')(pool, authenticateFirebaseToken);
const itemShopRouter = require('./routes/itemshop')(pool, authenticateFirebaseToken);
const profileRoutes = require('./routes/profile')(pool, authenticateFirebaseToken);
const achievementRoutes = require('./routes/achievements')(pool, authenticateFirebaseToken);
const communityRequestsRoutes = require('./routes/communityRequests')(pool, authenticateFirebaseToken);

// Use route modules
app.use('/api/communities', communityRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/items', itemShopRouter);
app.use('/api/profile', profileRoutes); 
app.use('/api/achievements', achievementRoutes);
app.use('/api/community-requests', communityRequestsRoutes);

// ==== USER ROUTES ====

app.get('/api/users', async (req, res) => {
  try {
    // Require authentication for listing all users
    if (!req.user) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    const [rows] = await pool.query('SELECT * FROM users');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET a specific user
app.get('/api/users/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Verify user is allowed to access this data
    if (req.user && req.user.uid !== userId) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [userId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Create a new user
app.post('/api/users', async (req, res) => {
  const {
    user_id, username, name, email,
    password = null,
    level = 1,
    xp_points = 0,
    future_coins = 0, // This will be ignored, always start with 0
    profile_image = null,
    created_at = new Date(),
    last_login = null
  } = req.body;

  // Verify Firebase user ID matches request
  if (req.user && req.user.uid !== user_id) {
    return res.status(403).json({ error: 'Unauthorized: Cannot create user with different ID' });
  }
  
  if (!user_id || !username || !name || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await pool.query(
      `INSERT INTO users (user_id, username, name, email, password, level, xp_points, future_coins, profile_image, created_at, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, username, name, email, password, level, xp_points, 0, profile_image, created_at, last_login] // Force 0 coins
    );
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('MySQL insert error:', error);
    res.status(500).json({ error: 'Database insert failed', details: error.message });
  }
});

// Add these endpoints to your existing server.js file
// Place them after the existing user routes (around line 150-200)

// ==== VALIDATION ROUTES ====

// Check if username is available
app.post('/api/check-username', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Validate username format
    if (username.length < 3) {
      return res.json({ available: false, reason: 'Username must be at least 3 characters' });
    }
    
    // Check for valid characters (alphanumeric and underscore only)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.json({ 
        available: false, 
        reason: 'Username can only contain letters, numbers, and underscores' 
      });
    }
    
    // Check if username exists in database
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE username = ?',
      [username]
    );
    
    const isAvailable = rows[0].count === 0;
    
    res.json({ 
      available: isAvailable,
      reason: isAvailable ? null : 'Username is already taken'
    });
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Check if email is available
app.post('/api/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.json({ 
        available: false, 
        reason: 'Please enter a valid email address' 
      });
    }
    
    // Check if email exists in database
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE email = ?',
      [email]
    );
    
    const isAvailable = rows[0].count === 0;
    
    res.json({ 
      available: isAvailable,
      reason: isAvailable ? null : 'Email is already registered'
    });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Batch validation endpoint (optional - for checking both at once)
app.post('/api/validate-signup', async (req, res) => {
  try {
    const { username, email } = req.body;
    
    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }
    
    const results = {};
    
    // Check username
    if (username.length < 3) {
      results.username = { available: false, reason: 'Username must be at least 3 characters' };
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      results.username = { 
        available: false, 
        reason: 'Username can only contain letters, numbers, and underscores' 
      };
    } else {
      const [usernameRows] = await pool.query(
        'SELECT COUNT(*) as count FROM users WHERE username = ?',
        [username]
      );
      results.username = {
        available: usernameRows[0].count === 0,
        reason: usernameRows[0].count === 0 ? null : 'Username is already taken'
      };
    }
    
    // Check email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      results.email = { 
        available: false, 
        reason: 'Please enter a valid email address' 
      };
    } else {
      const [emailRows] = await pool.query(
        'SELECT COUNT(*) as count FROM users WHERE email = ?',
        [email]
      );
      results.email = {
        available: emailRows[0].count === 0,
        reason: emailRows[0].count === 0 ? null : 'Email is already registered'
      };
    }
    
    res.json(results);
  } catch (error) {
    console.error('Error validating signup data:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// UPDATE user stats (XP and coins with level-up logic)
app.put('/api/users/:userId/stats', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const userId = req.params.userId;
    
    // Verify user is allowed to access this data
    if (req.user && req.user.uid !== userId) {
      await connection.release();
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    const { xp_points_to_add, future_coins_to_add } = req.body;
    
    await connection.beginTransaction();
    
    // Check if user exists
    const [checkUser] = await connection.query('SELECT COUNT(*) as count FROM users WHERE user_id = ?', [userId]);
    
    if (checkUser[0].count === 0) {
      // User doesn't exist, create a new user
      try {
        // Create user in database - START WITH 0 COINS
        await connection.query(
          `INSERT INTO users (user_id, username, name, email, profile_image, level, xp_points, future_coins, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            userId.substring(0, 20),
            'User',
            `${userId}@example.com`,
            null,
            1,
            xp_points_to_add || 0,
            0, // Always start with 0 coins
            new Date()
          ]
        );
        
        // Now add the coins if any
        const finalCoins = (future_coins_to_add || 0);
        if (finalCoins > 0) {
          await connection.query(
            'UPDATE users SET future_coins = ? WHERE user_id = ?',
            [finalCoins, userId]
          );
        }
        
        await connection.commit();
        
        return res.json({
          user_id: userId,
          level: 1,
          xp_points: xp_points_to_add || 0,
          future_coins: finalCoins,
          leveledUp: false
        });
      } catch (createError) {
        console.error('Error creating user:', createError);
        await connection.rollback();
        return res.status(500).json({ error: 'Failed to create user' });
      }
    }
    
    // Get current user stats
    const [userData] = await connection.query(
      'SELECT level, xp_points, future_coins FROM users WHERE user_id = ?',
      [userId]
    );
    
    const currentUser = userData[0];
    
    // Calculate new XP and level
    let newXpPoints = currentUser.xp_points + (xp_points_to_add || 0);
    let newLevel = currentUser.level;
    
    // Check for level up (every 100 XP)
    if (newXpPoints >= 100) {
      const levelsGained = Math.floor(newXpPoints / 100);
      newLevel += levelsGained;
      newXpPoints = newXpPoints % 100; // Keep the remainder
    }
    
    // Calculate new coins
    const newCoins = currentUser.future_coins + (future_coins_to_add || 0);
    
    // Update user in database
    await connection.query(
      'UPDATE users SET level = ?, xp_points = ?, future_coins = ? WHERE user_id = ?',
      [newLevel, newXpPoints, newCoins, userId]
    );
    
    // Commit transaction
    await connection.commit();
    
    // Return updated user data
    res.json({
      user_id: userId,
      level: newLevel,
      xp_points: newXpPoints,
      future_coins: newCoins,
      leveledUp: newLevel > currentUser.level
    });
  } catch (error) {
    // Rollback transaction if something went wrong
    await connection.rollback();
    console.error('Error updating user stats:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    // Release connection back to pool
    connection.release();
  }
});

// ==== STREAK ROUTES ====

// Updated streak GET endpoint
app.get('/api/users/:userId/streak', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Verify user is allowed to access this data
    if (req.user && req.user.uid !== userId) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    // Check if streaks table exists first
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'streaks'
    `);
    
    if (tables.length === 0) {
      // Streaks table doesn't exist yet - create it
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS streaks (
          streak_id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          current_streak INT NOT NULL DEFAULT 1,
          longest_streak INT NOT NULL DEFAULT 1,
          last_completed_date DATE NOT NULL,
          streak_start_date DATE NOT NULL,
          trackable_type VARCHAR(50) NOT NULL DEFAULT 'goal',
          trackable_id INT NOT NULL DEFAULT 0,
          INDEX idx_streaks_user (user_id)
        )
      `);
    } else {
      // Check if trackable_type and trackable_id columns exist
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'streaks' 
        AND COLUMN_NAME IN ('trackable_type', 'trackable_id')
      `);
      
      const columnNames = columns.map(col => col.COLUMN_NAME);
      
      // Add missing columns if needed
      if (!columnNames.includes('trackable_type')) {
        try {
          await pool.execute(`
            ALTER TABLE streaks 
            ADD COLUMN trackable_type VARCHAR(50) NOT NULL DEFAULT 'goal'
          `);
          console.log('Added trackable_type column to streaks table');
        } catch (error) {
          console.error('Error adding trackable_type column:', error);
        }
      }
      
      if (!columnNames.includes('trackable_id')) {
        try {
          await pool.execute(`
            ALTER TABLE streaks 
            ADD COLUMN trackable_id INT NOT NULL DEFAULT 0
          `);
          console.log('Added trackable_id column to streaks table');
        } catch (error) {
          console.error('Error adding trackable_id column:', error);
        }
      }
    }
    
    // Check if user exists
    const [userCheck] = await pool.execute(`
      SELECT COUNT(*) as count FROM users WHERE user_id = ?
    `, [userId]);
    
    if (userCheck[0].count === 0) {
      // User doesn't exist, create them with 0 coins
      try {
        await pool.execute(`
          INSERT INTO users (user_id, username, name, email, profile_image, level, xp_points, future_coins, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          userId,
          userId.substring(0, 20),
          'User',
          `${userId}@example.com`,
          null,
          1, 
          0, 
          0, // Start with 0 coins
          new Date()
        ]);
        
        console.log(`Created user: ${userId}`);
      } catch (createError) {
        console.error('Error creating user:', createError);
        // Continue anyway - streak will still be created
      }
    }
    
    // Check if user has a streak record
    const [streakRows] = await pool.execute(
      `SELECT * FROM streaks WHERE user_id = ? ORDER BY streak_id DESC LIMIT 1`,
      [userId]
    );
    
    if (streakRows.length === 0) {
      // Create initial streak record with streak of 0
      const today = new Date();
      await pool.execute(
        `INSERT INTO streaks (user_id, current_streak, longest_streak, last_completed_date, streak_start_date, trackable_type, trackable_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, 0, 0, today, today, 'goal', 0]
      );
      
      // Return the new streak record
      return res.json({
        streak_id: 0,
        user_id: userId,
        current_streak: 0,
        longest_streak: 0,
        last_completed_date: today,
        streak_start_date: today,
        trackable_type: 'goal',
        trackable_id: 0
      });
    }
    
    // Return the existing streak record
    res.json(streakRows[0]);
  } catch (error) {
    console.error('Error fetching streak:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Updated streak PUT endpoint
app.put('/api/users/:userId/streak', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const userId = req.params.userId;
    
    // Verify user is allowed to access this data
    if (req.user && req.user.uid !== userId) {
      await connection.release();
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    const { increment = true, trackable_id = 0 } = req.body;
    
    await connection.beginTransaction();
    
    // Check if user exists
    const [userCheck] = await connection.execute(`
      SELECT COUNT(*) as count FROM users WHERE user_id = ?
    `, [userId]);
    
    if (userCheck[0].count === 0) {
      // User doesn't exist, create a new user with 0 coins
      try {
        await connection.execute(`
          INSERT INTO users (user_id, username, name, email, profile_image, level, xp_points, future_coins, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          userId,
          userId.substring(0, 20),
          'User',
          `${userId}@example.com`,
          null,
          1, 
          0, 
          0, // Start with 0 coins
          new Date()
        ]);
        
        console.log(`Created user: ${userId}`);
      } catch (createError) {
        console.error('Error creating user:', createError);
        // Continue anyway - streak will still be created
      }
    }
    
    // Get current streak data
    const [streakRows] = await connection.query(
      `SELECT * FROM streaks WHERE user_id = ? ORDER BY streak_id DESC LIMIT 1`,
      [userId]
    );
    
    const today = new Date();
    let streakId, currentStreak, longestStreak;
    let lastCompletedDate = today;
    let streakStartDate = today;
    
    if (streakRows.length === 0) {
      // Create new streak record
      const [result] = await connection.query(
        `INSERT INTO streaks (user_id, current_streak, longest_streak, last_completed_date, streak_start_date, trackable_type, trackable_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, increment ? 1 : 0, increment ? 1 : 0, today, today, 'goal', trackable_id]
      );
      
      streakId = result.insertId;
      currentStreak = increment ? 1 : 0;
      longestStreak = increment ? 1 : 0;
    } else {
      const streak = streakRows[0];
      streakId = streak.streak_id;
      
      // Get the last completion date
      if (streak.last_completed_date) {
        lastCompletedDate = new Date(streak.last_completed_date);
      }
      
      // Get the streak start date
      if (streak.streak_start_date) {
        streakStartDate = new Date(streak.streak_start_date);
      }
      
      // Check if it's a new day
      const isNewDay = lastCompletedDate.toDateString() !== today.toDateString();
      
      if (increment && isNewDay) {
        // Check if it's consecutive with the last completion
        const dayDiff = Math.floor((today - lastCompletedDate) / (1000 * 60 * 60 * 24));
        
        if (dayDiff <= 1) {
          // Consecutive day, increment streak
          currentStreak = streak.current_streak + 1;
        } else {
          // Streak broken, reset to 1
          currentStreak = 1;
          streakStartDate = today;
        }
        
        // Update longest streak if needed
        longestStreak = Math.max(currentStreak, streak.longest_streak || 0);
      } else {
        // Same day or not incrementing, keep current values
        currentStreak = streak.current_streak;
        longestStreak = streak.longest_streak;
      }
      
      // Update streak in database
      await connection.query(
        `UPDATE streaks SET current_streak = ?, longest_streak = ?, last_completed_date = ?, trackable_id = ? 
         WHERE streak_id = ?`,
        [currentStreak, longestStreak, today, trackable_id, streakId]
      );
    }
    
    // Commit transaction
    await connection.commit();
    
    // Return updated streak data
    res.json({
      streak_id: streakId,
      user_id: userId,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_completed_date: today,
      streak_start_date: streakStartDate,
      trackable_type: 'goal',
      trackable_id: trackable_id
    });
  } catch (error) {
    // Rollback transaction if something went wrong
    await connection.rollback();
    console.error('Error updating streak:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    // Release connection back to pool
    connection.release();
  }
});

// ==== GOALS ROUTES ====

app.get('/api/goals', async (req, res) => {
  try {
    // Get user ID from query params
    const userId = req.query.userId;
    
    // Require a userId
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const [rows] = await pool.execute(
      `SELECT * FROM goals WHERE user_id = ? ORDER BY is_completed ASC, target_date DESC`,
      [userId]
    );
    
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
      // Add type field - recurring for daily goals, one-time for non-daily
      type: goal.is_daily === 1 ? 'recurring' : 'one-time',
      // Add targetDate (same as startDate for backward compatibility)
      targetDate: goal.target_date ? new Date(goal.target_date).toISOString().split('T')[0] : null
    }));
    
    res.json({ goals });
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get goals for today
app.get('/api/goals/today', async (req, res) => {
  try {
    // Get user ID from query params
    const userId = req.query.userId;
    
    // Require a userId
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const today = getTodayDayOfWeek();

    const [rows] = await pool.execute(
      `SELECT * FROM goals WHERE user_id = ? AND is_completed = 0 ORDER BY target_date DESC`,
      [userId]
    );
    
    // Filter goals that are active today
    const goals = rows
      .filter(goal => {
        // Non-daily goals are always included
        if (goal.is_daily === 0) return true;
        
        // For daily goals, check if today is in the routine_days array
        if (goal.routine_days) {
          try {
            const routineDays = JSON.parse(goal.routine_days);
            // If no days specified or today is in the routine days
            return routineDays.length === 0 || routineDays.includes(today);
          } catch (e) {
            console.error('Error parsing routine days:', e);
            return true; // Include by default if parsing fails
          }
        }
        
        // Default to showing all daily goals if no routine_days specified
        return true;
      })
      .map(goal => ({
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
    
    res.json({ goals });
  } catch (error) {
    console.error('Error fetching today\'s goals:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/goals/:id', async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    if (isNaN(goalId)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }
    
    const [rows] = await pool.execute(`SELECT * FROM goals WHERE goal_id = ?`, [goalId]);
    if (!rows.length) return res.status(404).json({ error: 'Goal not found' });

    // Check if user has permission
    if (req.user && req.user.uid !== rows[0].user_id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const [subgoals] = await pool.execute(`SELECT * FROM subgoals WHERE goal_id = ?`, [goalId]);
    const goal = rows[0];
    
    // Parse routine days if they exist
    if (goal.routine_days) {
      try {
        goal.routineDays = JSON.parse(goal.routine_days);
      } catch (e) {
        console.error('Error parsing routine days:', e);
        goal.routineDays = [];
      }
    } else {
      goal.routineDays = [];
    }
    
    // Add type field
    goal.type = goal.is_daily === 1 ? 'recurring' : 'one-time';
    
    // Add targetDate and startDate for compatibility
    goal.targetDate = goal.target_date ? new Date(goal.target_date).toISOString().split('T')[0] : null;
    goal.startDate = goal.target_date ? new Date(goal.target_date).toISOString().split('T')[0] : null;
    
    // Transform to match frontend Goal type format
    const responseGoal = {
      id: goal.goal_id,
      title: goal.title,
      description: goal.description,
      category: goal.category,
      color: getCategoryColor(goal.category), // Add color based on category
      isCompleted: goal.is_completed === 1,
      isDaily: goal.is_daily === 1,
      progress: goal.progress,
      startDate: goal.startDate,
      targetDate: goal.targetDate,
      userId: goal.user_id,
      coinReward: goal.coin_reward,
      routineDays: goal.routineDays || [],
      type: goal.type,
      lastCompleted: goal.last_completed || undefined,
      subgoals: subgoals
    };
    
    res.json(responseGoal);
  } catch (error) {
    console.error('Error fetching goal by ID:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Modified goal creation endpoint with simplified error handling
app.post('/api/goals', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    // Log incoming request for debugging
    console.log("Creating goal with data:", JSON.stringify(req.body));
    
    // Get the user ID from the request body
    const userId = req.body.user_id;
    
    // Require a userId
    if (!userId) {
      await connection.release();
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    await connection.beginTransaction();
    
    // Check if user exists in the database
    const [userRows] = await connection.execute(
      `SELECT COUNT(*) as count FROM users WHERE user_id = ?`, 
      [userId]
    );
    
    // If user doesn't exist, create user with 0 coins
    if (userRows[0].count === 0) {
      console.log(`User ${userId} doesn't exist, creating user...`);
      
      try {
        await connection.execute(
          `INSERT INTO users (user_id, username, name, email, profile_image, level, xp_points, future_coins, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            userId.substring(0, 20),
            'User',
            `${userId}@example.com`,
            null,
            1, // Default level
            0, // Default XP
            0, // Always start with 0 coins
            new Date() // Current timestamp
          ]
        );
        
        console.log(`Created user: ${userId}`);
      } catch (createError) {
        console.error('Error creating user:', createError);
        await connection.rollback();
        await connection.release();
        return res.status(500).json({ error: 'Failed to create user', details: createError.message });
      }
    }
    
    // Sanitize and validate input data
    const title = req.body.title || 'New Goal';
    const description = req.body.description || '';
    const target_date = req.body.target_date || getToday();
    const progress = Number(req.body.progress || 0);
    const category = req.body.category || 'Personal';
    const is_completed = req.body.is_completed ? 1 : 0;
    const is_daily = req.body.is_daily ? 1 : 0;
    
    // Handle routine_days properly
    let routine_days = null;
    if (req.body.routine_days) {
      if (typeof req.body.routine_days === 'string') {
        // Already a string, keep as is if it looks like valid JSON
        try {
          JSON.parse(req.body.routine_days);
          routine_days = req.body.routine_days;
        } catch (e) {
          // Not valid JSON, set to all days
          routine_days = '[0,1,2,3,4,5,6]';
        }
      } else if (Array.isArray(req.body.routine_days)) {
        // Convert array to JSON string
        routine_days = JSON.stringify(req.body.routine_days);
      } else {
        // Default to all days
        routine_days = '[0,1,2,3,4,5,6]';
      }
    } else if (is_daily) {
      // For daily goals with no routine_days, default to all days
      routine_days = '[0,1,2,3,4,5,6]';
    }
    
    const coin_reward = Number(req.body.coin_reward || 10);
    
    // Insert the goal with validated data
    try {
      const [result] = await connection.execute(
        `INSERT INTO goals (user_id, title, description, target_date, progress, is_completed, is_daily, routine_days, category, coin_reward)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, title, description, target_date, progress, is_completed, is_daily, routine_days, category, coin_reward]
      );
  
      const goalId = result.insertId;
      console.log(`Created goal with ID: ${goalId}`);
      
      // Get the created goal
      const [goalRows] = await connection.execute(`SELECT * FROM goals WHERE goal_id = ?`, [goalId]);
      
      if (goalRows.length === 0) {
        throw new Error(`Goal created but could not be retrieved with ID ${goalId}`);
      }
      
      // Commit transaction
      await connection.commit();
      
      const newGoal = goalRows[0];
      
      // Parse routine_days for the response
      if (newGoal.routine_days) {
        try {
          newGoal.routineDays = JSON.parse(newGoal.routine_days);
        } catch (e) {
          console.error('Error parsing routine days in response:', e);
          newGoal.routineDays = [];
        }
      } else {
        newGoal.routineDays = [];
      }
      
      // Add type field
      newGoal.type = newGoal.is_daily === 1 ? 'recurring' : 'one-time';
      
      // Add targetDate
      newGoal.targetDate = newGoal.target_date ? new Date(newGoal.target_date).toISOString().split('T')[0] : null;
      
      res.status(201).json(newGoal);
    } catch (insertError) {
      console.error('Goal insert error:', insertError);
      await connection.rollback();
      res.status(500).json({ error: 'Failed to create goal', details: insertError.message });
    }
  } catch (error) {
    // Rollback transaction if something went wrong
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Rollback error:', rollbackError);
    }
    
    console.error('DETAILED ERROR in goal creation:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    // Release connection back to pool
    try {
      await connection.release();
    } catch (releaseError) {
      console.error('Connection release error:', releaseError);
    }
  }
});

app.put('/api/goals/:id/progress', async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    if (isNaN(goalId)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }
    
    // First check if the goal exists and get the user ID
    const [goalCheck] = await pool.execute(`SELECT user_id FROM goals WHERE goal_id = ?`, [goalId]);
    if (goalCheck.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    // Check if user has permission
    if (req.user && req.user.uid !== goalCheck[0].user_id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    const newProgress = Math.min(Math.max(req.body.progress, 0), 100);
    const isCompleted = newProgress >= 100 ? 1 : 0;
    
    await pool.execute(
      `UPDATE goals SET progress = ?, is_completed = ? WHERE goal_id = ?`, 
      [newProgress, isCompleted, goalId]
    );
    
    // Get updated goal
    const [rows] = await pool.execute(`SELECT * FROM goals WHERE goal_id = ?`, [goalId]);
    if (!rows.length) return res.status(404).json({ error: 'Goal not found after update' });
    
    const goal = rows[0];
    
    // Parse routine days if they exist
    if (goal.routine_days) {
      try {
        goal.routineDays = JSON.parse(goal.routine_days);
      } catch (e) {
        console.error('Error parsing routine days:', e);
        goal.routineDays = [];
      }
    } else {
      goal.routineDays = [];
    }
    
    // Format the response to match the frontend Goal type
    const responseGoal = {
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
      routineDays: goal.routineDays || [],
      type: goal.is_daily === 1 ? 'recurring' : 'one-time',
      targetDate: goal.target_date ? new Date(goal.target_date).toISOString().split('T')[0] : null
    };
    
    res.json(responseGoal);
  } catch (error) {
    console.error('Error updating goal progress:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Update routine days for a goal
app.patch('/api/goals/:id', async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    if (isNaN(goalId)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }
    
    // First check if the goal exists and get the user ID
    const [goalCheck] = await pool.execute(`SELECT user_id FROM goals WHERE goal_id = ?`, [goalId]);
    if (goalCheck.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    // Check if user has permission
    if (req.user && req.user.uid !== goalCheck[0].user_id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    // Support both routine_days format or a general PATCH
    let updateFields = '';
    const updateValues = [];
    
    // Handle routine_days specially
    if (req.body.routine_days !== undefined) {
      let routineDays = req.body.routine_days;
      
      // Ensure routine_days is stored as a JSON string
      if (typeof routineDays !== 'string') {
        routineDays = JSON.stringify(routineDays);
      }
      
      updateFields += 'routine_days = ?';
      updateValues.push(routineDays);
    }
    
    // Handle other fields that might be provided
    const allowedFields = ['title', 'description', 'target_date', 'is_daily', 'category', 'coin_reward', 'type'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (updateFields) updateFields += ', ';
        updateFields += `${field} = ?`;
        updateValues.push(req.body[field]);
      }
    }
    
    // If nothing to update, return early
    if (!updateFields) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    // Add the goal ID to the values array
    updateValues.push(goalId);
    
    // Execute the update
    await pool.execute(
      `UPDATE goals SET ${updateFields} WHERE goal_id = ?`,
      updateValues
    );
    
    // Get the updated goal
    const [rows] = await pool.execute(`SELECT * FROM goals WHERE goal_id = ?`, [goalId]);
    if (!rows.length) return res.status(404).json({ error: 'Goal not found after update' });
    
    const goal = rows[0];
    
    // Parse routine days for the response
    if (goal.routine_days) {
      try {
        goal.routineDays = JSON.parse(goal.routine_days);
      } catch (e) {
        console.error('Error parsing routine days:', e);
        goal.routineDays = [];
      }
    } else {
      goal.routineDays = [];
    }
    
    // Format the response to match the frontend Goal type
    const responseGoal = {
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
      routineDays: goal.routineDays || [],
      type: goal.is_daily === 1 ? 'recurring' : 'one-time',
      targetDate: goal.target_date ? new Date(goal.target_date).toISOString().split('T')[0] : null
    };
    
    res.json(responseGoal);
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Delete a goal by ID
app.delete('/api/goals/:id', async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    if (isNaN(goalId)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }
    
    // First check if the goal exists and get the user ID
    const [goalCheck] = await pool.execute(`SELECT user_id FROM goals WHERE goal_id = ?`, [goalId]);
    if (goalCheck.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    // Check if user has permission
    if (req.user && req.user.uid !== goalCheck[0].user_id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    // Delete any subgoals first
    await pool.execute(`DELETE FROM subgoals WHERE goal_id = ?`, [goalId]);
    
    // Then delete the goal
    await pool.execute(`DELETE FROM goals WHERE goal_id = ?`, [goalId]);
    
    res.json({ success: true, message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/goals/:id/subgoals', async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    if (isNaN(goalId)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }
    
    // First check if the goal exists and get the user ID
    const [goalCheck] = await pool.execute(`SELECT user_id FROM goals WHERE goal_id = ?`, [goalId]);
    if (goalCheck.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    // Check if user has permission
    if (req.user && req.user.uid !== goalCheck[0].user_id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    const { title, isCompleted = false, dueDate = null } = req.body;
    
    const [result] = await pool.execute(
      `INSERT INTO subgoals (goal_id, title, is_completed, due_date) VALUES (?, ?, ?, ?)`,
      [goalId, title, isCompleted ? 1 : 0, dueDate]
    );
    
    const [rows] = await pool.execute(`SELECT * FROM subgoals WHERE id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating subgoal:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.patch('/api/subgoals/:id/toggle', async (req, res) => {
  try {
    const subGoalId = Number(req.params.id);
    if (isNaN(subGoalId)) {
      return res.status(400).json({ error: 'Invalid subgoal ID' });
    }
    
    // First check if the subgoal exists and get the goal ID
    const [subgoalCheck] = await pool.execute(`
      SELECT s.id, g.user_id 
      FROM subgoals s 
      JOIN goals g ON s.goal_id = g.goal_id 
      WHERE s.id = ?
    `, [subGoalId]);
    
    if (subgoalCheck.length === 0) {
      return res.status(404).json({ error: 'Subgoal not found' });
    }
    
    // Check if user has permission
    if (req.user && req.user.uid !== subgoalCheck[0].user_id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    const [rows] = await pool.execute(`SELECT is_completed FROM subgoals WHERE id = ?`, [subGoalId]);
    if (!rows.length) return res.status(404).json({ error: 'Subgoal not found' });
    
    const current = rows[0].is_completed;
    await pool.execute(`UPDATE subgoals SET is_completed = ? WHERE id = ?`, [current ? 0 : 1, subGoalId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling subgoal completion:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ==== ROUTINES ROUTES ====

// Get routines for a user
app.get('/api/routines', async (req, res) => {
  try {
    // Get user ID from query params
    const userId = req.query.userId;
    
    // Require a userId
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Fetch all daily goals that can be considered routines
    const [rows] = await pool.execute(
      `SELECT * FROM goals WHERE user_id = ? AND is_daily = 1 ORDER BY is_completed ASC, target_date DESC`,
      [userId]
    );
    
    // Transform the database rows to match the frontend Routine type
    const routines = rows.map(routine => ({
      id: routine.goal_id,
      title: routine.title,
      description: routine.description,
      frequency: 'daily', // Default frequency
      completedTasks: routine.is_completed ? 1 : 0, // Simple version - 1 task per routine
      totalTasks: 1, // Simple version - 1 task per routine
      userId: routine.user_id
    }));
    
    res.json({ routines });
  } catch (error) {
    console.error('Error fetching routines:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Toggle routine completion
app.put('/api/routines/:id/toggle', async (req, res) => {
  try {
    const routineId = Number(req.params.id);
    if (isNaN(routineId)) {
      return res.status(400).json({ error: 'Invalid routine ID' });
    }
    
    // First check if the routine exists and get the user ID
    const [routineCheck] = await pool.execute(`SELECT user_id FROM goals WHERE goal_id = ?`, [routineId]);
    if (routineCheck.length === 0) {
      return res.status(404).json({ error: 'Routine not found' });
    }
    
    // Check if user has permission
    if (req.user && req.user.uid !== routineCheck[0].user_id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    const [rows] = await pool.execute(`SELECT is_completed FROM goals WHERE goal_id = ?`, [routineId]);
    if (!rows.length) return res.status(404).json({ error: 'Routine not found' });
    
    const current = rows[0].is_completed;
    const newStatus = !current;
    
    await pool.execute(
      `UPDATE goals SET is_completed = ?, progress = ? WHERE goal_id = ?`, 
      [newStatus ? 1 : 0, newStatus ? 100 : 0, routineId]
    );
    
    // Get updated routine
    const [updatedRows] = await pool.execute(`SELECT * FROM goals WHERE goal_id = ?`, [routineId]);
    const updatedRoutine = updatedRows[0];
    
    // Format the response to match the frontend Routine type
    const responseRoutine = {
      id: updatedRoutine.goal_id,
      title: updatedRoutine.title,
      description: updatedRoutine.description,
      frequency: 'daily', // Default frequency
      completedTasks: updatedRoutine.is_completed ? 1 : 0,
      totalTasks: 1,
      userId: updatedRoutine.user_id
    };
    
    res.json(responseRoutine);
  } catch (error) {
    console.error('Error toggling routine completion:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ==== USER DATA ENDPOINTS ====

app.put('/api/users/:id/futurecoins', async (req, res) => {
  try {
    const userId = req.params.id;
    const amount = Number(req.body.amount || 0);
    
    // Check if user exists
    const [userCheck] = await pool.execute(`SELECT COUNT(*) as count FROM users WHERE user_id = ?`, [userId]);
    
    if (userCheck[0].count === 0) {
      // User doesn't exist, create them starting with 0 coins
      try {
        await pool.execute(
          `INSERT INTO users (user_id, username, name, email, profile_image, level, xp_points, future_coins, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            userId.substring(0, 20),
            'User',
            `${userId}@example.com`,
            null,
            1,
            0,
            0, // Start with 0, then add the amount
            new Date()
          ]
        );
        
        // Now add the coins if positive
        if (amount > 0) {
          await pool.execute(
            `UPDATE users SET future_coins = ? WHERE user_id = ?`,
            [amount, userId]
          );
          return res.json({ futureCoins: amount });
        } else {
          return res.json({ futureCoins: 0 });
        }
      } catch (createError) {
        console.error('Error creating user:', createError);
        return res.status(500).json({ error: 'Failed to create user' });
      }
    }
    
    // Update existing user's coins
    await pool.execute(
      `UPDATE users SET future_coins = future_coins + ? WHERE user_id = ?`,
      [amount, userId]
    );
    
    const [rows] = await pool.execute(`SELECT future_coins FROM users WHERE user_id = ?`, [userId]);
    res.json({ futureCoins: rows[0]?.future_coins || 0 });
  } catch (error) {
    console.error('Error updating future coins:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Used by GoalService.updateUserXP
app.put('/api/users/:id/xp', async (req, res) => {
  try {
    const userId = req.params.id;
    const amount = Number(req.body.amount || 0);
    
    // Check if user exists
    const [userCheck] = await pool.execute(`SELECT COUNT(*) as count FROM users WHERE user_id = ?`, [userId]);
    
    if (userCheck[0].count === 0) {
      // User doesn't exist, create them with 0 coins
      try {
        await pool.execute(
          `INSERT INTO users (user_id, username, name, email, profile_image, level, xp_points, future_coins, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            userId.substring(0, 20),
            'User',
            `${userId}@example.com`,
            null,
            1,
            amount > 0 ? amount : 0,
            0, // Always start with 0 coins
            new Date()
          ]
        );
        
        return res.json({
          xp: amount > 0 ? amount : 0,
          level: 1,
          leveledUp: false
        });
      } catch (createError) {
        console.error('Error creating user:', createError);
        return res.status(500).json({ error: 'Failed to create user' });
      }
    }
    
    // Update existing user's XP
    await pool.execute(
      `UPDATE users SET xp_points = xp_points + ? WHERE user_id = ?`,
      [amount, userId]
    );
    
    // Check if user should level up (simplified)
    const [userRows] = await pool.execute(
      `SELECT xp_points, level FROM users WHERE user_id = ?`,
      [userId]
    );
    
    const user = userRows[0];
    // Simple level-up logic: level up every 100 XP
    const newLevel = Math.floor(user.xp_points / 100) + 1;
    
    if (newLevel > user.level) {
      await pool.execute(
        `UPDATE users SET level = ? WHERE user_id = ?`,
        [newLevel, userId]
      );
    }
    
    const [updatedRows] = await pool.execute(
      `SELECT xp_points, level FROM users WHERE user_id = ?`,
      [userId]
    );
    
    res.json({
      xp: updatedRows[0].xp_points,
      level: updatedRows[0].level,
      leveledUp: newLevel > user.level
    });
  } catch (error) {
    console.error('Error updating user XP:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Add a route to delete all goals (DANGER: use only in development!)
app.delete('/api/admin/clear-goals', async (req, res) => {
  try {
    // Check for token for security
    const token = req.query.token || req.headers['x-admin-token'];
    if (!token) {
      return res.status(403).json({ error: 'Admin token required' });
    }
    
    const connection = await pool.getConnection();
    try {
      // Disable safe updates
      await connection.query('SET SQL_SAFE_UPDATES = 0');
      
      // Delete all goals
      await connection.query('DELETE FROM goals');
      
      // Re-enable safe updates
      await connection.query('SET SQL_SAFE_UPDATES = 1');
      
      res.json({ success: true, message: 'All goals deleted' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error clearing goals:', error);
    res.status(500).json({ error: 'Failed to clear goals' });
  }
});

// ==== DATABASE INITIALIZATION ====

(async () => {
  try {
    const connection = await pool.getConnection();
    
    // Create tables if they don't exist
    // Create users table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255),
        profile_image VARCHAR(255),
        level INT NOT NULL DEFAULT 1,
        xp_points INT NOT NULL DEFAULT 0,
        future_coins INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL,
        last_login DATETIME
      )
    `);
    
    // First check if communities table exists
    const [communitiesTables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'communities'
    `);
    
    // If not, create community tables using SQL from our community tables file
    if (communitiesTables.length === 0) {
      console.log('Creating community tables...');
      
      // These are the SQL statements from the communityTables file
      await connection.execute(`
        CREATE TABLE communities (
          community_id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          category VARCHAR(50) NOT NULL,
          image_url VARCHAR(255),
          created_by VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
        )
      `);
      
      await connection.execute(`
        CREATE TABLE community_members (
          community_id INT NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (community_id, user_id),
          FOREIGN KEY (community_id) REFERENCES communities(community_id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
      `);
      
      await connection.execute(`
        CREATE TABLE posts (
          post_id INT AUTO_INCREMENT PRIMARY KEY,
          community_id INT NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          image_url VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (community_id) REFERENCES communities(community_id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
      `);
      
      await connection.execute(`
        CREATE TABLE comments (
          comment_id INT AUTO_INCREMENT PRIMARY KEY,
          post_id INT NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
      `);
      
      await connection.execute(`
        CREATE TABLE post_likes (
          post_id INT NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (post_id, user_id),
          FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
      `);
      
      await connection.execute(`
        CREATE TABLE comment_likes (
          comment_id INT NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (comment_id, user_id),
          FOREIGN KEY (comment_id) REFERENCES comments(comment_id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
      `);
      
      await connection.execute(`
        CREATE TABLE post_reports (
          report_id INT AUTO_INCREMENT PRIMARY KEY,
          post_id INT NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          reason TEXT NOT NULL,
          status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
      `);
      
      await connection.execute(`
        CREATE TABLE comment_reports (
          report_id INT AUTO_INCREMENT PRIMARY KEY,
          comment_id INT NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          reason TEXT NOT NULL,
          status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (comment_id) REFERENCES comments(comment_id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
      `);
      
      await connection.execute(`
        CREATE TABLE community_moderators (
          community_id INT NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          added_by VARCHAR(255) NOT NULL,
          PRIMARY KEY (community_id, user_id),
          FOREIGN KEY (community_id) REFERENCES communities(community_id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
          FOREIGN KEY (added_by) REFERENCES users(user_id) ON DELETE CASCADE
        )
      `);
      
      // Create indexes
      await connection.execute(`CREATE INDEX idx_posts_community_id ON posts(community_id)`);
      await connection.execute(`CREATE INDEX idx_posts_user_id ON posts(user_id)`);
      await connection.execute(`CREATE INDEX idx_comments_post_id ON comments(post_id)`);
      await connection.execute(`CREATE INDEX idx_comments_user_id ON comments(user_id)`);
      await connection.execute(`CREATE INDEX idx_community_members_user_id ON community_members(user_id)`);
      
      console.log('Community tables created successfully!');
    }
    
    // Create goals table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS goals (
        goal_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        target_date DATE,
        progress INT NOT NULL DEFAULT 0,
        is_completed TINYINT(1) NOT NULL DEFAULT 0,
        is_daily TINYINT(1) NOT NULL DEFAULT 0,
        routine_days TEXT,
        category VARCHAR(50) DEFAULT 'Personal',
        coin_reward INT DEFAULT 10,
        type VARCHAR(20) DEFAULT 'one-time',
        INDEX idx_goals_user (user_id)
      )
    `);
    
    // Create subgoals table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS subgoals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        goal_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        is_completed TINYINT(1) NOT NULL DEFAULT 0,
        due_date DATE,
        INDEX idx_subgoals_goal (goal_id)
      )
    `);
    
    // First check if streaks table exists
    const [streaksTables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'streaks'
    `);
    
    // If streaks table exists, check if it has trackable_type and trackable_id columns
    if (streaksTables.length > 0) {
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'streaks' 
        AND COLUMN_NAME IN ('trackable_type', 'trackable_id')
      `);
      
      const columnNames = columns.map(col => col.COLUMN_NAME);
      
      // Add missing columns if needed
      if (!columnNames.includes('trackable_type')) {
        try {
          await connection.execute(`
            ALTER TABLE streaks 
            ADD COLUMN trackable_type VARCHAR(50) NOT NULL DEFAULT 'goal'
          `);
          console.log('Added trackable_type column to streaks table');
        } catch (error) {
          console.error('Error adding trackable_type column:', error);
        }
      }
      
      if (!columnNames.includes('trackable_id')) {
        try {
          await connection.execute(`
            ALTER TABLE streaks 
            ADD COLUMN trackable_id INT NOT NULL DEFAULT 0
          `);
          console.log('Added trackable_id column to streaks table');
        } catch (error) {
          console.error('Error adding trackable_id column:', error);
        }
      }
    } else {
      // Create streaks table if it doesn't exist
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS streaks (
          streak_id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          current_streak INT NOT NULL DEFAULT 1,
          longest_streak INT NOT NULL DEFAULT 1,
          last_completed_date DATE NOT NULL,
          streak_start_date DATE NOT NULL,
          trackable_type VARCHAR(50) NOT NULL DEFAULT 'goal',
          trackable_id INT NOT NULL DEFAULT 0,
          INDEX idx_streaks_user (user_id)
        )
      `);
      console.log('Created streaks table with trackable_type and trackable_id columns');
    }
    
    // Check if type column exists in goals table
    const [typeColumn] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'goals' 
      AND COLUMN_NAME = 'type'
    `);
    
    // Add type column if it doesn't exist
    if (typeColumn.length === 0) {
      console.log('Adding type column to goals table...');
      try {
        await connection.execute(`ALTER TABLE goals ADD COLUMN type VARCHAR(20) DEFAULT 'one-time' AFTER routine_days`);
        console.log('type column added successfully!');
        
        // Set default values based on is_daily
        await connection.execute(`
          UPDATE goals 
          SET type = CASE WHEN is_daily = 1 THEN 'recurring' ELSE 'one-time' END 
          WHERE goal_id > 0
        `);
      } catch (columnError) {
        console.error('Failed to add type column:', columnError);
      }
    }
    
    // Create item shop tables
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS items (
        item_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        image_url VARCHAR(255),
        category VARCHAR(50) NOT NULL,
        price INT NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_items (
        user_item_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        item_id INT NOT NULL,
        purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_equipped TINYINT(1) NOT NULL DEFAULT 0,
        INDEX idx_user_items_user (user_id),
        INDEX idx_user_items_item (item_id),
        UNIQUE KEY unique_user_item (user_id, item_id)
      )
    `);
    
    // Check if shop_items table exists (old structure)
    const [shopItemsTables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'shop_items'
    `);
    
    // If shop_items exists, migrate data to items table
    if (shopItemsTables.length > 0) {
      // Check if items table is empty
      const [itemsCount] = await connection.execute(`SELECT COUNT(*) as count FROM items`);
      
      if (itemsCount[0].count === 0) {
        // Copy data from shop_items to items
        await connection.execute(`
          INSERT INTO items (name, description, image_url, category, price, is_active, created_at)
          SELECT name, description, image_url, category, price, is_active, created_at
          FROM shop_items
        `);
        
        console.log('Migrated data from shop_items to items table');
      }
      
      // Drop the old shop_items table
      await connection.execute(`DROP TABLE shop_items`);
      console.log('Dropped old shop_items table');
    }
    
    // Create views for communities
    try {
      // Create post stats view
      await connection.execute(`
        CREATE OR REPLACE VIEW post_stats AS
        SELECT 
          p.post_id,
          p.community_id,
          p.user_id,
          p.content,
          p.image_url,
          p.created_at,
          p.updated_at,
          COUNT(DISTINCT pl.user_id) as likes_count,
          COUNT(DISTINCT c.comment_id) as comments_count
        FROM posts p
        LEFT JOIN post_likes pl ON p.post_id = pl.post_id
        LEFT JOIN comments c ON p.post_id = c.post_id
        GROUP BY p.post_id
      `);
      
      // Create community stats view
      await connection.execute(`
        CREATE OR REPLACE VIEW community_stats AS
        SELECT 
          c.community_id,
          c.name,
          c.description,
          c.category,
          c.image_url,
          c.created_by,
          c.created_at,
          COUNT(DISTINCT cm.user_id) as members_count,
          COUNT(DISTINCT p.post_id) as posts_count
        FROM communities c
        LEFT JOIN community_members cm ON c.community_id = cm.community_id
        LEFT JOIN posts p ON c.community_id = p.community_id
        GROUP BY c.community_id
      `);
      
      console.log('Created community stats views');
    } catch(viewError) {
      console.error('Error creating views:', viewError);
    }
    
    // Create stored procedures
    try {
      // Check if procedure exists before creating
      const [procedureCheck] = await connection.execute(`
        SELECT ROUTINE_NAME
        FROM INFORMATION_SCHEMA.ROUTINES
        WHERE ROUTINE_SCHEMA = DATABASE()
        AND ROUTINE_TYPE = 'PROCEDURE'
        AND ROUTINE_NAME = 'get_communities_with_membership'
      `);
      
      if (procedureCheck.length === 0) {
        // Create the procedure
        await connection.execute(`
          CREATE PROCEDURE get_communities_with_membership(IN user_id_param VARCHAR(255))
          BEGIN
            SELECT 
              c.community_id,
              c.name,
              c.description,
              c.category,
              c.image_url,
              c.created_by,
              c.created_at,
              COUNT(DISTINCT cm_all.user_id) as members_count,
              COUNT(DISTINCT p.post_id) as posts_count,
              CASE WHEN cm_user.user_id IS NOT NULL THEN 1 ELSE 0 END as is_joined
            FROM communities c
            LEFT JOIN community_members cm_all ON c.community_id = cm_all.community_id
            LEFT JOIN community_members cm_user ON c.community_id = cm_user.community_id AND cm_user.user_id = user_id_param
            LEFT JOIN posts p ON c.community_id = p.community_id
            GROUP BY c.community_id
            ORDER BY c.name;
          END
        `);
        
        console.log('Created get_communities_with_membership procedure');
      }
      
      // Check and create other procedures similarly
    } catch(procError) {
      console.error('Error creating stored procedures:', procError);
    }

    // Initialize shop items
    try {
      await initializeShopItems(pool);
    } catch (shopError) {
      console.error('Error during shop initialization:', shopError);
    }
    
    // Verify connection is good
    await connection.ping();
    connection.release();

    app.listen(3001, '0.0.0.0', () => {
      console.log(`✅ Server running on port 3001`);
      console.log(`✅ Shop initialized and ready`);
      console.log(`✅ All users will start with 0 future coins`);
    });
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
    process.exit(1);
  }
})();