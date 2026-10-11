import { createBondOps, configFromEnv } from '../../../../../server/bondops/service.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let backend: ReturnType<typeof createBondOps> | undefined;
async function handle(request: Request) {
 try { backend ??= createBondOps(configFromEnv()); return await backend.handle(request); }
 catch { return Response.json({error:'BondOps backend is not configured. Configure persistent storage and workspace authentication.'},{status:503}); }
}
export const GET = handle;
export const POST = handle;
