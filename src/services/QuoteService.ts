// services/quoteService.ts
import { Quote } from '../types';

// API Ninjas configuration
const API_URL = 'https://api.api-ninjas.com/v1/quotes';
const API_KEY = 'uLfBeSl/UtgD4jR6OotwtA==xUXitU6hRP9kJIO0';

// In-memory storage for favorites (would be replaced with AsyncStorage or API in real app)
let favoriteQuotes: Quote[] = [];

/**
 * Fetch a random quote from the API Ninjas service
 */
export const fetchDailyQuote = async (): Promise<Quote> => {
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      // The API returns quote in the "quote" field, but our interface also has text field
      return {
        ...data[0],
        text: data[0].quote,
        id: Date.now() // Generate a temporary ID
      };
    } else {
      throw new Error('No quotes returned from API');
    }
  } catch (error) {
    console.error('Error fetching quote from API:', error);
    throw error;
  }
};

/**
 * Fetch quotes by category (Premium feature)
 * @param category - The category to fetch quotes for
 * @param limit - Number of quotes to fetch (1-100)
 */
export const fetchQuotesByCategory = async (
  category: string, 
  limit: number = 1
): Promise<Quote[]> => {
  try {
    // Validate inputs
    if (!category) {
      throw new Error('Category is required');
    }
    
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
    
    const url = `${API_URL}?category=${encodeURIComponent(category)}&limit=${limit}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      // For premium features, we might get a 403 if not authorized
      if (response.status === 403) {
        throw new Error('This feature requires a premium subscription');
      }
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      // Add IDs and ensure text field is populated
      return data.map((quote: any, index: number) => ({
        ...quote,
        text: quote.quote,
        id: Date.now() + index // Generate temporary IDs
      }));
    } else {
      throw new Error(`No quotes found for category: ${category}`);
    }
  } catch (error) {
    console.error('Error fetching quotes by category:', error);
    throw error;
  }
};

/**
 * Save a quote as favorite
 * @param quote - The quote to save as favorite
 */
export const saveQuoteAsFavorite = async (quote: Quote): Promise<boolean> => {
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Check if quote already exists in favorites
    if (!favoriteQuotes.some(q => q.quote === quote.quote)) {
      const quoteWithTimestamp = {
        ...quote,
        savedAt: new Date().toISOString(),
        id: quote.id || Date.now() // Use existing ID or generate new one
      };
      
      favoriteQuotes = [...favoriteQuotes, quoteWithTimestamp];
      console.log(`Quote saved as favorite: "${quote.quote.substring(0, 20)}..."`);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving quote as favorite:', error);
    return false;
  }
};

/**
 * Save a quote as favorite using just the ID
 * @param quoteId - The ID of the quote to save
 */
export const saveQuoteAsFavoriteById = async (quoteId: number): Promise<boolean> => {
  try {
    // Find the quote in favorites (in a real app, would check against a database or API)
    const quoteToSave = favoriteQuotes.find(q => q.id === quoteId);
    
    if (!quoteToSave) {
      console.error(`Quote with ID ${quoteId} not found`);
      return false;
    }
    
    return await saveQuoteAsFavorite(quoteToSave);
  } catch (error) {
    console.error('Error saving quote as favorite by ID:', error);
    return false;
  }
};

/**
 * Remove a quote from favorites
 * @param quoteId - The ID of the quote to remove
 */
export const removeFromFavorites = async (quoteId: number): Promise<boolean> => {
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Remove quote from favorites
    favoriteQuotes = favoriteQuotes.filter(quote => quote.id !== quoteId);
    console.log(`Quote ${quoteId} removed from favorites`);
    
    return true;
  } catch (error) {
    console.error('Error removing quote from favorites:', error);
    return false;
  }
};

/**
 * Get all favorite quotes
 */
export const getFavoriteQuotes = async (): Promise<Quote[]> => {
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return favoriteQuotes;
  } catch (error) {
    console.error('Error getting favorite quotes:', error);
    return [];
  }
};

/**
 * Get available quote categories
 * This is a mock function as the actual API doesn't provide this endpoint
 */
export const getQuoteCategories = (): string[] => {
  // These are example categories - the actual API may have different ones
  return [
    'age', 'alone', 'amazing', 'anger', 'architecture', 'art', 'attitude',
    'beauty', 'best', 'birthday', 'business', 'car', 'change', 'communication',
    'computers', 'courage', 'dad', 'dating', 'death', 'design', 'dreams',
    'education', 'environmental', 'equality', 'experience', 'failure', 'faith',
    'family', 'famous', 'fear', 'fitness', 'food', 'forgiveness', 'freedom',
    'friendship', 'funny', 'future', 'god', 'good', 'government', 'graduation',
    'great', 'happiness', 'health', 'history', 'home', 'hope', 'humor',
    'imagination', 'inspirational', 'intelligence', 'jealousy', 'knowledge',
    'leadership', 'learning', 'legal', 'life', 'love', 'marriage', 'medical',
    'men', 'mom', 'money', 'morning', 'movies', 'success'
  ];
};