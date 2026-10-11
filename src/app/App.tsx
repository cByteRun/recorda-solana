import { lazy, Suspense } from "react";
import { DashboardPage } from "@/pages/dashboard/ui/dashboard-page";
const ProtocolPage = lazy(() => import("@/pages/protocol/ui/protocol-page").then(module => ({ default: module.ProtocolPage })));

const ActionsPage = lazy(() => import("@/pages/actions/ui/actions-page").then(module => ({ default: module.ActionsPage })));

const ClaimsPage = lazy(() => import("@/pages/claims/ui/claims-page").then(module => ({ default: module.ClaimsPage })));

export function App() {
  if (location.pathname === "/claims") return <Suspense fallback={<p className="p-8">Loading claims…</p>}><ClaimsPage /></Suspense>;
  if (location.pathname === "/actions") return <Suspense fallback={<p className="p-8">Loading actions…</p>}><ActionsPage /></Suspense>;
  return location.pathname !== "/reference"
    ? <Suspense fallback={<p className="p-8">Loading Coupon Core…</p>}><ProtocolPage /></Suspense>
    : <DashboardPage />;
}
