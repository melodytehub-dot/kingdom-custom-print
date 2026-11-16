import HomeContent from "@/components/HomeContent";
import { defaultHomepageLayout } from "@/lib/homepage-builder";
import { publishedHomepageLayout } from "@/lib/homepage-layout-store";

export const revalidate = 60;

export default async function HomePage() {
  const layout = await publishedHomepageLayout().catch(() => defaultHomepageLayout());
  return <HomeContent layout={layout} />;
}
