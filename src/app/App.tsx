import { lazy, Suspense } from "react";
import { DashboardPage } from "@/pages/dashboard/ui/dashboard-page";
const ProtocolPage = lazy(() => import("@/pages/protocol/ui/protocol-page").then(module => ({ default: module.ProtocolPage })));

export function App() {
  return location.pathname === "/protocol"
    ? <Suspense fallback={<p className="p-8">Loading Coupon Core…</p>}><ProtocolPage /></Suspense>
    : <DashboardPage />;
}
