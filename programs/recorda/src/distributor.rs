//! Domain-bound, holder-signed claim distribution. Roots are explicitly approved commitments.
use super::*;
use anchor_spl::token_2022::CloseAccount;
#[account]
#[derive(InitSpace)]
pub struct Distribution {
    pub instrument: Pubkey,
    pub authority: Pubkey,
    pub payment_mint: Pubkey,
    pub id: u64,
    pub version: u8,
    pub record_slot: u64,
    pub policy_version: u32,
    pub root: [u8; 32],
    pub manifest_hash: [u8; 32],
    pub provenance_hash: [u8; 32],
    pub total: u64,
    pub leaves: u32,
    pub deadline: i64,
    pub approved: bool,
    pub funded: bool,
    pub claimed: u64,
    pub claimed_leaves: u32,
    pub funded_amount: u64,
    pub reclaimed: u64,
    pub closed: bool,
    pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct ClaimRecord {
    pub distribution: Pubkey,
    pub holder: Pubkey,
    pub index: u32,
    pub destination: Pubkey,
    pub amount: u64,
    pub slot: u64,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DistributionParameters {
    pub record_slot: u64,
    pub policy_version: u32,
    pub root: [u8; 32],
    pub manifest_hash: [u8; 32],
    pub provenance_hash: [u8; 32],
    pub total: u64,
    pub leaves: u32,
    pub deadline: i64,
}
#[event]
pub struct DistributionEvent {
    pub distribution: Pubkey,
    pub holder: Pubkey,
    pub amount: u64,
    pub claimed: u64,
    pub reclaimed: u64,
    pub slot: u64,
}
pub fn leaf(
    distribution: Pubkey,
    instrument: Pubkey,
    mint: Pubkey,
    index: u32,
    holder: Pubkey,
    destination: Pubkey,
    amount: u64,
) -> [u8; 32] {
    hashv(&[
        b"recorda:claim:v1",
        distribution.as_ref(),
        instrument.as_ref(),
        mint.as_ref(),
        &index.to_le_bytes(),
        holder.as_ref(),
        destination.as_ref(),
        &amount.to_le_bytes(),
    ])
    .to_bytes()
}
pub fn verify(root: [u8; 32], mut current: [u8; 32], proof: &[[u8; 32]]) -> bool {
    if proof.len() > 32 {
        return false;
    }
    for sibling in proof {
        current = if current <= *sibling {
            hashv(&[b"recorda:merkle:v1", &current, sibling]).to_bytes()
        } else {
            hashv(&[b"recorda:merkle:v1", sibling, &current]).to_bytes()
        };
    }
    current == root
}
pub fn create_distribution_engine(
    ctx: Context<CreateDistribution>,
    id: u64,
    p: DistributionParameters,
) -> Result<()> {
    let clock = Clock::get()?;
    require!(
        p.record_slot > 0
            && p.record_slot <= clock.slot
            && p.policy_version > 0
            && p.leaves > 0
            && p.root != [0; 32]
            && p.manifest_hash != [0; 32]
            && p.provenance_hash != [0; 32]
            && p.deadline > clock.unix_timestamp,
        Fault::Parameters
    );
    let d = &mut ctx.accounts.distribution;
    d.instrument = ctx.accounts.instrument.key();
    d.authority = ctx.accounts.authority.key();
    d.payment_mint = ctx.accounts.instrument.payment_mint;
    d.id = id;
    d.version = 1;
    d.record_slot = p.record_slot;
    d.policy_version = p.policy_version;
    d.root = p.root;
    d.manifest_hash = p.manifest_hash;
    d.provenance_hash = p.provenance_hash;
    d.total = p.total;
    d.leaves = p.leaves;
    d.deadline = p.deadline;
    d.bump = ctx.bumps.distribution;
    Ok(())
}
pub fn approve_distribution_engine(ctx: Context<ManageDistribution>) -> Result<()> {
    let d = &mut ctx.accounts.distribution;
    require!(
        !d.approved && !d.closed && Clock::get()?.unix_timestamp < d.deadline,
        Fault::State
    );
    d.approved = true;
    Ok(())
}
pub fn fund(ctx: Context<ManageDistribution>) -> Result<()> {
    let d = &mut ctx.accounts.distribution;
    require!(
        d.approved && !d.funded && !d.closed && Clock::get()?.unix_timestamp < d.deadline,
        Fault::State
    );
    require!(
        ctx.accounts.vault.amount >= d.total,
        Fault::InsufficientFunds
    );
    d.funded = true;
    d.funded_amount = ctx.accounts.vault.amount;
    Ok(())
}
pub fn claim(
    ctx: Context<ClaimDistribution>,
    index: u32,
    amount: u64,
    proof: Vec<[u8; 32]>,
) -> Result<()> {
    let d = &mut ctx.accounts.distribution;
    let now = Clock::get()?;
    require!(
        d.approved && d.funded && !d.closed && now.unix_timestamp < d.deadline && index < d.leaves,
        Fault::State
    );
    require!(
        verify(
            d.root,
            leaf(
                d.key(),
                d.instrument,
                d.payment_mint,
                index,
                ctx.accounts.holder.key(),
                ctx.accounts.destination.key(),
                amount
            ),
            &proof
        ),
        Fault::Account
    );
    let claimed = d.claimed.checked_add(amount).ok_or(Fault::Overflow)?;
    require!(
        claimed <= d.total && ctx.accounts.vault.amount >= amount,
        Fault::InsufficientFunds
    );
    if amount > 0 {
        let instrument = d.instrument;
        let id = d.id.to_le_bytes();
        let bump = [d.bump];
        let seeds: &[&[u8]] = &[b"distribution", instrument.as_ref(), &id, &bump];
        token_2022::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    mint: ctx.accounts.payment_mint.to_account_info(),
                    authority: d.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            ctx.accounts.payment_mint.decimals,
        )?;
    }
    d.claimed = claimed;
    d.claimed_leaves = d.claimed_leaves.checked_add(1).ok_or(Fault::Overflow)?;
    let r = &mut ctx.accounts.claim;
    r.distribution = d.key();
    r.holder = ctx.accounts.holder.key();
    r.index = index;
    r.destination = ctx.accounts.destination.key();
    r.amount = amount;
    r.slot = now.slot;
    emit!(DistributionEvent {
        distribution: d.key(),
        holder: r.holder,
        amount,
        claimed: d.claimed,
        reclaimed: d.reclaimed,
        slot: now.slot
    });
    Ok(())
}
pub fn reclaim(ctx: Context<ReclaimDistribution>) -> Result<()> {
    let d = &mut ctx.accounts.distribution;
    require!(
        d.approved && d.funded && !d.closed && Clock::get()?.unix_timestamp >= d.deadline,
        Fault::State
    );
    let amount = ctx.accounts.vault.amount;
    let instrument = d.instrument;
    let id = d.id.to_le_bytes();
    let bump = [d.bump];
    let seeds: &[&[u8]] = &[b"distribution", instrument.as_ref(), &id, &bump];
    if amount > 0 {
        token_2022::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    mint: ctx.accounts.payment_mint.to_account_info(),
                    authority: d.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            ctx.accounts.payment_mint.decimals,
        )?;
    }
    // Include unsolicited top-ups/dust observed after the funding checkpoint.
    d.funded_amount = d.claimed.checked_add(amount).ok_or(Fault::Overflow)?;
    d.reclaimed = amount;
    token_2022::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.authority.to_account_info(),
            authority: d.to_account_info(),
        },
        &[seeds],
    ))?;
    d.closed = true;
    emit!(DistributionEvent {
        distribution: d.key(),
        holder: ctx.accounts.authority.key(),
        amount,
        claimed: d.claimed,
        reclaimed: amount,
        slot: Clock::get()?.slot
    });
    Ok(())
}
#[derive(Accounts)]
#[instruction(id:u64)]
pub struct CreateDistribution<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds=[b"instrument",instrument.mint.as_ref()],bump=instrument.bump,has_one=authority)]
    pub instrument: Box<Account<'info, Instrument>>,
    #[account(init,payer=authority,space=8+Distribution::INIT_SPACE,seeds=[b"distribution",instrument.key().as_ref(),&id.to_le_bytes()],bump)]
    pub distribution: Box<Account<'info, Distribution>>,
    #[account(address=instrument.payment_mint,mint::token_program=token_program)]
    pub payment_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(init,payer=authority,seeds=[b"claim-vault",distribution.key().as_ref()],bump,token::mint=payment_mint,token::authority=distribution,token::token_program=token_program)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct ManageDistribution<'info> {
    pub authority: Signer<'info>,
    #[account(mut,seeds=[b"distribution",distribution.instrument.as_ref(),&distribution.id.to_le_bytes()],bump=distribution.bump,has_one=authority)]
    pub distribution: Box<Account<'info, Distribution>>,
    #[account(seeds=[b"claim-vault",distribution.key().as_ref()],bump,token::token_program=token_program,constraint=vault.mint==distribution.payment_mint @ Fault::Account,constraint=vault.owner==distribution.key() @ Fault::Account)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
}
#[derive(Accounts)]
#[instruction(index:u32)]
pub struct ClaimDistribution<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,
    #[account(mut,seeds=[b"distribution",distribution.instrument.as_ref(),&distribution.id.to_le_bytes()],bump=distribution.bump)]
    pub distribution: Box<Account<'info, Distribution>>,
    #[account(init,payer=holder,space=8+ClaimRecord::INIT_SPACE,seeds=[b"claim",distribution.key().as_ref(),&index.to_le_bytes()],bump)]
    pub claim: Box<Account<'info, ClaimRecord>>,
    #[account(address=distribution.payment_mint,mint::token_program=token_program)]
    pub payment_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut,seeds=[b"claim-vault",distribution.key().as_ref()],bump,token::mint=payment_mint,token::token_program=token_program,constraint=vault.owner==distribution.key() @ Fault::Account)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut,token::mint=payment_mint,token::token_program=token_program,constraint=destination.owner==holder.key() @ Fault::Account,constraint=destination.key()!=vault.key() @ Fault::Account)]
    pub destination: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct ReclaimDistribution<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut,seeds=[b"distribution",distribution.instrument.as_ref(),&distribution.id.to_le_bytes()],bump=distribution.bump,has_one=authority)]
    pub distribution: Box<Account<'info, Distribution>>,
    #[account(address=distribution.payment_mint,mint::token_program=token_program)]
    pub payment_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut,seeds=[b"claim-vault",distribution.key().as_ref()],bump,token::mint=payment_mint,token::token_program=token_program,constraint=vault.owner==distribution.key() @ Fault::Account)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut,token::mint=payment_mint,token::token_program=token_program,constraint=destination.owner==authority.key() @ Fault::Account,constraint=destination.key()!=vault.key() @ Fault::Account)]
    pub destination: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn domain_bound_leaf_and_proof() {
        let d = Pubkey::new_unique();
        let i = Pubkey::new_unique();
        let m = Pubkey::new_unique();
        let h = Pubkey::new_unique();
        let dest = Pubkey::new_unique();
        let a = leaf(d, i, m, 0, h, dest, 10);
        let b = leaf(d, i, m, 1, h, dest, 20);
        let root = if a <= b {
            hashv(&[b"recorda:merkle:v1", &a, &b]).to_bytes()
        } else {
            hashv(&[b"recorda:merkle:v1", &b, &a]).to_bytes()
        };
        assert!(verify(root, a, &[b]));
        assert!(!verify(root, leaf(d, i, m, 0, h, dest, 11), &[b]));
        assert!(!verify(
            root,
            leaf(Pubkey::new_unique(), i, m, 0, h, dest, 10),
            &[b]
        ));
        assert!(!verify(root, a, &vec![b; 33]));
    }
}
