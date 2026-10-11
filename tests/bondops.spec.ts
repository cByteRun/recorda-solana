import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test.describe.configure({mode:'serial'});
async function signInDemo(page:import('@playwright/test').Page){await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'Operations overview.'})).toBeVisible();await page.getByRole('button',{name:'Sign in to demo',exact:true}).click();await expect(page.getByRole('button',{name:'Demo Operator',exact:true})).toBeVisible();}
test('overview exports source-labelled backend data and opens working actions', async ({page})=>{
 await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'Operations overview.'})).toBeVisible();await expect(page.locator('.bondops-source')).toContainText('иллюстративные');
 await page.getByRole('button',{name:/Investor A/}).click();await expect(page.getByRole('region',{name:'Exception detail'})).toContainText('10 × 1,000.00 × 1000/10000 ÷ 2 = 500.00');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export report',exact:true}).click();const saved=await download;expect(saved.suggestedFilename()).toBe('recorda-bondops-demo.json');const report=JSON.parse(await readFile((await saved.path())!,'utf8'));expect(report.mode).toBe('demo');expect(report.workspace.totals[0].expected).toBe('85000');expect(report.finality).toBeNull();
 await page.getByRole('link',{name:'New action',exact:true}).click();await expect(page).toHaveURL(/\/actions/);
});
test('filled Test Workspace opens an illustrative action with fixed rights and example history',async({page})=>{
 await page.goto('/actions?example=DEMO-CA-001');await expect(page.getByRole('heading',{name:'Купонная выплата · H2 2026',exact:true})).toBeVisible();await expect(page.getByText('Illustrative SQLite dataset',{exact:true})).toBeVisible();await expect(page.getByText(/6 \/ 9 \/ 2 \/ 0/)).toBeVisible();await page.getByRole('link',{name:'Transaction examples & history',exact:true}).click();await expect(page.getByRole('heading',{name:'Audit & proof.'})).toBeVisible();await expect(page.getByText('Перевод после record date',{exact:true})).toBeVisible();
});
test('case assignment and decision persist, unconfirmed closure is rejected by backend',async({page})=>{
 await signInDemo(page);await page.goto('/settlements');await expect(page.getByRole('heading',{name:'Settlement reconciliation.'})).toBeVisible();await page.getByRole('button',{name:/Review settlement/}).first().click();await page.getByLabel('Case owner').selectOption('demo-reviewer');await page.getByLabel('Case status').selectOption('investigating');await page.getByLabel('Case note').fill('Verify retained signature before any retry');const saved=page.waitForResponse(r=>r.url().includes('/api/bondops/cases')&&r.request().method()==='POST');await page.getByRole('button',{name:'Save case',exact:true}).click();expect((await saved).status()).toBe(200);await expect(page.getByText('Verify retained signature before any retry',{exact:true})).toBeVisible();
 const session=await (await page.request.get('/api/bondops/session')).json(),workspace=await (await page.request.get('/api/bondops/workspace')).json();const closed=await page.request.post('/api/bondops/cases',{headers:{origin:new URL(page.url()).origin,'x-bondops-csrf':session.csrf},data:{id:workspace.cases[0].id,status:'resolved',note:'Pretend paid'}});expect(closed.status()).toBe(409);
 await page.reload();await page.getByRole('button',{name:/Review settlement/}).first().click();await expect(page.getByLabel('Case owner')).toHaveValue('demo-reviewer');await expect(page.getByText('Verify retained signature before any retry',{exact:true})).toBeVisible();
 await page.goto('/audit');await expect(page.getByText('Verify retained signature before any retry',{exact:true})).toBeVisible();
});
test('calendar saves explicit payment deadline and shows deadline source',async({page})=>{
 await signInDemo(page);await page.goto('/calendar');await expect(page.getByRole('heading',{name:'Deadline calendar.'})).toBeVisible();await expect(page.locator('.calendar-day')).toHaveCount(42);
 const original=await (await page.request.get('/api/bondops/workspace')).json();const oldDue=original.actions[0].dueAt;
 const local=await page.evaluate(()=>{const d=new Date(Date.now()+24*3600000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});await page.getByLabel('Payment deadline Купонная выплата · H2 2026').fill(local);await page.getByRole('button',{name:'Save deadline',exact:true}).click();await expect(page.getByText('Источник срока: operator schedule',{exact:true})).toBeVisible();await page.getByLabel('Deadline filter').selectOption('upcoming');await expect(page.locator('.calendar-action')).toHaveCount(3);
 const session=await (await page.request.get('/api/bondops/session')).json();await page.request.post('/api/bondops/schedule',{headers:{origin:new URL(page.url()).origin,'x-bondops-csrf':session.csrf},data:{action:original.actions[0].id,dueAt:oldDue}});
});
test('server roles restrict settings and mutations; notification delivery is explicit',async({page})=>{
 await signInDemo(page);await page.goto('/notifications');await expect(page.getByRole('heading',{name:'Notifications & escalations.'})).toBeVisible();await expect(page.getByText('in-app: available',{exact:false}).first()).toBeVisible();await page.getByRole('button',{name:'Mark read',exact:true}).first().click();await page.goto('/settings');await page.getByRole('button',{name:'Demo Auditor · sandbox login',exact:true}).click();await expect(page.getByRole('button',{name:'Save notification rules',exact:true})).toBeDisabled();await page.goto('/settlements');await page.getByRole('button',{name:/Review settlement/}).first().click();await expect(page.getByRole('button',{name:'Save case',exact:true})).toBeDisabled();
});
test('Devnet RPC boundary never substitutes fixture balances',async({page})=>{
 await page.route('**/*',route=>route.request().postData()?.includes('\"jsonrpc\"')?route.abort():route.continue());
 await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'Operations overview.'})).toBeVisible();await page.getByLabel('Workspace source').selectOption('live');await expect(page.getByRole('heading',{name:'Devnet workspace'})).toBeVisible();await expect(page.locator('.stat-card')).toHaveCount(0);await expect(page.getByRole('button',{name:'Connect Phantom',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Devnet workspace'})).toBeVisible();await expect(page.locator('.stat-card')).toHaveCount(0);await page.getByLabel('RPC validator').selectOption('local');await expect(page.getByLabel('RPC validator')).toHaveValue('local');await expect(page.getByLabel('Workspace source')).toHaveValue('live');
});
for(const width of [1440,390,320])test(`BondOps domains fit ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 for(const route of ['/dashboard','/bonds','/settlements','/calendar','/audit','/settings','/notifications','/infrastructure','/actions','/protocol','/holders','/claims']){
 await page.goto(route);await expect(page.locator('.workspace-loading')).toHaveCount(0);await expect(page.locator('main').first()).toBeVisible();if(['/dashboard','/bonds','/settlements','/calendar','/audit','/settings','/notifications','/infrastructure'].includes(route))await expect(page.locator('.page-head')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route).toBe(true);
 }
 if(width===320){await page.goto('/dashboard');await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('navigation',{name:'All workspace pages'}).getByRole('link',{name:'Deadline calendar',exact:true}).click();await expect(page.getByRole('heading',{name:'Deadline calendar.'})).toBeVisible();}
 await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'Operations overview.'})).toBeVisible();await page.screenshot({path:`target/design-evidence/bondops-domains-${width}.png`,fullPage:true});
});
