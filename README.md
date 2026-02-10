# TreeWalley Furniture App

Amazon-style furniture buying app for **TreeWalley Furniture only** with a working end-to-end flow:

- Product listing
- Cart and checkout
- Login using OTP verification
- Payment gateway simulation
- Payment OTP verification
- Order completion

## Run locally

```bash
npm install
npm start
```

Open: `http://localhost:3000`

## Test

```bash
npm test
```

## Notes

This demo uses in-memory data and returns OTP in API responses as `demoOtp` so the complete flow can be tested without an SMS provider or payment processor.
