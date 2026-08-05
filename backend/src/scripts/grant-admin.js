/**
 * Grant the admin role from the command line.
 *
 *   npm run admin:grant -- someone@example.com [another@example.com]
 *
 * Same promote-only semantics as the ADMIN_EMAILS startup bootstrap: the
 * account must already exist, suspended accounts are refused, and nothing is
 * ever demoted. Useful where restarting with a new environment variable is
 * more awkward than running a one-off command.
 */
import { validateEnv } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { ensureAdmins } from '../services/bootstrap.service.js';

const emails = process.argv.slice(2).filter((a) => !a.startsWith('-'));

if (emails.length === 0) {
  console.error(
    'Usage: npm run admin:grant -- <email> [more emails…]\n\n' +
      'The account must already be registered. This promotes an existing\n' +
      'user; it never creates one.'
  );
  process.exit(1);
}

validateEnv();
await connectDB();

try {
  const r = await ensureAdmins(emails);

  for (const e of r.promoted) console.log(`  promoted     ${e}`);
  for (const e of r.alreadyAdmin) console.log(`  already admin ${e}`);
  for (const e of r.refused) console.error(`  REFUSED      ${e} (account is suspended)`);
  for (const e of r.missing) console.error(`  NOT FOUND    ${e} (register this address first)`);

  const failed = r.missing.length + r.refused.length;
  console.log(
    `\n${r.promoted.length} promoted, ${r.alreadyAdmin.length} already admin, ${failed} failed.`
  );
  await disconnectDB();
  process.exit(failed > 0 ? 1 : 0);
} catch (err) {
  console.error('admin:grant failed —', err.message);
  await disconnectDB();
  process.exit(1);
}
