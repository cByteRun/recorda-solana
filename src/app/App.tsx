import { useAppLocation } from "./use-app-location";
import { lazy, Suspense } from "react";
import { WelcomePage } from "@/pages/welcome/ui/welcome-page";
import { selectedWorkspace } from "@/shared/solana/workspaces";
import { DemoRegister } from "@/pages/workspaces/ui/demo-register";
import { TestActionPage } from "@/pages/dashboard/ui/test-action-page";
import { WorkspacesPage } from "@/pages/workspaces/ui/workspaces-page";
import { BondOpsShell } from "@/shared/ui/bondops-shell";
const BondOpsPage = lazy(() => import("@/pages/dashboard/ui/bondops-page").then(m => ({default:m.BondOpsPage})));
const LoginPage = lazy(() => import("@/pages/workspaces/ui/login-page").then(m => ({default:m.LoginPage})));
const DashboardPage = lazy(() => import("@/pages/dashboard/ui/dashboard-page").then(module => ({ default: module.DashboardPage })));
const ProtocolPage = lazy(() => import("@/pages/protocol/ui/protocol-page").then(module => ({ default: module.ProtocolPage })));

const ActionsPage = lazy(() => import("@/pages/actions/ui/actions-page").then(module => ({ default: module.ActionsPage })));

const ClaimsPage = lazy(() => import("@/pages/claims/ui/claims-page").then(module => ({ default: module.ClaimsPage })));
const OverviewPage = lazy(() => import("@/pages/overview/ui/overview-page").then(module => ({ default: module.OverviewPage })));

export function App() {
  const route=useAppLocation();
  if (location.pathname === "/" && !new URLSearchParams(location.search).has('action')) return <WelcomePage />;
  if (location.pathname === "/reference") return <Suspense fallback={<p className="workspace-loading">Opening reference…</p>}><DashboardPage /></Suspense>;
  if (location.pathname === "/workspaces" || !selectedWorkspace()) return <WorkspacesPage />;
  const demoPage = selectedWorkspace()==='demo' && ['/actions','/holders','/claims','/protocol'].includes(location.pathname) ? (location.pathname==='/holders'?<DemoRegister/>:<TestActionPage id={new URLSearchParams(location.search).get('example')??'DEMO-CA-001'}/>) : null;
  const page = demoPage ?? ( location.pathname === '/login' ? <LoginPage /> : location.pathname === '/dashboard' ? <BondOpsPage /> : ['/bonds','/settlements','/exceptions','/calendar','/notifications','/audit','/infrastructure','/settings','/holdings','/entitlements','/voting','/history','/proofs','/register','/reports'].includes(location.pathname) ? <BondOpsPage /> : location.pathname === '/holders' ? <OverviewPage /> : location.pathname === "/claims" ? <ClaimsPage /> : location.pathname === "/actions" ? <ActionsPage /> : <ProtocolPage />);
  return <BondOpsShell><Suspense key={route} fallback={<p className="workspace-loading" role="status">Opening your workspace…</p>}>{page}</Suspense></BondOpsShell>;
}
