//! External evidence can propose a scheduled action, never approve or execute it.
use super::*;
#[account]
#[derive(InitSpace)]
pub struct ExternalEventV2 {
    pub instrument: Pubkey,
    pub source: [u8; 32],
    pub event_id: [u8; 32],
    pub action: Pubkey,
    pub payload_hash: [u8; 32],
    pub evidence_hash: [u8; 32],
    pub proposed_by: Pubkey,
    pub slot: u64,
}
#[event]
pub struct ExternalProposed {
    pub instrument: Pubkey,
    pub action: Pubkey,
    pub source: [u8; 32],
    pub event_id: [u8; 32],
    pub evidence_hash: [u8; 32],
    pub slot: u64,
}
pub fn propose_external_engine(
    ctx: Context<ProposeExternalV2>,
    source: [u8; 32],
    event_id: [u8; 32],
    payload_hash: [u8; 32],
    evidence_hash: [u8; 32],
) -> Result<()> {
    let a = &mut ctx.accounts.action;
    require!(
        a.status == Stage::Scheduled
            && a.source == [0; 32]
            && source != [0; 32]
            && event_id != [0; 32]
            && payload_hash != [0; 32]
            && evidence_hash != [0; 32],
        Fault::State
    );
    // Payload is the canonical on-chain parameter contract, not unchecked adapter JSON.
    require!(
        payload_hash
            == hashv(&[
                b"recorda:external:parameters:v1",
                a.instrument.as_ref(),
                &a.parameters.try_to_vec()?
            ])
            .to_bytes(),
        Fault::Account
    );
    a.source = source;
    a.source_event = event_id;
    a.source_payload = payload_hash;
    a.source_evidence = evidence_hash;
    a.commitment = hashv(&[
        b"recorda:external:binding:v1",
        &a.commitment,
        &source,
        &event_id,
        &payload_hash,
        &evidence_hash,
    ])
    .to_bytes();
    let e = &mut ctx.accounts.event;
    e.instrument = a.instrument;
    e.source = source;
    e.event_id = event_id;
    e.action = a.key();
    e.payload_hash = payload_hash;
    e.evidence_hash = evidence_hash;
    e.proposed_by = ctx.accounts.authority.key();
    e.slot = Clock::get()?.slot;
    emit!(ExternalProposed {
        instrument: a.instrument,
        action: a.key(),
        source,
        event_id,
        evidence_hash,
        slot: e.slot
    });
    Ok(())
}
#[derive(Accounts)]
#[instruction(source:[u8;32],event_id:[u8;32])]
pub struct ProposeExternalV2<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds=[b"instrument",instrument.mint.as_ref()],bump=instrument.bump,has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(mut,seeds=[b"action-v2",instrument.key().as_ref(),&action.id.to_le_bytes()],bump=action.bump,has_one=instrument,has_one=authority)]
    pub action: Box<Account<'info, ActionV2>>,
    #[account(init,payer=authority,space=8+ExternalEventV2::INIT_SPACE,seeds=[b"external-v2",instrument.key().as_ref(),&source,&event_id],bump)]
    pub event: Box<Account<'info, ExternalEventV2>>,
    pub system_program: Program<'info, System>,
}
