import type { Page } from '@playwright/test';
export function actionsStage(page: Page, name: string, target?: string, options?: { timeout?: number; interval?: number }): Promise<{ state: string | null }>;
