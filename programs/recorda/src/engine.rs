//! Versioned action engine. Legacy accounts remain byte-for-byte compatible.
use super::*;
use anchor_spl::token_2022::Burn;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum ActionKind {
    Coupon,
    Redemption,
    Voting,
    PartialRedemption,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct ActionParameters {
    pub kind: ActionKind,
    pub record_at: i64,
    pub period: u64,
    pub include_coupon: bool,
    pub retire_bps: u16,
    pub opens_at: i64,
    pub closes_at: i64,
    pub quorum_bps: u16,
    pub proposal_hash: [u8; 32],
}
#[account]
#[derive(InitSpace)]
pub struct ActionV2 {
    pub instrument: Pubkey,
    pub authority: Pubkey,
    pub issuer: Pubkey,
    pub id: u64,
    pub version: u8,
    pub parameters: ActionParameters,
    pub face: u64,
    pub rate_bps: u16,
    pub frequency: u16,
    pub maturity: i64,
    pub currency: [u8; 8],
    pub terms_version: u32,
    pub metadata_uri: [u8; 128],
    pub metadata_hash: [u8; 32],
    pub terms_hash: [u8; 32],
    pub source: [u8; 32],
    pub source_event: [u8; 32],
    pub source_payload: [u8; 32],
    pub source_evidence: [u8; 32],
    pub commitment: [u8; 32],
    pub status: Stage,
    pub record_slot: u64,
    pub captured_at: i64,
    pub snapshot_hash: [u8; 32],
    pub expected_holders: u32,
    pub expected_supply: u64,
    pub captured_holders: u32,
    pub captured_supply: u64,
    pub calculated_holders: u32,
    pub processed_holders: u32,
    pub principal: u64,
    pub coupon: u64,
    pub total: u64,
    pub paid: u64,
    pub retire_units: u64,
    pub retired: u64,
    pub yes: u64,
    pub no: u64,
    pub abstain: u64,
    pub quorum_met: bool,
    pub passed: bool,
    pub approved_by: Pubkey,
    pub finalized_slot: u64,
    pub finalized_at: i64,
    pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct RightV2 {
    pub action: Pubkey,
    pub holder: Pubkey,
    pub index: u32,
    pub units: u64,
    pub retire_units: u64,
    pub principal: u64,
    pub coupon: u64,
    pub total: u64,
    pub calculated: bool,
    pub processed: bool,
    pub destination: Pubkey,
    pub settled_slot: u64,
}
#[account]
#[derive(InitSpace)]
pub struct PeriodV2 {
    pub instrument: Pubkey,
    pub period: u64,
    pub action: Pubkey,
    pub consumed: bool,
}
#[account]
#[derive(InitSpace)]
pub struct VoteV2 {
    pub action: Pubkey,
    pub holder: Pubkey,
    pub choice: u8,
    pub power: u64,
    pub slot: u64,
    pub timestamp: i64,
}
#[account]
#[derive(InitSpace)]
pub struct ReceiptV2 {
    pub action: Pubkey,
    pub version: u8,
    pub kind: ActionKind,
    pub commitment: [u8; 32],
    pub snapshot_hash: [u8; 32],
    pub principal: u64,
    pub coupon: u64,
    pub paid: u64,
    pub retired: u64,
    pub remaining_supply: u64,
    pub processed_holders: u32,
    pub yes: u64,
    pub no: u64,
    pub abstain: u64,
    pub quorum_met: bool,
    pub passed: bool,
    pub finalized_slot: u64,
    pub finalized_at: i64,
    pub summary_hash: [u8; 32],
}
#[event]
pub struct TransitionV2 {
    pub action: Pubkey,
    pub kind: ActionKind,
    pub from: Stage,
    pub to: Stage,
    pub slot: u64,
}

pub fn payable(p: &ActionParameters) -> bool {
    p.kind != ActionKind::Voting
}
pub fn retirement(p: &ActionParameters) -> bool {
    matches!(
        p.kind,
        ActionKind::Redemption | ActionKind::PartialRedemption
    )
}
pub fn has_coupon(p: &ActionParameters) -> bool {
    p.kind == ActionKind::Coupon || (retirement(p) && p.include_coupon)
}
pub fn validate_parameters(p: &ActionParameters, now: i64, maturity: i64) -> Result<()> {
    require!(p.record_at >= now, Fault::RecordDate);
    match p.kind {
        ActionKind::Coupon => require!(
            p.period > 0
                && p.include_coupon
                && p.retire_bps == 0
                && p.opens_at == 0
                && p.closes_at == 0
                && p.quorum_bps == 0
                && p.proposal_hash == [0; 32],
            Fault::Parameters
        ),
        ActionKind::Redemption | ActionKind::PartialRedemption => {
            require!(
                p.opens_at == 0
                    && p.closes_at == 0
                    && p.quorum_bps == 0
                    && p.proposal_hash == [0; 32],
                Fault::Parameters
            );
            require!(
                (p.include_coupon && p.period > 0) || (!p.include_coupon && p.period == 0),
                Fault::Parameters
            );
            if p.kind == ActionKind::Redemption {
                require!(now >= maturity && p.retire_bps == 10_000, Fault::RecordDate);
            } else {
                require!(
                    p.retire_bps > 0 && p.retire_bps <= 10_000,
                    Fault::Parameters
                );
            }
        }
        ActionKind::Voting => require!(
            !p.include_coupon
                && p.period == 0
                && p.retire_bps == 0
                && p.opens_at >= p.record_at
                && p.closes_at > p.opens_at
                && p.quorum_bps > 0
                && p.quorum_bps <= 10_000
                && p.proposal_hash != [0; 32],
            Fault::Parameters
        ),
    }
    Ok(())
}
pub fn components(
    units: u64,
    face: u64,
    bps: u16,
    frequency: u16,
    p: &ActionParameters,
) -> Result<(u64, u64, u64)> {
    let retired = if retirement(p) {
        u64::try_from(units as u128 * p.retire_bps as u128 / 10_000)
            .map_err(|_| error!(Fault::Overflow))?
    } else {
        0
    };
    let principal = retired.checked_mul(face).ok_or(Fault::Overflow)?;
    let coupon = if has_coupon(p) {
        coupon_minor(
            if retirement(p) { retired } else { units },
            face,
            bps,
            frequency,
        )?
    } else {
        0
    };
    principal.checked_add(coupon).ok_or(Fault::Overflow)?;
    Ok((retired, principal, coupon))
}
pub fn tally(supply: u64, yes: u64, no: u64, abstain: u64, quorum: u16) -> Result<(bool, bool)> {
    require!(
        supply > 0 && quorum > 0 && quorum <= 10_000,
        Fault::Parameters
    );
    let used = yes
        .checked_add(no)
        .and_then(|n| n.checked_add(abstain))
        .ok_or(Fault::Overflow)?;
    require!(used <= supply, Fault::Supply);
    let met = used as u128 * 10_000 >= supply as u128 * quorum as u128;
    Ok((met, met && yes > no))
}
fn step(a: &mut Account<ActionV2>, to: Stage) -> Result<()> {
    let allowed = valid_transition(a.status, to)
        || (a.parameters.kind == ActionKind::Voting
            && a.status == Stage::Approved
            && to == Stage::Settled);
    require!(allowed, Fault::State);
    // Funding/execution are exclusively payment transitions.
    require!(
        a.parameters.kind != ActionKind::Voting || !matches!(to, Stage::Funded | Stage::Executing),
        Fault::State
    );
    emit!(TransitionV2 {
        action: a.key(),
        kind: a.parameters.kind,
        from: a.status,
        to,
        slot: Clock::get()?.slot
    });
    a.status = to;
    Ok(())
}
pub fn create(ctx: Context<CreateV2>, id: u64, parameters: ActionParameters) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let i = &mut ctx.accounts.instrument;

    require!(
        !i.redeemed
            && !i.snapshot_pending
            && i.pending_record_timestamp == 0
            && i.active_snapshot == Pubkey::default(),
        Fault::Locked
    );
    let a = &mut ctx.accounts.action;
    a.instrument = i.key();
    a.authority = ctx.accounts.authority.key();
    a.issuer = i.authority;
    a.id = id;
    a.version = 2;
    a.parameters = parameters;
    a.face = i.face_value_minor;
    a.rate_bps = i.coupon_bps;
    a.frequency = i.payments_per_year;
    a.bump = ctx.bumps.action;
    a.maturity = i.maturity_timestamp;
    a.currency = i.currency;
    let (governance_address, _) =
        Pubkey::find_program_address(&[b"governance", i.key().as_ref()], &crate::ID);
    let (governance_signer, _) =
        Pubkey::find_program_address(&[b"governance-signer", i.key().as_ref()], &crate::ID);
    if i.authority == governance_signer {
        let info = ctx
            .remaining_accounts
            .iter()
            .find(|info| info.key() == governance_address)
            .ok_or(Fault::Account)?;
        require_keys_eq!(*info.owner, crate::ID, Fault::Account);
        let bytes = info.try_borrow_data()?;
        let g = Governance::try_deserialize(&mut &bytes[..])?;
        require!(g.instrument == i.key(), Fault::Account);
        a.issuer = g.issuer;
        a.face = g.face;
        a.rate_bps = g.rate;
        a.frequency = g.frequency;
        a.maturity = g.maturity;
        a.terms_version = g.terms_version;
        a.metadata_uri = g.metadata_uri;
        a.metadata_hash = g.metadata_hash;
        a.terms_hash = g.terms_hash;
    }
    validate_parameters(&parameters, now, a.maturity)?;
    a.commitment = hashv(&[
        b"recorda:action:v2",
        a.key().as_ref(),
        i.key().as_ref(),
        i.mint.as_ref(),
        i.payment_mint.as_ref(),
        &parameters.try_to_vec()?,
        &a.face.to_le_bytes(),
        &a.rate_bps.to_le_bytes(),
        &a.frequency.to_le_bytes(),
        &a.maturity.to_le_bytes(),
        &a.currency,
        a.issuer.as_ref(),
        &a.terms_version.to_le_bytes(),
        &a.metadata_uri,
        &a.metadata_hash,
        &a.terms_hash,
    ])
    .to_bytes();
    i.pending_record_timestamp = parameters.record_at;
    i.active_snapshot = a.key();
    step(a, Stage::Scheduled)
}
pub fn reserve_period(ctx: Context<ReservePeriodV2>) -> Result<()> {
    let a = &ctx.accounts.action;
    require!(
        a.status == Stage::Scheduled && has_coupon(&a.parameters),
        Fault::State
    );
    let p = &mut ctx.accounts.period;
    p.instrument = a.instrument;
    p.period = a.parameters.period;
    p.action = a.key();
    Ok(())
}
pub fn cancel(ctx: Context<ManageV2>) -> Result<()> {
    require!(ctx.accounts.action.status == Stage::Scheduled, Fault::State);
    ctx.accounts.instrument.pending_record_timestamp = 0;
    ctx.accounts.instrument.active_snapshot = Pubkey::default();
    step(&mut ctx.accounts.action, Stage::Cancelled)
}
pub fn release_period(ctx: Context<ReleasePeriodV2>) -> Result<()> {
    require!(
        ctx.accounts.action.status == Stage::Cancelled && !ctx.accounts.period.consumed,
        Fault::State
    );
    Ok(())
}
pub fn begin(ctx: Context<ManageV2>) -> Result<()> {
    let a = &mut ctx.accounts.action;
    let i = &mut ctx.accounts.instrument;
    require!(
        a.status == Stage::Scheduled
            && i.active_snapshot == a.key()
            && !i.snapshot_pending
            && !i.redeemed
            && i.approved_count > 0,
        Fault::Locked
    );
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= a.parameters.record_at,
        Fault::RecordDate
    );
    if a.parameters.kind == ActionKind::Redemption {
        require!(clock.unix_timestamp >= a.maturity, Fault::RecordDate);
    }
    require!(
        ctx.accounts.mint.supply == i.outstanding_supply && i.outstanding_supply > 0,
        Fault::Supply
    );
    governance::check_snapshot_eligibility(
        i,
        i.key(),
        ctx.remaining_accounts,
        a.parameters.record_at,
    )?;
    // Fail unsupported aggregate arithmetic while Scheduled, so cancellation remains available.
    components(
        i.outstanding_supply,
        a.face,
        a.rate_bps,
        a.frequency,
        &a.parameters,
    )?;
    i.snapshot_pending = true;
    i.sealed = true;
    a.record_slot = clock.slot;
    a.captured_at = clock.unix_timestamp;
    a.expected_supply = i.outstanding_supply;
    a.expected_holders = i.approved_count;
    a.snapshot_hash = hashv(&[
        b"recorda:snapshot:v2",
        a.key().as_ref(),
        &a.commitment,
        &a.record_slot.to_le_bytes(),
        &a.parameters.record_at.to_le_bytes(),
    ])
    .to_bytes();
    step(a, Stage::SnapshotPending)
}
pub fn capture(ctx: Context<CaptureV2>) -> Result<()> {
    let a = &mut ctx.accounts.action;
    require!(
        a.status == Stage::SnapshotPending
            && ctx.accounts.instrument.snapshot_pending
            && ctx.accounts.instrument.active_snapshot == a.key(),
        Fault::State
    );
    require!(
        ctx.accounts.position.approved
            && ctx.accounts.bond_account.state
                == token_2022::spl_token_2022::state::AccountState::Frozen,
        Fault::Eligibility
    );
    governance::check_policy_at(
        &ctx.accounts.instrument,
        ctx.accounts.instrument.key(),
        ctx.accounts.position.holder,
        ctx.accounts.position.holder,
        ctx.remaining_accounts,
        a.parameters.record_at,
    )?;
    let r = &mut ctx.accounts.right;
    r.action = a.key();
    r.holder = ctx.accounts.position.holder;
    r.units = ctx.accounts.bond_account.amount;
    a.captured_holders = a.captured_holders.checked_add(1).ok_or(Fault::Overflow)?;
    r.index = a.captured_holders;
    require!(a.captured_holders <= a.expected_holders, Fault::Supply);
    a.captured_supply = a
        .captured_supply
        .checked_add(r.units)
        .ok_or(Fault::Overflow)?;
    a.snapshot_hash =
        hashv(&[&a.snapshot_hash, r.holder.as_ref(), &r.units.to_le_bytes()]).to_bytes();
    Ok(())
}
pub fn finish_snapshot(ctx: Context<ManageV2>) -> Result<()> {
    let a = &mut ctx.accounts.action;
    let i = &mut ctx.accounts.instrument;
    require!(
        a.status == Stage::SnapshotPending
            && i.active_snapshot == a.key()
            && a.captured_holders == a.expected_holders
            && a.captured_supply == a.expected_supply
            && ctx.accounts.mint.supply == a.expected_supply,
        Fault::Supply
    );
    i.snapshot_pending = false;
    i.pending_record_timestamp = if retirement(&a.parameters) {
        i64::MIN
    } else {
        0
    };
    step(a, Stage::Snapshotted)
}
pub fn calculate(ctx: Context<CalculateV2>) -> Result<()> {
    let a = &mut ctx.accounts.action;
    let r = &mut ctx.accounts.right;
    require!(
        a.status == Stage::Snapshotted && !r.calculated,
        Fault::State
    );
    (r.retire_units, r.principal, r.coupon) =
        components(r.units, a.face, a.rate_bps, a.frequency, &a.parameters)?;
    r.total = r.principal.checked_add(r.coupon).ok_or(Fault::Overflow)?;
    r.calculated = true;
    a.principal = a
        .principal
        .checked_add(r.principal)
        .ok_or(Fault::Overflow)?;
    a.coupon = a.coupon.checked_add(r.coupon).ok_or(Fault::Overflow)?;
    a.total = a.total.checked_add(r.total).ok_or(Fault::Overflow)?;
    a.retire_units = a
        .retire_units
        .checked_add(r.retire_units)
        .ok_or(Fault::Overflow)?;
    a.calculated_holders = a.calculated_holders.checked_add(1).ok_or(Fault::Overflow)?;
    if a.calculated_holders == a.expected_holders {
        step(a, Stage::Calculated)?;
        step(a, Stage::AwaitingApproval)?;
    }
    Ok(())
}
pub fn approve(ctx: Context<ApproveV2>) -> Result<()> {
    let a = &mut ctx.accounts.action;
    require!(
        a.status == Stage::AwaitingApproval && a.calculated_holders == a.expected_holders,
        Fault::State
    );
    if has_coupon(&a.parameters) {
        let info = &ctx.accounts.period;
        let (address, _) = Pubkey::find_program_address(
            &[
                b"period-v2",
                a.instrument.as_ref(),
                &a.parameters.period.to_le_bytes(),
            ],
            &crate::ID,
        );
        require_keys_eq!(info.key(), address, Fault::Account);
        require_keys_eq!(*info.owner, crate::ID, Fault::Account);
        let bytes = info.try_borrow_data()?;
        let p = PeriodV2::try_deserialize(&mut &bytes[..])?;
        require!(
            p.instrument == a.instrument
                && p.period == a.parameters.period
                && p.action == a.key()
                && !p.consumed,
            Fault::State
        );
    }
    a.approved_by = ctx.accounts.authority.key();
    step(a, Stage::Approved)
}
pub fn create_vault(ctx: Context<CreateVaultV2>) -> Result<()> {
    require!(
        payable(&ctx.accounts.action.parameters) && ctx.accounts.action.status == Stage::Approved,
        Fault::State
    );
    Ok(())
}
pub fn funded(ctx: Context<FundV2>) -> Result<()> {
    let a = &mut ctx.accounts.action;
    require!(
        payable(&a.parameters)
            && a.status == Stage::Approved
            && ctx.accounts.vault.amount >= a.total,
        Fault::InsufficientFunds
    );
    step(a, Stage::Funded)
}
pub fn settle(ctx: Context<SettleV2>) -> Result<()> {
    let a = &mut ctx.accounts.action;
    let r = &mut ctx.accounts.right;
    let i = &mut ctx.accounts.instrument;
    require!(
        payable(&a.parameters) && matches!(a.status, Stage::Funded | Stage::Executing),
        Fault::State
    );
    require!(r.calculated && !r.processed, Fault::AlreadySettled);
    require!(
        ctx.accounts.vault.amount >= r.total,
        Fault::InsufficientFunds
    );
    if retirement(&a.parameters) {
        require!(
            i.active_snapshot == a.key() && i.pending_record_timestamp == i64::MIN,
            Fault::Locked
        );
        if a.parameters.kind == ActionKind::Redemption {
            require!(
                Clock::get()?.unix_timestamp >= a.maturity,
                Fault::RecordDate
            );
        }
        require!(
            (r.retire_units == 0
                && (ctx.accounts.actor.key() == i.authority
                    || ctx.accounts.actor.key() == r.holder))
                || (r.retire_units > 0 && ctx.accounts.actor.key() == r.holder),
            Fault::Eligibility
        );
        require!(
            ctx.accounts.bond_account.amount == r.units
                && ctx.accounts.mint.supply == i.outstanding_supply,
            Fault::Supply
        );
        if r.retire_units > 0 {
            let mint = i.mint;
            let bump = [i.bump];
            let seeds: &[&[u8]] = &[b"instrument", mint.as_ref(), &bump];
            token_2022::thaw_account(CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                ThawAccount {
                    account: ctx.accounts.bond_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    authority: i.to_account_info(),
                },
                &[seeds],
            ))?;
            token_2022::burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.mint.to_account_info(),
                        from: ctx.accounts.bond_account.to_account_info(),
                        authority: ctx.accounts.actor.to_account_info(),
                    },
                ),
                r.retire_units,
            )?;
            token_2022::freeze_account(CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                FreezeAccount {
                    account: ctx.accounts.bond_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    authority: i.to_account_info(),
                },
                &[seeds],
            ))?;
        }
    } else {
        require_keys_eq!(ctx.accounts.actor.key(), i.authority, Fault::Eligibility);
    }
    if r.total > 0 {
        let instrument = a.instrument;
        let id = a.id.to_le_bytes();
        let bump = [a.bump];
        let seeds: &[&[u8]] = &[b"action-v2", instrument.as_ref(), &id, &bump];
        token_2022::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    mint: ctx.accounts.payment_mint.to_account_info(),
                    authority: a.to_account_info(),
                },
                &[seeds],
            ),
            r.total,
            ctx.accounts.payment_mint.decimals,
        )?;
    }
    i.outstanding_supply = i
        .outstanding_supply
        .checked_sub(r.retire_units)
        .ok_or(Fault::Supply)?;
    i.redeemed_supply = i
        .redeemed_supply
        .checked_add(r.retire_units)
        .ok_or(Fault::Overflow)?;
    a.retired = a
        .retired
        .checked_add(r.retire_units)
        .ok_or(Fault::Overflow)?;
    a.paid = a.paid.checked_add(r.total).ok_or(Fault::Overflow)?;
    r.processed = true;
    r.destination = ctx.accounts.destination.key();
    r.settled_slot = Clock::get()?.slot;
    a.processed_holders = a.processed_holders.checked_add(1).ok_or(Fault::Overflow)?;
    if a.processed_holders == a.expected_holders {
        require!(
            a.paid == a.total && a.retired == a.retire_units,
            Fault::Supply
        );
        step(a, Stage::Settled)?;
    } else if a.status == Stage::Funded {
        step(a, Stage::Executing)?;
    }
    Ok(())
}
pub fn vote(ctx: Context<CastVoteV2>, choice: u8) -> Result<()> {
    let a = &mut ctx.accounts.action;
    let r = &mut ctx.accounts.right;
    let clock = Clock::get()?;
    require!(
        a.parameters.kind == ActionKind::Voting && a.status == Stage::Approved,
        Fault::State
    );
    require!(
        clock.unix_timestamp >= a.parameters.opens_at
            && clock.unix_timestamp < a.parameters.closes_at,
        Fault::RecordDate
    );
    require!(
        r.calculated && r.units > 0 && !r.processed && choice <= 2,
        Fault::Eligibility
    );
    let count = match choice {
        0 => &mut a.yes,
        1 => &mut a.no,
        _ => &mut a.abstain,
    };
    *count = count.checked_add(r.units).ok_or(Fault::Overflow)?;
    tally(
        a.expected_supply,
        a.yes,
        a.no,
        a.abstain,
        a.parameters.quorum_bps,
    )?;
    r.processed = true;
    a.processed_holders = a.processed_holders.checked_add(1).ok_or(Fault::Overflow)?;
    let v = &mut ctx.accounts.vote;
    v.action = a.key();
    v.holder = r.holder;
    v.choice = choice;
    v.power = r.units;
    v.slot = clock.slot;
    v.timestamp = clock.unix_timestamp;
    Ok(())
}
pub fn finish_vote(ctx: Context<ManageV2>) -> Result<()> {
    let a = &mut ctx.accounts.action;
    require!(
        a.parameters.kind == ActionKind::Voting && a.status == Stage::Approved,
        Fault::State
    );
    require!(
        Clock::get()?.unix_timestamp >= a.parameters.closes_at,
        Fault::RecordDate
    );
    (a.quorum_met, a.passed) = tally(
        a.expected_supply,
        a.yes,
        a.no,
        a.abstain,
        a.parameters.quorum_bps,
    )?;
    step(a, Stage::Settled)
}
pub fn consume_period(ctx: Context<ConsumePeriodV2>) -> Result<()> {
    require!(
        has_coupon(&ctx.accounts.action.parameters)
            && ctx.accounts.action.status == Stage::Settled
            && !ctx.accounts.period.consumed,
        Fault::State
    );
    ctx.accounts.period.consumed = true;
    Ok(())
}
pub fn finalize(ctx: Context<FinalizeV2>) -> Result<()> {
    let a = &mut ctx.accounts.action;
    let i = &mut ctx.accounts.instrument;
    require!(
        a.status == Stage::Settled
            && i.active_snapshot == a.key()
            && ctx.accounts.mint.supply == i.outstanding_supply,
        Fault::State
    );
    if payable(&a.parameters) {
        require!(
            a.paid == a.total
                && a.processed_holders == a.expected_holders
                && a.retired == a.retire_units,
            Fault::Supply
        );
    }
    if a.parameters.kind == ActionKind::Redemption {
        require!(
            a.retired == a.expected_supply && i.outstanding_supply == 0,
            Fault::Supply
        );
    }
    if has_coupon(&a.parameters) {
        let info = &ctx.accounts.period;
        let (address, _) = Pubkey::find_program_address(
            &[
                b"period-v2",
                a.instrument.as_ref(),
                &a.parameters.period.to_le_bytes(),
            ],
            &crate::ID,
        );
        require_keys_eq!(info.key(), address, Fault::Account);
        require_keys_eq!(*info.owner, crate::ID, Fault::Account);
        let bytes = info.try_borrow_data()?;
        let p = PeriodV2::try_deserialize(&mut &bytes[..])?;
        require!(p.action == a.key() && p.consumed, Fault::State);
    }
    i.redeemed = i.outstanding_supply == 0;
    i.active_snapshot = Pubkey::default();
    i.pending_record_timestamp = 0;
    step(a, Stage::Finalized)?;
    let clock = Clock::get()?;
    a.finalized_slot = clock.slot;
    a.finalized_at = clock.unix_timestamp;
    let r = &mut ctx.accounts.receipt;
    r.action = a.key();
    r.version = a.version;
    r.kind = a.parameters.kind;
    r.commitment = a.commitment;
    r.snapshot_hash = a.snapshot_hash;
    r.principal = a.principal;
    r.coupon = a.coupon;
    r.paid = a.paid;
    r.retired = a.retired;
    r.remaining_supply = i.outstanding_supply;
    r.processed_holders = a.processed_holders;
    r.yes = a.yes;
    r.no = a.no;
    r.abstain = a.abstain;
    r.quorum_met = a.quorum_met;
    r.passed = a.passed;
    r.finalized_slot = clock.slot;
    r.finalized_at = clock.unix_timestamp;
    r.summary_hash = hashv(&[
        b"recorda:receipt:v2",
        &r.try_to_vec()?[..ReceiptV2::INIT_SPACE - 32],
    ])
    .to_bytes();
    Ok(())
}

#[derive(Accounts)]
#[instruction(id:u64)]
pub struct CreateV2<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds=[b"instrument", instrument.mint.as_ref()], bump=instrument.bump, has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(init,payer=authority,space=8+ActionV2::INIT_SPACE,seeds=[b"action-v2",instrument.key().as_ref(),&id.to_le_bytes()],bump)]
    pub action: Box<Account<'info, ActionV2>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ManageV2<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds=[b"instrument", instrument.mint.as_ref()], bump=instrument.bump, has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(mut, seeds=[b"action-v2", instrument.key().as_ref(), &action.id.to_le_bytes()], bump=action.bump, has_one=instrument, has_one=authority)]
    pub action: Box<Account<'info, ActionV2>>,
    #[account(mut, address=instrument.mint, mint::token_program=token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct ReservePeriodV2<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds=[b"instrument", instrument.mint.as_ref()], bump=instrument.bump, has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(mut, seeds=[b"action-v2", instrument.key().as_ref(), &action.id.to_le_bytes()], bump=action.bump, has_one=instrument, has_one=authority)]
    pub action: Box<Account<'info, ActionV2>>,
    #[account(init,payer=authority,space=8+PeriodV2::INIT_SPACE,seeds=[b"period-v2",instrument.key().as_ref(),&action.parameters.period.to_le_bytes()],bump)]
    pub period: Account<'info, PeriodV2>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleasePeriodV2<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds=[b"instrument", instrument.mint.as_ref()], bump=instrument.bump, has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(mut, seeds=[b"action-v2", instrument.key().as_ref(), &action.id.to_le_bytes()], bump=action.bump, has_one=instrument, has_one=authority)]
    pub action: Box<Account<'info, ActionV2>>,
    #[account(mut, close=authority, seeds=[b"period-v2",instrument.key().as_ref(),&action.parameters.period.to_le_bytes()], bump, has_one=instrument, constraint=period.action==action.key() @ Fault::Account)]
    pub period: Account<'info, PeriodV2>,
}

#[derive(Accounts)]
pub struct CaptureV2<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds=[b"instrument", instrument.mint.as_ref()], bump=instrument.bump, has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(mut, seeds=[b"action-v2", instrument.key().as_ref(), &action.id.to_le_bytes()], bump=action.bump, has_one=instrument, has_one=authority)]
    pub action: Box<Account<'info, ActionV2>>,
    #[account(seeds=[b"holder",instrument.key().as_ref(),position.holder.as_ref()],bump,has_one=instrument,constraint=position.token_account==bond_account.key() @ Fault::Account)]
    pub position: Box<Account<'info, HolderPosition>>,
    #[account(token::token_program=token_program,constraint=bond_account.mint==instrument.mint @ Fault::Account,constraint=bond_account.owner==position.holder @ Fault::Account)]
    pub bond_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(init,payer=authority,space=8+RightV2::INIT_SPACE,seeds=[b"right-v2",action.key().as_ref(),position.holder.as_ref()],bump)]
    pub right: Box<Account<'info, RightV2>>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CalculateV2<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds=[b"instrument", instrument.mint.as_ref()], bump=instrument.bump, has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(mut, seeds=[b"action-v2", instrument.key().as_ref(), &action.id.to_le_bytes()], bump=action.bump, has_one=instrument, has_one=authority)]
    pub action: Box<Account<'info, ActionV2>>,
    #[account(mut, seeds=[b"right-v2",action.key().as_ref(),right.holder.as_ref()], bump, has_one=action)]
    pub right: Box<Account<'info, RightV2>>,
}

#[derive(Accounts)]
pub struct ApproveV2<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds=[b"instrument", instrument.mint.as_ref()], bump=instrument.bump, has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(mut, seeds=[b"action-v2", instrument.key().as_ref(), &action.id.to_le_bytes()], bump=action.bump, has_one=instrument, has_one=authority)]
    pub action: Box<Account<'info, ActionV2>>,
    /// CHECK: Optional for actions without coupon; otherwise owner/PDA/data checked in handler.
    pub period: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CreateVaultV2<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds=[b"instrument", instrument.mint.as_ref()], bump=instrument.bump, has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(mut, seeds=[b"action-v2", instrument.key().as_ref(), &action.id.to_le_bytes()], bump=action.bump, has_one=instrument, has_one=authority)]
    pub action: Box<Account<'info, ActionV2>>,
    #[account(address=instrument.payment_mint,mint::token_program=token_program)]
    pub payment_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(init,payer=authority,seeds=[b"vault-v2",action.key().as_ref()],bump,token::mint=payment_mint,token::authority=action,token::token_program=token_program)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundV2<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds=[b"instrument", instrument.mint.as_ref()], bump=instrument.bump, has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(mut, seeds=[b"action-v2", instrument.key().as_ref(), &action.id.to_le_bytes()], bump=action.bump, has_one=instrument, has_one=authority)]
    pub action: Box<Account<'info, ActionV2>>,
    #[account(mut, seeds=[b"vault-v2",action.key().as_ref()], bump, token::token_program=token_program, constraint=vault.mint==instrument.payment_mint @ Fault::Account, constraint=vault.owner==action.key() @ Fault::Account)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct SettleV2<'info> {
    #[account(mut)]
    pub actor: Signer<'info>,
    #[account(mut, seeds=[b"instrument", instrument.mint.as_ref()], bump=instrument.bump)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(mut, seeds=[b"action-v2", instrument.key().as_ref(), &action.id.to_le_bytes()], bump=action.bump, has_one=instrument)]
    pub action: Box<Account<'info, ActionV2>>,
    #[account(mut, seeds=[b"right-v2",action.key().as_ref(),right.holder.as_ref()], bump, has_one=action)]
    pub right: Box<Account<'info, RightV2>>,
    #[account(mut, address=instrument.mint, mint::token_program=token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(seeds=[b"holder",instrument.key().as_ref(),right.holder.as_ref()],bump,has_one=instrument,constraint=position.holder==right.holder @ Fault::Account,constraint=position.token_account==bond_account.key() @ Fault::Account)]
    pub position: Box<Account<'info, HolderPosition>>,
    #[account(mut,token::mint=mint,token::token_program=token_program,constraint=bond_account.owner==right.holder @ Fault::Account)]
    pub bond_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(address=instrument.payment_mint,mint::token_program=token_program)]
    pub payment_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, seeds=[b"vault-v2",action.key().as_ref()], bump, token::token_program=token_program, constraint=vault.mint==instrument.payment_mint @ Fault::Account, constraint=vault.owner==action.key() @ Fault::Account)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut,token::mint=payment_mint,token::token_program=token_program,constraint=destination.owner==right.holder @ Fault::Account,constraint=destination.key()!=vault.key() @ Fault::Account)]
    pub destination: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct CastVoteV2<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,
    #[account(mut, seeds=[b"instrument", instrument.mint.as_ref()], bump=instrument.bump)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(mut, seeds=[b"action-v2", instrument.key().as_ref(), &action.id.to_le_bytes()], bump=action.bump, has_one=instrument)]
    pub action: Box<Account<'info, ActionV2>>,
    #[account(mut, seeds=[b"right-v2",action.key().as_ref(),right.holder.as_ref()], bump, has_one=action,has_one=holder)]
    pub right: Box<Account<'info, RightV2>>,
    #[account(init,payer=holder,space=8+VoteV2::INIT_SPACE,seeds=[b"vote-v2",action.key().as_ref(),holder.key().as_ref()],bump)]
    pub vote: Account<'info, VoteV2>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConsumePeriodV2<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds=[b"instrument", instrument.mint.as_ref()], bump=instrument.bump, has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(mut, seeds=[b"action-v2", instrument.key().as_ref(), &action.id.to_le_bytes()], bump=action.bump, has_one=instrument, has_one=authority)]
    pub action: Box<Account<'info, ActionV2>>,
    #[account(mut, seeds=[b"period-v2",instrument.key().as_ref(),&action.parameters.period.to_le_bytes()], bump, has_one=instrument, constraint=period.action==action.key() @ Fault::Account)]
    pub period: Account<'info, PeriodV2>,
}

#[derive(Accounts)]
pub struct FinalizeV2<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds=[b"instrument", instrument.mint.as_ref()], bump=instrument.bump, has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(mut, seeds=[b"action-v2", instrument.key().as_ref(), &action.id.to_le_bytes()], bump=action.bump, has_one=instrument, has_one=authority)]
    pub action: Box<Account<'info, ActionV2>>,
    #[account(mut, address=instrument.mint, mint::token_program=token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    /// CHECK: Coupon period ownership/PDA/consumption validated in handler.
    pub period: UncheckedAccount<'info>,
    #[account(init,payer=authority,space=8+ReceiptV2::INIT_SPACE,seeds=[b"receipt-v2",action.key().as_ref()],bump)]
    pub receipt: Account<'info, ReceiptV2>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[cfg(test)]
mod tests {
    use super::*;
    fn parameters(kind: ActionKind) -> ActionParameters {
        ActionParameters {
            kind,
            record_at: 100,
            period: 0,
            include_coupon: false,
            retire_bps: 10_000,
            opens_at: 0,
            closes_at: 0,
            quorum_bps: 0,
            proposal_hash: [0; 32],
        }
    }
    #[test]
    fn maturity_principal_and_separate_coupon() {
        let mut p = parameters(ActionKind::Redemption);
        assert!(validate_parameters(&p, 99, 100).is_err());
        assert!(validate_parameters(&p, 100, 100).is_ok());
        assert_eq!(
            components(10, 100_000, 1000, 2, &p).unwrap(),
            (10, 1_000_000, 0)
        );
        p.include_coupon = true;
        p.period = 1;
        assert_eq!(
            components(10, 100_000, 1000, 2, &p).unwrap(),
            (10, 1_000_000, 50_000)
        );
        assert_eq!(components(0, 100_000, 1000, 2, &p).unwrap(), (0, 0, 0));
        assert!(components(u64::MAX, u64::MAX, 1000, 2, &p).is_err());
    }
    #[test]
    fn partial_fixture_and_per_holder_rounding() {
        let mut p = parameters(ActionKind::PartialRedemption);
        p.retire_bps = 2000;
        let results: Vec<_> = [100, 300, 600]
            .into_iter()
            .map(|u| components(u, 100_000, 1000, 2, &p).unwrap())
            .collect();
        assert_eq!(
            results,
            [(20, 2_000_000, 0), (60, 6_000_000, 0), (120, 12_000_000, 0)]
        );
        assert_eq!(1000 - results.iter().map(|r| r.0).sum::<u64>(), 800);
        assert_eq!(components(4, 100_000, 1000, 2, &p).unwrap(), (0, 0, 0));
    }
    #[test]
    fn independent_quorum_threshold_abstention_ties_and_overflow() {
        assert_eq!(tally(100, 30, 10, 10, 5000).unwrap(), (true, true));
        assert_eq!(tally(100, 30, 10, 9, 5000).unwrap(), (false, false));
        assert_eq!(tally(100, 25, 25, 0, 5000).unwrap(), (true, false));
        assert_eq!(tally(100, 0, 0, 100, 5000).unwrap(), (true, false));
        assert!(tally(0, 0, 0, 0, 5000).is_err());
        assert!(tally(10, 11, 0, 0, 5000).is_err());
        assert!(tally(u64::MAX, u64::MAX, 1, 0, 5000).is_err());
        assert_eq!(
            tally(u64::MAX, u64::MAX, 0, 0, 10_000).unwrap(),
            (true, true)
        );
    }
    #[test]
    fn parameters_reject_cross_kind_noise_and_ambiguous_periods() {
        let mut p = parameters(ActionKind::Voting);
        p.retire_bps = 0;
        p.opens_at = 100;
        p.closes_at = 200;
        p.quorum_bps = 5000;
        p.proposal_hash = [1; 32];
        assert!(validate_parameters(&p, 100, 300).is_ok());
        p.period = 1;
        assert!(validate_parameters(&p, 100, 300).is_err());
        p.period = 0;
        p.closes_at = 100;
        assert!(validate_parameters(&p, 100, 300).is_err());
        let mut r = parameters(ActionKind::Redemption);
        r.include_coupon = true;
        assert!(validate_parameters(&r, 100, 100).is_err());
        r.period = 1;
        assert!(validate_parameters(&r, 100, 100).is_ok());
    }
}
