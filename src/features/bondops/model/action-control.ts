import type { Action } from './bondops-context';

export const CONTROL_STAGES = ['snapshot', 'calculate', 'approve', 'fund', 'execute', 'finalize', 'complete', 'review'] as const;
export type ControlStage = typeof CONTROL_STAGES[number];
export const CONTROL_LABELS: Record<ControlStage, string> = {
  snapshot: 'Fix rights', calculate: 'Calculate', approve: 'Approve', fund: 'Fund',
  execute: 'Execute / vote', finalize: 'Finalize receipt', complete: 'Recorded outcomes', review: 'Review evidence',
};

// Readiness describes the loaded evidence, never permission to send an instruction.
export function actionControl(action: Action): { stage: ControlStage; next: string; reason: string } {
  if (!action.verified || action.status === 'finalized' && !action.receipt) {
    return { stage: 'review', next: 'Verify action state', reason: 'Evidence is unavailable. Verify the action before continuing.' };
  }
  if (action.receipt) return { stage: 'complete', next: 'Inspect outcome', reason: 'Inspect the receipt and its linked rights and execution evidence.' };
  if (action.kind !== 'voting' && action.rights.some(r => r.calculated && BigInt(r.expectedMinor) > BigInt(r.confirmedMinor) && ['unknown', 'pending'].includes(r.status))) {
    return { stage: 'review', next: 'Reconcile before retry', reason: 'A retained or unknown result must be reconciled before another payment.' };
  }
  if (['scheduled', 'snapshotPending'].includes(action.status)) {
    return { stage: 'snapshot', next: 'Review cutoff & snapshot', reason: 'Capture the complete holder population at this action’s record date.' };
  }
  if (['snapshotted', 'calculating'].includes(action.status)) {
    return { stage: 'calculate', next: 'Calculate fixed rights', reason: 'Use the action’s fixed terms and cutoff units, not current balances.' };
  }
  if (['calculated', 'awaitingApproval'].includes(action.status) || !action.approved) {
    return { stage: 'approve', next: 'Review & approve', reason: 'Review the allocation before the authorized approver signs.' };
  }
  if (action.status === 'settled') {
    return { stage: 'finalize', next: 'Finalize receipt', reason: 'Execution is recorded; the final action receipt still needs verification.' };
  }
  if (action.kind === 'voting') {
    return { stage: 'execute', next: 'Review voting window & tally', reason: 'Holders sign votes. Tally after the contract voting window closes.' };
  }
  if (!action.funded) return { stage: 'fund', next: 'Review vault funding', reason: 'The action vault must cover the remaining calculated obligation.' };
  if (['redemption', 'partialRedemption'].includes(action.kind)) {
    return { stage: 'execute', next: 'Coordinate holder redemption', reason: 'Each holder signs atomic retirement and payment. Track supply as well as money.' };
  }
  return { stage: 'execute', next: 'Review authorized settlement', reason: 'Continue unprocessed rights through the authorized action flow.' };
}
