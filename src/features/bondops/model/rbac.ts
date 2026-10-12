import type { Member, Workspace } from './bondops-context';

export type Role = 'operator' | 'reviewer' | 'investor' | 'auditor';
export const ROLE_LABELS: Record<Role, string> = {operator:'Operator',reviewer:'Reviewer',investor:'Investor',auditor:'Auditor'};
export const PERSONAS = [
  {id:'demo-operator',name:'Demo Operator',role:'operator',description:'Выпуски, корпоративные действия и контроль выплат.'},
  ...['A','B','C'].map(id => ({id:`demo-investor-${id}`,name:`Investor ${id}`,role:'investor' as const,description:'Мои облигации, права, голосования и история выплат.'})),
  {id:'demo-auditor',name:'Demo Auditor',role:'auditor',description:'Независимая проверка прав, исполнения и доказательств.'},
  {id:'demo-reviewer',name:'Demo Reviewer',role:'reviewer',description:'Сверка, сроки и разбор операционных исключений.'},
] satisfies {id:string;name:string;role:Role;description:string}[];
export function previewMember(id:string):Member | null {
  const p=PERSONAS.find(p=>p.id===id);
  return p?{id:p.id,name:p.name,role:p.role,wallet:p.role==='investor'?p.id.slice(-1):null,scopes:['*'],workspace:'demo'}:null;
}

export const configuredWallets = [
  {wallet:import.meta.env.VITE_RECORDA_OPERATOR,role:'operator',name:'Bond operator'},
  {wallet:import.meta.env.VITE_RECORDA_REVIEWER,role:'reviewer',name:'Operations reviewer'},
  {wallet:import.meta.env.VITE_RECORDA_AUDITOR,role:'auditor',name:'Independent auditor'},
  ...[['A',import.meta.env.VITE_RECORDA_HOLDER_A],['B',import.meta.env.VITE_RECORDA_HOLDER_B],['C',import.meta.env.VITE_RECORDA_HOLDER_C]].map(([id,wallet])=>({wallet,role:'investor',name:`Investor ${id}`})),
] as {wallet:string|undefined;role:Role;name:string}[];
export function resolveWalletMember(state:Workspace|null,wallet:string|null):Member|null {
  if(!wallet)return null;
  const configured=configuredWallets.filter(m=>m.wallet===wallet);
  if(new Set(configured.map(m=>m.role)).size>1)throw Error('This wallet is configured for conflicting roles. Check the public address configuration.');
  const m=configured[0];
  if(m)return {id:wallet,wallet,name:m.name,role:m.role,scopes:state?.members.filter(x=>x.wallet===wallet).flatMap(x=>x.scopes)??[],workspace:'live'};
  const records=state?.members.filter(m=>m.wallet===wallet)??[];
  return records.find(m=>m.role==='operator')??records.find(m=>m.role==='reviewer')??records[0]??null;
}
export function canVisit(role:Role,path:string) {
  if(['/dashboard','/login','/notifications'].includes(path))return true;
  if(role==='investor'&&['/actions','/protocol'].includes(path))return new URLSearchParams(location.search).has('action')||new URLSearchParams(location.search).has('example');
  if(role==='investor')return ['/holdings','/entitlements','/voting','/history','/claims'].includes(path);
  if(role==='auditor')return ['/audit','/proofs','/reports','/register','/exceptions','/bonds','/calendar','/settlements','/holders'].includes(path);
  if(role==='reviewer')return !['/settings','/infrastructure'].includes(path);
  return true;
}
export function canManage(role:Role|undefined) {return role==='operator'||role==='reviewer';}
