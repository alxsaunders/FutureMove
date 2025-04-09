import { Quote } from '../types';

// In a real app, this would connect to an API
export const fetchDailyQuote = async (): Promise<Quote> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // In a production app, this would fetch from an actual API
  // For now, we'll return a random quote from our local collection
  const quotes = [
    {
      id: 1,
      text: "The secret of getting ahead is getting started.",
      author: "Mark Twain"
    },
    {
      id: 2,
      text: "It's not about having time, it's about making time.",
      author: "Unknown"
    },
    {
      id: 3,
      text: "The only way to do great work is to love what you do.",
      author: "Steve Jobs"
    },
    {
      id: 4,
      text: "Don't count the days, make the days count.",
      author: "Muhammad Ali"
    },
    {
      id: 5,
      text: "You don't have to be great to start, but you have to start to be great.",
      author: "Zig Ziglar"
    }
  ];
  
  // Return a random quote
  const randomIndex = Math.floor(Math.random() * quotes.length);
  return quotes[randomIndex];
};

// Function to save a quote as favorite
export const saveQuoteAsFavorite = async (quoteId: number): Promise<boolean> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // In a real app, this would update the user's favorites in the backend
  console.log(`Quote ${quoteId} saved as favorite`);
  return true;
};

// Function to get all favorite quotes
export const getFavoriteQuotes = async (): Promise<Quote[]> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Mock data
  return [
    {
      id: 1,
      text: "The secret of getting ahead is getting started.",
      author: "Mark Twain"
    },
    {
      id: 3,
      text: "The only way to do great work is to love what you do.",
      author: "Steve Jobs"
    }
  ];
};