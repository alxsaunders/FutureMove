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
    const userId = 'KbtY3t4Tatd0r5tCjnjlmJyNT5R2'|| 'default_user';
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
      progress: goal.progress,
      startDate: goal.target_date ? new Date(goal.target_date).toISOString().split('T')[0] : null,
      userId: goal.user_id,
      coinReward: goal.coin_reward
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
    goal.subgoals = subgoals;
    res.json(goal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/goals', async (req, res) => {
  try {
    const userId = 'KbtY3t4Tatd0r5tCjnjlmJyNT5R2'|| 'default_user';
    const {
      title = 'New Goal',
      description = '',
      startDate = getToday(),
      progress = 0,
      category = 'Personal',
      isCompleted = false,
      coin_reward = 10,
      subgoals = []
    } = req.body;
const [result] = await pool.execute(
  `INSERT INTO goals (user_id, title, description, target_date, progress, is_completed, category, coin_reward)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  [userId, title, description, startDate, progress, isCompleted, category, coin_reward]
);


    const goalId = result.insertId;
    for (const s of subgoals) {
      await pool.execute(
        `INSERT INTO subgoals (goal_id, title, is_completed, due_date) VALUES (?, ?, ?, ?)`,
        [goalId, s.title, s.isCompleted || false, s.dueDate || null]
      );
    }

    const [goalRows] = await pool.execute(`SELECT * FROM goals WHERE goal_id = ?`, [goalId]);
    res.status(201).json(goalRows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/goals/:id/progress', async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    const newProgress = Math.min(Math.max(req.body.progress, 0), 100);
    const isCompleted = newProgress >= 100;
    await pool.execute(`UPDATE goals SET progress = ?, is_completed = ? WHERE goal_id = ?`, [newProgress, isCompleted, goalId]);
    const [goal] = await pool.execute(`SELECT * FROM goals WHERE goal_id = ?`, [goalId]);
    res.json(goal[0]);
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

(async () => {
  try {
    const connection = await pool.getConnection();
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