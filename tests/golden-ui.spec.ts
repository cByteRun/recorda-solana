import { expect, test } from "@playwright/test";

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
    expect(actual).toContain('"B": 24');
    expect(actual).toContain('"A": 500');
    expect(actual).toContain('"B": 1000');
    expect(actual).toContain('"C": 250');
    expect(actual).toContain('"finalStatus": "FINALIZED"');
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

  test("renders three holder identities as the lifecycle subjects", async ({ page }) => {
    await expect(page.getByTestId("holder-A")).toContainText("Investor A");
    await expect(page.getByTestId("holder-B")).toContainText("Investor B");
    await expect(page.getByTestId("holder-C")).toContainText("Investor C");
  });
});
