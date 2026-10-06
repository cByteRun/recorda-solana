import type { Page } from '@playwright/test';
export function protocolStage(page: Page, name: string, target?: string, options?: { timeout?: number; interval?: number }): Promise<{ clicked: boolean; state: string | null }>;
