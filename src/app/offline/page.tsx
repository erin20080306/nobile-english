export const metadata = {
  title: "離線模式｜Mobile Language",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm rounded-[34px] bg-white p-6 shadow-soft">
        <img src="/assets/pwa/icon-192.png" alt="" className="mx-auto h-20 w-20 rounded-[28px]" />
        <h1 className="mt-4 text-2xl font-extrabold text-ink">目前離線</h1>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-inkSoft">
          已安裝的 App 外殼仍可開啟；需要同步、AI、語音或文章資料時，請重新連線。
        </p>
        <a href="/dashboard" className="btn-primary mt-5 block">
          回到首頁
        </a>
      </div>
    </main>
  );
}
