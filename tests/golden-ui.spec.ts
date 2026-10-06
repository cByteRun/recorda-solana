import { expect, test as base } from "@playwright/test";

const test = base.extend<{ runtimeErrors: string[] }>({
  runtimeErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await use(errors);
    expect(errors, "browser runtime errors").toEqual([]);
  }, { auto: true }]
});

test.describe("Recorda React golden UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("communicates the product axis and trust boundary", async ({ page }) => {
    await expect(
      page.getByRole("heading", {
        name: /Record Date → Right → Controlled Execution → Verifiable Proof/i
      })
    ).toBeVisible();

    await expect(page.getByText(/Payroll engine for tokenized securities/i)).toBeVisible();
    await expect(page.getByText(/Browser\/Memo → CorporateAction PDA/i)).toBeVisible();
  });

  test("golden oracle passes without a wallet", async ({ page }) => {
    await expect(page.getByTestId("golden-oracle")).toBeVisible();
    await expect(page.getByTestId("golden-pass")).toHaveText(/PASS/);

    const actual = await page.getByTestId("golden-actual").textContent();
    expect(actual).toContain('"A": 6');
    expect(actual).toContain('"B": 9');
    expect(actual).toContain('"A": 50000');
    expect(actual).toContain('"B": 25000');
    expect(actual).toContain('"C": 10000');
    expect(actual).toContain('"D": 0');
    await expect(page.getByTestId("golden-oracle")).toContainText("SIMULATED");
  });

  test("wallet-dependent actions are gated before Phantom is connected", async ({ page }) => {
    await expect(page.getByTestId("connect-wallet")).toBeEnabled();
    await expect(page.getByTestId("deploy-button")).toBeDisabled();

    const pipeline = page.getByTestId("pipeline");
    await expect(pipeline.getByRole("button", { name: "Create snapshot" })).toBeDisabled();
    await expect(pipeline.getByRole("button", { name: "Transfer A → B" })).toBeDisabled();
    await expect(pipeline.getByRole("button", { name: "Calculate entitlement" })).toBeDisabled();
    await expect(pipeline.getByRole("button", { name: "Approve in Phantom" })).toBeDisabled();
    await expect(pipeline.getByRole("button", { name: "Settle KUSD" })).toBeDisabled();
  });

  test("renders four holder identities as the lifecycle subjects", async ({ page }) => {
    await expect(page.getByTestId("holder-A")).toContainText("Investor A");
    await expect(page.getByTestId("holder-B")).toContainText("Investor B");
    await expect(page.getByTestId("holder-C")).toContainText("Investor C");
    await expect(page.getByTestId("holder-D")).toContainText("Investor D");
  });
});



test("restored approved action still requires wallet connection", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kase_real_action_v2", JSON.stringify({
      actionId: "TEST-RESTORED", status: "APPROVED",
      signatures: { snapshot: "snapshot", transfer: "transfer", entitlement: "entitlement", approval: "approval" }
    }));
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Settle KUSD" })).toBeDisabled();
});

test("missing Phantom reports an error without unlocking actions", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("connect-wallet").click();
  await expect(page.getByTestId("app-error")).toBeVisible();
  await expect(page.getByTestId("deploy-button")).toBeDisabled();
  await expect(page.getByTestId("busy-state")).toHaveCount(0);
});


test("R1 NFR-03/08: pending settlement remains blocked after reload and wallet connection", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kase_real_action_v2", JSON.stringify({
      actionId: "TEST-PENDING", status: "APPROVED",
      pendingSettlementSignature: "submitted-signature",
      signatures: { approval: "approval" }
    }));
    const publicKey = { toBase58: () => "11111111111111111111111111111111" };
    Object.assign(window, { phantom: { solana: { isPhantom: true, publicKey, connect: async () => ({ publicKey }) } } });
  });
  await page.goto("/");
  await page.getByTestId("connect-wallet").click();
  await expect(page.getByTestId("busy-state")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settle KUSD" })).toBeDisabled();
  await page.reload();
  await page.getByTestId("connect-wallet").click();
  await expect(page.getByTestId("busy-state")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settle KUSD" })).toBeDisabled();
});
