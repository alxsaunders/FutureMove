const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

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

// Routes
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// ==== USER ROUTES ====

app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET a specific user
app.get('/api/users/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [userId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/users', async (req, res) => {
  const {
    user_id, username, name, email,
    password = null,
    level = 1,
    xp_points = 0,
    future_coins = 0,
    created_at = new Date(),
    last_login = null
  } = req.body;

  if (!user_id || !username || !name || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await pool.query(
      `INSERT INTO users (user_id, username, name, email, password, level, xp_points, future_coins, created_at, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, username, name, email, password, level, xp_points, future_coins, created_at, last_login]
    );
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('MySQL insert error:', error);
    res.status(500).json({ error: 'Database insert failed' });
  }
});

// UPDATE user stats (XP and coins with level-up logic)
app.put('/api/users/:userId/stats', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const userId = req.params.userId;
    const { xp_points_to_add, future_coins_to_add } = req.body;
    
    await connection.beginTransaction();
    
    // Get current user stats
    const [userData] = await connection.query(
      'SELECT level, xp_points, future_coins FROM users WHERE user_id = ?',
      [userId]
    );
    
    if (userData.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'User not found' });
    }
    
    const currentUser = userData[0];
    
    // Calculate new XP and level
    let newXpPoints = currentUser.xp_points + xp_points_to_add;
    let newLevel = currentUser.level;
    
    // Check for level up (every 100 XP)
    if (newXpPoints >= 100) {
      const levelsGained = Math.floor(newXpPoints / 100);
      newLevel += levelsGained;
      newXpPoints = newXpPoints % 100; // Keep the remainder
    }
    
    // Calculate new coins
    const newCoins = currentUser.future_coins + future_coins_to_add;
    
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
    res.status(500).json({ error: 'Internal server error' });
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
    const { increment = true, trackable_id = 0 } = req.body;
    
    await connection.beginTransaction();
    
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
    const userId = req.query.userId || 'default_user';
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
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get goals for today
app.get('/api/goals/today', async (req, res) => {
  try {
    const userId = req.query.userId || 'default_user';
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
          const routineDays = JSON.parse(goal.routine_days);
          // If no days specified or today is in the routine days
          return routineDays.length === 0 || routineDays.includes(today);
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
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/goals/:id', async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    const [rows] = await pool.execute(`SELECT * FROM goals WHERE goal_id = ?`, [goalId]);
    if (!rows.length) return res.status(404).json({ error: 'Goal not found' });

    const [subgoals] = await pool.execute(`SELECT * FROM subgoals WHERE goal_id = ?`, [goalId]);
    const goal = rows[0];
    
    // Parse routine days if they exist
    if (goal.routine_days) {
      goal.routineDays = JSON.parse(goal.routine_days);
    } else {
      goal.routineDays = [];
    }
    
    // Add type field
    goal.type = goal.is_daily === 1 ? 'recurring' : 'one-time';
    
    // Add targetDate
    goal.targetDate = goal.target_date ? new Date(goal.target_date).toISOString().split('T')[0] : null;
    
    goal.subgoals = subgoals;
    res.json(goal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/goals', async (req, res) => {
  try {
    // Get the user ID from the request or use a default
    const userId = req.body.user_id || 'default_user';
    
    // First check if the user exists
    const [userRows] = await pool.execute(
      `SELECT COUNT(*) as count FROM users WHERE user_id = ?`, 
      [userId]
    );
    
    // If user doesn't exist, create a default user with this ID
    if (userRows[0].count === 0) {
      console.log(`User ${userId} doesn't exist, creating default user...`);
      
      try {
        await pool.execute(
          `INSERT INTO users (user_id, username, name, email, level, xp_points, future_coins, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            `user_${userId.substring(0, 6)}`, // Create a username based on ID
            "Default User", 
            `user_${userId.substring(0, 6)}@example.com`, 
            1, // Default level
            0, // Default XP
            100, // Default coins
            new Date() // Current timestamp
          ]
        );
        console.log(`Created default user with ID: ${userId}`);
      } catch (userError) {
        console.error('Failed to create user:', userError);
        // If we can't create a user, try to find any existing user
        const [existingUsers] = await pool.execute(`SELECT user_id FROM users LIMIT 1`);
        if (existingUsers.length === 0) {
          return res.status(400).json({ 
            error: 'Could not create user and no existing users found',
            details: userError.message
          });
        }
        // Use an existing user instead
        userId = existingUsers[0].user_id;
        console.log(`Using existing user with ID: ${userId} instead`);
      }
    }
    
    // Now proceed with goal creation
    const {
      title = 'New Goal',
      description = '',
      target_date = getToday(),
      progress = 0,
      category = 'Personal',
      is_completed = 0,
      is_daily = 0,
      routine_days = null, // JSON string of day indices
      coin_reward = 10,
      subgoals = [],
      type = is_daily ? 'recurring' : 'one-time' // Add type field with default
    } = req.body;

    // Insert the goal
    const [result] = await pool.execute(
      `INSERT INTO goals (user_id, title, description, target_date, progress, is_completed, is_daily, routine_days, category, coin_reward)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, title, description, target_date, progress, is_completed, is_daily, routine_days, category, coin_reward]
    );

    const goalId = result.insertId;
    
    // Insert subgoals if any
    for (const s of subgoals) {
      await pool.execute(
        `INSERT INTO subgoals (goal_id, title, is_completed, due_date) VALUES (?, ?, ?, ?)`,
        [goalId, s.title, s.isCompleted || false, s.dueDate || null]
      );
    }

    // Return the created goal
    const [goalRows] = await pool.execute(`SELECT * FROM goals WHERE goal_id = ?`, [goalId]);
    const newGoal = goalRows[0];
    
    // Parse routine_days for the response
    if (newGoal.routine_days) {
      newGoal.routineDays = JSON.parse(newGoal.routine_days);
    } else {
      newGoal.routineDays = [];
    }
    
    // Add type field
    newGoal.type = newGoal.is_daily === 1 ? 'recurring' : 'one-time';
    
    // Add targetDate
    newGoal.targetDate = newGoal.target_date ? new Date(newGoal.target_date).toISOString().split('T')[0] : null;
    
    res.status(201).json(newGoal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.put('/api/goals/:id/progress', async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    const newProgress = Math.min(Math.max(req.body.progress, 0), 100);
    const isCompleted = newProgress >= 100 ? 1 : 0;
    
    await pool.execute(
      `UPDATE goals SET progress = ?, is_completed = ? WHERE goal_id = ?`, 
      [newProgress, isCompleted, goalId]
    );
    
    // Get updated goal
    const [rows] = await pool.execute(`SELECT * FROM goals WHERE goal_id = ?`, [goalId]);
    if (!rows.length) return res.status(404).json({ error: 'Goal not found' });
    
    const goal = rows[0];
    
    // Parse routine days if they exist
    if (goal.routine_days) {
      goal.routineDays = JSON.parse(goal.routine_days);
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
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update routine days for a goal
app.patch('/api/goals/:id/routine', async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    const { routine_days } = req.body; // Expects a JSON string
    
    await pool.execute(
      `UPDATE goals SET routine_days = ? WHERE goal_id = ?`,
      [routine_days, goalId]
    );
    
    const [rows] = await pool.execute(`SELECT * FROM goals WHERE goal_id = ?`, [goalId]);
    if (!rows.length) return res.status(404).json({ error: 'Goal not found' });
    
    const goal = rows[0];
    
    // Parse routine days for the response
    if (goal.routine_days) {
      goal.routineDays = JSON.parse(goal.routine_days);
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
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/goals/:id/subgoals', async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    const { title, isCompleted = false, dueDate = null } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO subgoals (goal_id, title, is_completed, due_date) VALUES (?, ?, ?, ?)`,
      [goalId, title, isCompleted, dueDate]
    );
    const [rows] = await pool.execute(`SELECT * FROM subgoals WHERE id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/subgoals/:id/toggle', async (req, res) => {
  try {
    const subGoalId = Number(req.params.id);
    const [rows] = await pool.execute(`SELECT is_completed FROM subgoals WHERE id = ?`, [subGoalId]);
    if (!rows.length) return res.status(404).json({ error: 'Subgoal not found' });
    const current = rows[0].is_completed;
    await pool.execute(`UPDATE subgoals SET is_completed = ? WHERE id = ?`, [!current, subGoalId]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==== ROUTINES ROUTES ====

// Get routines for a user
app.get('/api/routines', async (req, res) => {
  try {
    const userId = req.query.userId || 'default_user';
    
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
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle routine completion
app.put('/api/routines/:id/toggle', async (req, res) => {
  try {
    const routineId = Number(req.params.id);
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
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==== LEGACY/COMPATIBILITY ENDPOINTS ====

app.get('/api/users/:id/futurecoins', async (req, res) => {
  try {
    const userId = req.params.id;
    const [rows] = await pool.execute(`SELECT future_coins FROM users WHERE user_id = ?`, [userId]);
    res.json({ futureCoins: rows[0]?.future_coins || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Used by GoalService.updateUserCoins
app.put('/api/users/:id/futurecoins', async (req, res) => {
  try {
    const userId = req.params.id;
    const { amount } = req.body;
    
    await pool.execute(
      `UPDATE users SET future_coins = future_coins + ? WHERE user_id = ?`,
      [amount, userId]
    );
    
    const [rows] = await pool.execute(`SELECT future_coins FROM users WHERE user_id = ?`, [userId]);
    res.json({ futureCoins: rows[0]?.future_coins || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Used by GoalService.updateUserXP
app.put('/api/users/:id/xp', async (req, res) => {
  try {
    const userId = req.params.id;
    const { amount } = req.body;
    
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
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==== DATABASE INITIALIZATION ====

(async () => {
  try {
    const connection = await pool.getConnection();
    
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
        await connection.execute(`ALTER TABLE goals ADD COLUMN type VARCHAR(20) NULL AFTER routine_days`);
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
    
    // Check if targetDate column exists
    const [targetDateColumn] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'goals' 
      AND COLUMN_NAME = 'target_date'
    `);
    
    // Make sure it exists (it should already be there)
    if (targetDateColumn.length === 0) {
      console.log('Adding target_date column to goals table...');
      try {
        await connection.execute(`ALTER TABLE goals ADD COLUMN target_date DATE NULL AFTER description`);
        console.log('target_date column added successfully!');
      } catch (columnError) {
        console.error('Failed to add target_date column:', columnError);
      }
    }
    
    // Check if routine_days column exists
    const [routineDaysColumn] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'goals' 
      AND COLUMN_NAME = 'routine_days'
    `);
    
    if (routineDaysColumn.length === 0) {
      console.log('Adding routine_days column to goals table...');
      await connection.execute(`ALTER TABLE goals ADD COLUMN routine_days TEXT NULL AFTER is_daily`);
      console.log('routine_days column added successfully!');
      
      // Migrate existing daily goals to have all days selected
      await connection.execute(`
        UPDATE goals 
        SET routine_days = '[0,1,2,3,4,5,6]' 
        WHERE goal_id > 0 AND is_daily = 1 AND (routine_days IS NULL OR routine_days = '')
      `);
    }
    
    await connection.ping();
    connection.release();

    app.listen(3001, '0.0.0.0', () => {
      console.log(`\u2705 Server running on port 3001`);
    });
  } catch (error) {
    console.error('\u274C Unable to connect to database:', error);
    process.exit(1);
  }
})();