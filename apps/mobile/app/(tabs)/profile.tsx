import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import type { User } from "@blessed-ave/types";

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync("user").then((val) => {
      if (val) setUser(JSON.parse(val));
    });
  }, []);

  async function handleLogout() {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await SecureStore.deleteItemAsync("accessToken");
          await SecureStore.deleteItemAsync("refreshToken");
          await SecureStore.deleteItemAsync("user");
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name ?? "—"}</Text>
        <Text style={styles.email}>{user?.email ?? "—"}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{user?.role?.toLowerCase() ?? "staff"}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Blessed Ave Admin v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1c1917", padding: 24, alignItems: "center" },
  card: { backgroundColor: "#292524", borderRadius: 20, padding: 28, alignItems: "center", width: "100%", marginTop: 20 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#f97316", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  name: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 14 },
  email: { color: "#78716c", fontSize: 14, marginTop: 4 },
  badge: { marginTop: 10, backgroundColor: "#431407", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 },
  badgeText: { color: "#f97316", fontWeight: "700", fontSize: 12, textTransform: "capitalize" },
  logoutBtn: { marginTop: 32, backgroundColor: "#ef444420", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, borderWidth: 1, borderColor: "#ef4444" },
  logoutText: { color: "#ef4444", fontWeight: "700", fontSize: 15 },
  version: { color: "#44403c", fontSize: 12, marginTop: 24 },
});
