import { lazy, Suspense } from "react";
import { WelcomePage } from "@/pages/welcome/ui/welcome-page";
import { selectedWorkspace } from "@/shared/solana/workspaces";
import { DemoRegister } from "@/pages/workspaces/ui/demo-register";
import { TestActionPage } from "@/pages/dashboard/ui/test-action-page";
import { WorkspacesPage } from "@/pages/workspaces/ui/workspaces-page";
import { BondOpsShell } from "@/shared/ui/bondops-shell";
const BondOpsPage = lazy(() => import("@/pages/dashboard/ui/bondops-page").then(m => ({default:m.BondOpsPage})));
const BondOpsPlaceholder = lazy(() => import("@/pages/dashboard/ui/bondops-page").then(m => ({default:m.BondOpsPlaceholder})));
const DashboardPage = lazy(() => import("@/pages/dashboard/ui/dashboard-page").then(module => ({ default: module.DashboardPage })));
const ProtocolPage = lazy(() => import("@/pages/protocol/ui/protocol-page").then(module => ({ default: module.ProtocolPage })));

const ActionsPage = lazy(() => import("@/pages/actions/ui/actions-page").then(module => ({ default: module.ActionsPage })));

const ClaimsPage = lazy(() => import("@/pages/claims/ui/claims-page").then(module => ({ default: module.ClaimsPage })));
const OverviewPage = lazy(() => import("@/pages/overview/ui/overview-page").then(module => ({ default: module.OverviewPage })));

export function App() {
  if (location.pathname === "/" && !new URLSearchParams(location.search).has('action')) return <WelcomePage />;
  if (location.pathname === "/reference") return <Suspense fallback={<p className="workspace-loading">Opening reference…</p>}><DashboardPage /></Suspense>;
  if (location.pathname === "/workspaces" || !selectedWorkspace()) return <WorkspacesPage />;
  const demoPage = selectedWorkspace()==='demo' && ['/holders','/claims','/protocol'].includes(location.pathname) ? (location.pathname==='/holders'?<DemoRegister/>:<TestActionPage id="DEMO-CA-001"/>) : null;
  const page = demoPage ?? ( location.pathname === '/dashboard' ? <BondOpsPage /> : ['/bonds','/settlements','/exceptions','/calendar','/notifications','/audit','/infrastructure','/settings'].includes(location.pathname) ? <BondOpsPlaceholder /> : location.pathname === '/holders' ? <OverviewPage /> : location.pathname === "/claims" ? <ClaimsPage /> : location.pathname === "/actions" ? <ActionsPage /> : <ProtocolPage />);
  return <BondOpsShell><Suspense fallback={<p className="workspace-loading" role="status">Opening your workspace…</p>}>{page}</Suspense></BondOpsShell>;
}
