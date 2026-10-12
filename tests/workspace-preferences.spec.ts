import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{sessionStorage.setItem('recorda-workspace','demo');sessionStorage.setItem('bondops-persona','demo-operator');});
 await page.route('**/api/bondops/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({mode:'demo',member:null,csrf:null,demoEnabled:false,liveConfigured:true})}));
 await page.goto('/dashboard');await expect(page.locator('.stat-card')).toHaveCount(4);
});
test('appearance changes real colors, palettes and persisted preferences without replacing the portfolio',async({page})=>{
 const amounts=await page.locator('.stat-big').allTextContents();await page.locator('.sidebar-profile').click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Appearance',exact:true}).click();await page.getByRole('button',{name:'Dark',exact:true}).click();
 await expect(page.locator('.bondops')).toHaveAttribute('data-theme','dark');expect(await page.locator('.bondops').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(16, 21, 19)');
 await expect(page.locator('.palette-grid button')).toHaveCount(20);
 const colors:string[]=[];for(const button of await page.locator('.palette-grid button').all()){await button.click();await expect(button).toHaveAttribute('aria-pressed','true');colors.push(await page.locator('.bondops').evaluate(e=>getComputedStyle(e).getPropertyValue('--brand')));}
 expect(new Set(colors).size).toBe(20);await page.getByRole('button',{name:'Lavanda #7952B3',exact:true}).click();await page.getByRole('button',{name:'Close profile',exact:true}).click();await expect(page.locator('.stat-big')).toHaveText(amounts);
 await page.reload();await expect(page.locator('.bondops')).toHaveAttribute('data-theme','dark');await page.locator('.top-actions').getByRole('button',{name:'Appearance',exact:true}).click();await expect(page.getByRole('button',{name:'Lavanda #7952B3',exact:true})).toHaveAttribute('aria-pressed','true');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('language updates navigation, hero and profile and survives page reload',async({page})=>{
 await page.getByLabel('Language',{exact:true}).selectOption('ru');await expect(page.getByRole('heading',{name:'Обзор операций.'})).toBeVisible();await expect(page.locator('.sidebar').getByRole('link',{name:'Реестр держателей',exact:true})).toBeVisible();await expect(page.locator('.stat-label').first()).toHaveText('Облигации в обращении');
 await page.locator('.sidebar-profile').click();await expect(page.getByRole('heading',{name:'Аккаунт',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Выйти',exact:true})).toBeVisible();await page.getByRole('button',{name:'Закрыть профиль',exact:true}).click();await page.reload();await expect(page.getByRole('heading',{name:'Обзор операций.'})).toBeVisible();
 await page.getByLabel('Язык',{exact:true}).selectOption('en');await expect(page.getByRole('heading',{name:'Operations overview.'})).toBeVisible();
});
for(const width of [1440,390,320])test(`profile and palette panel fit ${width}px and retain keyboard focus`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.locator('.top-actions').getByRole('button',{name:'Open profile',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>document.querySelector('dialog')?.contains(document.activeElement))).toBe(true);await page.getByRole('dialog').getByRole('button',{name:'Appearance',exact:true}).click();await page.getByRole('button',{name:'Coffee #795548',exact:true}).click();
 expect(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('corporate actions follows both themes and the chosen accent palette',async({page})=>{
 const operator=await page.evaluate(async()=>{const path='/src/features/bondops/model/rbac.ts';const module=await import(path);return module.configuredWallets.find((member:{role:string})=>member.role==='operator')?.wallet;});
 test.skip(!operator,'Requires configured operator address');
 await page.addInitScript(({operator})=>{sessionStorage.setItem('recorda-workspace','test');sessionStorage.removeItem('bondops-signed-out');Object.defineProperty(window,'phantom',{value:{solana:{isPhantom:true,publicKey:{toBase58:()=>operator},on:()=>{},removeListener:()=>{}}}});},{operator});
 await page.route('http://127.0.0.1:8899/**',route=>route.abort());
 await page.goto('/actions');await expect(page.getByTestId('actions-root')).toBeVisible();
 await page.locator('.top-actions').getByRole('button',{name:'Appearance',exact:true}).click();await page.getByRole('button',{name:'Lavanda #7952B3',exact:true}).click();await page.getByRole('button',{name:'Dark',exact:true}).click();await page.keyboard.press('Escape');
 const colors=()=>page.evaluate(()=>({panel:getComputedStyle(document.querySelector('.schedule-panel')!).backgroundColor,paper:getComputedStyle(document.querySelector('.bondops')!).getPropertyValue('--paper').trim(),input:getComputedStyle(document.querySelector('.actions-workspace input')!).backgroundColor,button:getComputedStyle(document.querySelector('.actions-workspace .workspace-button')!).backgroundColor}));
 const dark=await colors();expect(dark.panel).toBe('rgb(25, 33, 30)');expect(dark.input).toBe('rgb(32, 43, 37)');
 await page.locator('.top-actions').getByRole('button',{name:'Appearance',exact:true}).click();await page.getByRole('button',{name:'Light',exact:true}).click();await page.keyboard.press('Escape');
 await expect.poll(async()=>(await colors()).button).toBe('rgb(121, 82, 179)');
 const light=await colors();expect(light.panel).toBe('rgb(255, 255, 255)');expect(light.input).toBe('rgb(249, 251, 249)');expect(light.button).toBe('rgb(121, 82, 179)');expect(dark.button).not.toBe(light.button);
});

for(const width of [390,320])test(`all eleven operator tabs are visible and usable in bottom navigation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});const links=page.locator('.rail .rail-ico');await expect(links).toHaveCount(11);
 const desktop=await page.locator('.sidebar .nav-item').evaluateAll(es=>es.map(e=>e.getAttribute('href')));expect(await links.evaluateAll(es=>es.map(e=>e.getAttribute('href')))).toEqual(desktop);
 for(const href of desktop){const link=page.locator(`.rail .rail-ico[href="${href}"]`);await expect(link).toBeInViewport();await link.click();await expect(link).toHaveAttribute('aria-current','page');await expect(page.locator('main')).toBeVisible();}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.rail-profile').click();await expect(page.getByRole('dialog')).toBeVisible();
});

test('operator control desk keeps exact fixed rights, unknown evidence and usable holder drill-down',async({page})=>{
 await expect(page.locator('.ops-client-book tbody tr')).toHaveCount(4);const investor=page.locator('.ops-client-book tbody tr').filter({hasText:'Investor A'});await expect(investor).toContainText('500.00');
 await page.getByLabel('Holder obligation filter').selectOption('unknown');await expect(page.locator('.ops-client-book tbody tr')).toHaveCount(1);await expect(page.locator('.ops-client-book')).toContainText('Investor A');
 await page.getByRole('button',{name:'Inspect rights',exact:true}).click();await expect(page.getByRole('region',{name:'Holder details'})).toContainText('Record units: 10');await expect(page.getByRole('region',{name:'Holder details'})).toContainText('500.00');
 await expect(page.locator('.ops-distribution')).toContainText('Unknown is part of Unsettled');await expect(page.locator('.ops-proof a')).toHaveCount(0);await expect(page.locator('.ops-pipeline a')).toHaveCount(6);
 await page.getByLabel('Search holders').fill('nonexistent-wallet');await expect(page.locator('.ops-client-book tbody tr')).toHaveCount(0);await expect(page.getByText('No holders match the selected filters')).toBeVisible();
});
