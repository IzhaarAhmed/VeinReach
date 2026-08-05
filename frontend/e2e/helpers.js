/**
 * Error capture for the smoke suite.
 *
 * `pageerror` is the important one: an uncaught exception during render is
 * exactly the white-screen failure a passing `vite build` cannot rule out.
 * Console errors matter too — Three.js reports a failed shader compile through
 * console.error, which is the only signal that the 3D scene is broken.
 */

/** Dev-environment noise that must not fail a smoke test. */
const IGNORED = [
  /favicon/i,
  // The API is not managed by this suite; auth bootstrap 401s are expected.
  /Failed to load resource/i,
  /net::ERR_/i,
  /the server responded with a status of 401/i,
  // Push notifications are intentionally disabled without Firebase config.
  /firebase/i,
  /messaging/i,
  /Download the React DevTools/i,
];

export function watchForErrors(page) {
  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  return {
    pageErrors,
    consoleErrors,
    /** Console errors with known dev noise stripped out. */
    significant: () => consoleErrors.filter((t) => !IGNORED.some((re) => re.test(t))),
  };
}

/** Assert the page mounted cleanly: no uncaught exceptions, no real console errors. */
export function expectClean(expect, errors, label) {
  expect(errors.pageErrors, `${label}: uncaught exception during render`).toEqual([]);
  expect(errors.significant(), `${label}: console errors`).toEqual([]);
}
