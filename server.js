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

app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    res.json(rows);
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

// GOALS
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
      routineDays: goal.routine_days ? JSON.parse(goal.routine_days) : [] // Parse routine days
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
        routineDays: goal.routine_days ? JSON.parse(goal.routine_days) : []
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
      subgoals = []
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
    
    // If goal is completed, update streaks and coins
    if (isCompleted && newProgress >= 100) {
      // Get the user ID from the goal
      const userId = goal.user_id;
      
      // Update the user's coins
      await pool.execute(
        `UPDATE users SET future_coins = future_coins + ? WHERE user_id = ?`,
        [goal.coin_reward || 10, userId]
      );
      
      // Update streaks - simplified implementation
      // In a real app, you'd check if the user completed a goal yesterday too
      const today = getToday();
      // Check if the streak table exists
      try {
        const [streakRows] = await pool.execute(
          `SELECT * FROM streaks WHERE user_id = ? ORDER BY streak_date DESC LIMIT 1`,
          [userId]
        );
        
        if (streakRows.length > 0) {
          const lastStreak = streakRows[0];
          await pool.execute(
            `INSERT INTO streaks (user_id, streak_date, current_streak) VALUES (?, ?, ?)`,
            [userId, today, lastStreak.current_streak + 1]
          );
        } else {
          // First streak
          await pool.execute(
            `INSERT INTO streaks (user_id, streak_date, current_streak) VALUES (?, ?, ?)`,
            [userId, today, 1]
          );
        }
      } catch (streakError) {
        // If streaks table doesn't exist, just log the error
        console.error('Streak update error:', streakError);
      }
    }
    
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
      routineDays: goal.routine_days ? JSON.parse(goal.routine_days) : []
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
      routineDays: goal.routineDays || []
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

app.get('/api/users/:id/streak', async (req, res) => {
  try {
    const userId = req.params.id;
    // Check if streaks table exists first
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'streaks'
    `);
    
    if (tables.length === 0) {
      // Streaks table doesn't exist yet
      return res.json({ streak: 0 });
    }
    
    const [rows] = await pool.execute(`SELECT MAX(current_streak) as streak_count FROM streaks WHERE user_id = ?`, [userId]);
    res.json({ streak: rows[0].streak_count || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

(async () => {
  try {
    const connection = await pool.getConnection();
    
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
    
    // Check if streaks table exists
    const [streaksTable] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'streaks'
    `);
    
    if (streaksTable.length === 0) {
      console.log('Creating streaks table...');
      try {
        await connection.execute(`
          CREATE TABLE streaks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(50) NOT NULL,
            streak_date DATE NOT NULL,
            current_streak INT NOT NULL DEFAULT 1,
            INDEX idx_streaks_user (user_id),
            INDEX idx_streaks_date (streak_date)
          )
        `);
        console.log('streaks table created successfully!');
      } catch (tableError) {
        console.error('Failed to create streaks table:', tableError);
        // Not critical, can continue without it
      }
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