// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole = "OWNER" | "MANAGER" | "STAFF" | "KITCHEN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  active: boolean;
  items?: MenuItem[];
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number; // in centavos (PHP)
  imageUrl?: string;
  available: boolean;
  modifierGroups?: ModifierGroup[];
}

export interface ModifierGroup {
  id: string;
  menuItemId: string;
  name: string; // e.g. "Size", "Milk Type", "Add-ons"
  required: boolean;
  multiSelect: boolean;
  options: ModifierOption[];
}

export interface ModifierOption {
  id: string;
  groupId: string;
  name: string;
  priceAdjustment: number; // in centavos, can be 0
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export type OrderSource = "ONLINE" | "QR_TABLE" | "POS";
export type DiscountType = "NONE" | "SENIOR_PWD" | "CUSTOM";
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COLLECTED"
  | "CANCELLED";

export interface Order {
  id: string;
  source: OrderSource;
  status: OrderStatus;
  tableId?: string;
  table?: CafeTable;
  offlineId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  notes?: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  discountType: DiscountType;
  discountAmount: number;
  discountIdNumber?: string;
  vatAmount: number;
  payment?: Payment;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  readyAt?: string;
  collectedAt?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  selectedOptions: SelectedOption[];
  subtotal: number;
  notes?: string;
  seniorDiscount?: boolean;
}

export interface SelectedOption {
  modifierOptionId: string;
  name: string;
  priceAdjustment: number;
}

// ─── Payments ────────────────────────────────────────────────────────────────

export type PaymentMethod = "GCASH" | "MAYA" | "CARD" | "CASH" | "SPLIT";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface PaymentSplitLine {
  method: Exclude<PaymentMethod, "SPLIT">;
  amount: number; // centavos
}

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number; // centavos
  splitDetails?: PaymentSplitLine[];
  paymongoPaymentIntentId?: string;
  paymongoSourceId?: string;
  paidAt?: string;
  createdAt: string;
}

// ─── Tables ──────────────────────────────────────────────────────────────────

export interface CafeTable {
  id: string;
  name: string; // e.g. "Table 1", "Window Seat"
  qrToken: string;
  active: boolean;
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export type InventoryUnit =
  | "KG"
  | "G"
  | "L"
  | "ML"
  | "PCS"
  | "PACK"
  | "BOTTLE";

export interface InventoryItem {
  id: string;
  name: string;
  unit: InventoryUnit;
  currentStock: number;
  lowStockThreshold: number;
  cost: number; // centavos per unit
  supplierId?: string;
  supplier?: Supplier;
  isLow?: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplier?: Supplier;
  items: PurchaseOrderItem[];
  total: number;
  notes?: string;
  createdAt: string;
  receivedAt?: string;
}

export interface PurchaseOrderItem {
  id: string;
  inventoryItemId: string;
  inventoryItem?: InventoryItem;
  quantity: number;
  unitCost: number;
}

// ─── Financials ──────────────────────────────────────────────────────────────

export interface SalesSummary {
  date: string;
  totalOrders: number;
  totalRevenue: number; // centavos
  byPaymentMethod: Record<PaymentMethod, number>;
  byCategory: { categoryName: string; revenue: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
}

export interface ReportRange {
  from: string; // ISO date
  to: string;
}

// ─── Staff ───────────────────────────────────────────────────────────────────

export interface Shift {
  id: string;
  userId: string;
  user?: User;
  date: string; // ISO date
  startTime: string; // "HH:mm"
  endTime: string;
  notes?: string;
}

export interface ClockEvent {
  id: string;
  userId: string;
  type: "CLOCK_IN" | "CLOCK_OUT";
  timestamp: string;
}

// ─── Till / Cash Drawer ──────────────────────────────────────────────────────

export interface TillSession {
  id: string;
  status: "OPEN" | "CLOSED";
  openedById: string;
  openedBy?: { id: string; name: string };
  openedAt: string;
  openingFloat: number;
  closedById?: string;
  closedBy?: { id: string; name: string };
  closedAt?: string;
  expectedCash?: number;
  actualCash?: number;
  variance?: number;
  notes?: string;
  cashIn?: number;
  cashOut?: number;
}

// ─── API Response wrappers ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
