import { getProducts } from "@/lib/catalog";
import WishlistView from "@/components/WishlistView";
export const revalidate = 60;
export const metadata = { title: "Your wishlist" };
export default async function WishlistPage() {
  const products = await getProducts();
  return <div className="minimog-container section"><div className="page-head"><h1>Your wishlist</h1><p>Your favorite garments, ready when inspiration strikes.</p></div><WishlistView products={products} /></div>;
}
