import { Suspense } from "react";
import PayPalReturnClient from "./PayPalReturnClient";

export default function PayPalReturnPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center text-inkSoft">確認付款中...</div>}>
      <PayPalReturnClient />
    </Suspense>
  );
}
