// shopSetup.js
// This file contains functions to set up shop items and initialize users with FutureCoins

/**
 * Initialize shop items and make sure they exist in the database
 * @param {*} pool - MySQL connection pool
 */
async function initializeShopItems(pool) {
  console.log("[SHOP DEBUG] Starting shop items initialization...");
  
  try {
    // Default shop items to ensure they exist
    const defaultItems = [
      {
        name: 'Dark Theme',
        description: 'A sleek dark theme for the app',
        category: 'theme',
        price: 150,
        is_active: 1
      },
      {
        name: 'Space Avatar',
        description: 'An astronaut avatar for your profile',
        category: 'avatar',
        price: 200,
        is_active: 1
      },
      {
        name: 'Gold Badge Frame',
        description: 'A special frame for your profile badges',
        category: 'badge',
        price: 250,
        is_active: 1
      },
      {
        name: 'Animated Celebrations',
        description: 'Special animations when you complete goals',
        category: 'feature',
        price: 300,
        is_active: 1
      }
    ];

    // Check if items table exists
    const [tableCheck] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'items'
    `);
    
    if (tableCheck.length === 0) {
      console.error('[SHOP DEBUG] Items table does not exist!');
      return;
    }
    
    console.log("[SHOP DEBUG] Items table exists, checking for data...");

    const connection = await pool.getConnection();
    try {
      // Check if items table is empty
      const [itemCount] = await connection.execute('SELECT COUNT(*) as count FROM items');
      console.log(`[SHOP DEBUG] Found ${itemCount[0].count} items in database`);
      
      // Only insert default items if the table is empty
      if (itemCount[0].count === 0) {
        console.log('[SHOP DEBUG] Initializing default shop items...');
        
        // First check for and delete duplicates
        try {
          await connection.execute('SET SQL_SAFE_UPDATES = 0');
          
          for (const item of defaultItems) {
            // Remove any duplicates
            await connection.execute(
              'DELETE FROM items WHERE name = ? AND category = ?',
              [item.name, item.category]
            );
            
            // Insert item
            await connection.execute(
              'INSERT INTO items (name, description, category, price, is_active) VALUES (?, ?, ?, ?, ?)',
              [item.name, item.description, item.category, item.price, item.is_active]
            );
            
            console.log(`[SHOP DEBUG] Added item: ${item.name}`);
          }
          
          await connection.execute('SET SQL_SAFE_UPDATES = 1');
        } catch (insertError) {
          console.error('[SHOP DEBUG] Error inserting items:', insertError);
          throw insertError;
        }
        
        // Verify items were added
        const [verifyCount] = await connection.execute('SELECT COUNT(*) as count FROM items');
        console.log(`[SHOP DEBUG] After initialization: ${verifyCount[0].count} items in database`);
        
        console.log('[SHOP DEBUG] Default shop items initialized successfully!');
      } else {
        console.log('[SHOP DEBUG] Shop items already exist, skipping initialization');
        
        // Show the existing items
        const [existingItems] = await connection.execute('SELECT name, category, price FROM items LIMIT 5');
        console.log('[SHOP DEBUG] Example items:', existingItems);
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[SHOP DEBUG] Error initializing shop items:', error);
    throw error;
  }
}

/**
 * Ensure a user has the specified amount of FutureCoins
 * This creates the user if they don't exist
 * @param {*} pool - MySQL connection pool
 * @param {string} userId - User ID
 * @param {number} coins - Amount of coins to ensure the user has (minimum)
 */
async function ensureUserHasCoins(pool, userId, coins = 0) {
  console.log(`[SHOP DEBUG] Ensuring user ${userId} has at least ${coins} coins`);
  
  if (!userId) {
    console.error('[SHOP DEBUG] Cannot ensure coins for user: No user ID provided');
    return;
  }
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Check if user exists
    const [userCheck] = await connection.execute('SELECT user_id, future_coins FROM users WHERE user_id = ?', [userId]);
    
    if (userCheck.length === 0) {
      // User doesn't exist, create them with the specified coins
      console.log(`[SHOP DEBUG] Creating new user ${userId} with ${coins} FutureCoins`);
      
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
            coins, // Give them the specified coins
            new Date() // Current timestamp
          ]
        );
        
        console.log(`[SHOP DEBUG] User ${userId} created with ${coins} coins`);
      } catch (insertError) {
        console.error('[SHOP DEBUG] Error creating user:', insertError);
        throw insertError;
      }
    } else {
      // User exists, check if they need more coins
      const currentCoins = userCheck[0].future_coins;
      
      console.log(`[SHOP DEBUG] User ${userId} exists with ${currentCoins} coins`);
      
      if (currentCoins < coins) {
        // User has fewer coins than the minimum, update their balance
        const coinsToAdd = coins - currentCoins;
        console.log(`[SHOP DEBUG] Adding ${coinsToAdd} FutureCoins to user ${userId}`);
        
        await connection.execute(
          'UPDATE users SET future_coins = ? WHERE user_id = ?',
          [coins, userId]
        );
        
        console.log(`[SHOP DEBUG] Updated user coins to ${coins}`);
      }
    }
    
    await connection.commit();
    
    // Verify user has coins
    const [verifyUser] = await pool.execute('SELECT user_id, future_coins FROM users WHERE user_id = ?', [userId]);
    if (verifyUser.length > 0) {
      console.log(`[SHOP DEBUG] Verified: User ${userId} has ${verifyUser[0].future_coins} coins`);
    } else {
      console.error(`[SHOP DEBUG] Verification failed: User ${userId} not found after operations!`);
    }
  } catch (error) {
    await connection.rollback();
    console.error(`[SHOP DEBUG] Error ensuring FutureCoins for user ${userId}:`, error);
    throw error;
  } finally {
    connection.release();
  }
}

// Add this function to your setup to initialize the default coins for a new user
async function setupUserWithDefaultCoins(pool, userId) {
  console.log(`[SHOP DEBUG] Setting up user ${userId} with default coins`);
  
  if (!userId) {
    console.error("[SHOP DEBUG] Cannot set up user: No user ID provided");
    return;
  }
  
  try {
    // Default amount of FutureCoins for new users
    const DEFAULT_COINS = 0;
    
    await ensureUserHasCoins(pool, userId, DEFAULT_COINS);
    console.log(`[SHOP DEBUG] User ${userId} set up with ${DEFAULT_COINS} FutureCoins`);
    return true;
  } catch (error) {
    console.error(`[SHOP DEBUG] Failed to set up user ${userId} with coins:`, error);
    return false;
  }
}

// Function to directly insert shop items (use for emergencies)
async function forceInitShopItems(pool) {
  console.log("[SHOP DEBUG] Force initializing shop items...");
  
  const defaultItems = [
    {
      name: 'Dark Theme',
      description: 'A sleek dark theme for the app',
      category: 'theme',
      price: 150,
      is_active: 1
    },
    {
      name: 'Space Avatar',
      description: 'An astronaut avatar for your profile',
      category: 'avatar',
      price: 200,
      is_active: 1
    },
    {
      name: 'Gold Badge Frame',
      description: 'A special frame for your profile badges',
      category: 'badge',
      price: 250,
      is_active: 1
    },
    {
      name: 'Animated Celebrations',
      description: 'Special animations when you complete goals',
      category: 'feature',
      price: 300,
      is_active: 1
    }
  ];

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Force reset the table
    try {
      await connection.execute('TRUNCATE TABLE items');
      console.log("[SHOP DEBUG] Items table truncated");
    } catch (truncateError) {
      console.error("[SHOP DEBUG] Error truncating items table:", truncateError);
      
      // Try to delete all items instead
      try {
        await connection.execute('SET SQL_SAFE_UPDATES = 0');
        await connection.execute('DELETE FROM items');
        await connection.execute('SET SQL_SAFE_UPDATES = 1');
        console.log("[SHOP DEBUG] Deleted all items instead of truncating");
      } catch (deleteError) {
        console.error("[SHOP DEBUG] Error deleting items:", deleteError);
      }
    }
    
    // Insert the items one by one
    for (const item of defaultItems) {
      await connection.execute(
        'INSERT INTO items (name, description, category, price, is_active) VALUES (?, ?, ?, ?, ?)',
        [item.name, item.description, item.category, item.price, item.is_active]
      );
      console.log(`[SHOP DEBUG] Force added item: ${item.name}`);
    }
    
    await connection.commit();
    console.log("[SHOP DEBUG] Force initialization complete!");
  } catch (error) {
    await connection.rollback();
    console.error("[SHOP DEBUG] Force initialization failed:", error);
  } finally {
    connection.release();
  }
}

// Debug utility functions
// Check if items table exists and has correct structure
async function checkItemsTable(pool) {
  try {
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'items'
    `);
    console.log(`items table exists: ${tables.length > 0}`);
    
    if (tables.length > 0) {
      const [columns] = await pool.execute(`DESCRIBE items`);
      console.log(`items table columns:`, columns.map(c => c.Field));
      
      const [count] = await pool.execute(`SELECT COUNT(*) as count FROM items`);
      console.log(`items table row count: ${count[0].count}`);
      
      if (count[0].count > 0) {
        const [sampleItems] = await pool.execute(`SELECT * FROM items LIMIT 3`);
        console.log(`Sample items:`, sampleItems);
      }
    }
    return tables.length > 0;
  } catch (error) {
    console.error(`Error checking items table:`, error);
    return false;
  }
}

module.exports = {
  initializeShopItems,
  ensureUserHasCoins,
  setupUserWithDefaultCoins,
  forceInitShopItems,
  checkItemsTable
};