import { News } from '../types';

// This is a mock service. In a real app, this would connect to your backend API or a news API
export const fetchNews = async (): Promise<News[]> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 700));
  
  // Mock data
  return [
    {
      id: 1,
      title: "New Study Shows Benefits of Daily Goal Setting",
      summary: "Researchers found that daily goal setting increases productivity by 37%.",
      source: "Psychology Today",
      url: "https://example.com/news/1",
      timestamp: "2025-04-08T09:30:00Z",
      imageUrl: undefined,
      category: "Productivity",
    },
    {
      id: 2,
      title: "Tech Companies Adopting 4-Day Work Weeks See Improved Output",
      summary: "Several tech giants report increased employee satisfaction and productivity.",
      source: "Tech Insider",
      url: "https://example.com/news/2",
      timestamp: "2025-04-07T14:15:00Z",
      imageUrl: undefined,
      category: "Work-Life Balance",
    },
    {
      id: 3,
      title: "Morning Routines of Successful Entrepreneurs",
      summary: "Find out how successful business leaders start their day for maximum productivity.",
      source: "Business Weekly",
      url: "https://example.com/news/3",
      timestamp: "2025-04-08T07:45:00Z",
      imageUrl: undefined,
      category: "Entrepreneurship",
    },
  ];
};

// Function to fetch news by category
export const fetchNewsByCategory = async (category: string): Promise<News[]> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Get all news first
  const allNews = await fetchNews();
  
  // Filter by category
  return allNews.filter(
    news => news.category.toLowerCase() === category.toLowerCase()
  );
};

// Function to mark a news item as read
export const markNewsAsRead = async (newsId: number): Promise<boolean> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // In a real app, this would update the backend
  console.log(`News item ${newsId} marked as read`);
  return true;
};