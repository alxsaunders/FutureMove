import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  StatusBar,
} from "react-native";

// API URL based on platform
const API_URL = 'http://192.168.1.207:3001/api'; 

const ItemDetailScreen = ({ route, navigation }) => {
  const {
    itemId,
    itemName,
    itemDescription,
    itemPrice,
    itemCategory,
    itemImageUrl,
    userId,
    isOwned: initialIsOwned,
  } = route.params;

  const [loading, setLoading] = useState(false);
  const [isOwned, setIsOwned] = useState(initialIsOwned || false);
  const [isEquipped, setIsEquipped] = useState(false);
  const [coins, setCoins] = useState(0);

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Fetch user coins
      const coinsResponse = await fetch(`${API_URL}/items/coins/${userId}`);
      const coinsData = await coinsResponse.json();
      setCoins(coinsData.futureCoins);

      // Fetch user items to check equipped status
      const userItemsResponse = await fetch(`${API_URL}/items/user/${userId}`);
      const userItemsData = await userItemsResponse.json();

      // Find if user owns and has equipped this item
      const ownedItem = userItemsData.find((item) => item.item_id === itemId);
      if (ownedItem) {
        setIsOwned(true);
        setIsEquipped(ownedItem.is_equipped === 1);
      }
    } catch (error) {
      console.error("[ITEM DETAIL] Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle item purchase
  const handlePurchase = async () => {
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
        setCoins(result.futureCoins);
        setIsOwned(true);
        Alert.alert("Success", "Item purchased successfully!");
      } else {
        Alert.alert("Purchase Failed", result.message);
      }
    } catch (error) {
      console.error("[ITEM DETAIL] Error during purchase:", error);
      Alert.alert("Error", "Could not complete purchase. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle equip/unequip
  const toggleEquip = async () => {
    if (!userId || !isOwned) return;

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
        setIsEquipped(!isEquipped);
        Alert.alert("Success", result.message);
      } else {
        Alert.alert("Failed", result.message);
      }
    } catch (error) {
      console.error("[ITEM DETAIL] Error toggling item:", error);
      Alert.alert("Error", "Could not update item. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Determine if user can afford the item
  const canAfford = coins >= itemPrice;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A5ACD" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#6A5ACD" barStyle="light-content" />

      {/* Header with back button and coins */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.coinsContainer}>
          <Image
            source={require("../assets/images/future_coin.png")}
            style={styles.coinIcon}
          />
          <Text style={styles.coinsText}>{coins}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Item Image */}
        <View style={styles.imageContainer}>
          {itemImageUrl ? (
            <Image
              source={{ uri: itemImageUrl }}
              style={styles.itemImage}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.itemImage, styles.placeholder]}>
              <Text style={styles.placeholderText}>
                {itemCategory?.charAt(0).toUpperCase() || "I"}
              </Text>
            </View>
          )}

          {/* Status Badge (if owned) */}
          {isOwned && (
            <View
              style={[
                styles.statusBadge,
                isEquipped ? styles.equippedBadge : styles.ownedBadge,
              ]}
            >
              <Text style={styles.statusText}>
                {isEquipped ? "Equipped" : "Owned"}
              </Text>
            </View>
          )}
        </View>

        {/* Item Info */}
        <View style={styles.infoContainer}>
          {/* Title and Category */}
          <Text style={styles.itemName}>{itemName}</Text>
          <Text style={styles.itemCategory}>{itemCategory}</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Description */}
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>
            {itemDescription || "No description available."}
          </Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Price */}
          <View style={styles.priceSection}>
            <Text style={styles.sectionTitle}>Price:</Text>
            <View style={styles.priceContainer}>
              <Image
                source={require("../assets/images/future_coin.png")}
                style={styles.priceCoinIcon}
              />
              <Text style={styles.price}>{itemPrice}</Text>
            </View>
          </View>

          {/* Action Button */}
          {isOwned ? (
            <TouchableOpacity
              style={[
                styles.actionButton,
                isEquipped ? styles.unequipButton : styles.equipButton,
              ]}
              onPress={toggleEquip}
            >
              <Text style={styles.actionButtonText}>
                {isEquipped ? "Unequip" : "Equip"}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.purchaseButton,
                !canAfford && styles.disabledButton,
              ]}
              onPress={handlePurchase}
              disabled={!canAfford}
            >
              <Text style={styles.actionButtonText}>
                {canAfford ? "Purchase" : "Not enough coins"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  backButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
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
  coinIcon: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  coinsText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  scrollContent: {
    padding: 16,
  },
  imageContainer: {
    alignItems: "center",
    position: "relative",
    marginBottom: 20,
  },
  itemImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  placeholder: {
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#757575",
  },
  statusBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  equippedBadge: {
    backgroundColor: "#6A5ACD",
  },
  ownedBadge: {
    backgroundColor: "#4CAF50",
  },
  statusText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  infoContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  itemName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 16,
    color: "#666",
    marginBottom: 6,
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: "#555",
    lineHeight: 24,
  },
  priceSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceCoinIcon: {
    width: 20,
    height: 20,
    marginRight: 6,
  },
  price: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#6A5ACD",
  },
  actionButton: {
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    marginTop: 10,
  },
  purchaseButton: {
    backgroundColor: "#6A5ACD",
  },
  equipButton: {
    backgroundColor: "#4CAF50",
  },
  unequipButton: {
    backgroundColor: "#FF5722",
  },
  disabledButton: {
    backgroundColor: "#c0c0c0",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
});

export default ItemDetailScreen;
