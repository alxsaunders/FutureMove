// src/hooks/usePostInteractions.ts
import { useState, useCallback } from 'react';
import { Alert, Share } from 'react-native';
import { Post } from '../types';

interface UsePostInteractionsProps {
  onLikePost?: (postId: string, isLiked: boolean) => Promise<boolean>;
  onBookmarkPost?: (postId: string, isBookmarked: boolean) => Promise<boolean>;
  onReportPost?: (postId: string) => Promise<void>;
  onBlockUser?: (userId: string) => Promise<void>;
}

interface UsePostInteractionsReturn {
  isLiking: boolean;
  isBookmarking: boolean;
  handleLike: (post: Post) => Promise<void>;
  handleBookmark: (post: Post) => Promise<void>;
  handleShare: (post: Post) => Promise<void>;
  handleMoreOptions: (post: Post) => void;
}

export const usePostInteractions = ({
  onLikePost,
  onBookmarkPost,
  onReportPost,
  onBlockUser,
}: UsePostInteractionsProps = {}): UsePostInteractionsReturn => {
  const [isLiking, setIsLiking] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);

  // Handle like/unlike
  const handleLike = useCallback(async (post: Post) => {
    if (isLiking) return;

    setIsLiking(true);
    try {
      if (onLikePost) {
        const success = await onLikePost(post.id, post.isLiked);
        if (!success) {
          Alert.alert('Error', 'Failed to update like. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error liking post:', error);
      Alert.alert('Error', 'Failed to update like. Please try again.');
    } finally {
      setIsLiking(false);
    }
  }, [isLiking, onLikePost]);

  // Handle bookmark/unbookmark
  const handleBookmark = useCallback(async (post: Post) => {
    if (isBookmarking) return;

    setIsBookmarking(true);
    try {
      if (onBookmarkPost) {
        // Assuming post has isBookmarked property - you may need to add this to your Post type
        const isCurrentlyBookmarked = (post as any).isBookmarked || false;
        const success = await onBookmarkPost(post.id, isCurrentlyBookmarked);
        if (!success) {
          Alert.alert('Error', 'Failed to update bookmark. Please try again.');
        }
      } else {
        // Default behavior - just show a message
        Alert.alert('Coming Soon', 'Bookmark functionality will be available soon.');
      }
    } catch (error) {
      console.error('Error bookmarking post:', error);
      Alert.alert('Error', 'Failed to update bookmark. Please try again.');
    } finally {
      setIsBookmarking(false);
    }
  }, [isBookmarking, onBookmarkPost]);

  // Handle share
  const handleShare = useCallback(async (post: Post) => {
    try {
      const shareContent = post.content.length > 100 
        ? `${post.content.substring(0, 100)}...` 
        : post.content;

      const shareOptions = {
        message: `Check out this post by ${post.userName} in ${post.communityName}:\n\n"${shareContent}"`,
        title: `Post from ${post.communityName}`,
        ...(post.image && { url: post.image }),
      };

      const result = await Share.share(shareOptions);

      if (result.action === Share.sharedAction) {
        console.log('Post shared successfully');
        // You could track this event for analytics
      }
    } catch (error) {
      console.error('Error sharing post:', error);
      Alert.alert('Error', 'Failed to share post. Please try again.');
    }
  }, []);

  // Handle more options menu
  const handleMoreOptions = useCallback((post: Post) => {
    Alert.alert(
      'Post Options',
      'Choose an action',
      [
        {
          text: 'Report Post',
          style: 'destructive',
          onPress: async () => {
            try {
              if (onReportPost) {
                await onReportPost(post.id);
                Alert.alert('Reported', 'Thank you for reporting this post. We will review it shortly.');
              } else {
                Alert.alert('Coming Soon', 'Report functionality will be available soon.');
              }
            } catch (error) {
              console.error('Error reporting post:', error);
              Alert.alert('Error', 'Failed to report post. Please try again.');
            }
          },
        },
        {
          text: 'Block User',
          style: 'destructive',
          onPress: async () => {
            Alert.alert(
              'Block User',
              `Are you sure you want to block ${post.userName}? You won't see their posts anymore.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Block',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      if (onBlockUser) {
                        await onBlockUser(post.userId);
                        Alert.alert('Blocked', `You have blocked ${post.userName}.`);
                      } else {
                        Alert.alert('Coming Soon', 'Block functionality will be available soon.');
                      }
                    } catch (error) {
                      console.error('Error blocking user:', error);
                      Alert.alert('Error', 'Failed to block user. Please try again.');
                    }
                  },
                },
              ]
            );
          },
        },
        {
          text: 'Copy Link',
          onPress: () => {
            // If you have deep linking set up, you could copy the post URL
            Alert.alert('Coming Soon', 'Copy link functionality will be available soon.');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  }, [onReportPost, onBlockUser]);

  return {
    isLiking,
    isBookmarking,
    handleLike,
    handleBookmark,
    handleShare,
    handleMoreOptions,
  };
};

export default usePostInteractions;