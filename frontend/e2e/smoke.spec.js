import { test, expect } from '@playwright/test';
import { watchForErrors, expectClean } from './helpers.js';

test.describe('landing page', () => {
  test('renders the hero and mounts the 3D scene without shader errors', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Every Drop');
    await expect(page.getByRole('link', { name: /become a donor/i }).first()).toBeVisible();

    // The headline's sans/serif contrast is deliberate art direction. If the
    // webfont fails to load the browser silently substitutes Georgia, which
    // looks plausible enough that nobody notices the design has changed.
    const accent = page.locator('.lux-display-accent');
    await expect(accent).toHaveCSS('font-style', 'italic');
    const serifReady = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('italic 400 48px "Instrument Serif"');
    });
    expect(serifReady, 'Instrument Serif did not load — headline fell back').toBe(true);

    // The scene is lazy-loaded behind a Suspense boundary, and headless
    // Chromium renders WebGL in software — on a loaded machine mounting can
    // take far longer than it ever would on real hardware. Generous timeout so
    // the suite fails on defects, not on how busy the box happens to be; a
    // scene that never mounts still fails.
    const canvas = page.locator('.lux-scene canvas');
    await expect(canvas).toBeAttached({ timeout: 60_000 });

    // A canvas can exist while WebGL silently failed, which would leave the
    // hero blank. Confirm a real drawing context and non-zero size.
    const scene = await canvas.evaluate((el) => ({
      width: el.width,
      height: el.height,
      hasContext: Boolean(el.getContext('webgl2') || el.getContext('webgl')),
    }));
    expect(scene.hasContext, 'WebGL context was never created').toBe(true);
    expect(scene.width).toBeGreaterThan(0);
    expect(scene.height).toBeGreaterThan(0);

    // Three.js reports a failed vertex/fragment compile via console.error, so
    // this is what actually validates the vein + heart shaders.
    const shaderErrors = errors.consoleErrors.filter((t) =>
      /shader|WebGLProgram|GLSL|THREE\./i.test(t)
    );
    expect(shaderErrors, 'shader compilation failed').toEqual([]);

    expectClean(expect, errors, 'landing');
  });

  test('scrolling reveals the later sections', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');

    await page.getByRole('heading', { name: /three steps between a request/i }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: /three steps between a request/i })).toBeVisible();

    // Counters start at 0 and animate on entry.
    const stat = page.locator('.lux-stat__value').first();
    await stat.scrollIntoViewIfNeeded();
    await expect(stat).not.toHaveText('0', { timeout: 10_000 });

    expectClean(expect, errors, 'landing scroll');
  });
});

test.describe('sign in', () => {
  test('renders the cinematic shell with usable fields', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.locator('.lux-auth')).toBeVisible();

    const email = page.locator('#email');
    const password = page.locator('#password');
    await expect(email).toBeVisible();
    await expect(password).toHaveAttribute('type', 'password');

    await email.fill('someone@example.test');
    await password.fill('hunter2hunter2');
    await expect(email).toHaveValue('someone@example.test');

    // The eye toggle must actually reveal the value.
    await page.getByRole('button', { name: /show password/i }).click();
    await expect(password).toHaveAttribute('type', 'text');

    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
    expectClean(expect, errors, 'login');
  });
});

test.describe('registration', () => {
  test('offers only the self-service roles', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/register');

    // The volunteer role was removed from the project.
    await expect(page.locator('option[value="volunteer"]')).toHaveCount(0);
    await expect(page.locator('option[value="donor"]')).toHaveCount(1);
    await expect(page.locator('option[value="recipient"]')).toHaveCount(1);

    expectClean(expect, errors, 'register');
  });
});

test.describe('password reset', () => {
  test('advances from email entry to the code step', async ({ page }) => {
    const errors = watchForErrors(page);

    // Stubbed so the suite never depends on the API being up, never sends mail,
    // and never burns the server's OTP rate limit.
    await page.route('**/api/v1/auth/forgot-password', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { sent: true, expiresInMin: 10 },
          message: 'If that email is registered, a reset code is on its way',
        }),
      })
    );

    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();

    await page.locator('#email').fill('someone@example.test');
    await page.getByRole('button', { name: /send reset code/i }).click();

    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible();
    await expect(page.locator('#code')).toBeVisible();
    // The address is masked back to the user, never echoed in full.
    await expect(page.getByText(/s\*+e@example\.test/)).toBeVisible();

    expectClean(expect, errors, 'forgot password');
  });
});

test.describe('removed volunteer role', () => {
  test('the route redirects away instead of rendering a portal', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/dashboard/volunteer');

    // Unauthenticated, so this lands on the login gate. Weak on its own — it
    // would have passed before the removal too — but it proves the dead route
    // does not throw, which is the white-screen risk after deleting a page.
    await expect(page).not.toHaveURL(/\/dashboard\/volunteer$/);
    await expect(page.getByRole('heading', { name: /volunteer/i })).toHaveCount(0);
    expectClean(expect, errors, 'volunteer route');
  });

  test('the client route table no longer defines a volunteer portal', async ({ page }) => {
    // The behavioural check above cannot distinguish "removed" from "auth
    // redirect", and the authenticated sidebar is unreachable without a login.
    // Asserting against the module the dev server actually serves is the one
    // check here that genuinely fails if the route comes back.
    const res = await page.request.get('/src/App.jsx');
    expect(res.status(), 'dev server should serve the route module').toBe(200);

    const source = await res.text();
    expect(source).not.toMatch(/volunteer/i);
    expect(source).not.toMatch(/VolunteerPortal/);
    // Sanity: the assertion is only meaningful if sibling portals are present.
    expect(source).toMatch(/HospitalPortal/);
  });
});
