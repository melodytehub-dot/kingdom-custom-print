import "server-only";
import { sql } from "./db";
import { parseSettingValue } from "./catalog";
import { isSafeBuilderLink } from "./builder/schema";

export const NAVIGATION_MENUS_KEY = "navigation_menus_v1";

export type HeaderMenuItem = {
  id: string;
  label: string;
  href: string;
  highlight?: boolean;
};

export type FooterMenuItem = {
  id: string;
  label: string;
  href: string;
};

export type NavigationMenus = {
  header: HeaderMenuItem[];
  footerCompany: FooterMenuItem[];
  footerInfo: FooterMenuItem[];
};

export function defaultNavigationMenus(): NavigationMenus {
  return {
    header: [
      { id: "hdr-home", label: "Home", href: "/" },
      { id: "hdr-shop", label: "Shop All", href: "/shop" },
      { id: "hdr-tee", label: "T-Shirts", href: "/shop?kind=tee" },
      { id: "hdr-polo", label: "Polo Shirts", href: "/shop?kind=polo" },
      { id: "hdr-ls", label: "Long Sleeves", href: "/shop?kind=longsleeve" },
      { id: "hdr-hoodie", label: "Hoodies", href: "/shop?kind=hoodie" },
      { id: "hdr-customize", label: "Design Studio", href: "/customize", highlight: true },
      { id: "hdr-contact", label: "Contact", href: "/contact" },
    ],
    footerCompany: [
      { id: "fc-contact", label: "Contact", href: "/contact" },
      { id: "fc-shipping", label: "Shipping & Return", href: "/shipping" },
      { id: "fc-faq", label: "FAQ", href: "/faq" },
      { id: "fc-privacy", label: "Privacy Policy", href: "/privacy" },
    ],
    footerInfo: [
      { id: "fi-cart", label: "My Cart", href: "/cart" },
      { id: "fi-wishlist", label: "Wishlist", href: "/wishlist" },
      { id: "fi-checkout", label: "Checkout", href: "/checkout" },
      { id: "fi-account", label: "My Account", href: "/account" },
      { id: "fi-enquiries", label: "Printing Enquiries", href: "/contact" },
      { id: "fi-terms", label: "Terms of Service", href: "/terms" },
    ],
  };
}

function parseList(
  value: unknown,
  maxItems: number,
  allowHighlight: boolean
): HeaderMenuItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxItems) return null;
  const out: HeaderMenuItem[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim().slice(0, 64) : "";
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const href = typeof item.href === "string" ? item.href.trim() : "";
    if (!id || seen.has(id) || !label || label.length > 48 || !isSafeBuilderLink(href)) {
      return null;
    }
    seen.add(id);
    out.push({
      id,
      label,
      href,
      ...(allowHighlight && item.highlight === true ? { highlight: true } : {}),
    });
  }
  return out;
}

export function parseNavigationMenus(value: unknown): NavigationMenus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const header = parseList(input.header, 12, true);
  const footerCompany = parseList(input.footerCompany, 10, false);
  const footerInfo = parseList(input.footerInfo, 10, false);
  if (!header || !footerCompany || !footerInfo) return null;
  return { header, footerCompany, footerInfo };
}

export async function getNavigationMenus(): Promise<NavigationMenus> {
  const [row] = await sql<{ value: unknown }[]>`
    SELECT value FROM site_settings WHERE key = ${NAVIGATION_MENUS_KEY} LIMIT 1`;
  if (!row) return defaultNavigationMenus();
  const parsed = parseNavigationMenus(parseSettingValue(row.value));
  return parsed ?? defaultNavigationMenus();
}

export async function saveNavigationMenus(menus: NavigationMenus): Promise<void> {
  await sql`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES (${NAVIGATION_MENUS_KEY}, ${sql.json(menus)}, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT (key) DO UPDATE
      SET value = excluded.value, updated_at = excluded.updated_at`;
}

export async function resetNavigationMenus(): Promise<NavigationMenus> {
  await sql`DELETE FROM site_settings WHERE key = ${NAVIGATION_MENUS_KEY}`;
  return defaultNavigationMenus();
}
