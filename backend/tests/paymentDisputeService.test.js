const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";

const PaymentDispute = require("../models/PaymentDispute");
const PaymentWebhookEvent = require("../models/PaymentWebhookEvent");
const Purchase = require("../models/Purchase");
const RevenueLedgerEntry = require("../models/RevenueLedgerEntry");
const WalletEntry = require("../models/WalletEntry");
const {
  normalizePaystackDispute,
  upsertPaystackDispute,
  recordDisputeOpenedEntries,
  recordDisputeResolvedEntries,
  shouldResolvePaystackDispute,
} = require("../services/paymentDisputeService");
const {
  computePurchaseDisputeAllocation,
  buildCreatorWalletSummary,
  buildCreatorWalletSnapshot,
  recordPurchaseSettlementEntries,
} = require("../services/walletService");
const {
  buildPaystackEventId,
  markPaymentWebhookEvent,
  reservePaymentWebhookEvent,
} = require("../services/paymentWebhookEventService");

let mongod;

const createPurchase = ({ providerRef = "purchase_dispute_ref" } = {}) =>
  Purchase.create({
    userId: new mongoose.Types.ObjectId(),
    creatorId: new mongoose.Types.ObjectId(),
    itemType: "track",
    itemId: new mongoose.Types.ObjectId(),
    amount: 2500,
    priceNGN: 2500,
    processingFeeAmount: 137.5,
    taxAmount: 12.5,
    currency: "NGN",
    status: "paid",
    provider: "paystack",
    providerRef,
    paidAt: new Date("2026-07-15T10:00:00.000Z"),
    revenueCategory: "music",
    revenueSharePolicy: "artist_music_net_75_v1",
    creatorShareRate: 0.75,
    platformShareRate: 0.25,
  });

describe("payment dispute accounting", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create({
      instance: { launchTimeout: 60000 },
    });
    await mongoose.connect(mongod.getUri(), {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
    });
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
      }
    } finally {
      await mongoose.disconnect().catch(() => null);
      await mongod?.stop();
    }
  });

  test("uses the event type in Paystack dispute webhook identities", () => {
    expect(
      buildPaystackEventId({
        event: { event: "charge.dispute.create", data: { id: 42 } },
      })
    ).toBe("charge.dispute.create:42");
    expect(
      buildPaystackEventId({
        event: { event: "charge.dispute.resolve", data: { id: 42 } },
      })
    ).toBe("charge.dispute.resolve:42");
    expect(
      buildPaystackEventId({
        event: { event: "charge.success", data: { id: 42 } },
      })
    ).toBe("42");
    expect(
      buildPaystackEventId({
        event: {
          event: "charge.dispute.resolve",
          data: { dispute_code: "DSP_fallback" },
        },
      })
    ).toBe("charge.dispute.resolve:DSP_fallback");
  });

  test("leases webhook processing and reclaims stale or failed attempts", async () => {
    const payload = { event: "charge.dispute.resolve", data: { id: 51 } };
    const first = await reservePaymentWebhookEvent({
      provider: "paystack",
      eventId: "charge.dispute.resolve:51",
      eventType: payload.event,
      payload,
    });
    expect(first).toMatchObject({ duplicate: false });
    expect(first.event.processingLeaseUntil).toBeInstanceOf(Date);

    const activeDuplicate = await reservePaymentWebhookEvent({
      provider: "paystack",
      eventId: "charge.dispute.resolve:51",
      eventType: payload.event,
      payload,
    });
    expect(activeDuplicate).toMatchObject({
      duplicate: true,
      inProgress: true,
      retryable: true,
    });

    await PaymentWebhookEvent.updateOne(
      { _id: first.event._id },
      { $set: { processingLeaseUntil: new Date(Date.now() - 1000) } }
    );
    const reclaimed = await reservePaymentWebhookEvent({
      provider: "paystack",
      eventId: "charge.dispute.resolve:51",
      eventType: payload.event,
      payload,
    });
    expect(reclaimed).toMatchObject({ duplicate: false, reclaimed: true });
    expect(reclaimed.event.attemptCount).toBe(2);

    await markPaymentWebhookEvent({ event: reclaimed.event, status: "failed" });
    const failedRetry = await reservePaymentWebhookEvent({
      provider: "paystack",
      eventId: "charge.dispute.resolve:51",
      eventType: payload.event,
      payload,
    });
    expect(failedRetry).toMatchObject({ duplicate: false, reclaimed: true });
    expect(failedRetry.event.attemptCount).toBe(3);
  });

  test("normalizes canonical Paystack dispute amounts and purchase reference", () => {
    expect(
      normalizePaystackDispute(
        {
          id: 42,
          status: "resolved",
          resolution: "merchant-accepted",
          amount: 250000,
          refund_amount: 100000,
          currency: "NGN",
          transaction: { id: 91, reference: "purchase_dispute_ref" },
          resolved_at: "2026-07-15T12:00:00.000Z",
        },
        { eventType: "charge.dispute.resolve" }
      )
    ).toMatchObject({
      providerDisputeId: "42",
      providerRef: "purchase_dispute_ref",
      providerTransactionId: "91",
      disputedAmount: 2500,
      refundAmount: 1000,
      outcome: "accepted",
      isResolved: true,
    });
    expect(
      normalizePaystackDispute({
        dispute_code: "DSP_fallback",
        transaction: { reference: "purchase_dispute_ref" },
      }).providerDisputeId
    ).toBe("DSP_fallback");
    expect(
      shouldResolvePaystackDispute({
        eventType: "charge.dispute.create",
        dispute: { status: "resolved", resolution: "declined" },
      })
    ).toBe(true);
  });

  test("computes the exact partial allocation delta from net revenue", () => {
    const purchase = {
      amount: 2500,
      processingFeeAmount: 137.5,
      taxAmount: 12.5,
      revenueCategory: "music",
      revenueSharePolicy: "artist_music_net_75_v1",
      creatorShareRate: 0.75,
      platformShareRate: 0.25,
    };

    expect(
      computePurchaseDisputeAllocation({ purchase, lossAmount: 1000 })
    ).toMatchObject({
      shareBaseAmount: 2350,
      deductibleLossAmount: 1000,
      creatorDebitAmount: 750,
      platformDebitAmount: 250,
      afterBaseAmount: 1350,
      unallocatedLossAmount: 0,
    });
    expect(
      computePurchaseDisputeAllocation({ purchase, lossAmount: 3000 })
    ).toMatchObject({
      deductibleLossAmount: 2350,
      creatorDebitAmount: 1762.5,
      platformDebitAmount: 587.5,
      unallocatedLossAmount: 650,
    });
  });

  test("holds, releases, and permanently debits an accepted dispute idempotently", async () => {
    const purchase = await createPurchase();
    const opened = normalizePaystackDispute(
      {
        id: 42,
        status: "awaiting-merchant-feedback",
        amount: 100000,
        currency: "NGN",
        transaction: { id: 91, reference: purchase.providerRef },
        created_at: "2026-07-15T11:00:00.000Z",
      },
      { eventType: "charge.dispute.create" }
    );
    const openedUpsert = await upsertPaystackDispute({
      dispute: opened,
      purchaseId: purchase._id,
    });
    const firstHold = await recordDisputeOpenedEntries({
      purchase,
      dispute: openedUpsert.dispute,
      logger: null,
    });
    expect(firstHold).toMatchObject({
      action: "hold",
      createdCount: 2,
      revenueLedgerCreatedCount: 2,
      financialState: "held",
      chargebackAmount: 1000,
      creatorChargebackAmount: 750,
      platformChargebackAmount: 250,
    });

    const secondHold = await recordDisputeOpenedEntries({
      purchase,
      dispute: firstHold.dispute,
      logger: null,
    });
    expect(secondHold.createdCount).toBe(0);
    expect(secondHold.revenueLedgerCreatedCount).toBe(0);

    const resolved = normalizePaystackDispute(
      {
        id: 42,
        status: "resolved",
        resolution: "merchant-accepted",
        amount: 100000,
        refund_amount: 100000,
        currency: "NGN",
        transaction: { id: 91, reference: purchase.providerRef },
        resolved_at: "2026-07-15T12:00:00.000Z",
      },
      { eventType: "charge.dispute.resolve" }
    );
    const resolvedUpsert = await upsertPaystackDispute({
      dispute: resolved,
      purchaseId: purchase._id,
    });
    const firstResolution = await recordDisputeResolvedEntries({
      purchase,
      dispute: resolvedUpsert.dispute,
      logger: null,
    });
    expect(firstResolution).toMatchObject({
      action: "chargeback",
      createdCount: 2,
      revenueLedgerCreatedCount: 2,
      financialState: "debited",
      chargebackAmount: 1000,
      creatorChargebackAmount: 750,
      platformChargebackAmount: 250,
      releaseResult: {
        createdCount: 2,
        revenueLedgerCreatedCount: 2,
      },
    });

    const stored = await PaymentDispute.findById(openedUpsert.dispute._id).lean();
    expect(stored).toMatchObject({
      financialState: "debited",
      chargebackAmount: 1000,
      creatorChargebackAmount: 750,
      platformChargebackAmount: 250,
    });
    expect(await WalletEntry.countDocuments({})).toBe(8);
    expect(await RevenueLedgerEntry.countDocuments({})).toBe(9);
    await expect(
      buildCreatorWalletSummary({ creatorId: purchase.creatorId })
    ).resolves.toMatchObject({
      grossRevenue: 2500,
      chargebacks: 1000,
      netRevenue: 1350,
      totalEarnings: 1012.5,
      platformRevenue: 337.5,
      availableBalance: 1012.5,
    });

    const secondResolution = await recordDisputeResolvedEntries({
      purchase,
      dispute: firstResolution.dispute,
      logger: null,
    });
    expect(secondResolution.createdCount).toBe(0);
    expect(secondResolution.revenueLedgerCreatedCount).toBe(0);
    expect(secondResolution.releaseResult.createdCount).toBe(0);
    expect(await WalletEntry.countDocuments({})).toBe(8);
    expect(await RevenueLedgerEntry.countDocuments({})).toBe(9);
  });

  test("records a canonical resolution even when the create event never arrived", async () => {
    const purchase = await createPurchase();
    const normalized = normalizePaystackDispute(
      {
        id: 43,
        status: "resolved",
        resolution: "merchant-accepted",
        amount: 50000,
        refund_amount: 50000,
        currency: "NGN",
        transaction: { reference: purchase.providerRef },
        resolved_at: "2026-07-15T12:30:00.000Z",
      },
      { eventType: "charge.dispute.resolve" }
    );
    const { dispute } = await upsertPaystackDispute({
      dispute: normalized,
      purchaseId: purchase._id,
    });

    const result = await recordDisputeResolvedEntries({
      purchase,
      dispute,
      logger: null,
    });
    expect(result).toMatchObject({
      action: "chargeback",
      createdCount: 2,
      revenueLedgerCreatedCount: 2,
      financialState: "debited",
      chargebackAmount: 500,
      creatorChargebackAmount: 375,
      platformChargebackAmount: 125,
      releaseResult: { skipped: true, reason: "no_dispute_hold" },
    });
    expect(await WalletEntry.countDocuments({ entryType: "dispute_hold" })).toBe(0);
    expect(await WalletEntry.countDocuments({ entryType: "chargeback_debit" })).toBe(2);
  });

  test("surfaces a ledger failure and repairs it idempotently on retry", async () => {
    const purchase = await createPurchase();
    await recordPurchaseSettlementEntries({ purchase, logger: null });
    const normalized = normalizePaystackDispute(
      {
        id: 44,
        status: "resolved",
        resolution: "merchant-accepted",
        amount: 20000,
        refund_amount: 20000,
        currency: "NGN",
        transaction: { reference: purchase.providerRef },
        resolved_at: "2026-07-15T13:00:00.000Z",
      },
      { eventType: "charge.dispute.resolve" }
    );
    const { dispute } = await upsertPaystackDispute({
      dispute: normalized,
      purchaseId: purchase._id,
    });
    const ledgerCreateSpy = jest
      .spyOn(RevenueLedgerEntry, "create")
      .mockRejectedValueOnce(new Error("simulated ledger outage"));

    const first = await recordDisputeResolvedEntries({
      purchase,
      dispute,
      logger: null,
    });
    expect(first).toMatchObject({
      createdCount: 2,
      revenueLedgerCreatedCount: 0,
      revenueLedgerFailed: true,
      financialState: "debited",
    });

    const changedCanonical = normalizePaystackDispute(
      {
        id: 44,
        status: "resolved",
        resolution: "merchant-accepted",
        amount: 30000,
        refund_amount: 30000,
        currency: "NGN",
        transaction: { reference: purchase.providerRef },
        resolved_at: "2026-07-15T13:05:00.000Z",
      },
      { eventType: "charge.dispute.resolve" }
    );
    const changed = await upsertPaystackDispute({
      dispute: changedCanonical,
      purchaseId: purchase._id,
    });
    const second = await recordDisputeResolvedEntries({
      purchase,
      dispute: changed.dispute,
      logger: null,
    });
    expect(second).toMatchObject({
      createdCount: 0,
      revenueLedgerCreatedCount: 2,
      revenueLedgerFailed: false,
      financialState: "debited",
      chargebackAmount: 200,
      creatorChargebackAmount: 150,
      platformChargebackAmount: 50,
    });
    expect(await WalletEntry.countDocuments({ entryType: "chargeback_debit" })).toBe(2);
    expect(await RevenueLedgerEntry.countDocuments({ ledgerEventType: "chargeback_settled" })).toBe(2);
    const stored = await PaymentDispute.findById(dispute._id).lean();
    expect(stored).toMatchObject({ refundAmount: 300, chargebackAmount: 200 });
    ledgerCreateSpy.mockRestore();
  });

  test("does not apply a chargeback when prerequisite settlement ledgering fails", async () => {
    const purchase = await createPurchase();
    const normalized = normalizePaystackDispute(
      {
        id: 45,
        status: "resolved",
        resolution: "merchant-accepted",
        amount: 50000,
        refund_amount: 50000,
        currency: "NGN",
        transaction: { reference: purchase.providerRef },
      },
      { eventType: "charge.dispute.resolve" }
    );
    const { dispute } = await upsertPaystackDispute({
      dispute: normalized,
      purchaseId: purchase._id,
    });
    const ledgerCreateSpy = jest
      .spyOn(RevenueLedgerEntry, "create")
      .mockRejectedValueOnce(new Error("settlement ledger unavailable"));

    const failed = await recordDisputeResolvedEntries({
      purchase,
      dispute,
      logger: null,
    });
    expect(failed).toMatchObject({
      skipped: true,
      reason: "purchase_settlement_ledger_failed",
      revenueLedgerFailed: true,
      financialState: "manual_review",
    });
    expect(await WalletEntry.countDocuments({ entryType: "chargeback_debit" })).toBe(0);

    ledgerCreateSpy.mockRestore();
    const repaired = await recordDisputeResolvedEntries({
      purchase,
      dispute: failed.dispute,
      logger: null,
    });
    expect(repaired).toMatchObject({
      skipped: false,
      financialState: "debited",
      chargebackAmount: 500,
    });
  });

  test("serializes and caps concurrent open holds and accepted chargebacks", async () => {
    const holdPurchase = await createPurchase({ providerRef: "concurrent_hold_purchase" });
    await recordPurchaseSettlementEntries({ purchase: holdPurchase, logger: null });
    const holdDisputes = await Promise.all(
      [61, 62].map(async (id) => {
        const normalized = normalizePaystackDispute(
          {
            id,
            status: "awaiting-merchant-feedback",
            amount: 200000,
            currency: "NGN",
            transaction: { reference: holdPurchase.providerRef },
          },
          { eventType: "charge.dispute.create" }
        );
        return (await upsertPaystackDispute({
          dispute: normalized,
          purchaseId: holdPurchase._id,
        })).dispute;
      })
    );
    await Promise.all(
      holdDisputes.map((dispute) =>
        recordDisputeOpenedEntries({ purchase: holdPurchase, dispute, logger: null })
      )
    );
    const held = await PaymentDispute.find({ purchaseId: holdPurchase._id }).lean();
    expect(held.reduce((sum, row) => sum + row.holdAmount, 0)).toBe(2350);

    const debitPurchase = await createPurchase({ providerRef: "concurrent_debit_purchase" });
    await recordPurchaseSettlementEntries({ purchase: debitPurchase, logger: null });
    const debitDisputes = await Promise.all(
      [63, 64].map(async (id) => {
        const normalized = normalizePaystackDispute(
          {
            id,
            status: "resolved",
            resolution: "merchant-accepted",
            amount: 200000,
            refund_amount: 200000,
            currency: "NGN",
            transaction: { reference: debitPurchase.providerRef },
          },
          { eventType: "charge.dispute.resolve" }
        );
        return (await upsertPaystackDispute({
          dispute: normalized,
          purchaseId: debitPurchase._id,
        })).dispute;
      })
    );
    const results = await Promise.all(
      debitDisputes.map((dispute) =>
        recordDisputeResolvedEntries({ purchase: debitPurchase, dispute, logger: null })
      )
    );
    expect(results.reduce((sum, row) => sum + row.chargebackAmount, 0)).toBe(2350);
    const debited = await PaymentDispute.find({ purchaseId: debitPurchase._id }).lean();
    expect(debited.reduce((sum, row) => sum + row.chargebackAmount, 0)).toBe(2350);
  });

  test("subtracts chargebacks from item aggregates and exposes recoverable debt", async () => {
    const purchase = await createPurchase();
    await recordPurchaseSettlementEntries({ purchase, logger: null });
    const creatorSale = await WalletEntry.findOne({
      sourceId: purchase._id,
      entryType: "sale_credit",
    });
    await WalletEntry.create({
      walletAccountId: creatorSale.walletAccountId,
      ownerType: "creator",
      ownerId: purchase.creatorId,
      currency: "NGN",
      direction: "debit",
      bucket: "available",
      entryType: "payout_debit",
      amount: creatorSale.amount,
      sourceType: "payout",
      sourceId: new mongoose.Types.ObjectId(),
      sourceRef: "paid_before_chargeback",
      dedupeKey: `test_payout:${purchase._id}`,
    });
    const normalized = normalizePaystackDispute(
      {
        id: 65,
        status: "resolved",
        resolution: "merchant-accepted",
        amount: 250000,
        refund_amount: 250000,
        currency: "NGN",
        transaction: { reference: purchase.providerRef },
      },
      { eventType: "charge.dispute.resolve" }
    );
    const { dispute } = await upsertPaystackDispute({
      dispute: normalized,
      purchaseId: purchase._id,
    });
    await recordDisputeResolvedEntries({ purchase, dispute, logger: null });

    const summary = await buildCreatorWalletSummary({ creatorId: purchase.creatorId });
    expect(summary).toMatchObject({
      availableBalance: -1762.5,
      spendableBalance: 0,
      recoverableBalance: -1762.5,
      debtBalance: 1762.5,
      totalEarnings: 0,
    });
    const snapshot = await buildCreatorWalletSnapshot({ creatorId: purchase.creatorId });
    expect(snapshot.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "track",
          chargebacks: 2350,
          netRevenue: 0,
          creatorEarnings: 0,
        }),
      ])
    );
    expect(snapshot.itemEarningsMap.get(`track:${purchase.itemId}`)).toBe(0);
  });
});
