# BankGuard / Scam2Safe integration

The banking application uses the external Scam2Safe service through [VisualPasswordService.js](src/services/VisualPasswordService.js). Controllers do not use Axios.

## Configure and run

Set the following server-only values in `.env`:

```text
PORT=3001
VISUAL_SDK_BASE=https://api.scam2safe.com
VISUAL_SDK_API_KEY=your-api-key
NODE_ENV=development
```

Then run `npm start` and visit `http://localhost:3001`.

## Local endpoints

- `POST /api/transactions/challenge` calls `startTransactionChallenge`.
- `POST /api/transactions/verify` calls `verifyTransactionChallenge` with five numeric `registerInputs`.
- `POST /api/recovery/start` calls `triggerRecoveryEmail`.

The exact external request and response contract is documented in [API_CONTRACT.md](API_CONTRACT.md).
