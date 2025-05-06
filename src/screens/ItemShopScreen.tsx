import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useIsFocused } from "@react-navigation/native";
import axios from "axios";
import { getApiBaseUrl } from "../services/itemService";

// Define TypeScript interfaces
interface Item {
  item_id: number;
  name: string;
  description: string;
  image_url: string | null;
  category: string;
  price: number;
  is_active: number;
  created_at: string;
}

interface UserItem extends Item {
  is_equipped: number;
  purchased_at: string;
}

const ItemShopScreen = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [userItems, setUserItems] = useState<UserItem[]>([]);
  const [futureCoins, setFutureCoins] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"shop" | "inventory">("shop");

  // Use the correct auth hook that gives access to currentUser
  const { currentUser, updateUserCoins } = useAuth();
  const isFocused = useIsFocused();

  // Use API base URL from service with error handling
  const API_URL = React.useMemo(() => {
    try {
      return getApiBaseUrl();
    } catch (error) {
      console.error("Error getting API URL:", error);
      // Fallback URL to prevent crashes
      return "http://localhost:3001/api";
    }
  }, []);

  // Fetch data with error handling
  const fetchData = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch all available shop items with error handling
      let itemsData: Item[] = [];
      try {
        const itemsResponse = await axios.get(`${API_URL}/items`, {
          timeout: 10000, // 10 second timeout
        });
        itemsData = itemsResponse.data.items || [];
        setItems(itemsData);
      } catch (itemsError) {
        console.error("Error fetching shop items:", itemsError);
        // Don't fail completely, continue to try fetching user items
      }

      // Fetch user's purchased items with error handling
      try {
        const userItemsResponse = await axios.get(
          `${API_URL}/users/${currentUser.id}/items`,
          {
            timeout: 10000, // 10 second timeout
          }
        );
        const userItemsData = userItemsResponse.data.items || [];
        setUserItems(userItemsData);
      } catch (userItemsError) {
        console.error("Error fetching user items:", userItemsError);
        // Continue with the coins fetch
      }

      // Use the current user's coins from context
      if (currentUser.future_coins !== undefined) {
        setFutureCoins(currentUser.future_coins);
      }
    } catch (error) {
      console.error("Error in fetchData:", error);
      Alert.alert("Error", "Failed to load shop data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [API_URL, currentUser]);

  // Fetch data on screen focus
  useEffect(() => {
    if (isFocused) {
      fetchData();
    }
  }, [isFocused, fetchData]);

  // Handle purchase with better error handling
  const handlePurchase = async (item: Item) => {
    if (!currentUser) {
      Alert.alert("Error", "You must be logged in to make purchases.");
      return;
    }

    // Check if user already owns this item
    const alreadyOwned = userItems.some(
      (userItem) => userItem.item_id === item.item_id
    );
    if (alreadyOwned) {
      Alert.alert("Already Owned", "You already own this item.");
      return;
    }

    // Check if user has enough coins
    if (futureCoins < item.price) {
      Alert.alert(
        "Not Enough Coins",
        "You need more FutureCoins to purchase this item."
      );
      return;
    }

    // Confirm purchase
    Alert.alert(
      "Confirm Purchase",
      `Do you want to purchase ${item.name} for ${item.price} FutureCoins?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Purchase",
          onPress: async () => {
            try {
              setLoading(true);
              const response = await axios.post(
                `${API_URL}/users/${currentUser.id}/items`,
                {
                  itemId: item.item_id,
                },
                {
                  timeout: 10000, // 10 second timeout
                }
              );

              // Update future coins using context method
              const newCoinsAmount = response.data.futureCoins;
              if (typeof newCoinsAmount === "number") {
                const coinDifference = newCoinsAmount - futureCoins;
                try {
                  await updateUserCoins(coinDifference);
                } catch (updateCoinsError) {
                  console.error("Error updating user coins:", updateCoinsError);
                }

                // Update local state
                setFutureCoins(newCoinsAmount);
              }

              // Fetch updated user items
              try {
                const userItemsResponse = await axios.get(
                  `${API_URL}/users/${currentUser.id}/items`,
                  {
                    timeout: 5000, // 5 second timeout
                  }
                );
                setUserItems(userItemsResponse.data.items || []);
              } catch (fetchError) {
                console.error("Error fetching updated user items:", fetchError);
              }

              Alert.alert("Success", `You have purchased ${item.name}!`);
            } catch (error) {
              console.error("Error purchasing item:", error);
              Alert.alert(
                "Error",
                "Failed to purchase item. Please try again."
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Handle toggle equip with better error handling
  const handleToggleEquip = async (item: UserItem) => {
    if (!currentUser) {
      Alert.alert("Error", "You must be logged in to equip items.");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.put(
        `${API_URL}/users/${currentUser.id}/items/${item.item_id}/toggle`,
        {},
        {
          timeout: 5000, // 5 second timeout
        }
      );

      // Update user items with the new equipped status
      try {
        const userItemsResponse = await axios.get(
          `${API_URL}/users/${currentUser.id}/items`,
          {
            timeout: 5000,
          }
        );
        setUserItems(userItemsResponse.data.items || []);
      } catch (fetchError) {
        console.error("Error fetching updated user items:", fetchError);
      }

      Alert.alert("Success", response.data.message || "Item status updated");
    } catch (error) {
      console.error("Error toggling item:", error);
      Alert.alert("Error", "Failed to toggle item. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get category color
  const getCategoryColor = (category: string): string => {
    switch (category.toLowerCase()) {
      case "theme":
        return "#6A5ACD"; // SlateBlue
      case "avatar":
        return "#20B2AA"; // LightSeaGreen
      case "badge":
        return "#FFD700"; // Gold
      case "feature":
        return "#FF6347"; // Tomato
      default:
        return "#2196F3"; // Blue
    }
  };

  // Helper function to get user-friendly category label
  const getCategoryLabel = (category: string): string => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  // Render shop item with error handling for images
  const renderShopItem = ({ item }: { item: Item }) => {
    const owned = userItems.some(
      (userItem) => userItem.item_id === item.item_id
    );

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemImageContainer}>
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.itemImage}
              defaultSource={require("../assets/placeholder.png")}
              onError={(e) =>
                console.warn(
                  `Failed to load image: ${item.image_url}`,
                  e.nativeEvent.error
                )
              }
            />
          ) : (
            <View
              style={[
                styles.placeholderImage,
                { backgroundColor: getCategoryColor(item.category) },
              ]}
            >
              <Text style={styles.placeholderText}>{item.name.charAt(0)}</Text>
            </View>
          )}
        </View>

        <View style={styles.itemDetails}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemCategory}>
            {getCategoryLabel(item.category)}
          </Text>
          <Text style={styles.itemDescription}>{item.description}</Text>
          <View style={styles.itemPriceContainer}>
            <Text style={styles.itemPrice}>{item.price} FutureCoins</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.actionButton,
            owned
              ? styles.ownedButton
              : futureCoins >= item.price
              ? styles.buyButton
              : styles.disabledButton,
          ]}
          onPress={() => !owned && handlePurchase(item)}
          disabled={owned || futureCoins < item.price}
        >
          <Text style={styles.actionButtonText}>{owned ? "Owned" : "Buy"}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render inventory item with error handling for images
  const renderInventoryItem = ({ item }: { item: UserItem }) => {
    return (
      <View style={styles.itemCard}>
        <View style={styles.itemImageContainer}>
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.itemImage}
              defaultSource={require("../assets/placeholder.png")}
              onError={(e) =>
                console.warn(
                  `Failed to load image: ${item.image_url}`,
                  e.nativeEvent.error
                )
              }
            />
          ) : (
            <View
              style={[
                styles.placeholderImage,
                { backgroundColor: getCategoryColor(item.category) },
              ]}
            >
              <Text style={styles.placeholderText}>{item.name.charAt(0)}</Text>
            </View>
          )}

          {item.is_equipped === 1 && (
            <View style={styles.equippedBadge}>
              <Text style={styles.equippedText}>Equipped</Text>
            </View>
          )}
        </View>

        <View style={styles.itemDetails}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemCategory}>
            {getCategoryLabel(item.category)}
          </Text>
          <Text style={styles.itemDescription}>{item.description}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.actionButton,
            item.is_equipped === 1 ? styles.equippedButton : styles.equipButton,
          ]}
          onPress={() => handleToggleEquip(item)}
        >
          <Text style={styles.actionButtonText}>
            {item.is_equipped === 1 ? "Unequip" : "Equip"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Item Shop</Text>
        <View style={styles.coinContainer}>
          <Text style={styles.coinIcon}>💰</Text>
          <Text style={styles.coinText}>{futureCoins} FutureCoins</Text>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "shop" && styles.activeTab]}
          onPress={() => setActiveTab("shop")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "shop" && styles.activeTabText,
            ]}
          >
            Shop
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "inventory" && styles.activeTab]}
          onPress={() => setActiveTab("inventory")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "inventory" && styles.activeTabText,
            ]}
          >
            Inventory
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : activeTab === "shop" ? (
        <FlatList
          data={items}
          renderItem={renderShopItem}
          keyExtractor={(item) => `shop-item-${item.item_id}`}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No items available in the shop.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={userItems}
          renderItem={renderInventoryItem}
          keyExtractor={(item) => `inventory-item-${item.item_id}`}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>You don't own any items yet.</Text>
              <TouchableOpacity onPress={() => setActiveTab("shop")}>
                <Text style={styles.emptyActionText}>Visit the shop</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333333",
  },
  coinContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFD700",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  coinIcon: {
    marginRight: 4,
    fontSize: 16,
  },
  coinText: {
    fontWeight: "bold",
    color: "#333333",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#2196F3",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#757575",
  },
  activeTabText: {
    color: "#2196F3",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    padding: 12,
  },
  itemCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    position: "relative",
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  placeholderImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  itemDetails: {
    flex: 1,
    justifyContent: "center",
  },
  itemName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 12,
    color: "#757575",
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: "#505050",
    marginBottom: 4,
  },
  itemPriceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2196F3",
  },
  actionButton: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 16,
    alignSelf: "center",
    marginLeft: 8,
  },
  buyButton: {
    backgroundColor: "#2196F3",
  },
  ownedButton: {
    backgroundColor: "#4CAF50",
  },
  disabledButton: {
    backgroundColor: "#BDBDBD",
  },
  equipButton: {
    backgroundColor: "#2196F3",
  },
  equippedButton: {
    backgroundColor: "#FF9800",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  equippedBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#4CAF50",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  equippedText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#757575",
    marginBottom: 12,
  },
  emptyActionText: {
    fontSize: 16,
    color: "#2196F3",
    fontWeight: "500",
  },
});

export default ItemShopScreen;
