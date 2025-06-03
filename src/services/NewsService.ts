import { News } from '../types';

// API Configuration
const API_BASE_URL = 'https://api.thenewsapi.com/v1';
const API_KEY = 'lCSaSYMDT4pTW0U4mIPuCYJ2IndaxIT2RzJ2Wnie'; // Get free API key from https://www.thenewsapi.com/register

// Interface for The News API response
interface NewsApiResponse {
  meta: {
    found: number;
    returned: number;
    limit: number;
    page: number;
  };
  data: NewsApiArticle[];
}

interface NewsApiArticle {
  uuid: string;
  title: string;
  description: string;
  keywords: string;
  snippet: string;
  url: string;
  image_url: string | null;
  language: string;
  published_at: string;
  source: string;
  categories: string[];
  relevance_score: number | null;
  locale: string;
}

// Function to transform API response to our News interface
const transformArticle = (article: NewsApiArticle): News => ({
  id: article.uuid.hashCode(), // Convert UUID to number
  title: article.title,
  summary: article.description || article.snippet,
  source: article.source,
  url: article.url,
  timestamp: article.published_at,
  imageUrl: article.image_url || undefined,
  category: article.categories[0] || 'General',
});

// Helper function to convert string to hash number
String.prototype.hashCode = function() {
  let hash = 0;
  if (this.length === 0) return hash;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

// Fetch latest news with optional filtering
export const fetchNews = async (
  limit: number = 10,
  categories?: string[],
  language: string = 'en',
  locale: string = 'us'
): Promise<News[]> => {
  try {
    let url = `${API_BASE_URL}/news/all?api_token=${API_KEY}&language=${language}&limit=${limit}&locale=${locale}`;
    
    // Add categories filter if provided
    if (categories && categories.length > 0) {
      url += `&categories=${categories.join(',')}`;
    }

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`News API responded with status: ${response.status}`);
    }

    const data: NewsApiResponse = await response.json();
    
    return data.data.map(transformArticle);
  } catch (error) {
    console.error('Error fetching news:', error);
    // Return fallback mock data if API fails
    return getFallbackNews();
  }
};

// Fetch top headlines
export const fetchTopHeadlines = async (
  limit: number = 10,
  locale: string = 'us'
): Promise<News[]> => {
  try {
    const url = `${API_BASE_URL}/news/top?api_token=${API_KEY}&locale=${locale}&limit=${limit}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`News API responded with status: ${response.status}`);
    }

    const data: NewsApiResponse = await response.json();
    
    return data.data.map(transformArticle);
  } catch (error) {
    console.error('Error fetching top headlines:', error);
    return getFallbackNews();
  }
};

// Search news by keyword
export const searchNews = async (
  query: string,
  limit: number = 10,
  language: string = 'en'
): Promise<News[]> => {
  try {
    const url = `${API_BASE_URL}/news/all?api_token=${API_KEY}&search=${encodeURIComponent(query)}&language=${language}&limit=${limit}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`News API responded with status: ${response.status}`);
    }

    const data: NewsApiResponse = await response.json();
    
    return data.data.map(transformArticle);
  } catch (error) {
    console.error('Error searching news:', error);
    return getFallbackNews();
  }
};

// Function to fetch news by category
export const fetchNewsByCategory = async (
  category: string,
  limit: number = 10,
  locale: string = 'us'
): Promise<News[]> => {
  try {
    // Map common categories to API categories
    const categoryMap: { [key: string]: string } = {
      'technology': 'tech',
      'business': 'business',
      'sports': 'sports',
      'entertainment': 'entertainment',
      'health': 'health',
      'science': 'science',
      'politics': 'politics',
      'general': 'general'
    };

    const apiCategory = categoryMap[category.toLowerCase()] || 'general';
    
    return await fetchNews(limit, [apiCategory], 'en', locale);
  } catch (error) {
    console.error('Error fetching news by category:', error);
    return getFallbackNews();
  }
};

// Function to mark a news item as read (local storage for now)
export const markNewsAsRead = async (newsId: number): Promise<boolean> => {
  try {
    // In a real app, this would update your backend
    // For now, we'll use local storage
    const readArticles = JSON.parse(localStorage.getItem('readArticles') || '[]');
    if (!readArticles.includes(newsId)) {
      readArticles.push(newsId);
      localStorage.setItem('readArticles', JSON.stringify(readArticles));
    }
    
    console.log(`News item ${newsId} marked as read`);
    return true;
  } catch (error) {
    console.error('Error marking news as read:', error);
    return false;
  }
};

// Function to check if a news item has been read
export const isNewsRead = (newsId: number): boolean => {
  try {
    const readArticles = JSON.parse(localStorage.getItem('readArticles') || '[]');
    return readArticles.includes(newsId);
  } catch (error) {
    console.error('Error checking read status:', error);
    return false;
  }
};

// Fallback mock data in case API fails
const getFallbackNews = (): News[] => [
  {
    id: 1,
    title: "Tech Industry Sees Major Breakthrough in AI Development",
    summary: "Leading tech companies announce significant advancements in artificial intelligence technology, promising improved user experiences across multiple platforms.",
    source: "TechNews",
    url: "https://example.com/tech-ai-breakthrough",
    timestamp: new Date().toISOString(),
    imageUrl: undefined,
    category: "Technology",
  },
  {
    id: 2,
    title: "Global Markets Show Strong Recovery Signals",
    summary: "Financial analysts report positive trends in international markets as economic indicators point toward sustained growth.",
    source: "Financial Times",
    url: "https://example.com/markets-recovery",
    timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    imageUrl: undefined,
    category: "Business",
  },
  {
    id: 3,
    title: "Breakthrough in Renewable Energy Storage",
    summary: "Scientists develop new battery technology that could revolutionize renewable energy storage and grid stability.",
    source: "Science Daily",
    url: "https://example.com/renewable-energy",
    timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    imageUrl: undefined,
    category: "Science",
  },
];

// Available categories for filtering
export const NEWS_CATEGORIES = [
  'general',
  'business',
  'entertainment',
  'health',
  'science',
  'sports',
  'technology',
  'politics'
];

// Export configuration for easy access
export const NEWS_CONFIG = {
  API_BASE_URL,
  DEFAULT_LIMIT: 10,
  DEFAULT_LANGUAGE: 'en',
  DEFAULT_LOCALE: 'us',
  CATEGORIES: NEWS_CATEGORIES
};