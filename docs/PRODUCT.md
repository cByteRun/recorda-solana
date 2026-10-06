# Product context — Recorda

This document explains the domain and product positioning. [TZ](TZ.md) and its [REQUIREMENTS annex](REQUIREMENTS.md) define the requirements. [README](../README.md) gives the short pitch, example and quick validation; [ROADMAP](ROADMAP.md) records current delivery.

## The domain distinction

A tokenized bond changes owners throughout its life. A corporate action creates a right from ownership at a particular cutoff. Those are different facts: **current balance ≠ entitlement balance**.

A later sale changes who owns the bond today; it must not rewrite a coupon already earned at the record date. The same distinction applies to voting power and redemption eligibility. [TZ §9](TZ.md#9-record-date--critical-mechanism) defines the record-date mechanism; [TZ §22](TZ.md#22-demo-dataset) fixes the demonstration inputs and expected result.

## Why this matters to market infrastructure

Traditional securities infrastructure already has registries and corporate-action processes. The challenge is to make the lifecycle of an instrument whose ownership lives on Solana operational on that infrastructure, while keeping eligibility, calculation, authorization and outcome linked.

Recorda is positioned as a B2B servicing layer for market operators, issuers/paying agents and depository infrastructure. Custodians and brokers are potential integration channels; holders benefit from explainable rights, and auditors from traceable outcomes. Formal roles and permissions are maintained in [REQUIREMENTS §6](REQUIREMENTS.md#6-users-and-roles); role-specific value and the economic hypothesis are in [TZ §4](TZ.md#4-value-and-expected-impact).

## A useful analogy

Payroll turns an employee's state at a cutoff into an approved payment and a payslip. Recorda applies the same servicing pattern to holders: ownership at a record date creates a right, followed by controlled execution and a receipt. The analogy explains the workflow; financial formulas and acceptance are defined by the specification.

## Product differentiation

Token-2022 supplies asset primitives such as minting, accounts and transfers. Recorda's domain layer connects historical ownership to a right and its execution history. The product must explain **why a holder was entitled**, **who approved execution** and **what actually happened**, even after ownership changes.

Required scenarios and acceptance are defined once in the annex:

- [Coupon payment](REQUIREMENTS.md#12-required-scenario-a--coupon-payment).
- [Bond redemption](REQUIREMENTS.md#13-required-scenario-b--bond-redemption).
- [Bondholder voting](REQUIREMENTS.md#14-required-scenario-c--bondholder-voting).

Implementation/trust boundaries belong in [ARCHITECTURE](ARCHITECTURE.md); verified features, unfinished work and test evidence belong in [ROADMAP](ROADMAP.md#verification-and-gaps). A successful model demonstration and a verified on-chain outcome are distinct evidence.

## Product decisions

Use [TZ §30](TZ.md#30-architectural-decision-principle) to decide whether a feature belongs in scope, [§25–26](TZ.md#25-outside-mvp-scope) for exclusions/priorities, and [§28](TZ.md#28-primary-mvp-success-metric) for success metrics. The presentation narrative is maintained in [TZ §29](TZ.md#29-critical-demo-narrative), rather than repeated here.
