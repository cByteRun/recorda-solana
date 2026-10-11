//! BondOps operational state. Financial rights remain in the existing action engine.
use super::*;

#[account]
#[derive(InitSpace)]
pub struct OpsWorkspace {
    pub instrument: Pubkey,
    pub admin: Pubkey,
    pub lead_hours: u16,
    pub escalate_hours: u16,
    pub sequence: u64,
    pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct OpsMember {
    pub workspace: Pubkey,
    pub wallet: Pubkey,
    pub role: u8, // 1 Operator, 2 Reviewer, 3 Auditor. Admin is workspace.admin.
    pub active: bool,
    #[max_len(80)]
    pub name: String,
}
#[account]
#[derive(InitSpace)]
pub struct OpsDeadline {
    pub workspace: Pubkey,
    pub action: Pubkey,
    pub due_at: i64,
}
#[account]
#[derive(InitSpace)]
pub struct OpsCase {
    pub workspace: Pubkey,
    pub action: Pubkey,
    pub holder: Pubkey,
    pub owner: Pubkey,
    pub status: u8, // 0 Open, 1 Investigating, 2 Resolved.
    pub created_at: i64,
    pub updated_at: i64,
    #[max_len(240)]
    pub note: String,
    #[max_len(88)]
    pub signature: String, // Reference only; never payment confirmation.
}
#[account]
#[derive(InitSpace)]
pub struct OpsAudit {
    pub workspace: Pubkey,
    pub sequence: u64,
    pub actor: Pubkey,
    pub action: Pubkey,
    pub subject: Pubkey,
    pub kind: u8,
    pub at: i64,
    pub slot: u64,
    #[max_len(240)]
    pub note: String,
}
#[account]
#[derive(InitSpace)]
pub struct OpsNotice {
    pub workspace: Pubkey,
    pub action: Pubkey,
    pub recipient: Pubkey,
    pub kind: u8, // 0 Upcoming, 1 Overdue, 2 Exception, 3 Escalation.
    pub stamp: i64,
    pub subject: Pubkey,
    pub created_at: i64,
    pub read_at: i64,
}

fn authorize(
    workspace: &OpsWorkspace,
    member: &Option<Box<Account<OpsMember>>>,
    actor: Pubkey,
    admin: bool,
) -> Result<()> {
    if actor == workspace.admin {
        return Ok(());
    }
    require!(!admin, Fault::Eligibility);
    let m = member.as_ref().ok_or(error!(Fault::Eligibility))?;
    require!(
        m.active && m.wallet == actor && (m.role == 1 || m.role == 2),
        Fault::Eligibility
    );
    Ok(())
}
fn audit(
    workspace: &mut OpsWorkspace,
    entry: &mut OpsAudit,
    sequence: u64,
    actor: Pubkey,
    action: Pubkey,
    subject: Pubkey,
    kind: u8,
    note: String,
    workspace_key: Pubkey,
) -> Result<()> {
    require!(
        sequence == workspace.sequence && note.len() <= 240,
        Fault::Parameters
    );
    let clock = Clock::get()?;
    *entry = OpsAudit {
        workspace: workspace_key,
        sequence,
        actor,
        action,
        subject,
        kind,
        at: clock.unix_timestamp,
        slot: clock.slot,
        note,
    };
    workspace.sequence = workspace
        .sequence
        .checked_add(1)
        .ok_or(error!(Fault::Parameters))?;
    Ok(())
}
// Decode only program-owned actions and canonical right PDAs, with exact action/holder binding.
fn action_info(info: &AccountInfo, instrument: Pubkey) -> Result<(u8, i64, i64)> {
    require_keys_eq!(*info.owner, crate::ID, Fault::Parameters);
    let data = info.try_borrow_data()?;
    if let Ok(a) = ActionV2::try_deserialize(&mut &data[..]) {
        require_keys_eq!(a.instrument, instrument, Fault::Parameters);
        require_keys_eq!(
            Pubkey::find_program_address(
                &[b"action-v2", instrument.as_ref(), &a.id.to_le_bytes()],
                &crate::ID
            )
            .0,
            info.key(),
            Fault::Parameters
        );
        require!(a.status != Stage::Cancelled, Fault::Parameters);
        return Ok((
            if a.parameters.kind == ActionKind::Coupon {
                0
            } else if a.parameters.kind == ActionKind::Voting {
                2
            } else {
                1
            },
            a.parameters.record_at,
            if a.parameters.kind == ActionKind::Voting {
                a.parameters.closes_at
            } else if a.parameters.kind == ActionKind::Redemption {
                a.maturity
            } else {
                0
            },
        ));
    }
    let a = CorporateAction::try_deserialize(&mut &data[..])?;
    require_keys_eq!(a.instrument, instrument, Fault::Parameters);
    require_keys_eq!(
        Pubkey::find_program_address(
            &[b"action", instrument.as_ref(), &a.id.to_le_bytes()],
            &crate::ID
        )
        .0,
        info.key(),
        Fault::Parameters
    );
    require!(a.status != Stage::Cancelled, Fault::Parameters);
    Ok((0, a.record_timestamp, 0))
}
fn execution(info: &AccountInfo, action: Pubkey, holder: Pubkey) -> Result<bool> {
    require_keys_eq!(*info.owner, crate::ID, Fault::Parameters);
    let data = info.try_borrow_data()?;
    if let Ok(r) = RightV2::try_deserialize(&mut &data[..]) {
        require_keys_eq!(r.action, action, Fault::Parameters);
        require_keys_eq!(r.holder, holder, Fault::Parameters);
        require_keys_eq!(
            Pubkey::find_program_address(
                &[b"right-v2", action.as_ref(), holder.as_ref()],
                &crate::ID
            )
            .0,
            info.key(),
            Fault::Parameters
        );
        require!(r.calculated && r.total > 0, Fault::Parameters);
        return Ok(r.processed);
    }
    let r = EntitlementPosition::try_deserialize(&mut &data[..])?;
    require_keys_eq!(r.action, action, Fault::Parameters);
    require_keys_eq!(r.holder, holder, Fault::Parameters);
    require_keys_eq!(
        Pubkey::find_program_address(
            &[b"entitlement", action.as_ref(), holder.as_ref()],
            &crate::ID
        )
        .0,
        info.key(),
        Fault::Parameters
    );
    require!(r.calculated && r.amount_minor > 0, Fault::Parameters);
    Ok(r.settled)
}
pub fn initialize(ctx: Context<InitializeOps>) -> Result<()> {
    let actor = ctx.accounts.actor.key();
    let issuer = ctx
        .accounts
        .governance
        .as_ref()
        .map(|g| g.issuer == actor && g.signer == ctx.accounts.instrument.authority)
        .unwrap_or(false);
    require!(
        ctx.accounts.instrument.authority == actor || issuer,
        Fault::Eligibility
    );
    ctx.accounts.workspace.set_inner(OpsWorkspace {
        instrument: ctx.accounts.instrument.key(),
        admin: actor,
        lead_hours: 72,
        escalate_hours: 24,
        sequence: 0,
        bump: ctx.bumps.workspace,
    });
    Ok(())
}
pub fn configure_workspace(
    ctx: Context<ConfigureOps>,
    lead: u16,
    escalate: u16,
    sequence: u64,
) -> Result<()> {
    authorize(
        &ctx.accounts.workspace,
        &ctx.accounts.member,
        ctx.accounts.actor.key(),
        true,
    )?;
    require!(
        (1..=720).contains(&lead) && (1..=720).contains(&escalate),
        Fault::Parameters
    );
    let key = ctx.accounts.workspace.key();
    ctx.accounts.workspace.lead_hours = lead;
    ctx.accounts.workspace.escalate_hours = escalate;
    audit(
        &mut ctx.accounts.workspace,
        &mut ctx.accounts.entry,
        sequence,
        ctx.accounts.actor.key(),
        Pubkey::default(),
        Pubkey::default(),
        0,
        format!("Reminder {lead}h; escalation {escalate}h"),
        key,
    )
}
pub fn set_member(
    ctx: Context<SetOpsMember>,
    wallet: Pubkey,
    role: u8,
    name: String,
    active: bool,
    sequence: u64,
) -> Result<()> {
    authorize(
        &ctx.accounts.workspace,
        &None,
        ctx.accounts.actor.key(),
        true,
    )?;
    require!(
        wallet != Pubkey::default()
            && wallet != ctx.accounts.workspace.admin
            && (1..=3).contains(&role)
            && !name.trim().is_empty()
            && name.len() <= 80,
        Fault::Parameters
    );
    let key = ctx.accounts.workspace.key();
    ctx.accounts.target.set_inner(OpsMember {
        workspace: key,
        wallet,
        role,
        active,
        name: name.clone(),
    });
    audit(
        &mut ctx.accounts.workspace,
        &mut ctx.accounts.entry,
        sequence,
        ctx.accounts.actor.key(),
        Pubkey::default(),
        wallet,
        1,
        format!("{name}; role {role}; active {active}"),
        key,
    )
}
pub fn set_deadline(ctx: Context<SetOpsDeadline>, due_at: i64, sequence: u64) -> Result<()> {
    authorize(
        &ctx.accounts.workspace,
        &ctx.accounts.member,
        ctx.accounts.actor.key(),
        false,
    )?;
    let (kind, record_at, _) =
        action_info(&ctx.accounts.action, ctx.accounts.workspace.instrument)?;
    require!(kind == 0 && due_at >= record_at, Fault::Parameters);
    let key = ctx.accounts.workspace.key();
    ctx.accounts.deadline.set_inner(OpsDeadline {
        workspace: key,
        action: ctx.accounts.action.key(),
        due_at,
    });
    audit(
        &mut ctx.accounts.workspace,
        &mut ctx.accounts.entry,
        sequence,
        ctx.accounts.actor.key(),
        ctx.accounts.action.key(),
        ctx.accounts.deadline.key(),
        2,
        format!("Coupon due {due_at} UTC"),
        key,
    )
}
pub fn update_case(
    ctx: Context<UpdateOpsCase>,
    holder: Pubkey,
    owner: Pubkey,
    status: u8,
    note: String,
    sequence: u64,
) -> Result<()> {
    authorize(
        &ctx.accounts.workspace,
        &ctx.accounts.member,
        ctx.accounts.actor.key(),
        false,
    )?;
    require!(
        action_info(&ctx.accounts.action, ctx.accounts.workspace.instrument)?.0 != 2,
        Fault::Parameters
    );
    let processed = execution(&ctx.accounts.right, ctx.accounts.action.key(), holder)?;
    require!(
        status <= 2 && (status != 2 || processed) && !note.trim().is_empty() && note.len() <= 240,
        Fault::Parameters
    );
    if owner != Pubkey::default() && owner != ctx.accounts.workspace.admin {
        let m = ctx
            .accounts
            .assignee
            .as_ref()
            .ok_or(error!(Fault::Eligibility))?;
        require!(
            m.wallet == owner && m.active && m.role != 3,
            Fault::Eligibility
        );
    }
    let key = ctx.accounts.workspace.key();
    let at = Clock::get()?.unix_timestamp;
    let c = &mut ctx.accounts.case;
    if c.created_at == 0 {
        c.created_at = at;
    }
    c.workspace = key;
    c.action = ctx.accounts.action.key();
    c.holder = holder;
    c.owner = owner;
    c.status = status;
    c.updated_at = at;
    c.note = note.clone();
    audit(
        &mut ctx.accounts.workspace,
        &mut ctx.accounts.entry,
        sequence,
        ctx.accounts.actor.key(),
        ctx.accounts.action.key(),
        ctx.accounts.case.key(),
        3,
        note,
        key,
    )
}
pub fn retain_reference(
    ctx: Context<RetainOpsReference>,
    holder: Pubkey,
    signature: String,
    sequence: u64,
) -> Result<()> {
    authorize(
        &ctx.accounts.workspace,
        &ctx.accounts.member,
        ctx.accounts.actor.key(),
        false,
    )?;
    require!(
        action_info(&ctx.accounts.action, ctx.accounts.workspace.instrument)?.0 != 2
            && !execution(&ctx.accounts.right, ctx.accounts.action.key(), holder)?,
        Fault::Parameters
    );
    require!(
        (64..=88).contains(&signature.len())
            && signature.bytes().all(|b| {
                b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz".contains(&b)
            }),
        Fault::Parameters
    );
    let key = ctx.accounts.workspace.key();
    let c = &mut ctx.accounts.case;
    require!(
        c.signature.is_empty() || c.signature == signature,
        Fault::Locked
    );
    let at = Clock::get()?.unix_timestamp;
    if c.created_at == 0 {
        c.created_at = at;
    }
    c.workspace = key;
    c.action = ctx.accounts.action.key();
    c.holder = holder;
    c.updated_at = at;
    c.signature = signature.clone();
    audit(
        &mut ctx.accounts.workspace,
        &mut ctx.accounts.entry,
        sequence,
        ctx.accounts.actor.key(),
        ctx.accounts.action.key(),
        ctx.accounts.case.key(),
        4,
        signature,
        key,
    )
}
pub fn create_notice(
    ctx: Context<CreateOpsNotice>,
    recipient: Pubkey,
    kind: u8,
    stamp: i64,
    subject: Pubkey,
) -> Result<()> {
    authorize(
        &ctx.accounts.workspace,
        &ctx.accounts.member,
        ctx.accounts.actor.key(),
        false,
    )?;
    if recipient != ctx.accounts.workspace.admin {
        let m = ctx
            .accounts
            .recipient_member
            .as_ref()
            .ok_or(error!(Fault::Eligibility))?;
        require!(
            m.active && m.wallet == recipient && m.role != 3,
            Fault::Eligibility
        );
    }
    let (action_kind, _, native_due) =
        action_info(&ctx.accounts.action, ctx.accounts.workspace.instrument)?;
    let clock = Clock::get()?;
    if kind < 2 {
        let due = if action_kind == 0 {
            ctx.accounts
                .deadline
                .as_ref()
                .ok_or(error!(Fault::Parameters))?
                .due_at
        } else {
            native_due
        };
        require!(
            due > 0 && stamp == due && subject == ctx.accounts.action.key(),
            Fault::Parameters
        );
        require!(
            if kind == 0 {
                clock.unix_timestamp <= stamp
                    && stamp - clock.unix_timestamp
                        <= i64::from(ctx.accounts.workspace.lead_hours) * 3600
            } else {
                clock.unix_timestamp > stamp
            },
            Fault::Parameters
        );
    } else {
        let case = ctx
            .accounts
            .case
            .as_ref()
            .ok_or(error!(Fault::Parameters))?;
        require!(
            subject == case.key()
                && kind <= 3
                && case.status != 2
                && stamp == case.created_at
                && (case.owner == recipient
                    || case.owner == Pubkey::default()
                        && recipient == ctx.accounts.workspace.admin),
            Fault::Parameters
        );
        let holder = case.holder;
        require!(
            !execution(
                &ctx.accounts
                    .right
                    .as_ref()
                    .ok_or(error!(Fault::Parameters))?
                    .to_account_info(),
                ctx.accounts.action.key(),
                holder
            )?,
            Fault::Parameters
        );
        if kind == 3 {
            require!(
                clock.unix_timestamp - stamp
                    >= i64::from(ctx.accounts.workspace.escalate_hours) * 3600,
                Fault::Parameters
            );
        }
    }
    ctx.accounts.notice.set_inner(OpsNotice {
        workspace: ctx.accounts.workspace.key(),
        action: ctx.accounts.action.key(),
        recipient,
        kind,
        stamp,
        subject,
        created_at: clock.unix_timestamp,
        read_at: 0,
    });
    Ok(())
}
pub fn read_notice(ctx: Context<ReadOpsNotice>) -> Result<()> {
    ctx.accounts.notice.read_at = Clock::get()?.unix_timestamp;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeOps<'info> {
    #[account(mut)]
    pub actor: Signer<'info>,
    #[account(seeds=[b"instrument", instrument.mint.as_ref()], bump=instrument.bump)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(seeds=[b"governance", instrument.key().as_ref()], bump, constraint=governance.instrument==instrument.key())]
    pub governance: Option<Box<Account<'info, Governance>>>,
    #[account(init, payer=actor, space=8+OpsWorkspace::INIT_SPACE, seeds=[b"ops-workspace", instrument.key().as_ref()], bump)]
    pub workspace: Box<Account<'info, OpsWorkspace>>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(lead_hours: u16, escalate_hours: u16, sequence: u64)]
pub struct ConfigureOps<'info> {
    #[account(mut)]
    pub actor: Signer<'info>,
    #[account(mut, seeds=[b"ops-workspace", workspace.instrument.as_ref()], bump=workspace.bump)]
    pub workspace: Box<Account<'info, OpsWorkspace>>,
    #[account(seeds=[b"ops-member", workspace.key().as_ref(), actor.key().as_ref()], bump, constraint=member.workspace==workspace.key())]
    pub member: Option<Box<Account<'info, OpsMember>>>,
    #[account(init, payer=actor, space=8+OpsAudit::INIT_SPACE, seeds=[b"ops-audit", workspace.key().as_ref(), &sequence.to_le_bytes()], bump)]
    pub entry: Box<Account<'info, OpsAudit>>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(wallet: Pubkey, role: u8, name: String, active: bool, sequence: u64)]
pub struct SetOpsMember<'info> {
    #[account(mut)]
    pub actor: Signer<'info>,
    #[account(mut, seeds=[b"ops-workspace", workspace.instrument.as_ref()], bump=workspace.bump)]
    pub workspace: Box<Account<'info, OpsWorkspace>>,
    #[account(init_if_needed, payer=actor, space=8+OpsMember::INIT_SPACE, seeds=[b"ops-member", workspace.key().as_ref(), wallet.as_ref()], bump)]
    pub target: Box<Account<'info, OpsMember>>,
    #[account(init, payer=actor, space=8+OpsAudit::INIT_SPACE, seeds=[b"ops-audit", workspace.key().as_ref(), &sequence.to_le_bytes()], bump)]
    pub entry: Box<Account<'info, OpsAudit>>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(due_at: i64, sequence: u64)]
pub struct SetOpsDeadline<'info> {
    #[account(mut)]
    pub actor: Signer<'info>,
    #[account(mut, seeds=[b"ops-workspace", workspace.instrument.as_ref()], bump=workspace.bump)]
    pub workspace: Box<Account<'info, OpsWorkspace>>,
    #[account(seeds=[b"ops-member", workspace.key().as_ref(), actor.key().as_ref()], bump, constraint=member.workspace==workspace.key())]
    pub member: Option<Box<Account<'info, OpsMember>>>,
    /// CHECK: program owner, discriminator, instrument and canonical PDA checked in handler.
    pub action: UncheckedAccount<'info>,
    #[account(init_if_needed, payer=actor, space=8+OpsDeadline::INIT_SPACE, seeds=[b"ops-deadline", workspace.key().as_ref(), action.key().as_ref()], bump)]
    pub deadline: Box<Account<'info, OpsDeadline>>,
    #[account(init, payer=actor, space=8+OpsAudit::INIT_SPACE, seeds=[b"ops-audit", workspace.key().as_ref(), &sequence.to_le_bytes()], bump)]
    pub entry: Box<Account<'info, OpsAudit>>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(holder: Pubkey, owner: Pubkey, status: u8, note: String, sequence: u64)]
pub struct UpdateOpsCase<'info> {
    #[account(mut)]
    pub actor: Signer<'info>,
    #[account(mut, seeds=[b"ops-workspace", workspace.instrument.as_ref()], bump=workspace.bump)]
    pub workspace: Box<Account<'info, OpsWorkspace>>,
    #[account(seeds=[b"ops-member", workspace.key().as_ref(), actor.key().as_ref()], bump, constraint=member.workspace==workspace.key())]
    pub member: Option<Box<Account<'info, OpsMember>>>,
    #[account(seeds=[b"ops-member", workspace.key().as_ref(), assignee.wallet.as_ref()], bump, constraint=assignee.workspace==workspace.key())]
    pub assignee: Option<Box<Account<'info, OpsMember>>>,
    /// CHECK: validated by action_info.
    pub action: UncheckedAccount<'info>,
    /// CHECK: exact canonical right/action/holder validated by execution.
    pub right: UncheckedAccount<'info>,
    #[account(init_if_needed, payer=actor, space=8+OpsCase::INIT_SPACE, seeds=[b"ops-case", workspace.key().as_ref(), action.key().as_ref(), holder.as_ref()], bump)]
    pub case: Box<Account<'info, OpsCase>>,
    #[account(init, payer=actor, space=8+OpsAudit::INIT_SPACE, seeds=[b"ops-audit", workspace.key().as_ref(), &sequence.to_le_bytes()], bump)]
    pub entry: Box<Account<'info, OpsAudit>>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(holder: Pubkey, signature: String, sequence: u64)]
pub struct RetainOpsReference<'info> {
    #[account(mut)]
    pub actor: Signer<'info>,
    #[account(mut, seeds=[b"ops-workspace", workspace.instrument.as_ref()], bump=workspace.bump)]
    pub workspace: Box<Account<'info, OpsWorkspace>>,
    #[account(seeds=[b"ops-member", workspace.key().as_ref(), actor.key().as_ref()], bump, constraint=member.workspace==workspace.key())]
    pub member: Option<Box<Account<'info, OpsMember>>>,
    /// CHECK: validated by action_info.
    pub action: UncheckedAccount<'info>,
    /// CHECK: validated by execution.
    pub right: UncheckedAccount<'info>,
    #[account(init_if_needed, payer=actor, space=8+OpsCase::INIT_SPACE, seeds=[b"ops-case", workspace.key().as_ref(), action.key().as_ref(), holder.as_ref()], bump)]
    pub case: Box<Account<'info, OpsCase>>,
    #[account(init, payer=actor, space=8+OpsAudit::INIT_SPACE, seeds=[b"ops-audit", workspace.key().as_ref(), &sequence.to_le_bytes()], bump)]
    pub entry: Box<Account<'info, OpsAudit>>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(recipient: Pubkey, kind: u8, stamp: i64, subject: Pubkey)]
pub struct CreateOpsNotice<'info> {
    #[account(mut)]
    pub actor: Signer<'info>,
    #[account(seeds=[b"ops-workspace", workspace.instrument.as_ref()], bump=workspace.bump)]
    pub workspace: Box<Account<'info, OpsWorkspace>>,
    #[account(seeds=[b"ops-member", workspace.key().as_ref(), actor.key().as_ref()], bump, constraint=member.workspace==workspace.key())]
    pub member: Option<Box<Account<'info, OpsMember>>>,
    #[account(seeds=[b"ops-member", workspace.key().as_ref(), recipient.as_ref()], bump, constraint=recipient_member.workspace==workspace.key())]
    pub recipient_member: Option<Box<Account<'info, OpsMember>>>,
    /// CHECK: validated by action_info.
    pub action: UncheckedAccount<'info>,
    #[account(seeds=[b"ops-deadline", workspace.key().as_ref(), action.key().as_ref()], bump, constraint=deadline.workspace==workspace.key() && deadline.action==action.key())]
    pub deadline: Option<Box<Account<'info, OpsDeadline>>>,
    #[account(seeds=[b"ops-case", workspace.key().as_ref(), action.key().as_ref(), case.holder.as_ref()], bump, constraint=case.workspace==workspace.key() && case.action==action.key())]
    pub case: Option<Box<Account<'info, OpsCase>>>,
    /// CHECK: canonical right is checked for case notices; omitted for deadlines.
    pub right: Option<UncheckedAccount<'info>>,
    #[account(init, payer=actor, space=8+OpsNotice::INIT_SPACE, seeds=[b"ops-notice", workspace.key().as_ref(), action.key().as_ref(), recipient.as_ref(), &[kind], &stamp.to_le_bytes(), subject.as_ref()], bump)]
    pub notice: Box<Account<'info, OpsNotice>>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct ReadOpsNotice<'info> {
    pub actor: Signer<'info>,
    #[account(mut, constraint=notice.recipient==actor.key())]
    pub notice: Box<Account<'info, OpsNotice>>,
}
