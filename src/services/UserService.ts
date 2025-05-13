// src/services/UserService.ts

const API_URL = 'http://10.0.2.2:3001/api'; // Emulator localhost

/**
 * Updates a user's coin balance
 * @param userId The ID of the user
 * @param newCoinsValue The new coin balance
 * @returns The updated coin balance
 */
export const updateUserCoins = async (userId: string, newCoinsValue: number): Promise<number> => {
  try {
    const res = await fetch(`${API_URL}/users/${userId}/futurecoins`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: newCoinsValue }),
    });
    
    if (!res.ok) throw new Error('Failed to update user coins');
    const data = await res.json();
    
    return data.futureCoins || data.future_coins || newCoinsValue;
  } catch (error) {
    console.error("Error updating user coins:", error);
    throw error;
  }
};

/**
 * Updates a user's XP and optionally their level
 * @param userId The ID of the user
 * @param newXpValue The new XP value (0-99)
 * @param newLevel Optional - the new level if the user leveled up
 * @returns Object containing the updated XP and level values
 */
export const updateUserXP = async (
  userId: string, 
  newXpValue: number, 
  newLevel?: number
): Promise<{ xp: number; level?: number }> => {
  try {
    const res = await fetch(`${API_URL}/users/${userId}/xp`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        amount: newXpValue,
        level: newLevel 
      }),
    });
    
    if (!res.ok) throw new Error('Failed to update user XP');
    const data = await res.json();
    
    return { 
      xp: data.xp || data.xp_points || newXpValue, 
      level: data.level || newLevel 
    };
  } catch (error) {
    console.error("Error updating user XP:", error);
    throw error;
  }
};

/**
 * Adds XP to a user's current value and handles level-ups
 * @param userId The ID of the user
 * @param currentXp The user's current XP
 * @param currentLevel The user's current level
 * @param xpToAdd The amount of XP to add
 * @returns Object containing the updated XP and level values
 */
export const addUserXP = async (
  userId: string,
  currentXp: number,
  currentLevel: number,
  xpToAdd: number
): Promise<{ xp: number; level: number; leveledUp: boolean }> => {
  try {
    // Calculate new XP and level
    let newXp = currentXp + xpToAdd;
    let newLevel = currentLevel;
    let leveledUp = false;
    
    // Check for level-up (XP maxes at 99, then resets to 0 at level-up)
    if (newXp >= 100) {
      const levelsGained = Math.floor(newXp / 100);
      newLevel += levelsGained;
      newXp = newXp % 100; // Keep the remainder
      leveledUp = true;
    }
    
    // Update in database
    await updateUserXP(userId, newXp, newLevel);
    
    // Return the new values
    return { xp: newXp, level: newLevel, leveledUp };
  } catch (error) {
    console.error("Error adding user XP:", error);
    throw error;
  }
};

/**
 * Adds coins to a user's balance
 * @param userId The ID of the user
 * @param currentCoins The user's current coin balance
 * @param coinsToAdd The amount of coins to add
 * @returns The updated coin balance
 */
export const addUserCoins = async (
  userId: string,
  currentCoins: number,
  coinsToAdd: number
): Promise<number> => {
  try {
    // Calculate new coin balance
    const newCoins = currentCoins + coinsToAdd;
    
    // Update in database
    return await updateUserCoins(userId, newCoins);
  } catch (error) {
    console.error("Error adding user coins:", error);
    throw error;
  }
};

/**
 * Gets a user's current data including level, XP, and coins
 * @param userId The ID of the user
 * @returns Object containing the user's data
 */
export const getUserData = async (
  userId: string
): Promise<{ level: number; xp: number; coins: number }> => {
  try {
    const res = await fetch(`${API_URL}/users/${userId}`);
    if (!res.ok) throw new Error('Failed to fetch user data');
    const data = await res.json();
    
    return {
      level: data.level || 1,
      xp: data.xp_points || data.xp || 0,
      coins: data.future_coins || data.futureCoins || 0
    };
  } catch (error) {
    console.error("Error fetching user data:", error);
    // Return default values if there's an error
    return { level: 1, xp: 0, coins: 0 };
  }
};