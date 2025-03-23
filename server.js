// server.js
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Database connection pool
const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'root', // Add your MySQL password here
  database: 'futuremove_db',
  waitForConnections: true,
  connectionLimit: 10
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new user
app.post('/api/users', async (req, res) => {
  const { user_id, username, name, email } = req.body;
  
  if (!user_id || !username || !name || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    await pool.query(
      'INSERT INTO users (user_id, username, name, email) VALUES (?, ?, ?, ?)',
      [user_id, username, name, email]
    );
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error creating user:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});