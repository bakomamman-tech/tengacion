# TengaAgent Pilot Payment Boundary

The controlled pilot may use manual `trialing`/`active` subscription state while the runtime enforces plan entitlements and usage. Paystack/Stripe subscription collection remains disabled until the dedicated payment-collection milestone. No pilot code should silently mark a payment as completed or infer subscription payment from unrelated Tengacion commerce flows.
