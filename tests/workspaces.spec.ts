import {test,expect} from '@playwright/test';
test('welcome requires explicit selection and Demo never contacts Solana on any operational page',async({page})=>{
 const rpc:string[]=[];page.on('request',r=>{if(r.postData()?.includes('"jsonrpc"'))rpc.push(r.url());});
 await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'Choose your environment'})).toBeVisible();
 await page.goto('/');await page.getByRole('link',{name:'Get started',exact:true}).first().click();await expect(page).toHaveURL(/\/workspaces$/);
 await page.getByRole('button',{name:'Открыть Demo',exact:true}).click();await expect(page.getByLabel('Workspace',{exact:true})).toHaveValue('demo');
 for(const path of ['/dashboard','/bonds','/actions','/holders','/claims','/protocol','/calendar','/audit']){await page.goto(path);await expect(page.locator('main')).toBeVisible();}
 expect(rpc).toEqual([]);await expect(page.locator('.sidebar-footer')).toContainText('Demo Workspace');
});
test('workspace pins RPC and discards signer and demo balances when switching',async({page})=>{
 const rpc:string[]=[];await page.route('**/*',route=>{const req=route.request();if(req.postData()?.includes('"jsonrpc"')){rpc.push(req.url());return route.abort();}return route.continue();});
 await page.goto('/workspaces');await page.getByRole('button',{name:'Открыть Demo',exact:true}).click();await expect(page.getByRole('heading',{name:'Operations overview.'})).toBeVisible();
 await page.evaluate(()=>{sessionStorage.setItem('bondops-wallet','old-signer');localStorage.setItem('recorda:protocol:addresses:v1:test',JSON.stringify({action:'stale-selection'}));});
 await page.getByLabel('Workspace',{exact:true}).selectOption('test');await expect(page.getByRole('heading',{name:'Test workspace',exact:true})).toBeVisible();await expect(page.locator('.stat-card')).toHaveCount(0);
 expect(await page.evaluate(()=>sessionStorage.getItem('bondops-wallet'))).toBeNull();expect(await page.evaluate(()=>localStorage.getItem('recorda:protocol:addresses:v1:test'))).toBeNull();expect(rpc.length).toBeGreaterThan(0);expect(rpc.every(url=>url.startsWith('http://127.0.0.1:8899'))).toBe(true);
 rpc.length=0;await page.getByLabel('Workspace',{exact:true}).selectOption('devnet');await expect(page.getByRole('heading',{name:'Devnet workspace',exact:true})).toBeVisible();expect(rpc.length).toBeGreaterThan(0);expect(rpc.every(url=>url.startsWith('https://api.devnet.solana.com'))).toBe(true);
 await page.reload();await expect(page.getByLabel('Workspace',{exact:true})).toHaveValue('devnet');await expect(page.locator('.stat-card')).toHaveCount(0);
});
test('public Demo uses packaged illustrative data when demo service is disabled',async({page})=>{
 await page.route('**/api/bondops/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({demoEnabled:false,member:null,csrf:null})}));
 await page.goto('/workspaces');await page.getByRole('button',{name:'Открыть Demo',exact:true}).click();await expect(page.getByRole('heading',{name:'Operations overview.'})).toBeVisible();await expect(page.getByRole('link',{name:'Choose role',exact:true})).toBeVisible();await expect(page.locator('.stat-card').filter({hasText:'Expected obligations'})).toContainText('850.00');
});
for(const width of [1440,390,320])test(`workspace entry fits ${width}px`,async({page})=>{await page.setViewportSize({width,height:1000});await page.goto('/workspaces');await expect(page.locator('.entry-card')).toHaveCount(3);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);});
