
## Deep analysis report (current state, end-to-end)

### 1) What “Sync to AutoCount” does in your app (actual call chain)

```text
Browser (/stores) 
  └─ src/pages/Stores.tsx: handleSyncToAutoCount()
      └─ supabase.functions.invoke('push-store-to-autocount')
          └─ Supabase Edge Function: supabase/functions/push-store-to-autocount/index.ts
              ├─ Reads stores from Supabase table `stores` where autocount_synced is null/false
              ├─ Authenticates to LemonCo API (LEMONCO_API_URL) to get Bearer token
              ├─ For each store:
              │    ├─ GET  /autocount/debtors/{debtor_code}  (existence check)
              │    ├─ PUT  /autocount/debtors/{debtor_code}  (if exists)
              │    └─ POST /autocount/debtors               (if not exists)
              └─ If LemonCo call succeeds:
                   ├─ Updates `stores.autocount_synced = true` and `last_synced_at`
                   └─ Writes to `autocount_sync_log`
```

### 2) Confirmed behavior observed by instrumentation (irrefutable evidence)

#### A) The frontend is successfully calling the edge function
Evidence from browser network capture:
- `POST https://...supabase.co/functions/v1/push-store-to-autocount` returns HTTP **200** (so the function is reachable and returning a JSON response).

This rules out:
- Missing route / wrong endpoint name
- CORS blocking
- Supabase function not deployed / not reachable

#### B) The edge function runs and attempts create/update calls
Evidence from Supabase Edge Function logs for `push-store-to-autocount`:
- `INFO Sync complete. Synced: 0, Errors: 53`
- Multiple lines like:
  - `INFO Creating debtor for store: ... (STR-TLC-0XX)`
  - `INFO Updating debtor for store: ... (STR-TLC-0XX)`

This rules out:
- No stores being found (it found 53)
- Early exit before processing
- Failure to read `stores` table

#### C) Exact failure point(s) and their root causes are upstream of your code (in the LemonCo/AutoCount backend)

There are **two distinct failure modes** recorded in the function logs. Both come back as error payloads from the LemonCo/AutoCount layer and are not thrown by the edge function itself.

---

### Failure Mode 1: “Create debtor” fails because the LemonCo backend calls `GetDebtor()` and AutoCount throws an exception for “not found”
Edge logs show errors like (example):
- `ERROR Failed to create debtor STR-TLC-052: ...`
  - `ExceptionMessage: "Failed to create debtor in AutoCount."`
  - `InnerException.ExceptionType: AutoCount.ARAP.Debtor.DebtorRecordNotFoundException`
  - `InnerException.ExceptionMessage: "Debtor record not found (AccNo=STR-TLC-052)."`
  - Stack trace points to:
    - `Backend.Infrastructure.AutoCount.AutoCountDebtorService.CreateDebtor(...)`
    - specifically `AutoCountDebtorService.cs:line 113` inside:
      - `var existing = cmd.GetDebtor(debtor.Code);`

**What this proves**
- The LemonCo backend’s AutoCount SDK call `cmd.GetDebtor(code)` is throwing `DebtorRecordNotFoundException` instead of returning `null` for missing debtors.
- Your LemonCo backend code expects `GetDebtor()` to return `null` when missing (it does not catch this specific exception), so it treats “not found” as an error and aborts create.

**Local code confirmation**
We inspected your backend implementation:
- `Backend/Backend.Infrastructure.AutoCount/AutoCountDebtorService.cs`
  - `CreateDebtor()` calls `cmd.GetDebtor(debtor.Code)` to detect duplicates.
  - It does not handle a “not found exception” path, and the outer catch wraps it as `InvalidOperationException("Failed to create debtor in AutoCount.", ex)`.

This is the exact failure point for **new debtors**: the backend’s duplicate-check logic is incompatible with the AutoCount SDK behavior in your environment/version.

---

### Failure Mode 2: “Update debtor” fails due to AutoCount Currency foreign key constraint
Edge logs show errors like (example):
- `ERROR Failed to update debtor STR-TLC-043: ...`
  - `InnerException.ExceptionMessage: "Foreign Key Error (Constraint Name=FK_GLMast_CurrencyCode)"`
  - deeper:
    - `The UPDATE statement conflicted with the FOREIGN KEY constraint "FK_GLMast_CurrencyCode"... table "dbo.CURRENCY", column 'CurrencyCode'.`

**What this proves**
- Even when a debtor exists and the backend reaches SaveDebtor, AutoCount rejects the update because `CurrencyCode` being saved does not exist in `dbo.CURRENCY`.

**Why this isn’t caused by the edge function payload**
- The edge function does not send `currencyCode` at all.
- Your backend mapping (`MapDomainDebtorToEntity`) attempts to default currency:
  - If no currency is specified, it uses `DBRegistry(LocalCurrencyCode)` as the debtor currency.
- Therefore, the FK failure indicates one of these must be true in the AutoCount company DB:
  1) The configured **LocalCurrencyCode** value does not exist in `dbo.CURRENCY`, or
  2) `dbo.CURRENCY` is missing the code expected by registry/config, or
  3) There’s an AutoCount configuration/data mismatch across company DBs.

This is an AutoCount master-data/config issue that must be corrected in AutoCount (or the LemonCo backend must set a valid currency explicitly).

---

## Conclusion (exact reason sync fails)

Sync fails because the LemonCo/AutoCount backend currently cannot reliably:
1) **Create** a debtor when the debtor does not exist (because “not found” throws an exception during the duplicate check), and
2) **Update** a debtor when it exists (because AutoCount rejects the save due to invalid/missing CurrencyCode in the AutoCount database).

Your Supabase edge function and frontend are doing what they should: they are orchestrating calls correctly, but the downstream system is rejecting them.

This meets the “exact failure point with irrefutable evidence” requirement:
- Evidence is in recorded edge logs, including exception types and stack traces pointing to exact backend code lines and DB constraint names.

---

## Validated development plan (no implementation yet)

### Track A — Fix the true root causes (required for successful sync)
These steps are on the LemonCo/AutoCount side (you indicated you have access to adjust settings).

#### A1) Fix “Create debtor” not-found exception handling in LemonCo backend
Goal: Treat “debtor not found” as normal, not an exception.

Concrete change required (in LemonCo backend):
- In `AutoCountDebtorService.CreateDebtor`:
  - Wrap `cmd.GetDebtor(debtor.Code)` with handling for `DebtorRecordNotFoundException`.
  - If that exception occurs, treat it as “existing = null” and proceed to `NewDebtor()` and `SaveDebtor()`.

Validation steps:
- Directly call LemonCo API POST `/autocount/debtors` with a new code.
- Confirm it returns 200/201 and the debtor exists in AutoCount.

#### A2) Fix CurrencyCode FK issue in AutoCount company DB
Goal: Ensure that the CurrencyCode being used in SaveDebtor exists in `dbo.CURRENCY`.

What to check in AutoCount:
- Identify the local currency code configured for the account book/company (what `DBRegistry(LocalCurrencyCode)` returns).
- Confirm that code exists in AutoCount table `dbo.CURRENCY` for the company database (`AED_Terraganics` per the exception).

Validation steps:
- Update any debtor (even a test debtor) in AutoCount through LemonCo API PUT `/autocount/debtors/{code}`.
- Confirm no FK error and the update persists.

---

### Track B — Improve observability and UX in this Lovable app (safe and non-breaking)
These do not “fix” AutoCount, but they will prevent the current generic “Failed to sync stores to AutoCount” and give actionable feedback without affecting other modules.

#### B1) Surface backend error details in the UI
Current issue:
- The edge function returns `errors: [{store, error}]`, but the UI only reads `data.error`.
- Result: user sees a generic toast even though the edge function provides detailed per-store error payloads.

Planned UX change:
- When `data.success === false`:
  - Show a dialog (or expandable toast) summarizing:
    - Synced count, total, number failed
    - The first N errors (store name + parsed message)
  - Provide a “Download errors (JSON)” option (client-side only).

Validation:
- Trigger sync.
- Confirm the UI displays the exact AutoCount error (e.g., FK_GLMast_CurrencyCode) without opening logs.

#### B2) Add a “Sync one store” action for targeted retries
Why:
- With current failures, bulk sync always results in 53 failures and is noisy.
- Single-store sync accelerates testing after backend changes (currency fix / create fix).

Planned technical shape:
- Edge function accepts optional body `{ storeId?: string }` and only processes that store when provided.
- UI adds a per-row “Sync” button.

Validation:
- Pick a store, sync only that one, verify status updates.

#### B3) Make existence-check more diagnostic (not a logic change)
Planned:
- If GET `/autocount/debtors/{code}` returns non-200:
  - capture and log response body/status in the edge function logs (and optionally in returned errors) so “404 vs 500” is visible.
This helps confirm whether LemonCo returns 500 on “not found”, reinforcing A1.

Validation:
- Re-run a single store sync and verify we can see the existence-check failure status/body clearly.

---

## Dependencies / sequencing

1) Implement Track B (UI error surfacing + single-store sync) first to speed iteration and confirm A1/A2 fixes quickly.
2) Apply LemonCo backend fix (A1).
3) Apply AutoCount currency configuration/data fix (A2).
4) Re-test from the Stores UI:
   - Single-store sync → bulk sync

---

## Test protocol (end-to-end, evidence based)

After A1/A2 are addressed:
1) Select one brand-new store code (never in AutoCount) and run single-store sync:
   - Expect: create succeeds, store marked `autocount_synced=true`
2) Select one existing debtor/store and run single-store sync:
   - Expect: update succeeds, `last_synced_at` updates
3) Run bulk sync:
   - Expect: synced count increases, 0 errors
4) Confirm AutoCount side:
   - Debtor exists, has correct name/contact/isActive, and CurrencyCode is valid

---

## What I need from you (to keep evidence airtight)

1) Confirm whether LemonCo API and AutoCount are the only systems involved (no additional proxy or environment).
2) Identify what the correct local currency code should be for this AutoCount company (e.g., PHP, USD) and confirm it exists in AutoCount’s currency master.

(You already confirmed: you retried “just now”, all fail, and you have access to fix AutoCount settings/backend.)

Once you approve this plan, the next step on my side would be implementing Track B changes in this repo (UI + edge function parameters/logging) without altering the existing sync semantics for other modules.
