import type { OrderStatus, ProductKind } from "./types";
import type { Product } from "./types";

export interface SiteSettings {
  announcement: string;
  shippingFlat: number;
  freeShippingThreshold: number;
  contactEmail: string;
  contactPhone: string;
  businessAddress: string;
  productionDays: string;
}

export interface DashboardStats {
  orders: number;
  paidOrders: number;
  revenue: number;
  garments: number;
  lowActivity: boolean;
}

export interface AdminOrder {
  reference: string;
  email: string;
  name: string;
  city: string;
  region: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  garmentCount: number;
  createdAt: string;
}

export interface CustomerRow {
  email: string;
  name: string;
  phone: string;
  orders: number;
  spent: number;
  lastOrderAt: string;
}

export interface AdminOrderItem {
  productName: string;
  productKind: ProductKind;
  colorName: string;
  colorHex: string;
  quantity: number;
  unitPrice: number;
  sizeBreakdown: { label: string; qty: number }[];
  design: { front: unknown[]; back: unknown[] };
  previewFront: string | null;
  previewBack: string | null;
}

export interface AdminOrderDetail {
  reference: string;
  email: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  notes: string;
  status: OrderStatus;
  subtotal: number;
  shipping: number;
  total: number;
  createdAt: string;
  paidAt: string | null;
  items: AdminOrderItem[];
}

export type { Product };
