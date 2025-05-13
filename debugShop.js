// debugShop.js - Run these commands in your server console to diagnose and fix shop issues
// Run this file with: node debugShop.js

// Import required modules
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'test',
  waitForConnections: true,
  connectionLimit: 10
});

// Import the shopSetup functions
const { 
  initializeShopItems, 
  forceInitShopItems, 
  ensureUserHasCoins,
  checkItemsTable
} = require('./routes/shopSetup');

// Check if items table exists and has correct structure
async function checkShopTables() {
  console.log("\n=== CHECKING SHOP TABLES ===");
  try {
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'items'
    `);
    console.log(`✓ items table exists: ${tables.length > 0 ? 'YES' : 'NO'}`);
    
    if (tables.length > 0) {
      const [columns] = await pool.execute(`DESCRIBE items`);
      console.log(`✓ items table columns:`, columns.map(c => c.Field));
      
      const [count] = await pool.execute(`SELECT COUNT(*) as count FROM items`);
      console.log(`✓ items table contains ${count[0].count} rows`);
      
      if (count[0].count > 0) {
        const [sampleItems] = await pool.execute(`SELECT * FROM items LIMIT 3`);
        console.log(`✓ First few items:`, sampleItems);
      } else {
        console.log(`❌ PROBLEM: No items found in the table!`);
      }
    } else {
      console.log(`❌ PROBLEM: The items table doesn't exist!`);
      
      // Create the table if it doesn't exist
      console.log(`Creating items table...`);
      await pool.execute(`
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
      console.log(`✓ Items table created`);
    }
    
    // Also check the user_items junction table
    const [userItemTables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_items'
    `);
    
    console.log(`✓ user_items table exists: ${userItemTables.length > 0 ? 'YES' : 'NO'}`);
    
    if (userItemTables.length === 0) {
      console.log(`❌ PROBLEM: The user_items table doesn't exist!`);
      
      // Create the table if it doesn't exist
      console.log(`Creating user_items table...`);
      await pool.execute(`
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
      console.log(`✓ user_items table created`);
    }
  } catch (error) {
    console.error(`❌ Error checking shop tables:`, error);
  }
}

// Force add default items to the shop
async function resetShopItems() {
  console.log("\n=== RESETTING SHOP ITEMS ===");
  try {
    await forceInitShopItems(pool);
    console.log("✓ Shop items have been reset");
    
    const [count] = await pool.execute(`SELECT COUNT(*) as count FROM items`);
    console.log(`✓ Items table now contains ${count[0].count} rows`);
    
    const [items] = await pool.execute(`SELECT * FROM items`);
    console.log(`✓ All shop items:`, items);
  } catch (error) {
    console.error(`❌ Error resetting shop items:`, error);
  }
}

// Test user creation and coins setup
async function setupTestUser(userId = 'test-user') {
  console.log(`\n=== SETTING UP TEST USER: ${userId} ===`);
  
  try {
    console.log(`Testing coins for user: ${userId}`);
    
    // Check if user exists first
    const [userBefore] = await pool.execute(`SELECT * FROM users WHERE user_id = ?`, [userId]);
    console.log(`✓ User exists before setup: ${userBefore.length > 0 ? 'YES' : 'NO'}`);
    if (userBefore.length > 0) {
      console.log(`✓ User info:`, userBefore[0]);
    }
    
    // Set up coins
    await ensureUserHasCoins(pool, userId, 500);
    console.log(`✓ Ensured user has coins`);
    
    // Check user after
    const [userAfter] = await pool.execute(`SELECT * FROM users WHERE user_id = ?`, [userId]);
    if (userAfter.length > 0) {
      console.log(`✓ User after setup:`, userAfter[0]);
    } else {
      console.log(`❌ PROBLEM: User not found after setup!`);
    }
  } catch (error) {
    console.error(`❌ Error setting up test user:`, error);
  }
}

// Run API tests
async function testApi(userId = 'test-user') {
  console.log(`\n=== TESTING API ENDPOINTS FOR USER: ${userId} ===`);

  // Define a mock Express request and response
  const createMockReq = (params = {}, query = {}, body = {}) => {
    return {
      params,
      query,
      body,
      user: { uid: userId }
    };
  };
  
  const createMockRes = () => {
    const res = {
      statusCode: 200,
      statusMessage: '',
      data: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.data = data;
        return this;
      }
    };
    return res;
  };
  
  try {
    // Test shop items endpoint
    console.log(`Testing GET /items endpoint...`);
    const itemsReq = createMockReq();
    const itemsRes = createMockRes();
    
    // Directly use pool to simulate the endpoint
    const [items] = await pool.execute(`
      SELECT * FROM items 
      WHERE is_active = 1
      ORDER BY category, price
    `);
    
    console.log(`✓ GET /items would return ${items.length} items`);
    if (items.length === 0) {
      console.log(`❌ PROBLEM: No items returned from items table`);
    } else {
      console.log(`✓ Example item:`, items[0]);
    }
    
    // Test coins endpoint
    console.log(`\nTesting GET /items/coins/${userId} endpoint...`);
    
    // Directly use pool to simulate the endpoint 
    const [users] = await pool.execute(
      'SELECT future_coins FROM users WHERE user_id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      console.log(`❌ PROBLEM: User ${userId} not found in database`);
    } else {
      console.log(`✓ GET /items/coins/${userId} would return: ${users[0].future_coins} coins`);
    }
    
    // Test user items endpoint
    console.log(`\nTesting GET /items/user/${userId} endpoint...`);
    
    // Directly use pool to simulate the endpoint
    const [userItems] = await pool.execute(`
      SELECT ui.user_item_id, ui.user_id, ui.item_id, ui.purchased_at, ui.is_equipped,
             i.name, i.description, i.image_url, i.category, i.price
      FROM user_items ui
      JOIN items i ON ui.item_id = i.item_id
      WHERE ui.user_id = ?
      ORDER BY ui.is_equipped DESC, i.category, i.name
    `, [userId]);
    
    console.log(`✓ User ${userId} owns ${userItems.length} items`);
    
    // Test purchase flow
    if (items.length > 0 && users.length > 0) {
      console.log(`\nSimulating purchase flow...`);
      
      // Check if user already owns the first item
      const itemId = items[0].item_id;
      const [existingItems] = await pool.execute(
        'SELECT * FROM user_items WHERE user_id = ? AND item_id = ?',
        [userId, itemId]
      );
      
      if (existingItems.length > 0) {
        console.log(`✓ User already owns item ${itemId} (${items[0].name})`);
      } else {
        console.log(`✓ User does not own item ${itemId} (${items[0].name})`);
        
        // Check if user has enough coins
        const userCoins = users[0].future_coins;
        const itemPrice = items[0].price;
        
        if (userCoins >= itemPrice) {
          console.log(`✓ User has enough coins (${userCoins} >= ${itemPrice})`);
          console.log(`→ Purchase would succeed (not executing to avoid modifying data)`);
        } else {
          console.log(`✓ User does not have enough coins (${userCoins} < ${itemPrice})`);
          console.log(`→ Purchase would fail with "Not enough FutureCoins" error`);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error testing API:`, error);
  }
}

// Main function to run diagnostics
async function runDiagnostics() {
  try {
    console.log("=== STARTING SHOP DIAGNOSTICS ===");
    
    await checkShopTables();
    
    // Get the count of items
    const [itemCount] = await pool.execute(`SELECT COUNT(*) as count FROM items`);
    
    // If no items, initialize them
    if (itemCount[0].count === 0) {
      console.log("\n❌ PROBLEM: No items found in shop! Initializing...");
      await resetShopItems();
    }
    
    // Setup a test user
    await setupTestUser();
    
    // Test API endpoints
    await testApi();
    
    console.log("\n=== DIAGNOSTICS COMPLETE ===");
    console.log("If you saw any PROBLEM messages above, follow the suggestions to fix them.");
    console.log("If no problems were found, check your client-side code for issues.");
    
  } catch (error) {
    console.error("Error running diagnostics:", error);
  } finally {
    // End the pool
    await pool.end();
    process.exit(0);
  }
}

// Run the diagnostics
runDiagnostics();