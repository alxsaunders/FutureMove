// routes/itemshop.js
const express = require('express');
const router = express.Router();
const { ensureUserHasCoins } = require('./shopSetup');

// Enable detailed debugging
const DEBUG_SHOP = true;

// Helper functions
const handleError = (res, error, message = 'Server error') => {
  console.error(`${message}:`, error);
  res.status(500).json({ error: message, details: error.message });
};

module.exports = (pool, authenticateFirebaseToken) => {
  // Apply authentication middleware - to validate user tokens
  router.use(authenticateFirebaseToken);
  
  // GET all shop items
  router.get('/', async (req, res) => {
    if (DEBUG_SHOP) console.log(`[SHOP DEBUG] GET / - Fetching all shop items`);
    
    try {
      // Get items from the items table (not shop_items)
      const [rows] = await pool.execute(`
        SELECT * FROM items 
        WHERE is_active = 1
        ORDER BY category, price
      `);
      
      if (DEBUG_SHOP) {
        console.log(`[SHOP DEBUG] Found ${rows.length} items in the shop`);
        if (rows.length === 0) {
          console.log(`[SHOP DEBUG] No items found - checking table exists and has data`);
          // Execute a simple query to verify the table exists and has the expected structure
          pool.execute('DESCRIBE items').then(([tableInfo]) => {
            console.log(`[SHOP DEBUG] items table structure:`, tableInfo.map(col => col.Field));
          }).catch(err => {
            console.error(`[SHOP DEBUG] Error checking items table:`, err);
          });
          
          // Check if there are any rows in the table regardless of is_active
          pool.execute('SELECT COUNT(*) as total FROM items').then(([countResult]) => {
            console.log(`[SHOP DEBUG] Total rows in items table: ${countResult[0].total}`);
          }).catch(err => {
            console.error(`[SHOP DEBUG] Error counting items:`, err);
          });
        } else {
          // Log the first item as a sample
          console.log(`[SHOP DEBUG] First item sample:`, rows[0]);
        }
      }
      
      res.json(rows);
    } catch (error) {
      console.error(`[SHOP DEBUG] Error fetching shop items:`, error);
      handleError(res, error, 'Error fetching shop items');
    }
  });
  
  // GET user's purchased items
  router.get('/user/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;
      
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] GET /user/${userId} - Fetching user items`);
      
      // Check if user has permission to access this data
      if (req.user && req.user.uid !== userId) {
        if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Unauthorized access - req.user.uid=${req.user.uid}, userId=${userId}`);
        return res.status(403).json({ error: 'Unauthorized access' });
      }
      
      // Ensure the user exists with coins before trying to get their items
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Ensuring user ${userId} exists before fetching items`);
      try {
        await ensureUserHasCoins(pool, userId);
      } catch (ensureError) {
        console.error(`[SHOP DEBUG] Error ensuring user has coins:`, ensureError);
      }
      
      // Join user_items with items to get full item details
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Executing query for user items`);
      const [rows] = await pool.execute(`
        SELECT ui.user_item_id, ui.user_id, ui.item_id, ui.purchased_at, ui.is_equipped,
               i.name, i.description, i.image_url, i.category, i.price
        FROM user_items ui
        JOIN items i ON ui.item_id = i.item_id
        WHERE ui.user_id = ?
        ORDER BY ui.is_equipped DESC, i.category, i.name
      `, [userId]);
      
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Found ${rows.length} items owned by user`);
      
      res.json(rows);
    } catch (error) {
      console.error(`[SHOP DEBUG] Error fetching user items:`, error);
      handleError(res, error, 'Error fetching user items');
    }
  });
  
  // Purchase an item
  router.post('/purchase/:userId/:itemId', async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
      const userId = req.params.userId;
      const itemId = parseInt(req.params.itemId);
      
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] POST /purchase/${userId}/${itemId} - Purchase request`);
      
      // Check if user has permission to perform this action
      if (req.user && req.user.uid !== userId) {
        if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Unauthorized purchase - req.user.uid=${req.user.uid}, userId=${userId}`);
        connection.release();
        return res.status(403).json({ 
          success: false, 
          message: 'Unauthorized access' 
        });
      }
      
      // Ensure user exists with default coins before transaction
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Ensuring user ${userId} exists before purchase`);
      try {
        await ensureUserHasCoins(pool, userId);
      } catch (ensureError) {
        console.error(`[SHOP DEBUG] Error ensuring user has coins:`, ensureError);
      }
      
      await connection.beginTransaction();
      
      // Check if user already owns this item
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Checking if user already owns item ${itemId}`);
      const [existingItems] = await connection.execute(
        'SELECT * FROM user_items WHERE user_id = ? AND item_id = ?',
        [userId, itemId]
      );
      
      if (existingItems.length > 0) {
        if (DEBUG_SHOP) console.log(`[SHOP DEBUG] User already owns this item`);
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          success: false, 
          message: 'You already own this item' 
        });
      }
      
      // Get item price
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Getting price for item ${itemId}`);
      const [items] = await connection.execute(
        'SELECT * FROM items WHERE item_id = ?',
        [itemId]
      );
      
      if (items.length === 0) {
        if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Item ${itemId} not found`);
        await connection.rollback();
        connection.release();
        return res.status(404).json({ 
          success: false, 
          message: 'Item not found' 
        });
      }
      
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Item found:`, items[0]);
      const itemPrice = items[0].price;
      
      // Check if user has enough coins
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Checking if user has enough coins`);
      const [users] = await connection.execute(
        'SELECT * FROM users WHERE user_id = ?',
        [userId]
      );
      
      // User should now exist due to ensureUserHasCoins, but double-check
      if (users.length === 0) {
        if (DEBUG_SHOP) console.log(`[SHOP DEBUG] User ${userId} not found in database`);
        await connection.rollback();
        connection.release();
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }
      
      const userCoins = users[0].future_coins;
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] User has ${userCoins} coins, item costs ${itemPrice}`);
      
      if (userCoins < itemPrice) {
        if (DEBUG_SHOP) console.log(`[SHOP DEBUG] User doesn't have enough coins`);
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          success: false, 
          message: 'Not enough FutureCoins' 
        });
      }
      
      // Deduct coins from user
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Deducting ${itemPrice} coins from user`);
      await connection.execute(
        'UPDATE users SET future_coins = future_coins - ? WHERE user_id = ?',
        [itemPrice, userId]
      );
      
      // Add item to user's inventory
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Adding item to user's inventory`);
      await connection.execute(
        'INSERT INTO user_items (user_id, item_id, purchased_at) VALUES (?, ?, NOW())',
        [userId, itemId]
      );
      
      // Get updated coins
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Getting updated coin balance`);
      const [updatedUsers] = await connection.execute(
        'SELECT future_coins FROM users WHERE user_id = ?',
        [userId]
      );
      
      await connection.commit();
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Purchase successful, user now has ${updatedUsers[0].future_coins} coins`);
      connection.release();
      
      res.json({ 
        success: true, 
        message: 'Item purchased successfully',
        futureCoins: updatedUsers[0].future_coins
      });
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(`[SHOP DEBUG] Rollback error:`, rollbackError);
      }
      
      connection.release();
      console.error(`[SHOP DEBUG] Error purchasing item:`, error);
      handleError(res, error, 'Error purchasing item');
    }
  });
  
  // Toggle item equipped status
  router.put('/toggle/:userId/:itemId', async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
      const userId = req.params.userId;
      const itemId = parseInt(req.params.itemId);
      
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] PUT /toggle/${userId}/${itemId} - Toggle equipped status`);
      
      // Check if user has permission to perform this action
      if (req.user && req.user.uid !== userId) {
        if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Unauthorized toggle - req.user.uid=${req.user.uid}, userId=${userId}`);
        connection.release();
        return res.status(403).json({ 
          success: false, 
          message: 'Unauthorized access' 
        });
      }
      
      // Ensure user exists before transaction
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Ensuring user ${userId} exists before toggle`);
      try {
        await ensureUserHasCoins(pool, userId);
      } catch (ensureError) {
        console.error(`[SHOP DEBUG] Error ensuring user has coins:`, ensureError);
      }
      
      await connection.beginTransaction();
      
      // Get current equipped status
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Getting current equip status`);
      const [items] = await connection.execute(
        'SELECT is_equipped FROM user_items WHERE user_id = ? AND item_id = ?',
        [userId, itemId]
      );
      
      if (items.length === 0) {
        if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Item not found in user inventory`);
        await connection.rollback();
        connection.release();
        return res.status(404).json({ 
          success: false, 
          message: 'Item not found in user inventory' 
        });
      }
      
      const currentStatus = items[0].is_equipped;
      const newStatus = currentStatus ? 0 : 1;
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Current status: ${currentStatus}, new status will be: ${newStatus}`);
      
      // Get the category of the item
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Getting item category`);
      const [itemData] = await connection.execute(
        'SELECT category FROM items WHERE item_id = ?',
        [itemId]
      );
      
      if (itemData.length === 0) {
        if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Item ${itemId} not found in items table`);
        await connection.rollback();
        connection.release();
        return res.status(404).json({ 
          success: false, 
          message: 'Item not found' 
        });
      }
      
      const category = itemData[0].category;
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Item category: ${category}`);
      
      // If equipping, unequip other items in the same category 
      // BUT ONLY for categories that should be exclusive (not badges)
      if (newStatus === 1 && category !== 'badge') {
        if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Unequipping other items in category: ${category} (exclusive category)`);
        await connection.execute(`
          UPDATE user_items ui
          JOIN items i ON ui.item_id = i.item_id
          SET ui.is_equipped = 0
          WHERE ui.user_id = ? AND i.category = ? AND ui.item_id != ?
        `, [userId, category, itemId]);
      } else if (newStatus === 1 && category === 'badge') {
        if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Equipping badge - allowing multiple badges to be equipped`);
        // For badges, we don't unequip other badges - multiple can be equipped
      }
      
      // Update this item's status
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Setting item ${itemId} equipped status to ${newStatus}`);
      await connection.execute(
        'UPDATE user_items SET is_equipped = ? WHERE user_id = ? AND item_id = ?',
        [newStatus, userId, itemId]
      );
      
      await connection.commit();
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Toggle completed successfully`);
      connection.release();
      
      res.json({ 
        success: true, 
        message: newStatus ? 'Item equipped' : 'Item unequipped'
      });
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(`[SHOP DEBUG] Rollback error:`, rollbackError);
      }
      
      connection.release();
      console.error(`[SHOP DEBUG] Error toggling item:`, error);
      handleError(res, error, 'Error toggling item');
    }
  });
  // Get user's FutureCoins
  router.get('/coins/:userId', async (req, res) => {
    const userId = req.params.userId;
    
    if (DEBUG_SHOP) console.log(`[SHOP DEBUG] GET /coins/${userId} - Fetching coins`);
    
    try {
      // Check if user has permission to access this data
      if (req.user && req.user.uid !== userId) {
        if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Unauthorized access - req.user.uid=${req.user.uid}, userId=${userId}`);
        return res.status(403).json({ error: 'Unauthorized access' });
      }
      
      // Ensure user exists with default coins
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Ensuring user ${userId} exists with coins`);
      
      try {
        await ensureUserHasCoins(pool, userId);
        if (DEBUG_SHOP) console.log(`[SHOP DEBUG] User ensured with coins`);
      } catch (ensureError) {
        console.error(`[SHOP DEBUG] Error ensuring user has coins:`, ensureError);
      }
      
      const [rows] = await pool.execute(
        'SELECT future_coins FROM users WHERE user_id = ?',
        [userId]
      );
      
      if (DEBUG_SHOP) {
        if (rows.length === 0) {
          console.log(`[SHOP DEBUG] User ${userId} not found after ensuring coins!`);
          // Check if user exists at all
          pool.execute('SELECT COUNT(*) as count FROM users').then(([countResult]) => {
            console.log(`[SHOP DEBUG] Total users in database: ${countResult[0].count}`);
          });
        } else {
          console.log(`[SHOP DEBUG] User ${userId} has ${rows[0].future_coins} FutureCoins`);
        }
      }
      
      // User should exist now due to ensureUserHasCoins
      if (rows.length === 0) {
        if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Returning 0 coins as fallback`);
        return res.json({ futureCoins: 0 });
      }
      
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Returning ${rows[0].future_coins} coins`);
      res.json({ futureCoins: rows[0].future_coins });
    } catch (error) {
      console.error(`[SHOP DEBUG] Error in coins endpoint:`, error);
      handleError(res, error, 'Error fetching future coins');
    }
  });
  
  // Update user's FutureCoins
  router.put('/coins/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;
      const amount = Number(req.body.amount || 0);
      
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] PUT /coins/${userId} - Updating coins by ${amount}`);
      
      // Check if user has permission to access this data
      if (req.user && req.user.uid !== userId) {
        if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Unauthorized update - req.user.uid=${req.user.uid}, userId=${userId}`);
        return res.status(403).json({ error: 'Unauthorized access' });
      }
      
      // Ensure user exists with default coins
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Ensuring user ${userId} exists before updating coins`);
      try {
        await ensureUserHasCoins(pool, userId);
      } catch (ensureError) {
        console.error(`[SHOP DEBUG] Error ensuring user has coins:`, ensureError);
      }
      
      // Update existing user's coins
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Updating coins balance by ${amount}`);
      await pool.execute(
        `UPDATE users SET future_coins = future_coins + ? WHERE user_id = ?`,
        [amount, userId]
      );
      
      // Get updated balance
      const [rows] = await pool.execute(`SELECT future_coins FROM users WHERE user_id = ?`, [userId]);
      if (DEBUG_SHOP) console.log(`[SHOP DEBUG] Updated balance: ${rows[0]?.future_coins || 0} coins`);
      
      res.json({ futureCoins: rows[0]?.future_coins || 0 });
    } catch (error) {
      console.error(`[SHOP DEBUG] Error updating coins:`, error);
      handleError(res, error, 'Error updating future coins');
    }
  });
  
  return router;
};