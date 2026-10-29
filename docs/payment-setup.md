# Payment setup for Kingdom Custom Print

Only the business owner or an authorized administrator should enter payment credentials. Never send secret keys, signing secrets, passwords, or card numbers by email or chat. Use the store's authenticated **Admin → Payment** form. Blank fields leave previously saved values unchanged.

## Stripe

1. Sign in at https://dashboard.stripe.com/ and select the correct business account.
2. Complete Stripe's business activation and payment/payout verification if requested.
3. In **Developers → API keys**, select live mode and reveal the live secret key (`sk_live_…`), or create a suitably restricted key. The store uses Stripe-hosted checkout, so a publishable key is not required here.
4. In **Developers → Webhooks** (or Event destinations), add an HTTPS endpoint for `https://kingdomcustomprint.com/api/webhook`. Select `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, and `charge.refunded`.
5. Reveal that endpoint's signing secret (`whsec_…`). It is different from the API key.
6. In the store's payment settings, enter the secret key and signing secret, confirm the admin password, and save. Saving the credentials alone does not enable checkout; the developer will enable it after testing.

## PayPal

1. Sign in with the business account at https://developer.paypal.com/dashboard/ and open **Apps & Credentials**.
2. Choose **Sandbox** for initial integration testing. Create or select a REST app and find its client ID and client secret.
3. Add a webhook pointing to `https://kingdomcustomprint.com/api/paypal/webhook`, subscribing to `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, and `PAYMENT.CAPTURE.REFUNDED`. Copy its webhook ID.
4. Once the developer confirms the sandbox test is ready, enter all three matching values and choose **Sandbox** in the store's payment settings. PayPal checkout stays disabled until the developer explicitly enables it for testing.
5. For production, switch the developer dashboard to **Live**, create or select a live REST app, and create a separate live webhook with the same endpoint and event subscriptions. Save its live client ID, live client secret, and live webhook ID together, selecting **Live**.

The mode and all three PayPal values must match the same app and environment. Saving PayPal credentials alone does not enable checkout.

## Verification

First use Stripe test mode and PayPal sandbox on an isolated test environment. Once each integration, signed webhook, order record and refund are verified, the client can perform the requested two $1 live tests from a separate buyer account or card and approve each payment herself. Confirm the store order, provider transaction and webhook, then use the admin refund control if desired. Live payment and refund fees and settlement timing depend on the providers and merchant account.

Official guidance: https://docs.stripe.com/keys and https://developer.paypal.com/api/get-started/.
