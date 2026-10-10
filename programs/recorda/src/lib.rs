use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::extension::{
    BaseStateWithExtensions, StateWithExtensions,
};
use anchor_spl::token_2022::{
    self, FreezeAccount, MintTo, SetAuthority, ThawAccount, Token2022, TransferChecked,
};
use anchor_spl::token_interface::{Mint, TokenAccount};
use solana_sha256_hasher::hashv;

declare_id!("CFyseDHTMkDxMpnozdZpHV5a4fbEkPAkyue5RpHtrobF");

#[program]
pub mod recorda {
    use super::*;
    pub fn create_instrument(
        ctx: Context<CreateInstrument>,
        id: u64,
        face_value_minor: u64,
        coupon_bps: u16,
        payments_per_year: u16,
        maturity_timestamp: i64,
        currency: [u8; 8],
    ) -> Result<()> {
        require!(
            face_value_minor > 0 && coupon_bps <= 10_000 && payments_per_year > 0,
            Fault::Parameters
        );
        require!(ctx.accounts.payment_mint.decimals == 2, Fault::Parameters);
        require!(
            maturity_timestamp > Clock::get()?.unix_timestamp,
            Fault::Parameters
        );
        // Fee/interest/hook extensions would change credited amounts. The MVP rail is plain Token-2022.
        let data = ctx.accounts.payment_mint.to_account_info();
        let bytes = data.try_borrow_data()?;
        let payment =
            StateWithExtensions::<token_2022::spl_token_2022::state::Mint>::unpack(&bytes)?;
        require!(payment.get_extension_types()?.is_empty(), Fault::Account);
        let i = &mut ctx.accounts.instrument;
        i.id = id;
        i.authority = ctx.accounts.authority.key();
        i.mint = ctx.accounts.mint.key();
        i.payment_mint = ctx.accounts.payment_mint.key();
        i.face_value_minor = face_value_minor;
        i.coupon_bps = coupon_bps;
        i.payments_per_year = payments_per_year;
        i.maturity_timestamp = maturity_timestamp;
        i.currency = currency;
        i.bump = ctx.bumps.instrument;
        emit!(InstrumentCreated {
            instrument: i.key(),
            mint: i.mint,
            authority: i.authority
        });
        Ok(())
    }
    pub fn register_holder(ctx: Context<RegisterHolder>, units: u64) -> Result<()> {
        let i = &mut ctx.accounts.instrument;
        require!(!i.sealed && !i.snapshot_pending, Fault::Locked);
        require_before_record(i)?;
        let p = &mut ctx.accounts.position;
        p.instrument = i.key();
        p.holder = ctx.accounts.holder.key();
        p.token_account = ctx.accounts.bond_account.key();
        p.approved = true;
        i.registered_count = i.registered_count.checked_add(1).ok_or(Fault::Overflow)?;
        i.approved_count = i.approved_count.checked_add(1).ok_or(Fault::Overflow)?;
        i.outstanding_supply = i
            .outstanding_supply
            .checked_add(units)
            .ok_or(Fault::Overflow)?;
        let mint = i.mint;
        let bump = [i.bump];
        let seeds: &[&[u8]] = &[b"instrument", mint.as_ref(), &bump];
        if units > 0 {
            token_2022::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.bond_account.to_account_info(),
                        authority: i.to_account_info(),
                    },
                    &[seeds],
                ),
                units,
            )?;
        }
        // Prevent a zero-balance holder from closing its registered account and
        // making every future snapshot impossible. Assign custody before freezing.
        for (kind, authority) in [
            (token_2022::spl_token_2022::instruction::AuthorityType::CloseAccount, i.key()),
            (token_2022::spl_token_2022::instruction::AuthorityType::AccountOwner, p.holder),
        ] {
            token_2022::set_authority(
                CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), SetAuthority {
                    current_authority: i.to_account_info(),
                    account_or_mint: ctx.accounts.bond_account.to_account_info(),
                }, &[seeds]), kind, Some(authority)
            )?;
        }
        token_2022::freeze_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            FreezeAccount {
                account: ctx.accounts.bond_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: i.to_account_info(),
            },
            &[seeds],
        ))?;
        emit!(RegistryChanged {
            instrument: i.key(),
            holder: p.holder,
            approved: true
        });
        Ok(())
    }
    pub fn set_holder_approved(ctx: Context<SetHolderApproved>, approved: bool) -> Result<()> {
        let i = &mut ctx.accounts.instrument;
        require!(!i.snapshot_pending, Fault::Locked);
        require_before_record(i)?;
        require!(ctx.accounts.position.approved != approved, Fault::State);
        // A revoked balance cannot vanish from eligible supply. Transfer out through the controlled path first.
        require!(ctx.accounts.bond_account.amount == 0, Fault::Balance);
        if approved {
            i.approved_count = i.approved_count.checked_add(1).ok_or(Fault::Overflow)?;
        } else {
            i.approved_count = i.approved_count.checked_sub(1).ok_or(Fault::Overflow)?;
        }
        ctx.accounts.position.approved = approved;
        emit!(RegistryChanged {
            instrument: i.key(),
            holder: ctx.accounts.position.holder,
            approved
        });
        Ok(())
    }
    pub fn transfer_bonds(ctx: Context<TransferBonds>, units: u64) -> Result<()> {
        let i = &ctx.accounts.instrument;
        require!(!i.snapshot_pending && !i.redeemed, Fault::Locked);
        require_before_record(i)?;
        require!(
            ctx.accounts.from_position.approved && ctx.accounts.to_position.approved,
            Fault::Eligibility
        );
        require!(
            units > 0 && ctx.accounts.from_position.key() != ctx.accounts.to_position.key(),
            Fault::Parameters
        );
        let mint = i.mint;
        let bump = [i.bump];
        let seeds: &[&[u8]] = &[b"instrument", mint.as_ref(), &bump];
        for account in [&ctx.accounts.from_account, &ctx.accounts.to_account] {
            token_2022::thaw_account(CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                ThawAccount {
                    account: account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    authority: i.to_account_info(),
                },
                &[seeds],
            ))?;
        }
        token_2022::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.from_account.to_account_info(),
                    to: ctx.accounts.to_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    authority: ctx.accounts.holder.to_account_info(),
                },
            ),
            units,
            0,
        )?;
        for account in [&ctx.accounts.from_account, &ctx.accounts.to_account] {
            token_2022::freeze_account(CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                FreezeAccount {
                    account: account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    authority: i.to_account_info(),
                },
                &[seeds],
            ))?;
        }
        emit!(BondsTransferred {
            instrument: i.key(),
            from: ctx.accounts.holder.key(),
            to: ctx.accounts.to_position.holder,
            units
        });
        Ok(())
    }
    pub fn create_coupon(
        ctx: Context<CreateCoupon>,
        action_id: u64,
        record_timestamp: i64,
    ) -> Result<()> {
        require!(
            record_timestamp >= Clock::get()?.unix_timestamp,
            Fault::RecordDate
        );
        let i = &mut ctx.accounts.instrument;
        require!(!i.snapshot_pending && i.pending_record_timestamp == 0, Fault::Locked);
        // A scheduled record date is a protocol barrier, even if the operator is late.
        i.pending_record_timestamp = record_timestamp;
        let a = &mut ctx.accounts.action;
        a.id = action_id;
        a.instrument = ctx.accounts.instrument.key();
        a.authority = ctx.accounts.authority.key();
        a.record_timestamp = record_timestamp;
        a.bump = ctx.bumps.action;
        a.status = Stage::Draft;
        transition(a, Stage::Scheduled)?;
        Ok(())
    }
    pub fn cancel_action(ctx: Context<ManageAction>) -> Result<()> {
        require!(ctx.accounts.action.status == Stage::Scheduled, Fault::State);
        ctx.accounts.instrument.pending_record_timestamp = 0;
        transition(&mut ctx.accounts.action, Stage::Cancelled)
    }
    pub fn begin_snapshot(ctx: Context<ManageAction>) -> Result<()> {
        let a = &mut ctx.accounts.action;
        let i = &mut ctx.accounts.instrument;
        require!(a.status == Stage::Scheduled, Fault::State);
        require!(
            Clock::get()?.unix_timestamp >= a.record_timestamp,
            Fault::RecordDate
        );
        require!(
            !i.snapshot_pending && !i.redeemed && i.approved_count > 0,
            Fault::Locked
        );
        require!(
            ctx.accounts.mint.supply == i.outstanding_supply,
            Fault::Supply
        );
        i.snapshot_pending = true;
        i.active_snapshot = a.key();
        i.sealed = true;
        a.record_slot = Clock::get()?.slot;
        a.snapshot_timestamp = Clock::get()?.unix_timestamp;
        a.expected_holders = i.approved_count;
        a.expected_supply = i.outstanding_supply;
        a.snapshot_hash = hashv(&[
            a.key().as_ref(),
            &a.record_slot.to_le_bytes(),
            &a.record_timestamp.to_le_bytes(),
        ])
        .to_bytes();
        transition(a, Stage::SnapshotPending)
    }
    pub fn snapshot_holder(ctx: Context<SnapshotHolder>) -> Result<()> {
        let a = &mut ctx.accounts.action;
        require!(
            a.status == Stage::SnapshotPending
                && ctx.accounts.instrument.active_snapshot == a.key(),
            Fault::State
        );
        require!(ctx.accounts.position.approved, Fault::Eligibility);
        let e = &mut ctx.accounts.entitlement;
        e.action = a.key();
        e.holder = ctx.accounts.position.holder;
        e.snapshot_units = ctx.accounts.bond_account.amount;
        a.snapshot_units = a
            .snapshot_units
            .checked_add(e.snapshot_units)
            .ok_or(Fault::Overflow)?;
        a.snapshot_holders = a.snapshot_holders.checked_add(1).ok_or(Fault::Overflow)?;
        require!(a.snapshot_holders <= a.expected_holders, Fault::Supply);
        e.snapshot_index = a.snapshot_holders;
        a.snapshot_hash = hashv(&[
            &a.snapshot_hash,
            e.holder.as_ref(),
            &e.snapshot_units.to_le_bytes(),
        ])
        .to_bytes();
        emit!(PositionSnapshotted {
            action: a.key(),
            holder: e.holder,
            units: e.snapshot_units,
            index: a.snapshot_holders
        });
        Ok(())
    }
    pub fn finalize_snapshot(ctx: Context<ManageAction>) -> Result<()> {
        let a = &mut ctx.accounts.action;
        let i = &mut ctx.accounts.instrument;
        require!(
            a.status == Stage::SnapshotPending && i.active_snapshot == a.key(),
            Fault::State
        );
        require!(
            a.snapshot_holders == a.expected_holders
                && a.snapshot_units == a.expected_supply
                && ctx.accounts.mint.supply == a.expected_supply,
            Fault::Supply
        );
        i.snapshot_pending = false;
        i.pending_record_timestamp = 0;
        i.active_snapshot = Pubkey::default();
        transition(a, Stage::Snapshotted)
    }
    pub fn calculate_entitlement(ctx: Context<CalculateEntitlement>) -> Result<()> {
        let a = &mut ctx.accounts.action;
        let e = &mut ctx.accounts.entitlement;
        let i = &ctx.accounts.instrument;
        require!(
            a.status == Stage::Snapshotted && !e.calculated,
            Fault::State
        );
        e.amount_minor = coupon_minor(
            e.snapshot_units,
            i.face_value_minor,
            i.coupon_bps,
            i.payments_per_year,
        )?;
        // Shared right contracts for Phase 2; they do not execute redemption/voting.
        e.principal_minor = e
            .snapshot_units
            .checked_mul(i.face_value_minor)
            .ok_or(Fault::Overflow)?;
        e.final_coupon_minor = e.amount_minor;
        e.voting_power = e.snapshot_units;
        e.calculated = true;
        a.total_obligation_minor = a
            .total_obligation_minor
            .checked_add(e.amount_minor)
            .ok_or(Fault::Overflow)?;
        a.calculated_holders = a.calculated_holders.checked_add(1).ok_or(Fault::Overflow)?;
        emit!(RightCalculated {
            action: a.key(),
            holder: e.holder,
            amount_minor: e.amount_minor
        });
        if a.calculated_holders == a.expected_holders {
            transition(a, Stage::Calculated)?;
            transition(a, Stage::AwaitingApproval)?;
        }
        Ok(())
    }
    pub fn approve_action(ctx: Context<ManageAction>) -> Result<()> {
        require!(
            ctx.accounts.action.status == Stage::AwaitingApproval,
            Fault::State
        );
        ctx.accounts.action.approved_by = ctx.accounts.authority.key();
        transition(&mut ctx.accounts.action, Stage::Approved)
    }
    pub fn mark_funded(ctx: Context<ManageFunding>) -> Result<()> {
        let a = &mut ctx.accounts.action;
        require!(a.status == Stage::Approved, Fault::State);
        require!(
            ctx.accounts.vault.amount >= a.total_obligation_minor,
            Fault::InsufficientFunds
        );
        transition(a, Stage::Funded)
    }
    pub fn settle_holder(ctx: Context<SettleHolder>) -> Result<()> {
        let a = &mut ctx.accounts.action;
        let e = &mut ctx.accounts.entitlement;
        require!(
            a.status == Stage::Funded || a.status == Stage::Executing,
            Fault::State
        );
        require!(e.calculated && !e.settled, Fault::AlreadySettled);
        require!(
            ctx.accounts.vault.amount >= e.amount_minor,
            Fault::InsufficientFunds
        );
        let instrument = a.instrument;
        let id = a.id.to_le_bytes();
        let bump = [a.bump];
        let seeds: &[&[u8]] = &[b"action", instrument.as_ref(), &id, &bump];
        if e.amount_minor > 0 {
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
                e.amount_minor,
                ctx.accounts.payment_mint.decimals,
            )?;
        }
        e.destination = ctx.accounts.destination.key();
        e.settled_amount_minor = e.amount_minor;
        e.settled = true;
        e.settled_slot = Clock::get()?.slot;
        a.settled_total_minor = a
            .settled_total_minor
            .checked_add(e.amount_minor)
            .ok_or(Fault::Overflow)?;
        a.processed_holders = a.processed_holders.checked_add(1).ok_or(Fault::Overflow)?;
        emit!(HolderSettled {
            action: a.key(),
            holder: e.holder,
            amount_minor: e.amount_minor,
            slot: e.settled_slot
        });
        if a.processed_holders == a.expected_holders {
            require!(
                a.settled_total_minor == a.total_obligation_minor,
                Fault::Supply
            );
            transition(a, Stage::Settled)?;
        } else if a.status != Stage::Executing {
            transition(a, Stage::Executing)?;
        }
        Ok(())
    }
    pub fn finalize_action(ctx: Context<FinalizeAction>) -> Result<()> {
        let a = &mut ctx.accounts.action;
        require!(
            a.status == Stage::Settled
                && a.processed_holders == a.expected_holders
                && a.settled_total_minor == a.total_obligation_minor,
            Fault::State
        );
        transition(a, Stage::Finalized)?;
        let r = &mut ctx.accounts.receipt;
        r.action = a.key();
        r.final_status = Stage::Finalized;
        r.settled_total_minor = a.settled_total_minor;
        r.processed_holders = a.processed_holders;
        r.finalized_at = a.updated_at;
        r.finalized_slot = a.updated_slot;
        r.summary_hash = hashv(&[
            a.key().as_ref(),
            &a.snapshot_hash,
            &r.settled_total_minor.to_le_bytes(),
            &r.processed_holders.to_le_bytes(),
            &r.finalized_slot.to_le_bytes(),
        ])
        .to_bytes();
        Ok(())
    }
}

fn require_before_record(i: &Instrument) -> Result<()> {
    require!(before_record(i.pending_record_timestamp, Clock::get()?.unix_timestamp), Fault::Locked);
    Ok(())
}
fn before_record(record: i64, now: i64) -> bool {
    record == 0 || now < record
}

pub fn coupon_minor(units: u64, face: u64, bps: u16, periods: u16) -> Result<u64> {
    require!(face > 0 && bps <= 10_000 && periods > 0, Fault::Parameters);
    let amount = (units as u128)
        .checked_mul(face as u128)
        .and_then(|v| v.checked_mul(bps as u128))
        .ok_or(Fault::Overflow)?
        / (10_000u128 * periods as u128);
    u64::try_from(amount).map_err(|_| error!(Fault::Overflow))
}
fn transition(a: &mut Account<CorporateAction>, status: Stage) -> Result<()> {
    require!(valid_transition(a.status, status), Fault::State);
    let clock = Clock::get()?;
    let from = a.status;
    a.status = status;
    a.updated_at = clock.unix_timestamp;
    a.updated_slot = clock.slot;
    emit!(ActionTransition {
        action: a.key(),
        from,
        to: status,
        slot: clock.slot,
        timestamp: clock.unix_timestamp
    });
    Ok(())
}
fn valid_transition(from: Stage, to: Stage) -> bool {
    matches!((from, to),
        (Stage::Draft, Stage::Scheduled)
        | (Stage::Scheduled, Stage::SnapshotPending | Stage::Cancelled)
        | (Stage::SnapshotPending, Stage::Snapshotted)
        | (Stage::Snapshotted, Stage::Calculated)
        | (Stage::Calculated, Stage::AwaitingApproval)
        | (Stage::AwaitingApproval, Stage::Approved)
        | (Stage::Approved, Stage::Funded)
        | (Stage::Funded, Stage::Executing | Stage::Settled)
        | (Stage::Executing, Stage::Settled)
        | (Stage::Settled, Stage::Finalized))
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct CreateInstrument<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + Instrument::INIT_SPACE, seeds = [b"instrument", mint.key().as_ref()], bump)]
    pub instrument: Account<'info, Instrument>,
    #[account(init, payer = authority, seeds = [b"mint", authority.key().as_ref(), &id.to_le_bytes()], bump, mint::decimals = 0, mint::authority = instrument, mint::freeze_authority = instrument, mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mint::token_program = token_program)]
    pub payment_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct RegisterHolder<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"instrument", mint.key().as_ref()], bump = instrument.bump, has_one = authority, has_one = mint)]
    pub instrument: Account<'info, Instrument>,
    #[account(mut, mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    /// CHECK: Identity only; holder signs transfers, never administrative issuance.
    pub holder: UncheckedAccount<'info>,
    #[account(init, payer = authority, space = 8 + HolderPosition::INIT_SPACE, seeds = [b"holder", instrument.key().as_ref(), holder.key().as_ref()], bump)]
    pub position: Account<'info, HolderPosition>,
    #[account(init, payer = authority, seeds = [b"bond-account", instrument.key().as_ref(), holder.key().as_ref()], bump, token::mint = mint, token::authority = instrument, token::token_program = token_program)]
    pub bond_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct SetHolderApproved<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"instrument", instrument.mint.as_ref()], bump = instrument.bump, has_one = authority)]
    pub instrument: Account<'info, Instrument>,
    #[account(mut, seeds = [b"holder", instrument.key().as_ref(), position.holder.as_ref()], bump, has_one = instrument, constraint = position.token_account == bond_account.key() @ Fault::Account)]
    pub position: Account<'info, HolderPosition>,
    #[account(constraint = bond_account.mint == instrument.mint @ Fault::Account, constraint = bond_account.owner == position.holder @ Fault::Account)]
    pub bond_account: InterfaceAccount<'info, TokenAccount>,
}
#[derive(Accounts)]
pub struct TransferBonds<'info> {
    pub holder: Signer<'info>,
    #[account(seeds = [b"instrument", mint.key().as_ref()], bump = instrument.bump, has_one = mint)]
    pub instrument: Account<'info, Instrument>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(seeds = [b"holder", instrument.key().as_ref(), holder.key().as_ref()], bump, has_one = instrument, constraint = from_position.token_account == from_account.key() @ Fault::Account)]
    pub from_position: Account<'info, HolderPosition>,
    #[account(seeds = [b"holder", instrument.key().as_ref(), to_position.holder.as_ref()], bump, has_one = instrument, constraint = to_position.token_account == to_account.key() @ Fault::Account)]
    pub to_position: Account<'info, HolderPosition>,
    #[account(mut, token::mint = mint, token::authority = holder, token::token_program = token_program)]
    pub from_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::token_program = token_program, constraint = to_account.owner == to_position.holder @ Fault::Account)]
    pub to_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token2022>,
}
#[derive(Accounts)]
#[instruction(action_id: u64)]
pub struct CreateCoupon<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"instrument", instrument.mint.as_ref()], bump = instrument.bump, has_one = authority, constraint = !instrument.redeemed @ Fault::Locked)]
    pub instrument: Account<'info, Instrument>,
    #[account(init, payer = authority, space = 8 + CorporateAction::INIT_SPACE, seeds = [b"action", instrument.key().as_ref(), &action_id.to_le_bytes()], bump)]
    pub action: Account<'info, CorporateAction>,
    #[account(address = instrument.payment_mint, mint::token_program = token_program)]
    pub payment_mint: InterfaceAccount<'info, Mint>,
    #[account(init, payer = authority, seeds = [b"vault", action.key().as_ref()], bump, token::mint = payment_mint, token::authority = action, token::token_program = token_program)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct ManageAction<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"instrument", mint.key().as_ref()], bump = instrument.bump, has_one = authority, has_one = mint)]
    pub instrument: Account<'info, Instrument>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [b"action", instrument.key().as_ref(), &action.id.to_le_bytes()], bump = action.bump, has_one = instrument, has_one = authority)]
    pub action: Account<'info, CorporateAction>,
    pub token_program: Program<'info, Token2022>,
}
#[derive(Accounts)]
pub struct SnapshotHolder<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"instrument", instrument.mint.as_ref()], bump = instrument.bump, has_one = authority)]
    pub instrument: Account<'info, Instrument>,
    #[account(mut, seeds = [b"action", instrument.key().as_ref(), &action.id.to_le_bytes()], bump = action.bump, has_one = instrument, has_one = authority)]
    pub action: Account<'info, CorporateAction>,
    #[account(seeds = [b"holder", instrument.key().as_ref(), position.holder.as_ref()], bump, has_one = instrument, constraint = position.token_account == bond_account.key() @ Fault::Account)]
    pub position: Account<'info, HolderPosition>,
    #[account(token::token_program = token_program, constraint = bond_account.mint == instrument.mint @ Fault::Account, constraint = bond_account.owner == position.holder @ Fault::Account)]
    pub bond_account: InterfaceAccount<'info, TokenAccount>,
    #[account(init, payer = authority, space = 8 + EntitlementPosition::INIT_SPACE, seeds = [b"entitlement", action.key().as_ref(), position.holder.as_ref()], bump)]
    pub entitlement: Account<'info, EntitlementPosition>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct CalculateEntitlement<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [b"instrument", instrument.mint.as_ref()], bump = instrument.bump, has_one = authority)]
    pub instrument: Account<'info, Instrument>,
    #[account(mut, seeds = [b"action", instrument.key().as_ref(), &action.id.to_le_bytes()], bump = action.bump, has_one = instrument, has_one = authority)]
    pub action: Account<'info, CorporateAction>,
    #[account(mut, seeds = [b"entitlement", action.key().as_ref(), entitlement.holder.as_ref()], bump, has_one = action)]
    pub entitlement: Account<'info, EntitlementPosition>,
}
#[derive(Accounts)]
pub struct ManageFunding<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [b"instrument", instrument.mint.as_ref()], bump = instrument.bump, has_one = authority)]
    pub instrument: Account<'info, Instrument>,
    #[account(mut, seeds = [b"action", instrument.key().as_ref(), &action.id.to_le_bytes()], bump = action.bump, has_one = instrument, has_one = authority)]
    pub action: Account<'info, CorporateAction>,
    #[account(seeds = [b"vault", action.key().as_ref()], bump, token::token_program = token_program, constraint = vault.mint == instrument.payment_mint @ Fault::Account, constraint = vault.owner == action.key() @ Fault::Account)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token2022>,
}
#[derive(Accounts)]
pub struct SettleHolder<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [b"instrument", instrument.mint.as_ref()], bump = instrument.bump, has_one = authority)]
    pub instrument: Account<'info, Instrument>,
    #[account(mut, seeds = [b"action", instrument.key().as_ref(), &action.id.to_le_bytes()], bump = action.bump, has_one = instrument, has_one = authority)]
    pub action: Account<'info, CorporateAction>,
    #[account(mut, seeds = [b"entitlement", action.key().as_ref(), entitlement.holder.as_ref()], bump, has_one = action)]
    pub entitlement: Account<'info, EntitlementPosition>,
    #[account(address = instrument.payment_mint, mint::token_program = token_program)]
    pub payment_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [b"vault", action.key().as_ref()], bump, token::mint = payment_mint, token::authority = action, token::token_program = token_program)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = payment_mint, token::token_program = token_program, constraint = destination.owner == entitlement.holder @ Fault::Account, constraint = destination.key() != vault.key() @ Fault::Account)]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token2022>,
}
#[derive(Accounts)]
pub struct FinalizeAction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"instrument", instrument.mint.as_ref()], bump = instrument.bump, has_one = authority)]
    pub instrument: Account<'info, Instrument>,
    #[account(mut, seeds = [b"action", instrument.key().as_ref(), &action.id.to_le_bytes()], bump = action.bump, has_one = instrument, has_one = authority)]
    pub action: Account<'info, CorporateAction>,
    #[account(init, payer = authority, space = 8 + ActionReceipt::INIT_SPACE, seeds = [b"receipt", action.key().as_ref()], bump)]
    pub receipt: Account<'info, ActionReceipt>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Instrument {
    pub id: u64,
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub payment_mint: Pubkey,
    pub face_value_minor: u64,
    pub currency: [u8; 8],
    pub coupon_bps: u16,
    pub payments_per_year: u16,
    pub maturity_timestamp: i64,
    pub outstanding_supply: u64,
    pub redeemed_supply: u64,
    pub registered_count: u32,
    pub approved_count: u32,
    pub sealed: bool,
    pub snapshot_pending: bool,
    pub active_snapshot: Pubkey,
    pub pending_record_timestamp: i64,
    pub redeemed: bool,
    pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct HolderPosition {
    pub instrument: Pubkey,
    pub holder: Pubkey,
    pub token_account: Pubkey,
    pub approved: bool,
}
#[account]
#[derive(InitSpace)]
pub struct CorporateAction {
    pub id: u64,
    pub instrument: Pubkey,
    pub authority: Pubkey,
    pub approved_by: Pubkey,
    pub record_timestamp: i64,
    pub record_slot: u64,
    pub snapshot_timestamp: i64,
    pub snapshot_hash: [u8; 32],
    pub status: Stage,
    pub expected_holders: u32,
    pub expected_supply: u64,
    pub snapshot_holders: u32,
    pub snapshot_units: u64,
    pub calculated_holders: u32,
    pub total_obligation_minor: u64,
    pub settled_total_minor: u64,
    pub processed_holders: u32,
    pub updated_slot: u64,
    pub updated_at: i64,
    pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct EntitlementPosition {
    pub action: Pubkey,
    pub holder: Pubkey,
    pub snapshot_units: u64,
    pub snapshot_index: u32,
    pub amount_minor: u64,
    pub principal_minor: u64,
    pub final_coupon_minor: u64,
    pub voting_power: u64,
    pub calculated: bool,
    pub settled: bool,
    pub settled_slot: u64,
    pub destination: Pubkey,
    pub settled_amount_minor: u64,
}
#[account]
#[derive(InitSpace)]
pub struct ActionReceipt {
    pub action: Pubkey,
    pub final_status: Stage,
    pub settled_total_minor: u64,
    pub processed_holders: u32,
    pub finalized_at: i64,
    pub finalized_slot: u64,
    pub summary_hash: [u8; 32],
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum Stage {
    Draft,
    Scheduled,
    SnapshotPending,
    Snapshotted,
    Calculated,
    AwaitingApproval,
    Approved,
    Funded,
    Executing,
    Settled,
    Finalized,
    Cancelled,
}

#[event]
pub struct InstrumentCreated {
    pub instrument: Pubkey,
    pub mint: Pubkey,
    pub authority: Pubkey,
}
#[event]
pub struct RegistryChanged {
    pub instrument: Pubkey,
    pub holder: Pubkey,
    pub approved: bool,
}
#[event]
pub struct BondsTransferred {
    pub instrument: Pubkey,
    pub from: Pubkey,
    pub to: Pubkey,
    pub units: u64,
}
#[event]
pub struct PositionSnapshotted {
    pub action: Pubkey,
    pub holder: Pubkey,
    pub units: u64,
    pub index: u32,
}
#[event]
pub struct RightCalculated {
    pub action: Pubkey,
    pub holder: Pubkey,
    pub amount_minor: u64,
}
#[event]
pub struct HolderSettled {
    pub action: Pubkey,
    pub holder: Pubkey,
    pub amount_minor: u64,
    pub slot: u64,
}
#[event]
pub struct ActionTransition {
    pub action: Pubkey,
    pub from: Stage,
    pub to: Stage,
    pub slot: u64,
    pub timestamp: i64,
}
#[error_code]
pub enum Fault {
    #[msg("Invalid financial parameters")]
    Parameters,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Invalid token account or mint")]
    Account,
    #[msg("Invalid lifecycle transition")]
    State,
    #[msg("Instrument transfers or registry are locked")]
    Locked,
    #[msg("Holder is not eligible")]
    Eligibility,
    #[msg("Holder must have zero balance before approval changes")]
    Balance,
    #[msg("Record date has not arrived or scheduling date is invalid")]
    RecordDate,
    #[msg("Snapshot supply or processed totals do not reconcile")]
    Supply,
    #[msg("Insufficient settlement vault funding")]
    InsufficientFunds,
    #[msg("Entitlement was already settled or not calculated")]
    AlreadySettled,
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn tz_22() {
        let amounts: Vec<u64> = [10, 5, 2, 0]
            .into_iter()
            .map(|u| coupon_minor(u, 100_000, 1000, 2).unwrap())
            .collect();
        assert_eq!(amounts, [50_000, 25_000, 10_000, 0]);
        assert_eq!(amounts.iter().sum::<u64>(), 85_000);
    }
    #[test]
    fn historical() {
        assert_eq!(coupon_minor(20, 100_000, 1000, 2).unwrap(), 100_000);
    }
    #[test]
    fn rounding_and_overflow() {
        assert_eq!(coupon_minor(1, 101, 333, 3).unwrap(), 1);
        assert!(coupon_minor(u64::MAX, u64::MAX, 10_000, 1).is_err());
        assert!(coupon_minor(1, 100, 1000, 0).is_err());
        assert!(coupon_minor(1, 0, 1000, 2).is_err());
    }
    #[test]
    fn record_barrier_exact_boundary_and_late_operator() {
        assert!(before_record(100, 99));
        assert!(!before_record(100, 100));
        assert!(!before_record(100, 101));
        assert!(!before_record(100, i64::MAX));
        assert!(before_record(0, i64::MAX)); // Only cancellation/finalized snapshot releases it.
    }
    #[test]
    fn lifecycle_all_pairs_reject_skip_replay_and_terminal_escape() {
        let stages = [Stage::Draft, Stage::Scheduled, Stage::SnapshotPending, Stage::Snapshotted,
            Stage::Calculated, Stage::AwaitingApproval, Stage::Approved, Stage::Funded,
            Stage::Executing, Stage::Settled, Stage::Finalized, Stage::Cancelled];
        // Independent acceptance table: normal flow, Scheduled cancellation,
        // and single-holder settlement which skips the partial Executing stage.
        let allowed = [(0, 1), (1, 2), (1, 11), (2, 3), (3, 4), (4, 5),
            (5, 6), (6, 7), (7, 8), (7, 9), (8, 9), (9, 10)];
        for (from_index, from) in stages.iter().enumerate() {
            for (to_index, to) in stages.iter().enumerate() {
                assert_eq!(valid_transition(*from, *to), allowed.contains(&(from_index, to_index)),
                    "unexpected transition {from:?} -> {to:?}");
            }
        }
    }
    #[test]
    fn coupon_boundaries_and_aggregate_rounding() {
        assert_eq!(coupon_minor(0, u64::MAX, 10_000, 1).unwrap(), 0);
        assert_eq!(coupon_minor(u64::MAX, 1, 10_000, 1).unwrap(), u64::MAX);
        assert_eq!(coupon_minor(u64::MAX, 1, 0, 1).unwrap(), 0);
        assert!(coupon_minor(1, 1, 10_001, 1).is_err());
        // Round each holder, then sum: aggregating first would overpay one minor unit.
        assert_eq!(coupon_minor(1, 1, 5000, 1).unwrap() * 2, 0);
        assert_eq!(coupon_minor(2, 1, 5000, 1).unwrap(), 1);
    }
    #[test]
    fn coupon_deterministic_grid_matches_independent_integer_formula() {
        for units in [0u64, 1, 2, 17, 1000, u32::MAX as u64] {
            for face in [1u64, 101, 100_000] {
                for bps in [0u16, 1, 333, 1000, 10_000] {
                    for periods in [1u16, 2, 3, u16::MAX] {
                        let expected = (units as u128 * face as u128 * bps as u128 / 10_000 / periods as u128) as u64;
                        assert_eq!(coupon_minor(units, face, bps, periods).unwrap(), expected);
                    }
                }
            }
        }
    }
}
