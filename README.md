# Sidewayz Garage mobile servicing

Complete Netlify migration of the Sidewayz landing page and operations backend. The original visual design, two-step form and operational controls are retained. This is application source, not a static demonstration.

## Current status

- Production frontend build and pre-rendering pass.
- 17 integration tests pass against Netlify's local PostgreSQL-compatible engine.
- Netlify project created: `sidewayz-mobile-servicing`, site ID `ad6e78b0-e4d4-4326-b9be-7c522156685a`, team `info-qro-amu`.
- Approved pricing and commercial-policy configuration were stored privately as production function variables.
- **Not deployed:** GitHub rejected branch creation with HTTP 403, `Resource not accessible by integration`.
- Hosted PostgreSQL database provisioned; two migrations applied. Test enquiry 38632098 was independently verified with is_test=1. Both functions deployed; dispatch schedule registered.
- CRM, customer message delivery, QuickBooks and Google Ads integrations are **not connected or verified**.
- Real intake remains disabled. No customer enquiries were found in the original hosted database when checked; no records have been imported.

## Development

Node 22.12+; `npm ci`, `npm test`, `npm run build`.
`npm run dev` serves the React frontend. Use Netlify's local platform tooling to exercise Functions, environment variables and the managed local database. Do not assume frontend-only Vite serves backend routes.

The frontend pre-renders the landing, privacy, terms and operations pages and hydrates them in the browser. Functions run at `/api/servicing/*`. `dispatch` is a private scheduled function that runs every minute on published deploys. Scheduled work processes at most two messages per run with an eight-second timeout per provider request, staying inside the scheduled-function execution budget.

The database adapter uses PostgreSQL parameter binding, transactions, savepoints, advisory locking for competing job mutations, unique enquiry claims and unique booking slots. Transactions commit before any customer delivery is attempted. A failed booking transaction rolls back capacity, stage and events together. Deliberate test enquiries remain flagged and are never delivered or included in campaign reporting.

## Deploy through GitHub

1. Restore GitHub write permission for `sidewayz24s/Sidewayzastra` (or use a separately authorised private repository). The attempted branch name is `netlify-mobile-servicing`; its creation failed and must not be assumed to exist.
2. Commit this source to the authorised repository. Keep `.netlify`, `.env`, `original/`, `private-config/`, runtime data and credentials excluded. No complete private pricing matrix or internal commercial thresholds are included in source. Approved public vehicle examples are on the landing page.
3. In Netlify project `sidewayz-mobile-servicing`, connect that repository and the intended production branch. The existing `sidewayzastra` project uses a different repository and was left untouched.
4. Build command: `npm run build`; publish directory: `dist`; functions directory: `netlify/functions`. Configuration is in `netlify.toml`. The `@netlify/database` dependency and committed SQL migrations allow supported Netlify deployment to provision the database and apply schema migrations.
5. Verify the selected Netlify plan supports Database and check costs before changing the plan. No paid upgrade has been authorised or purchased.
6. Deploy and verify the actual DB, function routes, scheduler and public access before enabling live intake. If an infrastructure error occurs, retain the exact deploy error and log URL.

## Production variables

Configure values with the Netlify UI/connector; never commit them. Function variables are deployed with the function and require a fresh deploy after changes.

| Variable | Purpose |
| --- | --- |
| `COMMERCIAL_POLICY_JSON` | Private approved profitability policy; already configured for production |
| `PRICING_MATRIX_JSON` | Exact approved private pricing examples; already configured for production |
| `OPERATIONS_KEY` | Unique random operations access secret, at least 24 characters; not configured |
| `CRM_CALLBACK_KEY` | Distinct secret for authenticated delivery/CRM callbacks, at least 24 characters; not configured |
| `SCHEDULER_KEY` | Distinct secret for externally authenticated dispatch, at least 24 characters; not configured |
| `CRM_WEBHOOK_URL` | Actual HighLevel inbound workflow URL on `services.leadconnectorhq.com/hooks/`; not configured |
| `GA4_ID`, `GOOGLE_ADS_ID` | Validated analytics/Ads IDs after account setup; not configured |
| `WORKFLOWS_VERIFIED` | Set to `yes` only after real CRM/message receipt and stop rules are verified |
| `LAUNCH_APPROVED` | Set to `yes` only after business/legal approval and all live checks pass |

All secrets must be newly generated in a trusted credential manager. The single-key operations login is an initial access mechanism, not individual staff identity or a complete user audit system.

The approved pricing matrix is unchanged. Owner confirmed no VAT registration, Mon–Sat 09:00–18:00, payment on completion and 24-hour cancellation notice. Public examples are vehicle-specific. An additional workmanship guarantee is DRAFT pending approval; customer intake remains disabled. See docs/LAUNCH_CHECKLIST.md for pending photos, Google reviews, broker clarification, integration and launch checks.

## External workflows

The HighLevel adapter delivers a stable event ID, enquiry/job ID, contact, vehicle, channel preference, consent, attribution, customer-facing message and internal-task instructions. Configure HighLevel contact/opportunity mapping, receiver-side deduplication, the internal recipient and actual sending channels before activation. An HTTP acceptance response is not proof of message delivery.

Callback endpoint: `/api/servicing/callback`, authenticated by the callback secret. Supported callback types: `crm_record_created`, `message_delivered`, `message_failed`, `customer_replied`, `customer_opted_out`. Persist provider IDs and send unique callback event IDs. Replies pause optional follow-up; opt-outs suppress it. No quote follow-up is scheduled without consent for the chosen channel. Phone preference creates a human-contact task rather than silently switching channels. Email unsubscribe and WhatsApp business-template requirements must be implemented in the receiving system.

The operations area records verified vehicle/location, quote, customer acceptance and capacity before confirming appointments. Internal overlap prevention includes 30-minute buffers. Existing commitments outside this system require staff checks until a calendar integration is built. QuickBooks invoice integration has not been implemented.

Browser events are consent gated; no personal vehicle/contact information is sent to browser analytics. Phone clicks are supporting events, never qualified conversations. Qualified enquiry/call and confirmed-booking events are separate. Google Ads upload/call reporting remains account setup work; the current CSV is a review export, not an automated uploader.

## Acceptance tests still required on the hosted system

- Public page and legal pages return correctly without a hosting sign-in wall.
- Labelled test submission persists as test-only, creates the expected CRM record in an isolated test workflow, and produces no production ad conversion.
- Actual email/SMS/WhatsApp delivery and internal notifications are evidenced.
- Multi-connection PostgreSQL booking conflicts and duplicate requests remain atomic on hosted Postgres. The local engine is documented as single-process; tests use one DB connection and do not constitute a load test.
- Replies, declines, bookings and opt-outs terminate optional workflows; uncertain messages remain quarantined.
- Appointment confirmation, rescheduling, cancellation and scheduler invocation work end to end.
- Ads attribution/import receipt, consent and deduplication are verified in the actual account.
- Privacy retention, processor arrangements, cancellation/payment terms, capacity and insurance scope are confirmed. Update legal/setup notices and robots/noindex only after launch approval.
