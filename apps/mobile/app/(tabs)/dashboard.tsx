import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { mobileApi } from "../../src/lib/api";

interface Summary {
  todayOrders: number;
  weekRevenue: number;
  pendingOrders: number;
  lowStockItems: number;
}

const CARDS = (s: Summary) => [
  { label: "Orders Today", value: String(s.todayOrders), icon: "📋", accent: "#3b82f6" },
  { label: "Revenue This Week", value: `₱${(s.weekRevenue / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, icon: "💰", accent: "#10b981" },
  { label: "Pending Orders", value: String(s.pendingOrders), icon: "⏳", accent: s.pendingOrders > 0 ? "#f97316" : "#78716c" },
  { label: "Low Stock Alerts", value: String(s.lowStockItems), icon: "⚠️", accent: s.lowStockItems > 0 ? "#ef4444" : "#78716c" },
];

export default function DashboardScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const res = await mobileApi.reports.summary();
      setSummary(res.data);
    } catch {
      // if unauthed, navigate to login
      router.replace("/(auth)/login");
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
    >
      <Text style={styles.greeting}>Good morning! ☀️</Text>
      <Text style={styles.sub}>Here's Blessed Ave today</Text>

      <View style={styles.grid}>
        {summary
          ? CARDS(summary).map((card) => (
              <View key={card.label} style={[styles.card, { borderLeftColor: card.accent }]}>
                <Text style={styles.cardIcon}>{card.icon}</Text>
                <Text style={[styles.cardValue, { color: card.accent }]}>{card.value}</Text>
                <Text style={styles.cardLabel}>{card.label}</Text>
              </View>
            ))
          : Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={[styles.card, styles.cardSkeleton]} />
            ))}
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actions}>
        {[
          { label: "Kitchen Queue", icon: "👨‍🍳", route: "/(tabs)/orders" as const },
          { label: "Inventory", icon: "📦", route: "/(tabs)/inventory" as const },
        ].map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.actionCard}
            onPress={() => router.push(action.route)}
          >
            <Text style={styles.actionIcon}>{action.icon}</Text>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1c1917" },
  content: { padding: 20, paddingBottom: 40 },
  greeting: { fontSize: 22, fontWeight: "700", color: "#fff", marginTop: 8 },
  sub: { fontSize: 14, color: "#78716c", marginTop: 2, marginBottom: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
  card: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#292524",
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
  },
  cardSkeleton: { height: 90, borderLeftColor: "#3c3532", opacity: 0.5 },
  cardIcon: { fontSize: 22 },
  cardValue: { fontSize: 20, fontWeight: "700", marginTop: 6 },
  cardLabel: { fontSize: 12, color: "#78716c", marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 12 },
  actions: { flexDirection: "row", gap: 12 },
  actionCard: {
    flex: 1,
    backgroundColor: "#292524",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  actionIcon: { fontSize: 28 },
  actionLabel: { color: "#d4ccc9", fontWeight: "600", fontSize: 13, marginTop: 8, textAlign: "center" },
});
