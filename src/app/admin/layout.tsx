import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Link
        href="/admin/manual-subscriptions"
        className="fixed bottom-5 right-5 z-50 rounded-full bg-lilacDeep px-5 py-3 text-sm font-extrabold text-white shadow-soft active:scale-95"
      >
        手動開通／付款通知
      </Link>
    </>
  );
}
