import type { Metadata } from "next";
import { cookies } from "next/headers";
import { adminConfigured, validateSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { paymentsConfigured } from "@/lib/stripe";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { getCategories, getProducts, getSettings } from "@/lib/catalog";
import {
  getAdminOrder,
  getDashboardStats,
  listCustomers,
  listOrders,
} from "@/lib/orders";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const TABS = ["overview", "orders", "products", "customers", "settings"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ref?: string }>;
}) {
  const configured = adminConfigured();
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value ?? null;
  const signedIn = configured && (await validateSession(token));

  if (!signedIn) {
    return (
      <div className="wrap admin-page">
        <AdminLogin configured={configured} />
      </div>
    );
  }

  const params = await searchParams;
  const tab: Tab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : "overview";
  const reference = params.ref ? decodeURIComponent(params.ref) : null;

  const [stats, orders, products, categories, settings, customers] = await Promise.all([
    getDashboardStats(),
    listOrders(),
    getProducts({ includeInactive: true }),
    getCategories(),
    getSettings(),
    listCustomers(),
  ]);

  const orderDetail = reference ? await getAdminOrder(reference) : null;

  return (
    <div className="wrap admin-page">
      <header className="admin-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="h2">Dashboard</h1>
        </div>
      </header>

      <AdminDashboard
        initialTab={tab}
        orderDetail={orderDetail}
        data={{
          stats,
          orders,
          products,
          categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
          customers,
          settings,
          paymentsLive: paymentsConfigured(),
        }}
      />
    </div>
  );
}