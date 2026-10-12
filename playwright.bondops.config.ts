import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:['asset-control.spec.ts','bondops.spec.ts','dashboard.spec.ts','welcome.spec.ts','protocol-client.spec.ts','workspaces.spec.ts'],outputDir:'./test-results/bondops',workers:2,
 reporter:[['list']],use:{baseURL:'http://127.0.0.1:4446',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
 webServer:{command:'npm run dev -- --host 127.0.0.1 --port 4446 --strictPort',url:'http://127.0.0.1:4446/api/bondops/session',reuseExistingServer:false,env:{BONDOPS_MODE:'demo',BONDOPS_DB_PATH:`target/bondops-e2e/workspace-${process.pid}.sqlite`,BONDOPS_ORIGINS:'http://127.0.0.1:4446',BONDOPS_BACKGROUND:'false'}},
});
