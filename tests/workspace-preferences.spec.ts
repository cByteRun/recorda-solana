import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{sessionStorage.setItem('recorda-workspace','demo');sessionStorage.setItem('bondops-persona','demo-operator');});
 await page.route('**/api/bondops/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({mode:'demo',member:null,csrf:null,demoEnabled:false,liveConfigured:true})}));
 await page.goto('/dashboard');await expect(page.locator('.stat-card')).toHaveCount(4);
});
test('appearance changes real colors, palettes and persisted preferences without replacing the portfolio',async({page})=>{
 const amounts=await page.locator('.stat-big').allTextContents();await page.locator('.rail-profile').click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Appearance',exact:true}).click();await page.getByRole('button',{name:'Dark',exact:true}).click();
 await expect(page.locator('.bondops')).toHaveAttribute('data-theme','dark');expect(await page.locator('.bondops').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(16, 21, 19)');
 await expect(page.locator('.palette-grid button')).toHaveCount(20);
 const colors:string[]=[];for(const button of await page.locator('.palette-grid button').all()){await button.click();await expect(button).toHaveAttribute('aria-pressed','true');colors.push(await page.locator('.bondops').evaluate(e=>getComputedStyle(e).getPropertyValue('--brand')));}
 expect(new Set(colors).size).toBe(20);await page.getByRole('button',{name:'Lavanda #7952B3',exact:true}).click();await page.getByRole('button',{name:'Close profile',exact:true}).click();await expect(page.locator('.stat-big')).toHaveText(amounts);
 await page.reload();await expect(page.locator('.bondops')).toHaveAttribute('data-theme','dark');await page.locator('.top-actions').getByRole('button',{name:'Appearance',exact:true}).click();await expect(page.getByRole('button',{name:'Lavanda #7952B3',exact:true})).toHaveAttribute('aria-pressed','true');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('language updates navigation, hero and profile and survives page reload',async({page})=>{
 await page.getByLabel('Language',{exact:true}).selectOption('ru');await expect(page.getByRole('heading',{name:'Обзор операций.'})).toBeVisible();await expect(page.locator('.sidebar').getByRole('link',{name:'Реестр держателей',exact:true})).toBeVisible();await expect(page.locator('.stat-label').first()).toHaveText('Облигации в обращении');
 await page.locator('.rail-profile').click();await expect(page.getByRole('heading',{name:'Аккаунт',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Выйти',exact:true})).toBeVisible();await page.getByRole('button',{name:'Закрыть профиль',exact:true}).click();await page.reload();await expect(page.getByRole('heading',{name:'Обзор операций.'})).toBeVisible();
 await page.getByLabel('Язык',{exact:true}).selectOption('en');await expect(page.getByRole('heading',{name:'Operations overview.'})).toBeVisible();
});
for(const width of [1440,390,320])test(`profile and palette panel fit ${width}px and retain keyboard focus`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.locator('.top-actions').getByRole('button',{name:'Open profile',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>document.querySelector('dialog')?.contains(document.activeElement))).toBe(true);await page.getByRole('dialog').getByRole('button',{name:'Appearance',exact:true}).click();await page.getByRole('button',{name:'Coffee #795548',exact:true}).click();
 expect(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
