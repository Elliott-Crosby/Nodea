# Hosted web app retirement

The hosted web app is retired. The farewell page, blog/RSS, privacy policy,
terms, and feedback form remain public. Nodea Tree continues to be supported.

## Preserved source and data

Original route entrypoints and replaced configuration are in `retired/`.
The original UI components and libraries remain in `src/`. The original
dependency manifest and lockfile are also archived. Git history remains intact.
The archive is excluded from compilation and deployment uploads.

Existing account data and uploads have not been deleted. Browser roles (`anon`
and `authenticated`) have no privileges on public application tables, columns,
sequences, or functions. A restrictive storage policy blocks access to retired
uploads, and the `chat-attachments` bucket is private. Service-role access is
retained for the owner to handle verified export/deletion requests.

Supabase Auth remains enabled because the extension uses that same Auth project.
An extension login does not grant access to retired web-app data. The extension's
old “Open in Nodea” feature now leads to the farewell page.

## Feedback

Feedback is stored in Supabase's `public.shutdown_feedback` table. Read it in
the project's Table Editor using your owner account. No browser role can read,
insert, update, or delete these rows directly, or invoke the collector RPC.

Only `/api/feedback` can accept submissions publicly. It validates the origin,
content type, bounded body, message and optional email; rejects a honeypot;
and returns success only after the database confirms persistence. A service-only
database function atomically enforces 5 submissions per network address per hour
and 100 total per hour across instances. A keyed hash is stored instead of the raw
network address. Feedback is plain text and is never rendered on a public page.

## Deployment and verification

- Deploy the shutdown source to Vercel and apply
  `supabase/migrations/20261109150000_retire_web_app_access.sql` to the linked project.
  The migration checks browser table/column/function privileges and rolls back if
  any remain. Set the upload bucket private using the Supabase Storage API.
- Retired API routes return 410 for every supported HTTP method; retired page
  links redirect home. No retired handlers are compiled into the active route tree.
- Vercel's `all_except_custom_domains` deployment protection must remain enabled
  so older generated deployment URLs require Vercel sign-in. Do not attach public
  custom domains to old deployments or roll production back to an old app build.
- The new site uses a per-response script nonce, same-origin connections,
  frame denial, HTTPS enforcement, and no analytics or external font scripts.
  Legacy blog style attributes remain allowed; inline executable scripts do not.
- Run `node --experimental-strip-types --test tests/shutdown-feedback.test.mjs`,
  `npm audit`, and `npm run build` before publishing changes.

The service key is a privileged credential. Keep it server-only and out of logs,
Git, feedback exports, and public files. To restore the web app later, review the
original database grants and policies before changing them; do not broadly
re-grant browser access or restore an old vulnerable dependency lockfile.
