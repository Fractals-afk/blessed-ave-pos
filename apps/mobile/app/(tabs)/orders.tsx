import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { mobileApi } from "../../src/lib/api";
import type { Order } from "@blessed-ave/types";

const STATUS_ACTIONS: Record<string, { next: string; label: string }> = {
  PENDING: { next: "CONFIRMED", label: "Confirm Order" },
  CONFIRMED: { next: "PREPARING", label: "Start Preparing" },
  PREPARING: { next: "READY", label: "Mark Ready 🔔" },
  READY: { next: "COLLECTED", label: "Collected ✓" },
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#3b82f6",
  CONFIRMED: "#eab308",
  PREPARING: "#f97316",
  READY: "#10b981",
};

function elapsed(createdAt: string) {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  return mins < 1 ? "just now" : `${mins}m ago`;
}

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const res = await mobileApi.orders.kitchen();
    setOrders(res.data);
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  async function advance(order: Order) {
    const action = STATUS_ACTIONS[order.status];
    if (!action) return;
    try {
      await mobileApi.orders.updateStatus(order.id, action.next);
      load();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
    >
      <Text style={styles.title}>Kitchen Queue</Text>
      {orders.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>😌</Text>
          <Text style={styles.emptyText}>All clear! No active orders.</Text>
        </View>
      )}
      {orders.map((order) => {
        const color = STATUS_COLORS[order.status] ?? "#78716c";
        return (
          <View key={order.id} style={[styles.card, { borderLeftColor: color }]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.orderId}>#{order.id.slice(-4).toUpperCase()}</Text>
                <Text style={styles.meta}>
                  {order.source === "QR_TABLE"
                    ? order.tableName ?? "Table"
                    : order.source === "POS"
                    ? "POS"
                    : "Online"}{" "}
                  · {elapsed(order.createdAt)}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: color + "22" }]}>
                <Text style={[styles.badgeText, { color }]}>{order.status}</Text>
              </View>
            </View>

            {order.items.map((item) => (
              <View key={item.id} style={styles.item}>
                <Text style={styles.itemName}>
                  {item.quantity}× {item.menuItemName}
                </Text>
                {item.selectedOptions.length > 0 && (
                  <Text style={styles.itemOptions}>
                    {item.selectedOptions.map((o) => o.name).join(", ")}
                  </Text>
                )}
              </View>
            ))}

            {order.notes ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>📝 {order.notes}</Text>
              </View>
            ) : null}

            {STATUS_ACTIONS[order.status] && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: color }]}
                onPress={() => advance(order)}
              >
                <Text style={styles.actionBtnText}>
                  {STATUS_ACTIONS[order.status].label}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1c1917" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 16, marginTop: 4 },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: "#78716c", marginTop: 8, fontSize: 15 },
  card: {
    backgroundColor: "#292524",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  orderId: { color: "#fff", fontWeight: "700", fontSize: 16 },
  meta: { color: "#78716c", fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  item: { marginBottom: 6 },
  itemName: { color: "#e7e5e4", fontWeight: "600", fontSize: 14 },
  itemOptions: { color: "#78716c", fontSize: 12, marginTop: 1, marginLeft: 12 },
  noteBox: { backgroundColor: "#3c3532", borderRadius: 10, padding: 10, marginTop: 8 },
  noteText: { color: "#fdba74", fontSize: 13 },
  actionBtn: { borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
