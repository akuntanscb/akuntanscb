# Security Spec - SIA Sekolah Cendekia Baznas

## Data Invariants
1. A JournalEntry must have at least two lines.
2. The total Debit must equal total Credit in a JournalEntry (balance).
3. Accounts cannot be deleted if they are "isDeletable: false".
4. Every document must have a `createdBy` field matching the user's UID.
5. Invoices must have a unique `invoiceNumber`.

## The "Dirty Dozen" Payloads
1. Create Account with missing `category`.
2. Update Account `code` to a 2MB string.
3. Create JournalEntry where `debit != credit`.
4. Create JournalEntry with `createdBy` NOT matching current UID.
5. Update JournalEntry `createdAt` (immutable field).
6. Delete a system-protected Account.
7. Create Invoice with negative `total`.
8. Read Invoices of another user.
9. List all JournalEntries without being authenticated.
10. Update Invoice `status` to an invalid value.
11. Inject malicious script into Account `name`.
12. Create more than 100 Account documents (Denial of Wallet).

## Test Runner (Logic Check)
- verify(auth != null)
- verify(request.resource.data.createdBy == request.auth.uid)
- verify(incoming().total >= 0)
- verify(incoming().lines.size() >= 2)
