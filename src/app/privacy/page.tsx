import AppHeader from "@/components/AppHeader";

export default function PrivacyPage() {
  return (
    <div className="min-h-[100dvh] pb-4">
      <AppHeader title="隱私權政策" subtitle="最後更新：2026年6月" back={true} />

      <div className="px-5 space-y-4">
        <div className="card">
          <h2 className="font-extrabold text-ink text-lg mb-3">Mobile English 隱私權政策</h2>
          <p className="text-sm text-inkSoft leading-relaxed mb-4">
            感謝您使用 Mobile English（以下稱「本 App」）。本隱私權政策說明我們如何蒐集、使用、儲存和保護您的個人資料。
          </p>

          <div className="space-y-4 text-sm text-ink">
            <section>
              <h3 className="font-bold text-ink mb-2">1. 蒐集的資料類型</h3>
              <ul className="list-disc list-inside space-y-1 text-inkSoft">
                <li>帳號資訊：電子郵件、姓名、登入方式</li>
                <li>學習資料：學習紀錄、進度、對話紀錄、語音辨識文字</li>
                <li>設定資料：語言偏好、語音設定、中文顯示設定</li>
                <li>裝置資訊：裝置型號、作業系統版本（用於技術支援）</li>
                <li>訂閱資料：訂閱狀態、購買記錄（透過 RevenueCat 管理）</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-ink mb-2">2. 麥克風與語音資料</h3>
              <p className="text-inkSoft leading-relaxed mb-2">
                本 App 使用麥克風進行語音輸入與口說練習。原始錄音音檔僅用於即時語音辨識，辨識完成後立即刪除，不會永久儲存。
              </p>
              <p className="text-inkSoft leading-relaxed">
                語音辨識後的文字內容會儲存於您的學習紀錄中，用於提供個人化建議與進度追蹤。
              </p>
            </section>

            <section>
              <h3 className="font-bold text-ink mb-2">3. 第三方服務</h3>
              <p className="text-inkSoft leading-relaxed mb-2">本 App 使用以下第三方服務：</p>
              <ul className="list-disc list-inside space-y-1 text-inkSoft">
                <li><strong>Supabase</strong>：資料庫與認證服務</li>
                <li><strong>OpenAI</strong>：AI 導師對話與語音合成</li>
                <li><strong>Google Cloud</strong>：語音辨識（STT）</li>
                <li><strong>RevenueCat</strong>：訂閱與付款管理</li>
              </ul>
              <p className="text-inkSoft leading-relaxed mt-2">
                這些服務會依照其各自的隱私權政策處理您的資料。我們不會將您的資料出售給第三方。
              </p>
            </section>

            <section>
              <h3 className="font-bold text-ink mb-2">4. 訂閱資料處理</h3>
              <p className="text-inkSoft leading-relaxed mb-2">
                訂閱交易透過 Apple App Store 或 Google Play 處理。我們透過 RevenueCat 管理訂閱狀態，並在 Supabase 中儲存訂閱權限資訊。
              </p>
              <p className="text-inkSoft leading-relaxed">
                訂閱交易紀錄僅保留法律、會計或退款處理必要資料。您可以隨時透過 App 內的「管理訂閱」功能取消訂閱。
              </p>
            </section>

            <section>
              <h3 className="font-bold text-ink mb-2">5. 資料安全</h3>
              <p className="text-inkSoft leading-relaxed">
                我們採用業界標準的加密技術保護您的資料傳輸與儲存。所有資料都儲存在安全的雲端伺服器上，並定期進行安全審查。
              </p>
            </section>

            <section>
              <h3 className="font-bold text-ink mb-2">6. 您的權利</h3>
              <ul className="list-disc list-inside space-y-1 text-inkSoft">
                <li>查看、修改或刪除您的個人資料</li>
                <li>撤回麥克風權限（透過裝置設定）</li>
                <li>刪除帳號與所有相關資料（設定 &gt; 刪除帳號）</li>
                <li>取消訂閱（設定 &gt; 訂閱與付款 &gt; 管理訂閱）</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-ink mb-2">7. 帳號刪除</h3>
              <p className="text-inkSoft leading-relaxed mb-2">
                您可以透過 App 內的「刪除帳號」功能或公開網站 /delete-account 刪除您的帳號。刪除後，以下資料將被永久刪除：
              </p>
              <ul className="list-disc list-inside space-y-1 text-inkSoft">
                <li>個人資料與設定</li>
                <li>學習紀錄與進度</li>
                <li>對話紀錄與語音辨識文字</li>
                <li>單字複習與收藏</li>
              </ul>
              <p className="text-inkSoft leading-relaxed mt-2">
                訂閱交易紀錄僅保留法律必要資料。刪除後，您無法再存取舊的學習資料。若日後使用同一購買帳號重新登入，可透過「恢復購買」恢復訂閱權益，但不會還原已刪除的學習資料。
              </p>
            </section>

            <section>
              <h3 className="font-bold text-ink mb-2">8. 兒童隱私</h3>
              <p className="text-inkSoft leading-relaxed">
                本 App 不會故意蒐集 13 歲以下兒童的個人資料。若發現我們蒐集了兒童資料，將立即刪除。
              </p>
            </section>

            <section>
              <h3 className="font-bold text-ink mb-2">9. 政策更新</h3>
              <p className="text-inkSoft leading-relaxed">
                我們可能會不定期更新本隱私權政策。重大變更將透過 App 內通知或電子郵件告知您。
              </p>
            </section>

            <section>
              <h3 className="font-bold text-ink mb-2">10. 聯絡我們</h3>
              <p className="text-inkSoft leading-relaxed">
                若您對本隱私權政策有任何疑問，請透過以下方式聯絡我們：
                <br />
                <a href="mailto:support.mobileenglish@gmail.com" className="text-lilacDeep">
                  support.mobileenglish@gmail.com
                </a>
              </p>
            </section>
          </div>
        </div>

        <p className="text-xs text-inkSoft text-center">
          本隱私權政策最後更新日期：2026年6月29日
        </p>
      </div>
    </div>
  );
}
