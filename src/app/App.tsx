import { lazy, Suspense } from "react";
import { WelcomePage } from "@/pages/welcome/ui/welcome-page";
import { ProductShell } from "@/shared/ui/product-shell";
const DashboardPage = lazy(() => import("@/pages/dashboard/ui/dashboard-page").then(module => ({ default: module.DashboardPage })));
const ProtocolPage = lazy(() => import("@/pages/protocol/ui/protocol-page").then(module => ({ default: module.ProtocolPage })));

const ActionsPage = lazy(() => import("@/pages/actions/ui/actions-page").then(module => ({ default: module.ActionsPage })));

const ClaimsPage = lazy(() => import("@/pages/claims/ui/claims-page").then(module => ({ default: module.ClaimsPage })));

export function App() {
  if (location.pathname === "/" && !new URLSearchParams(location.search).has('action')) return <WelcomePage />;
  if (location.pathname === "/reference") return <Suspense fallback={<p className="workspace-loading">Opening reference…</p>}><DashboardPage /></Suspense>;
  const page = location.pathname === "/claims" ? <ClaimsPage /> : location.pathname === "/actions" ? <ActionsPage /> : <ProtocolPage />;
  return <ProductShell><Suspense fallback={<p className="workspace-loading" role="status">Opening your workspace…</p>}>{page}</Suspense></ProductShell>;
}
