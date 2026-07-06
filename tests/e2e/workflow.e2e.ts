import { test, expect } from '@playwright/test';

test.describe('Aegis GateKeeper E2E Volunteer Incident Resolution Workflow', () => {
  test('should process a diaper bag incident scan and output ALLOW status', async ({ page }) => {
    // 1. Navigate to the application route
    await page.goto('/');

    // Verify page title and header are loaded
    await expect(page.locator('h1')).toContainText('Aegis GateKeeper');

    // 2. Select "Offline Simulation" profile in the Simulation Panel to avoid API dependencies
    const offlineProfileButton = page.locator('button:has-text("Offline Simulation")');
    await offlineProfileButton.click();

    // Verify offline status banner is displayed
    const offlineBanner = page.locator('.offline-banner');
    await expect(offlineBanner).toBeVisible();
    await expect(offlineBanner).toContainText('Local Simulation Active');

    // 3. Populate volunteer context observations
    const contextInput = page.locator('textarea#volunteer-desc');
    await contextInput.fill('Diaper bag containing baby formula and a clean empty flask.');

    // 4. Click the Submit button to trigger AI decision pipeline
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // 5. Verify the Decision Card renders the resulting ALLOW status directive
    const decisionCard = page.locator('.decision-card');
    await expect(decisionCard).toBeVisible();
    await expect(decisionCard).toHaveClass(/status-allow/);

    // Verify specific visual text
    const statusLabel = decisionCard.locator('.status-label');
    await expect(statusLabel).toContainText('Allow Entry');

    const actionTitle = decisionCard.locator('.action-title');
    await expect(actionTitle).toContainText('APPLY GREEN TAG & ADMIT');

    // 6. Test the Web Speech Audio triggers
    const speakButton = decisionCard.locator('.btn-speak');
    await expect(speakButton).toBeVisible();
    
    // Clicking the speak button should fire the Web Speech API call (verifying it is interactive)
    await speakButton.click();
  });
});
