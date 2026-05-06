import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
} from "react-native";
import { mobileApi } from "../../src/lib/api";
import type { InventoryItem } from "@blessed-ave/types";

export default function InventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<"PURCHASE" | "WASTE" | "ADJUSTMENT">("PURCHASE");

  async function load() {
    const res = await mobileApi.inventory.list();
    setItems(res.data);
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdjust() {
    if (!adjustItem || !qty) return;
    try {
      await mobileApi.inventory.adjust(adjustItem.id, {
        quantity: Number(qty),
        reason,
      });
      Alert.alert("Done", "Stock updated");
      setAdjustItem(null);
      setQty("");
      load();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );
  const lowStock = filtered.filter((i) => i.isLow);
  const ok = filtered.filter((i) => !i.isLow);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
      >
        <TextInput
          style={styles.search}
          placeholder="Search items..."
          placeholderTextColor="#78716c"
          value={search}
          onChangeText={setSearch}
        />

        {lowStock.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>⚠️ Low Stock ({lowStock.length})</Text>
            {lowStock.map((item) => (
              <ItemRow key={item.id} item={item} onAdjust={() => setAdjustItem(item)} />
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>All Items</Text>
        {ok.map((item) => (
          <ItemRow key={item.id} item={item} onAdjust={() => setAdjustItem(item)} />
        ))}
      </ScrollView>

      {/* Adjust modal */}
      <Modal visible={!!adjustItem} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Adjust: {adjustItem?.name}</Text>
            <Text style={styles.modalSub}>
              Current: {adjustItem?.currentStock} {adjustItem?.unit}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Quantity (+/−)"
              placeholderTextColor="#78716c"
              value={qty}
              onChangeText={setQty}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Reason</Text>
            <View style={styles.reasonRow}>
              {(["PURCHASE", "WASTE", "ADJUSTMENT"] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonBtn, reason === r && styles.reasonBtnActive]}
                  onPress={() => setReason(r)}
                >
                  <Text style={[styles.reasonText, reason === r && styles.reasonTextActive]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAdjustItem(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAdjust}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function ItemRow({ item, onAdjust }: { item: InventoryItem; onAdjust: () => void }) {
  return (
    <View style={[styles.row, item.isLow && styles.rowLow]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowStock}>
          {item.currentStock} {item.unit}
          {item.isLow && (
            <Text style={styles.lowText}> — Low!</Text>
          )}
        </Text>
      </View>
      <TouchableOpacity style={styles.adjustBtn} onPress={onAdjust}>
        <Text style={styles.adjustText}>Adjust</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1c1917" },
  content: { padding: 16, paddingBottom: 40 },
  search: {
    backgroundColor: "#292524",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#fff",
    marginBottom: 16,
    fontSize: 14,
  },
  sectionTitle: { color: "#78716c", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  row: {
    backgroundColor: "#292524",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  rowLow: { borderLeftWidth: 3, borderLeftColor: "#ef4444" },
  rowName: { color: "#e7e5e4", fontWeight: "600", fontSize: 14 },
  rowStock: { color: "#78716c", fontSize: 13, marginTop: 2 },
  lowText: { color: "#ef4444", fontWeight: "700" },
  adjustBtn: { backgroundColor: "#f97316", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  adjustText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#292524", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  modalSub: { color: "#78716c", fontSize: 13, marginTop: 4, marginBottom: 16 },
  input: {
    backgroundColor: "#3c3532",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
    marginBottom: 12,
  },
  label: { color: "#a8a29e", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  reasonRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  reasonBtn: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: "#57534e", paddingVertical: 8, alignItems: "center" },
  reasonBtnActive: { borderColor: "#f97316", backgroundColor: "#431407" },
  reasonText: { color: "#78716c", fontSize: 11, fontWeight: "600" },
  reasonTextActive: { color: "#f97316" },
  modalActions: { flexDirection: "row", gap: 12 },
  cancelBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: "#57534e", paddingVertical: 13, alignItems: "center" },
  cancelText: { color: "#a8a29e", fontWeight: "600" },
  saveBtn: { flex: 1, borderRadius: 12, backgroundColor: "#f97316", paddingVertical: 13, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "700" },
});
