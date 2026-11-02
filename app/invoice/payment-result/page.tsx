import Link from "next/link";
export const metadata = { title: "Invoice payment", robots: { index: false, follow: false } };
export default async function InvoicePaymentResult({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams;
  return <main className="admin-invoice"><h1>{cancelled ? "Payment not completed" : "Checking your payment"}</h1><p>{cancelled ? "You can return to your invoice whenever you are ready." : "Return to the invoice link in your email to check its payment status. It may take a moment to update."}</p><Link className="btn btn-light" href="/contact">Contact us</Link></main>;
}
