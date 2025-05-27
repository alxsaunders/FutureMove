// src/utils/itemImageMapping.js

// Map database image paths to require() statements
export const ITEM_IMAGES = {
    // Profile Rings
    'images/item_shop/profile_rings/golden_glow.png': require('../assets/images/item_shop/profile_rings/golden_glow.png'),
    'images/item_shop/profile_rings/electric_pulse.png': require('../assets/images/item_shop/profile_rings/electric_pulse.png'),
    'images/item_shop/profile_rings/natures_crown.png': require('../assets/images/item_shop/profile_rings/natures_crown.png'),
    'images/item_shop/profile_rings/champions_fire.png': require('../assets/images/item_shop/profile_rings/champions_fire.png'),
    
    // Badges
    'images/item_shop/badges/legend_badge.png': require('../assets/images/item_shop/badges/legend_badge.png'),
    'images/item_shop/badges/crystal_guardian.png': require('../assets/images/item_shop/badges/crystal_guardian.png'),
    'images/item_shop/badges/cosmic_explorer.png': require('../assets/images/item_shop/badges/cosmic_explorer.png'),
    'images/item_shop/badges/millionaire_badge.png': require('../assets/images/item_shop/badges/millionaire_badge.png'),
    
    // Themes
    'images/item_shop/themes/midnight_motivation.png': require('../assets/images/item_shop/themes/midnight_motivation.png'),
    'images/item_shop/themes/sunrise_success.png': require('../assets/images/item_shop/themes/sunrise_success.png'),
    'images/item_shop/themes/forest_focus.png': require('../assets/images/item_shop/themes/forest_focus.png'),
    'images/item_shop/themes/aurora_dreams.png': require('../assets/images/item_shop/themes/aurora_dreams.png'),
  };
  
  // Helper function to get image source
  export const getItemImage = (imagePath) => {
    if (!imagePath) return null;
    return ITEM_IMAGES[imagePath] || null;
  };
  
  // Check if image exists
  export const hasItemImage = (imagePath) => {
    return !!ITEM_IMAGES[imagePath];
  };