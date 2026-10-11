import type { Page } from '@playwright/test';
export function waitForDevnetWallet(page: Page, address: string, options?: {
  timeout?: number;
  interval?: number;
  onChange?: (message: string) => void;
}): Promise<void>;
