import { test, expect } from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('recorda-workspace','demo'));
 await page.route('**/api/bondops/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({mode:'demo',member:null,csrf:null,demoEnabled:false,liveConfigured:true})}));
});
async function previewLogin(page:import('@playwright/test').Page,role:string,name:string) {
 await page.goto('/login');await page.getByRole('button',{name:new RegExp(`^${role}`,'i')}).click();await page.getByRole('button',{name:`Open ${name}`,exact:true}).click();
}
test('investor cabinet isolates rights and preserves historical entitlement after transfer',async({page})=>{
 const rpc:string[]=[];page.on('request',r=>{if(r.postData()?.includes('"jsonrpc"'))rpc.push(r.url());});
 await previewLogin(page,'investor','Investor A');await expect(page.getByRole('heading',{name:'My overview.'})).toBeVisible();await expect(page.locator('.stat-card').filter({hasText:'Current units'})).toContainText('6');await expect(page.locator('.stat-card').filter({hasText:'Recorded entitlement'})).toContainText('500.00');
 await page.goto('/entitlements');await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody tr')).toContainText('500.00');await expect(page.locator('tbody tr td').nth(1)).toHaveText('10');
 await page.goto('/settings');await expect(page.getByRole('heading',{name:'Your role workspace'})).toBeVisible();await expect(page.getByRole('button',{name:'Save notification rules'})).toHaveCount(0);
 await previewLogin(page,'investor','Investor B');await page.goto('/entitlements');await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody tr')).toContainText('250.00');await expect(page.locator('tbody tr')).not.toContainText('500.00');expect(rpc).toEqual([]);
});
test('auditor has proof navigation and cannot open operator settings',async({page})=>{
 await previewLogin(page,'auditor','Demo Auditor');await expect(page.getByRole('heading',{name:'Audit overview.'})).toBeVisible();await expect(page.locator('.sidebar').getByRole('link',{name:'Corporate actions',exact:true})).toHaveCount(0);
 await page.goto('/register');await page.getByRole('link',{name:'Купонная выплата · H2 2026',exact:true}).click();await expect(page.getByRole('heading',{name:'Proof explorer.'})).toBeVisible();await expect(page.locator('tbody tr')).toHaveCount(4);
 await page.goto('/settings');await expect(page.getByRole('heading',{name:'Your role workspace'})).toBeVisible();
});
test('operator tab clicks and browser Back retain identity and the loaded portfolio',async({page})=>{
 await previewLogin(page,'operator','Demo Operator');await expect(page.locator('.stat-card')).toHaveCount(4);
 await page.evaluate(()=>Object.assign(window,{recordaNavigationMarker:'same-workspace'}));
 for(const name of ['Bonds','Corporate actions','Holder registry','Settlements','Deadline calendar','Holder claims','Notifications','Audit & proof','Infrastructure','Settings','Overview']) {
   await page.locator('.sidebar').getByRole('link',{name:new RegExp(`^${name}(?: \\d+)?$`)}).click();
   await expect(page.locator('.workspace-loading')).toHaveCount(0);await expect(page.locator('main')).toBeVisible();
   expect(await page.evaluate(()=>Reflect.get(window,'recordaNavigationMarker')),name).toBe('same-workspace');
   await expect(page.locator('.top-actions')).toContainText('Demo Operator · Operator');
 }
 await page.goBack();await expect(page.getByRole('heading',{name:'Workspace settings.'})).toBeVisible();
 expect(await page.evaluate(()=>Reflect.get(window,'recordaNavigationMarker'))).toBe('same-workspace');
});
test('wallet address controls identity even when a different role card is selected',async({page})=>{
 await page.goto('/login');
 const operator=await page.evaluate(async()=>{const path='/src/features/bondops/model/rbac.ts';const m=await import(path);return m.configuredWallets.find((m:{role:string;wallet?:string})=>m.role==='operator')?.wallet;});
 test.skip(!operator,'Configure RECORDA_OPERATOR to test the local wallet address map');
 await page.addInitScript(({operator})=>{sessionStorage.setItem('recorda-workspace','test');sessionStorage.setItem('bondops-wallet','forged-wallet');const provider={isPhantom:true,connect:async(options?:{onlyIfTrusted?:boolean})=>{if(options?.onlyIfTrusted)throw Error('Not connected');return {publicKey:{toBase58:()=>operator}};},on:()=>{},removeListener:()=>{}};Object.defineProperty(window,'phantom',{value:{solana:provider}});},{operator});
 await page.route('http://127.0.0.1:8899/**',r=>r.abort());await page.goto('/login');await page.getByRole('button',{name:/^auditor/i}).click();await page.getByRole('button',{name:'Connect Phantom & identify me'}).click();await expect(page.getByText('Current identity: Bond operator · Operator')).toBeVisible();await expect(page.locator('.top-actions')).toContainText('Bond operator · Operator');
 await page.locator('.sidebar').getByRole('link',{name:'Overview',exact:true}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);await expect(page.getByRole('status')).toHaveText('Ожидаем входа');
});
for(const width of [1440,390,320])test(`role login fits ${width}px`,async({page})=>{await page.setViewportSize({width,height:1000});await page.goto('/login');await expect(page.locator('.login-role')).toHaveCount(4);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);});

test('login keeps controls locked and shows actual loading while RPC is pending',async({page})=>{
 await page.goto('/login');
 const investor=await page.evaluate(async()=>{const path='/src/features/bondops/model/rbac.ts';const m=await import(path);return m.configuredWallets.find((m:{role:string;wallet?:string})=>m.role==='investor')?.wallet;});
 test.skip(!investor,'Configure a holder address');
 await page.addInitScript(({investor})=>{sessionStorage.setItem('recorda-workspace','test');const provider={isPhantom:true,publicKey:{toBase58:()=>investor},connect:async()=>{throw Error('Already connected: do not reconnect');},on:()=>{},removeListener:()=>{}};Object.defineProperty(window,'phantom',{value:{solana:provider}});},{investor});
 await page.route('http://127.0.0.1:8899/**',()=>{});
 await page.goto('/login');await expect(page.getByRole('button',{name:'Open my dashboard'})).toBeDisabled();await expect(page.getByRole('status')).toHaveText('Загружаем операционные данные');await expect(page.locator('.login-role:disabled')).toHaveCount(4);await expect(page).toHaveURL(/\/login$/);await expect(page.locator('.top-actions')).toContainText('Investor');await expect(page.getByText('Connecting…')).toHaveCount(0);
});

test('signed-out login stays idle and does not read RPC before Connect Phantom',async({page})=>{
 await page.addInitScript(()=>{sessionStorage.setItem('recorda-workspace','test');sessionStorage.setItem('bondops-signed-out','true');Object.defineProperty(window,'phantom',{value:{solana:{isPhantom:true,publicKey:{toBase58:()=> '7FKcUyMW6tFFRsAdGZ3ByC3pMVXdoxd6BdKnCVpQzYhu'},connect:async()=>{throw Error('No automatic connection');},on:()=>{},removeListener:()=>{}}}});});
 const rpc:string[]=[];await page.route('http://127.0.0.1:8899/**',r=>{rpc.push(r.request().url());return r.abort();});
 await page.goto('/login');await expect(page.getByRole('status')).toHaveText('Ожидаем входа');await expect(page.getByRole('button',{name:'Connect Phantom & identify me'})).toBeEnabled();
 await page.waitForTimeout(1000);await expect(page).toHaveURL(/\/login$/);expect(rpc).toEqual([]);
 const links=await page.locator('.rail-ico').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));expect(new Set(links).size).toBe(links.length);
});

test('signed-out routes and sidebar links lead to login without reading RPC',async({page})=>{
 await page.addInitScript(()=>{sessionStorage.setItem('recorda-workspace','test');sessionStorage.setItem('bondops-signed-out','true');});
 const rpc:string[]=[];await page.route('http://127.0.0.1:8899/**',r=>{rpc.push(r.request().url());return r.abort();});
 await page.goto('/holdings');await expect(page).toHaveURL(/\/login\?next=%2Fholdings$/);await expect(page.getByRole('status')).toHaveText('Ожидаем входа');
 for(const link of ['Audit overview','Proof explorer','Notifications']){
   await page.locator('.sidebar').getByRole('link',{name:link,exact:true}).click();await expect(page).toHaveURL(/\/login\?next=/);await expect(page.getByRole('status')).toHaveText('Ожидаем входа');
 }
 expect(rpc).toEqual([]);await expect(page.getByRole('button',{name:'Connect Phantom & identify me'})).toBeEnabled();
});
