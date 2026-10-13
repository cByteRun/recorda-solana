export function configFromEnv(): Record<string, unknown>;
export function createBondOps(config: Record<string, unknown>): { handle(request: Request): Promise<Response>; close(): void };
