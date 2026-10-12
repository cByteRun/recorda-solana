// The persisted 'test' key identifies Localnet and remains compatible with existing sessions.
export type WorkspaceMode = 'demo' | 'test' | 'devnet';
export const WORKSPACE_LABELS = {demo:'Demo Workspace',test:'Localnet Workspace',devnet:'Devnet Workspace'} as const;
export function selectedWorkspace(): WorkspaceMode | null {
  try { const mode=sessionStorage.getItem('recorda-workspace'); return mode==='demo'||mode==='test'||mode==='devnet'?mode:null; } catch { return null; }
}
export function enterWorkspace(mode:WorkspaceMode) {
  sessionStorage.removeItem('bondops-access');
  sessionStorage.removeItem('bondops-wallet');
  sessionStorage.removeItem('bondops-persona');
  sessionStorage.removeItem('bondops-signed-out');
  sessionStorage.removeItem('bondops-source');
  sessionStorage.removeItem('recorda-rpc');
  for(const workspace of ['demo','test','devnet']) {
    localStorage.removeItem(`recorda:protocol:addresses:v1:${workspace}`);
    localStorage.removeItem(`kase_real_deployment_v2:${workspace}`);
    localStorage.removeItem(`kase_real_action_v2:${workspace}`);
  }
  sessionStorage.setItem('recorda-workspace',mode);
  if(mode==='demo')sessionStorage.setItem('bondops-persona','demo-operator');
  // A full navigation discards readers, wallet state, selected addresses and in-memory RPC caches.
  if(mode!=='demo')sessionStorage.setItem('bondops-signed-out','true');
  location.assign(mode==='demo'?'/dashboard':'/login');
}
