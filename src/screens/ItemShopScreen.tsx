// src/screens/ItemShopScreen.tsx

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Modal,
  ScrollView,
  ListRenderItem,
} from "react-native";
import { NavigationProp, RouteProp } from "@react-navigation/native";
import { getItemImage, hasItemImage } from "../utils/itemImageMapping";

// Type definitions
interface ShopItem {
  item_id: number;
  name: string;
  description: string;
  image_url: string | null;
  category: string;
  price: number;
  is_active: number;
  created_at?: string;
}

interface UserItem extends ShopItem {
  user_item_id: number;
  user_id: string;
  purchased_at: string;
  is_equipped: number;
}

interface ItemWithOwnership extends ShopItem {
  isOwned?: boolean;
}

interface RouteParams {
  userId?: string;
  forceRefresh?: number;
}

interface Props {
  route: RouteProp<{ params: RouteParams }, "params">;
  navigation: NavigationProp<any>;
}

// Get screen width for calculating item width
const screenWidth = Dimensions.get("window").width;

// API URL based on platform
const getApiUrl = (): string => {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3001/api";
  } else {
    // For iOS or development on Mac
    return "http://192.168.1.207:3001/api";
  }
};

const API_URL = getApiUrl();

// EMERGENCY FALLBACK - replace with a valid user ID from your database
const FALLBACK_USER_ID = "KbtY3t4Tatd0r5tCjnjlmJyNT5R2";

const ItemShopScreen: React.FC<Props> = ({ route, navigation }) => {
  // Screen state
  const [items, setItems] = useState<ShopItem[]>([]);
  const [userItems, setUserItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [coins, setCoins] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"shop" | "inventory">("shop");
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Modal state
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<ItemWithOwnership | null>(
    null
  );

  // Get userId from route params or use fallback
  const userId = route.params?.userId || FALLBACK_USER_ID;

  // Memoized fetch function
  const fetchData = useCallback(async () => {
    if (!userId) {
      console.log("[SHOP] No userId available, skipping fetch");
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log(`[SHOP] Fetching data for user ${userId}`);

    try {
      // Get shop items
      const shopResponse = await fetch(`${API_URL}/items`);
      const shopData: ShopItem[] = await shopResponse.json();
      setItems(shopData);
      console.log(`[SHOP] Fetched ${shopData.length} shop items`);

      // Get user coins
      const coinsResponse = await fetch(`${API_URL}/items/coins/${userId}`);
      const coinsData = await coinsResponse.json();
      setCoins(coinsData.futureCoins);
      console.log(`[SHOP] User has ${coinsData.futureCoins} coins`);

      // Get user inventory
      const inventoryResponse = await fetch(`${API_URL}/items/user/${userId}`);
      const inventoryData: UserItem[] = await inventoryResponse.json();
      setUserItems(inventoryData);
      console.log(`[SHOP] User has ${inventoryData.length} items in inventory`);
    } catch (error) {
      console.error("[SHOP] Error fetching data:", error);
      Alert.alert("Error", "Could not load shop data. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Add focus listener to refresh when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      console.log("[SHOP] Screen focused - refreshing data");
      fetchData();
    });

    return unsubscribe;
  }, [navigation, fetchData]);

  // Fetch shop data when params or refresh key changes
  useEffect(() => {
    fetchData();
  }, [userId, route.params?.forceRefresh, refreshKey, fetchData]);

  // Function to force a screen refresh
  const refreshScreen = (): void => {
    setRefreshKey((prevKey) => prevKey + 1);
  };

  // Show item detail in modal
  const showItemDetail = (item: ShopItem): void => {
    refreshScreen();

    const isOwned = userItems.some(
      (userItem) => userItem.item_id === item.item_id
    );

    setSelectedItem({
      ...item,
      isOwned,
    });

    setModalVisible(true);
  };

  // Handle item purchase
  const handlePurchase = async (itemId: number): Promise<void> => {
    if (!userId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/items/purchase/${userId}/${itemId}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (result.success) {
        if (modalVisible) {
          setModalVisible(false);
        }

        setActiveTab("inventory");
        await fetchData();

        Alert.alert(
          "Success",
          "Item purchased successfully! Check your inventory."
        );
      } else {
        Alert.alert("Purchase Failed", result.message);
      }
    } catch (error) {
      console.error("[SHOP] Error during purchase:", error);
      Alert.alert("Error", "Could not complete purchase. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle equip/unequip
  const toggleEquip = async (itemId: number): Promise<void> => {
    if (!userId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/items/toggle/${userId}/${itemId}`,
        {
          method: "PUT",
        }
      );

      const result = await response.json();

      if (result.success) {
        await fetchData();

        if (modalVisible && selectedItem && selectedItem.item_id === itemId) {
          const updatedItem = userItems.find((item) => item.item_id === itemId);
          if (updatedItem) {
            setSelectedItem({
              ...selectedItem,
              is_equipped: updatedItem.is_equipped,
            });
          }
        }

        Alert.alert("Success", result.message);

        const equippedItem = userItems.find((item) => item.item_id === itemId);
        if (
          equippedItem &&
          (equippedItem.category === "theme" ||
            equippedItem.category === "profile_ring")
        ) {
          navigation.navigate("Profile", { forceRefresh: Date.now() });
        }
      } else {
        Alert.alert("Failed", result.message);
      }
    } catch (error) {
      console.error("[SHOP] Error toggling item:", error);
      Alert.alert("Error", "Could not update item. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle tab switching
  const handleTabSwitch = (tab: "shop" | "inventory"): void => {
    if (tab !== activeTab) {
      setActiveTab(tab);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A5ACD" />
        <Text style={styles.loadingText}>Loading shop items...</Text>
      </View>
    );
  }

  // Render shop item
  const renderShopItem: ListRenderItem<ShopItem> = ({ item }) => {
    const isOwned = userItems.some(
      (userItem) => userItem.item_id === item.item_id
    );
    const canAfford = coins >= item.price;

    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => showItemDetail(item)}
      >
        <View style={styles.gridImageContainer}>
          {item.image_url && hasItemImage(item.image_url) ? (
            <Image
              source={getItemImage(item.image_url)}
              style={styles.gridItemImage}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.gridItemImage, styles.placeholder]}>
              <Text style={styles.placeholderText}>
                {item.category?.charAt(0).toUpperCase() || "I"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.gridItemDetails}>
          <Text
            style={styles.gridItemName}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.name}
          </Text>
          <Text
            style={styles.gridItemCategory}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.category}
          </Text>

          <View style={styles.itemPriceContainer}>
            <Image
              source={require("../assets/images/future_coin.png")}
              style={styles.coinIcon}
            />
            <Text style={styles.itemPrice}>{item.price}</Text>
          </View>

          {isOwned ? (
            <View style={styles.ownedBadge}>
              <Text style={styles.ownedText}>Owned</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.purchaseButton,
                !canAfford && styles.disabledButton,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                handlePurchase(item.item_id);
              }}
              disabled={!canAfford}
            >
              <Text style={styles.buttonText}>
                {canAfford ? "Buy" : "Not enough"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render inventory item
  const renderInventoryItem: ListRenderItem<UserItem> = ({ item }) => {
    const isEquipped = item.is_equipped === 1;

    return (
      <TouchableOpacity
        style={[styles.gridItem, isEquipped && styles.equippedCard]}
        onPress={() => showItemDetail(item)}
      >
        <View style={styles.gridImageContainer}>
          {item.image_url && hasItemImage(item.image_url) ? (
            <Image
              source={getItemImage(item.image_url)}
              style={styles.gridItemImage}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.gridItemImage, styles.placeholder]}>
              <Text style={styles.placeholderText}>
                {item.category?.charAt(0).toUpperCase() || "I"}
              </Text>
            </View>
          )}

          {isEquipped && (
            <View style={styles.equippedBadge}>
              <Text style={styles.equippedText}>Equipped</Text>
            </View>
          )}
        </View>

        <View style={styles.gridItemDetails}>
          <Text
            style={styles.gridItemName}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.name}
          </Text>
          <Text
            style={styles.gridItemCategory}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.category}
          </Text>

          <TouchableOpacity
            style={[styles.equipButton, isEquipped && styles.unequipButton]}
            onPress={(e) => {
              e.stopPropagation();
              toggleEquip(item.item_id);
            }}
          >
            <Text style={styles.buttonText}>
              {isEquipped ? "Unequip" : "Equip"}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Item Detail Modal Component
  const ItemDetailModal: React.FC = () => {
    if (!selectedItem) return null;

    const isOwned =
      selectedItem.isOwned ||
      userItems.some((item) => item.item_id === selectedItem.item_id);
    const userItem = userItems.find(
      (item) => item.item_id === selectedItem.item_id
    );
    const isEquipped = userItem?.is_equipped === 1;
    const canAfford = coins >= selectedItem.price;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            <ScrollView>
              <View style={styles.modalImageContainer}>
                {selectedItem.image_url &&
                  hasItemImage(selectedItem.image_url) ? (
                  <Image
                    source={getItemImage(selectedItem.image_url)}
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.modalImage, styles.placeholder]}>
                    <Text style={styles.modalPlaceholderText}>
                      {selectedItem.category?.charAt(0).toUpperCase() || "I"}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.modalTitle}>{selectedItem.name}</Text>
              <View style={styles.modalCategoryContainer}>
                <Text style={styles.modalCategory}>
                  {selectedItem.category}
                </Text>
              </View>

              {!isOwned && (
                <View style={styles.modalPriceContainer}>
                  <Image
                    source={require("../assets/images/future_coin.png")}
                    style={styles.modalCoinIcon}
                  />
                  <Text style={styles.modalPrice}>{selectedItem.price}</Text>
                </View>
              )}

              <Text style={styles.modalDescriptionTitle}>Description:</Text>
              <Text style={styles.modalDescription}>
                {selectedItem.description || "No description available."}
              </Text>

              {isOwned ? (
                <TouchableOpacity
                  style={[
                    styles.modalActionButton,
                    isEquipped ? styles.unequipButton : styles.equipButton,
                  ]}
                  onPress={() => toggleEquip(selectedItem.item_id)}
                >
                  <Text style={styles.modalButtonText}>
                    {isEquipped ? "Unequip" : "Equip"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.modalActionButton,
                    !canAfford && styles.disabledButton,
                  ]}
                  onPress={() => handlePurchase(selectedItem.item_id)}
                  disabled={!canAfford}
                >
                  <Text style={styles.modalButtonText}>
                    {canAfford ? "Purchase" : "Not enough coins"}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#6A5ACD" barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Item Shop</Text>

        <View style={styles.coinsContainer}>
          <Image
            source={require("../assets/images/future_coin.png")}
            style={styles.coinIconLarge}
          />
          <Text style={styles.coinsText}>{coins}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "shop" && styles.activeTab]}
          onPress={() => handleTabSwitch("shop")}
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
          onPress={() => handleTabSwitch("inventory")}
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

      {activeTab === "shop" ? (
        items.length > 0 ? (
          <FlatList
            data={items}
            renderItem={renderShopItem}
            keyExtractor={(item) =>
              item.item_id?.toString() || Math.random().toString()
            }
            contentContainerStyle={styles.gridList}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No items available in the shop</Text>
          </View>
        )
      ) : userItems.length > 0 ? (
        <FlatList
          data={userItems}
          renderItem={renderInventoryItem}
          keyExtractor={(item) =>
            item.user_item_id?.toString() || `user-item-${item.item_id}`
          }
          contentContainerStyle={styles.gridList}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>You don't own any items yet</Text>
        </View>
      )}

      <ItemDetailModal />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#6A5ACD",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
  },
  coinsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  coinIconLarge: {
    width: 34,
    height: 34,
    marginRight: 8,
  },
  coinsText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  itemPriceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 5,
  },
  coinIcon: {
    width: 30,
    height: 30,
    marginRight: 4,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#6A5ACD",
  },
  tabText: {
    fontSize: 16,
    color: "#777",
    fontWeight: "500",
  },
  activeTabText: {
    color: "#6A5ACD",
    fontWeight: "bold",
  },
  gridList: {
    padding: 10,
  },
  gridRow: {
    justifyContent: "space-between",
  },
  gridItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    width: screenWidth / 2 - 15,
  },
  gridImageContainer: {
    position: "relative",
    alignItems: "center",
    marginBottom: 10,
  },
  gridItemImage: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    resizeMode: "cover",
  },
  gridItemDetails: {
    alignItems: "center",
  },
  gridItemName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 2,
  },
  gridItemCategory: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 15,
    width: "90%",
    maxHeight: "80%",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    position: "absolute",
    right: 15,
    top: 15,
    zIndex: 1,
    width: 30,
    height: 30,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  modalImageContainer: {
    alignItems: "center",
    marginBottom: 15,
  },
  modalImage: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    resizeMode: "cover",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 10,
  },
  modalCategoryContainer: {
    alignItems: "center",
    marginBottom: 10,
  },
  modalCategory: {
    fontSize: 16,
    color: "#666",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalPriceContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 15,
  },
  modalCoinIcon: {
    width: 44,
    height: 44,
    marginRight: 8,
  },
  modalPrice: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#6A5ACD",
  },
  modalDescriptionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 10,
    marginBottom: 5,
  },
  modalDescription: {
    fontSize: 16,
    color: "#555",
    lineHeight: 24,
    marginBottom: 20,
  },
  modalActionButton: {
    backgroundColor: "#6A5ACD",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalPlaceholderText: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#757575",
  },
  placeholder: {
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#757575",
  },
  equippedCard: {
    borderWidth: 2,
    borderColor: "#6A5ACD",
  },
  equippedBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#6A5ACD",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  equippedText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#6A5ACD",
  },
  ownedBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
    marginTop: 5,
  },
  ownedText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  purchaseButton: {
    backgroundColor: "#6A5ACD",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 5,
  },
  equipButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 5,
  },
  unequipButton: {
    backgroundColor: "#FF5722",
  },
  disabledButton: {
    backgroundColor: "#c0c0c0",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
});

export default ItemShopScreen;