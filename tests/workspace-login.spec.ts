import {test,expect,type Page} from '@playwright/test';
const wallet='9AWV62NJoDF2Wi7GwYw6WWEGpiuA86BRHgyJahB7cdXJ';
async function setup(page:Page,signedOut:boolean){
 await page.addInitScript(({wallet,signedOut})=>{
  sessionStorage.setItem('recorda-workspace','test');
  if(signedOut)sessionStorage.setItem('bondops-signed-out','true');
  const key={toBase58:()=>wallet};
  Object.assign(window,{phantom:{solana:{isPhantom:true,publicKey:key,connect:()=>new Promise((resolve,reject)=>Object.assign(window,{approveConnection:()=>resolve({publicKey:key}),rejectConnection:()=>reject(new Error('Connection rejected'))}))}}});
 },{wallet,signedOut});
 // Isolate wallet/loader behavior from the validator; actual localnet is checked separately.
 await page.route('**/src/shared/solana/bondops-program.ts',route=>route.fulfill({contentType:'application/javascript',body:`
 export async function loadProgramWorkspace(){const response=await fetch('/__test_workspace');if(!response.ok)throw Error('Local Solana RPC unavailable');return response.json();}
 export function unavailableProgramWorkspace(state){return {...state,syncError:'Local Solana RPC unavailable'};}
 export async function mutateProgramWorkspace(){throw Error('Unexpected mutation');}
 `}));
 let available=true;
 await page.route('**/__test_workspace',route=>route.fulfill({status:available?200:503,contentType:'application/json',body:JSON.stringify({mode:'live',revision:0,instruments:[],actions:[],cases:[],audit:[],notifications:[],members:[{id:wallet,wallet,name:'Test operator',role:'operator',scopes:[],workspace:'live'}],totals:[],preferences:{leadHours:72,escalateHours:24},lastSync:new Date().toISOString(),syncError:null,serverTime:new Date().toISOString(),network:'Local validator'})}));
 return (value:boolean)=>{available=value;};
}
test('locked Phantom awaits approval, displays rejection, and allows reconnect',async({page})=>{
 await setup(page,true);await page.goto('/login');
 await page.getByRole('button',{name:'Connect Phantom & identify me',exact:true}).click();
 await expect(page.getByText('Unlock Phantom and approve the connection in the wallet window. Enter your password only in Phantom.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Connecting…',exact:true})).toBeDisabled();
 await page.evaluate(()=>{(window as unknown as {rejectConnection():void}).rejectConnection();});
 await expect(page.getByRole('status')).toHaveText('Unable to load workspace');
 await expect(page.getByRole('alert')).toHaveText('Connection rejected');
 await page.getByRole('button',{name:'Retry loading',exact:true}).click();
 await page.evaluate(()=>{(window as unknown as {approveConnection():void}).approveConnection();});
 await expect(page).toHaveURL(/\/dashboard$/);await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(page.locator('.top-actions')).toContainText('Operator');
});
test('retry after RPC failure resumes operator entry without reconnecting Phantom',async({page})=>{
 const setAvailable=await setup(page,false);await page.goto('/login?next=%2Fbonds');
 await expect(page.getByRole('button',{name:'Open my dashboard',exact:true})).toBeEnabled();
 setAvailable(false);await page.getByRole('button',{name:'Open my dashboard',exact:true}).click();
 await page.evaluate(()=>{(window as unknown as {approveConnection():void}).approveConnection();});
 await expect(page.getByRole('status')).toHaveText('Unable to load workspace');
 setAvailable(true);await page.getByRole('button',{name:'Retry loading',exact:true}).click();
 await expect(page).toHaveURL(/\/bonds$/);await expect(page.getByRole('alert')).toHaveCount(0);
});
