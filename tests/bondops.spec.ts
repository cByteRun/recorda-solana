import { test, expect } from '@playwright/test';
test('BondOps overview discloses fixture, exports provenance and opens working actions', async ({page})=>{
 await page.goto('/dashboard');
 await expect(page.getByRole('heading',{name:'Operations overview.'})).toBeVisible();
 await expect(page.locator('.bondops-note')).toBeVisible();
 await page.getByRole('button',{name:/Investor A/}).click();
 await expect(page.getByText('Демо-кейс:',{exact:false})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export report'}).click();expect((await download).suggestedFilename()).toBe('recorda-bondops-preview.json');
 await page.getByRole('link',{name:'New action',exact:true}).click();await expect(page).toHaveURL(/\/actions/);
});
for(const width of [1440,390,320])test(`BondOps fits ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 for(const route of ['/dashboard','/settlements','/bonds','/actions','/protocol','/holders','/claims']){
 await page.goto(route);await expect(page.locator('.workspace-loading')).toHaveCount(0);await expect(page.locator('main').first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route).toBe(true);
 }
 await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'Operations overview.'})).toBeVisible();await page.screenshot({path:`target/design-evidence/bondops-${width}.png`,fullPage:true});
});
test('missing reconciliation stays a placeholder',async({page})=>{await page.goto('/settlements');await expect(page.getByText('Backend planned')).toBeVisible();await expect(page.getByText('Заглушка не подтверждает выплату',{exact:false})).toBeVisible();});
