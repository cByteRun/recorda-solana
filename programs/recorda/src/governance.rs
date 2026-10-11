//! Role-separated, threshold governance. Approved intents bind exact CPI bytes and account metas.
use super::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct RoleSet {
    pub owners: [Pubkey; 5],
    pub threshold: u8,
}
#[account]
#[derive(InitSpace)]
pub struct Governance {
    pub instrument: Pubkey,
    pub issuer: Pubkey,
    pub signer: Pubkey,
    pub signer_bump: u8,
    pub face: u64,
    pub rate: u16,
    pub frequency: u16,
    pub maturity: i64,
    pub roles: [RoleSet; 4],
    pub terms_version: u32,
    pub metadata_uri: [u8; 128],
    pub metadata_hash: [u8; 32],
    pub terms_hash: [u8; 32],
    pub bump: u8,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct IntentMeta {
    pub key: Pubkey,
    pub writable: bool,
}
#[account]
#[derive(InitSpace)]
pub struct GovernanceIntent {
    pub governance: Pubkey,
    pub id: u64,
    pub role: u8,
    pub digest: [u8; 32],
    pub approvals: u8,
    pub executed: bool,
    pub expires_at: i64,
    #[max_len(512)]
    pub data: Vec<u8>,
    #[max_len(24)]
    pub accounts: Vec<IntentMeta>,
}
#[account]
#[derive(InitSpace)]
pub struct EligibilityV2 {
    pub instrument: Pubkey,
    pub holder: Pubkey,
    pub version: u32,
    pub expires_at: i64,
    pub frozen: bool,
    pub group: u16,
    pub jurisdiction: u16,
}
#[event]
pub struct TermsChanged {
    pub instrument: Pubkey,
    pub version: u32,
    pub metadata_hash: [u8; 32],
    pub terms_hash: [u8; 32],
    pub slot: u64,
}
#[event]
pub struct EligibilityChanged {
    pub instrument: Pubkey,
    pub holder: Pubkey,
    pub version: u32,
    pub expires_at: i64,
    pub frozen: bool,
    pub slot: u64,
}
fn member(role: &RoleSet, key: Pubkey) -> Result<u8> {
    role.owners
        .iter()
        .position(|owner| *owner == key && key != Pubkey::default())
        .map(|index| 1 << index)
        .ok_or(error!(Fault::Eligibility))
}
fn role_for(data: &[u8]) -> Result<u8> {
    require!(data.len() >= 8, Fault::Parameters);
    let names: [(&str, u8); 27] = [
        ("register_holder", 1),
        ("set_holder_approved", 1),
        ("set_eligibility_v2", 1),
        ("modify_terms_v2", 0),
        ("create_coupon_disabled", 0),
        ("create_action_v2", 0),
        ("reserve_period_v2", 0),
        ("release_period_v2", 0),
        ("cancel_action", 0),
        ("cancel_v2", 0),
        ("begin_snapshot", 0),
        ("begin_v2", 0),
        ("snapshot_holder", 0),
        ("capture_v2", 0),
        ("finalize_snapshot", 0),
        ("finish_snapshot_v2", 0),
        ("calculate_entitlement", 0),
        ("calculate_v2", 0),
        ("approve_action", 2),
        ("approve_v2", 2),
        ("create_vault_v2", 3),
        ("mark_funded", 3),
        ("funded_v2", 3),
        ("settle_v2", 3),
        ("settle_holder", 3),
        ("finish_vote_v2", 0),
        ("finalize_v2", 0),
    ];
    for (name, role) in names {
        if hashv(&[format!("global:{name}").as_bytes()]).to_bytes()[..8] == data[..8] {
            return Ok(role);
        }
    }
    for (name, role) in [
        ("consume_period_v2", 0),
        ("finalize_action", 0),
        ("create_distribution", 0),
        ("approve_distribution", 2),
        ("fund_distribution", 3),
        ("reclaim_distribution", 3),
        ("propose_external_v2", 0),
    ] {
        if hashv(&[format!("global:{name}").as_bytes()]).to_bytes()[..8] == data[..8] {
            return Ok(role);
        }
    }
    err!(Fault::Parameters)
}
pub fn configure(
    ctx: Context<ConfigureGovernance>,
    roles: [RoleSet; 4],
    metadata_uri: [u8; 128],
    metadata_hash: [u8; 32],
    terms_hash: [u8; 32],
) -> Result<()> {
    require!(
        !ctx.accounts.instrument.sealed
            && ctx.accounts.instrument.active_snapshot == Pubkey::default()
            && ctx.accounts.instrument.pending_record_timestamp == 0
            && !ctx.accounts.instrument.snapshot_pending,
        Fault::Locked
    );
    for role in &roles {
        let unique: std::collections::BTreeSet<_> = role
            .owners
            .iter()
            .filter(|p| **p != Pubkey::default())
            .collect();
        require!(
            role.threshold > 0
                && role.threshold as usize <= unique.len()
                && unique.len()
                    == role
                        .owners
                        .iter()
                        .filter(|p| **p != Pubkey::default())
                        .count(),
            Fault::Parameters
        );
    }
    require!(
        metadata_hash != [0; 32] && terms_hash != [0; 32],
        Fault::Parameters
    );
    let g = &mut ctx.accounts.governance;
    g.face = ctx.accounts.instrument.face_value_minor;
    g.rate = ctx.accounts.instrument.coupon_bps;
    g.frequency = ctx.accounts.instrument.payments_per_year;
    g.maturity = ctx.accounts.instrument.maturity_timestamp;
    g.issuer = ctx.accounts.authority.key();
    g.instrument = ctx.accounts.instrument.key();
    g.signer = ctx.accounts.signer.key();
    g.signer_bump = ctx.bumps.signer;
    g.roles = roles;
    g.terms_version = 1;
    g.metadata_uri = metadata_uri;
    g.metadata_hash = metadata_hash;
    g.terms_hash = terms_hash;
    g.bump = ctx.bumps.governance;
    // Custody makes legacy signer checks fail closed: only this program can sign for Governance.
    ctx.accounts.instrument.authority = g.signer;
    Ok(())
}
pub fn intent_digest(data: &[u8], accounts: &[AccountInfo]) -> [u8; 32] {
    let mut bytes = Vec::new();
    for a in accounts {
        bytes.extend_from_slice(a.key.as_ref());
        bytes.push(u8::from(a.is_writable));
    }
    hashv(&[b"recorda:intent:v1", data, &bytes]).to_bytes()
}
pub fn propose(ctx: Context<ProposeIntent>, id: u64, data: Vec<u8>, expires_at: i64) -> Result<()> {
    require!(
        data.len() <= 512
            && ctx.remaining_accounts.len() <= 24
            && expires_at > Clock::get()?.unix_timestamp,
        Fault::Parameters
    );
    let role = role_for(&data)?;
    let g = &ctx.accounts.governance;
    require!(
        ctx.remaining_accounts
            .iter()
            .any(|a| a.key() == g.instrument)
            && ctx.remaining_accounts.iter().any(|a| a.key() == g.signer),
        Fault::Account
    );
    let approvals = member(&g.roles[role as usize], ctx.accounts.member.key())?;
    let p = &mut ctx.accounts.intent;
    p.governance = g.key();
    p.id = id;
    p.role = role;
    p.digest = intent_digest(&data, ctx.remaining_accounts);
    p.approvals = approvals;
    p.expires_at = expires_at;
    p.data = data;
    p.accounts = ctx
        .remaining_accounts
        .iter()
        .map(|a| IntentMeta {
            key: a.key(),
            writable: a.is_writable,
        })
        .collect();
    Ok(())
}
pub fn approve_governance_engine(ctx: Context<ApproveIntent>) -> Result<()> {
    let p = &mut ctx.accounts.intent;
    require!(
        !p.executed && Clock::get()?.unix_timestamp < p.expires_at,
        Fault::State
    );
    let bit = member(
        &ctx.accounts.governance.roles[p.role as usize],
        ctx.accounts.member.key(),
    )?;
    require!(p.approvals & bit == 0, Fault::AlreadySettled);
    p.approvals |= bit;
    Ok(())
}
pub fn execute<'info>(
    ctx: Context<'_, '_, '_, 'info, ExecuteIntent<'info>>,
    data: Vec<u8>,
) -> Result<()> {
    let p = &mut ctx.accounts.intent;
    let g = &ctx.accounts.governance;
    require!(
        !p.executed
            && Clock::get()?.unix_timestamp < p.expires_at
            && p.approvals.count_ones() >= g.roles[p.role as usize].threshold as u32,
        Fault::State
    );
    require!(
        role_for(&data)? == p.role && intent_digest(&data, ctx.remaining_accounts) == p.digest,
        Fault::Account
    );
    // Privileged CPI can only act on this instrument; generic recursive governance execution is not allowlisted.
    let accounts = ctx
        .remaining_accounts
        .iter()
        .map(|a| AccountMeta {
            pubkey: a.key(),
            is_writable: a.is_writable,
            is_signer: a.is_signer || a.key() == g.signer,
        })
        .collect();
    p.executed = true;
    let instrument = g.instrument;
    let bump = [g.signer_bump];
    let seeds: &[&[u8]] = &[b"governance-signer", instrument.as_ref(), &bump];
    let mut infos = ctx.remaining_accounts.to_vec();
    infos.push(ctx.accounts.recorda_program.to_account_info());
    invoke_signed(
        &Instruction {
            program_id: crate::ID,
            accounts,
            data,
        },
        &infos,
        &[seeds],
    )?;
    Ok(())
}
pub fn modify(
    ctx: Context<ModifyTermsV2>,
    metadata_uri: [u8; 128],
    metadata_hash: [u8; 32],
    terms_hash: [u8; 32],
    face: u64,
    rate: u16,
    frequency: u16,
    maturity: i64,
) -> Result<()> {
    let i = &mut ctx.accounts.instrument;
    require!(
        i.active_snapshot == Pubkey::default()
            && i.pending_record_timestamp == 0
            && !i.snapshot_pending
            && !i.redeemed,
        Fault::Locked
    );
    require!(
        face > 0
            && rate <= 10000
            && frequency > 0
            && maturity > Clock::get()?.unix_timestamp
            && metadata_hash != [0; 32]
            && terms_hash != [0; 32],
        Fault::Parameters
    );
    let g = &mut ctx.accounts.governance;
    g.terms_version = g.terms_version.checked_add(1).ok_or(Fault::Overflow)?;
    g.metadata_uri = metadata_uri;
    g.metadata_hash = metadata_hash;
    g.terms_hash = terms_hash;
    g.face = face;
    g.rate = rate;
    g.frequency = frequency;
    g.maturity = maturity;
    emit!(TermsChanged {
        instrument: i.key(),
        version: g.terms_version,
        metadata_hash,
        terms_hash,
        slot: Clock::get()?.slot
    });
    Ok(())
}
pub fn set_eligibility(
    ctx: Context<SetEligibilityV2>,
    version: u32,
    expires_at: i64,
    frozen: bool,
    group: u16,
    jurisdiction: u16,
) -> Result<()> {
    require!(
        ctx.accounts.instrument.active_snapshot == Pubkey::default()
            && !ctx.accounts.instrument.snapshot_pending,
        Fault::Locked
    );
    let e = &mut ctx.accounts.eligibility;
    require!(version > e.version, Fault::Parameters);
    e.instrument = ctx.accounts.instrument.key();
    e.holder = ctx.accounts.position.holder;
    e.version = version;
    e.expires_at = expires_at;
    e.frozen = frozen;
    e.group = group;
    e.jurisdiction = jurisdiction;
    emit!(EligibilityChanged {
        instrument: e.instrument,
        holder: e.holder,
        version,
        expires_at,
        frozen,
        slot: Clock::get()?.slot
    });
    Ok(())
}
pub fn check_transfer(
    i: &Instrument,
    instrument: Pubkey,
    from: Pubkey,
    to: Pubkey,
    remaining: &[AccountInfo],
) -> Result<()> {
    check_policy_at(
        i,
        instrument,
        from,
        to,
        remaining,
        Clock::get()?.unix_timestamp,
    )
}
pub fn check_policy_at(
    i: &Instrument,
    instrument: Pubkey,
    from: Pubkey,
    to: Pubkey,
    remaining: &[AccountInfo],
    at: i64,
) -> Result<()> {
    let (governance, _) =
        Pubkey::find_program_address(&[b"governance-signer", instrument.as_ref()], &crate::ID);
    if i.authority != governance {
        return Ok(());
    }
    let mut policies = Vec::new();
    for holder in [from, to] {
        let (address, _) = Pubkey::find_program_address(
            &[b"eligibility-v2", instrument.as_ref(), holder.as_ref()],
            &crate::ID,
        );
        let info = remaining
            .iter()
            .find(|a| a.key() == address)
            .ok_or(Fault::Eligibility)?;
        require_keys_eq!(*info.owner, crate::ID, Fault::Account);
        let bytes = info.try_borrow_data()?;
        let e = EligibilityV2::try_deserialize(&mut &bytes[..])?;
        require!(
            e.instrument == instrument && e.holder == holder && !e.frozen && e.expires_at > at,
            Fault::Eligibility
        );
        policies.push(e);
    }
    require!(
        policies[0].group == policies[1].group
            && policies[0].jurisdiction == policies[1].jurisdiction,
        Fault::Eligibility
    );
    Ok(())
}
pub fn check_snapshot_eligibility(
    i: &Instrument,
    instrument: Pubkey,
    remaining: &[AccountInfo],
    record: i64,
) -> Result<()> {
    let (signer, _) =
        Pubkey::find_program_address(&[b"governance-signer", instrument.as_ref()], &crate::ID);
    if i.authority != signer {
        return Ok(());
    }
    let mut holders = std::collections::BTreeSet::new();
    for info in remaining {
        if *info.owner != crate::ID {
            continue;
        }
        let bytes = info.try_borrow_data()?;
        if bytes.get(..8) != Some(HolderPosition::DISCRIMINATOR) {
            continue;
        }
        let p = HolderPosition::try_deserialize(&mut &bytes[..])?;
        if p.instrument != instrument || !p.approved {
            continue;
        }
        let (address, _) = Pubkey::find_program_address(
            &[b"holder", instrument.as_ref(), p.holder.as_ref()],
            &crate::ID,
        );
        require_keys_eq!(address, info.key(), Fault::Account);
        require!(holders.insert(p.holder), Fault::Supply);
        check_policy_at(i, instrument, p.holder, p.holder, remaining, record)?;
    }
    require!(
        holders.len() == i.approved_count as usize,
        Fault::Eligibility
    );
    Ok(())
}
#[derive(Accounts)]
pub struct ConfigureGovernance<'info> {
    #[account(seeds=[b"governance-signer",instrument.key().as_ref()],bump)]
    pub signer: SystemAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut,seeds=[b"instrument",instrument.mint.as_ref()],bump=instrument.bump,has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(init,payer=authority,space=8+Governance::INIT_SPACE,seeds=[b"governance",instrument.key().as_ref()],bump)]
    pub governance: Box<Account<'info, Governance>>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(id:u64)]
pub struct ProposeIntent<'info> {
    #[account(mut)]
    pub member: Signer<'info>,
    #[account(seeds=[b"governance",governance.instrument.as_ref()],bump=governance.bump)]
    pub governance: Box<Account<'info, Governance>>,
    #[account(init,payer=member,space=8+GovernanceIntent::INIT_SPACE,seeds=[b"intent",governance.key().as_ref(),&id.to_le_bytes()],bump)]
    pub intent: Box<Account<'info, GovernanceIntent>>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct ApproveIntent<'info> {
    pub member: Signer<'info>,
    #[account(seeds=[b"governance",governance.instrument.as_ref()],bump=governance.bump)]
    pub governance: Box<Account<'info, Governance>>,
    #[account(mut,seeds=[b"intent",governance.key().as_ref(),&intent.id.to_le_bytes()],bump,has_one=governance)]
    pub intent: Box<Account<'info, GovernanceIntent>>,
}
#[derive(Accounts)]
pub struct ExecuteIntent<'info> {
    pub recorda_program: Program<'info, crate::program::Recorda>,
    #[account(seeds=[b"governance",governance.instrument.as_ref()],bump=governance.bump)]
    pub governance: Box<Account<'info, Governance>>,
    #[account(mut,seeds=[b"intent",governance.key().as_ref(),&intent.id.to_le_bytes()],bump,has_one=governance)]
    pub intent: Box<Account<'info, GovernanceIntent>>,
}
#[derive(Accounts)]
pub struct ModifyTermsV2<'info> {
    pub authority: Signer<'info>,
    #[account(mut,seeds=[b"instrument",instrument.mint.as_ref()],bump=instrument.bump,has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(mut,seeds=[b"governance",instrument.key().as_ref()],bump=governance.bump,has_one=instrument,constraint=authority.key()==governance.signer @ Fault::Eligibility)]
    pub governance: Box<Account<'info, Governance>>,
}
#[derive(Accounts)]
pub struct SetEligibilityV2<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds=[b"instrument",instrument.mint.as_ref()],bump=instrument.bump,has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(seeds=[b"holder",instrument.key().as_ref(),position.holder.as_ref()],bump,has_one=instrument)]
    pub position: Box<Account<'info, HolderPosition>>,
    #[account(init_if_needed,payer=authority,space=8+EligibilityV2::INIT_SPACE,seeds=[b"eligibility-v2",instrument.key().as_ref(),position.holder.as_ref()],bump)]
    pub eligibility: Box<Account<'info, EligibilityV2>>,
    pub system_program: Program<'info, System>,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn members_have_unique_role_bits_and_default_is_never_a_member() {
        let a = Pubkey::new_unique();
        let b = Pubkey::new_unique();
        let role = RoleSet {
            owners: [
                a,
                b,
                Pubkey::default(),
                Pubkey::default(),
                Pubkey::default(),
            ],
            threshold: 2,
        };
        assert_eq!(member(&role, a).unwrap(), 1);
        assert_eq!(member(&role, b).unwrap(), 2);
        assert!(member(&role, Pubkey::default()).is_err());
        assert!(member(&role, Pubkey::new_unique()).is_err());
    }
    #[test]
    fn role_dispatch_rejects_arbitrary_and_legacy_creation_instructions() {
        let discriminator =
            |name: &str| hashv(&[format!("global:{name}").as_bytes()]).to_bytes()[..8].to_vec();
        for (name, role) in [
            ("create_action_v2", 0),
            ("set_eligibility_v2", 1),
            ("approve_v2", 2),
            ("funded_v2", 3),
        ] {
            assert_eq!(role_for(&discriminator(name)).unwrap(), role);
        }
        assert!(role_for(&discriminator("create_coupon")).is_err());
        assert!(role_for(&discriminator("transfer")).is_err());
        assert!(role_for(&[0; 7]).is_err());
        assert!(role_for(&[0; 8]).is_err());
    }
}
