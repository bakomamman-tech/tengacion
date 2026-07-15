const crypto = require("crypto");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-dispute-webhook-test";
process.env.PAYSTACK_SECRET_KEY = "sk_test_dispute_webhook_1234567890";

const Entitlement = require("../models/Entitlement");
const PaymentDispute = require("../models/PaymentDispute");
const PaymentWebhookEvent = require("../models/PaymentWebhookEvent");
const Purchase = require("../models/Purchase");
const RevenueLedgerEntry = require("../models/RevenueLedgerEntry");
const Track = require("../models/Track");
const WalletEntry = require("../models/WalletEntry");
const {
  handlePaystackWebhookEvent,
  loadPurchaseOperationalArtifacts,
} = require("../services/paymentOpsService");
const {
  recordPurchaseSettlementEntries,
} = require("../services/walletService");

const originalFetch = global.fetch;
let mongod;

const providerResponse = (data) => ({
  ok: true,
  json: async () => ({ status: true, data }),
});

const buildCanonicalDispute = ({
  id,
  reference,
  amountMinor = 250000,
  refundAmountMinor = 0,
  status = "awaiting-merchant-feedback",
  resolution = "",
  resolvedAt = null,
} = {}) => ({
  id,
  status,
  resolution,
  amount: amountMinor,
  refund_amount: refundAmountMinor,
  currency: "NGN",
  created_at: "2026-07-15T11:00:00.000Z",
  updated_at: resolvedAt || "2026-07-15T11:00:00.000Z",
  resolved_at: resolvedAt,
  transaction: {
    id: 901,
    reference,
    amount: 250000,
    currency: "NGN",
  },
});

const deliverDisputeEvent = async ({ eventType, disputeId, reference }) => {
  const payload = {
    event: eventType,
    data: {
      id: disputeId,
      transaction: { reference },
    },
  };
  const rawBody = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");
  return handlePaystackWebhookEvent({
    rawBody,
    signature,
    event: payload,
  });
};

const createPaidMusicPurchase = async ({ reference = "paid_dispute_purchase" } = {}) => {
  const creatorId = new mongoose.Types.ObjectId();
  const buyerId = new mongoose.Types.ObjectId();
  const track = await Track.create({
    creatorId,
    title: "Disputed Music Sale",
    price: 2500,
    priceNGN: 2500,
    audioUrl: "https://example.com/disputed-track.mp3",
    kind: "music",
    creatorCategory: "music",
    contentType: "track",
    publishedStatus: "published",
    isPublished: true,
    purchaseCount: 1,
  });
  const purchase = await Purchase.create({
    userId: buyerId,
    creatorId,
    itemType: "track",
    itemId: track._id,
    amount: 2500,
    priceNGN: 2500,
    processingFeeAmount: 100,
    taxAmount: 0,
    currency: "NGN",
    status: "paid",
    provider: "paystack",
    providerRef: reference,
    paidAt: new Date("2026-07-15T10:00:00.000Z"),
    revenueCategory: "music",
    revenueSharePolicy: "artist_music_net_75_v1",
    creatorShareRate: 0.75,
    platformShareRate: 0.25,
  });
  await Entitlement.create({
    buyerId,
    itemType: "track",
    itemId: track._id,
    grantedAt: purchase.paidAt,
  });
  await recordPurchaseSettlementEntries({ purchase, logger: null });
  return { purchase, track };
};

describe("Paystack dispute webhook integration", () => {
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
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => null);
    await mongod?.stop();
  });

  test("opens, reminds, and settles a full accepted chargeback exactly once", async () => {
    const { purchase, track } = await createPaidMusicPurchase({
      reference: "full_chargeback_purchase",
    });
    const disputeId = 2867;

    global.fetch = jest.fn().mockResolvedValue(
      providerResponse(
        buildCanonicalDispute({
          id: disputeId,
          reference: purchase.providerRef,
        })
      )
    );
    await expect(
      deliverDisputeEvent({
        eventType: "charge.dispute.create",
        disputeId,
        reference: purchase.providerRef,
      })
    ).resolves.toMatchObject({ dispute: true, action: "hold" });

    let storedDispute = await PaymentDispute.findOne({ providerDisputeId: String(disputeId) }).lean();
    expect(storedDispute.financialState).toBe("held");
    expect(await WalletEntry.countDocuments({ entryType: "dispute_hold" })).toBe(2);

    await expect(
      deliverDisputeEvent({
        eventType: "charge.dispute.remind",
        disputeId,
        reference: purchase.providerRef,
      })
    ).resolves.toMatchObject({ dispute: true, action: "hold" });
    expect(await WalletEntry.countDocuments({ entryType: "dispute_hold" })).toBe(2);

    global.fetch = jest.fn().mockResolvedValue(
      providerResponse(
        buildCanonicalDispute({
          id: disputeId,
          reference: purchase.providerRef,
          refundAmountMinor: 250000,
          status: "resolved",
          resolution: "merchant-accepted",
          resolvedAt: "2026-07-15T12:00:00.000Z",
        })
      )
    );
    const resolution = await deliverDisputeEvent({
      eventType: "charge.dispute.resolve",
      disputeId,
      reference: purchase.providerRef,
    });
    expect(resolution).toMatchObject({
      dispute: true,
      action: "chargeback",
      financialState: "debited",
      accessRevoked: true,
      fullyChargedBack: true,
    });

    storedDispute = await PaymentDispute.findById(storedDispute._id).lean();
    expect(storedDispute).toMatchObject({
      financialState: "debited",
      chargebackAmount: 2400,
      creatorChargebackAmount: 1800,
      platformChargebackAmount: 600,
    });
    const updatedPurchase = await Purchase.findById(purchase._id).lean();
    expect(updatedPurchase).toMatchObject({
      status: "refunded",
      refundReason: `paystack_chargeback:${disputeId}`,
    });
    expect(await Entitlement.countDocuments({ itemId: track._id })).toBe(0);
    expect((await Track.findById(track._id).lean()).purchaseCount).toBe(0);
    expect(await WalletEntry.countDocuments({ entryType: "dispute_release" })).toBe(2);
    expect(await WalletEntry.countDocuments({ entryType: "chargeback_debit" })).toBe(2);
    expect(await RevenueLedgerEntry.countDocuments({ sourceType: "dispute" })).toBe(6);

    global.fetch = jest.fn();
    await expect(
      deliverDisputeEvent({
        eventType: "charge.dispute.resolve",
        disputeId,
        reference: purchase.providerRef,
      })
    ).resolves.toMatchObject({ received: true, duplicate: true });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(await WalletEntry.countDocuments({ sourceType: "dispute" })).toBe(6);
    expect(await PaymentWebhookEvent.countDocuments({ provider: "paystack" })).toBe(3);

    const artifacts = await loadPurchaseOperationalArtifacts(updatedPurchase);
    expect(artifacts.disputes).toHaveLength(1);
    expect(artifacts.walletEntries.filter((entry) => entry.sourceType === "dispute")).toHaveLength(6);
  });

  test("releases a won dispute without debiting revenue or revoking access", async () => {
    const { purchase, track } = await createPaidMusicPurchase({
      reference: "declined_dispute_purchase",
    });
    const disputeId = 2868;
    global.fetch = jest.fn().mockResolvedValue(
      providerResponse(
        buildCanonicalDispute({ id: disputeId, reference: purchase.providerRef })
      )
    );
    await deliverDisputeEvent({
      eventType: "charge.dispute.create",
      disputeId,
      reference: purchase.providerRef,
    });

    global.fetch = jest.fn().mockResolvedValue(
      providerResponse(
        buildCanonicalDispute({
          id: disputeId,
          reference: purchase.providerRef,
          status: "resolved",
          resolution: "declined",
          resolvedAt: "2026-07-15T12:30:00.000Z",
        })
      )
    );
    await expect(
      deliverDisputeEvent({
        eventType: "charge.dispute.resolve",
        disputeId,
        reference: purchase.providerRef,
      })
    ).resolves.toMatchObject({
      action: "release",
      financialState: "released",
      accessRevoked: false,
    });

    expect((await Purchase.findById(purchase._id).lean()).status).toBe("paid");
    expect(await Entitlement.countDocuments({ itemId: track._id })).toBe(1);
    expect((await Track.findById(track._id).lean()).purchaseCount).toBe(1);
    expect(await WalletEntry.countDocuments({ entryType: "chargeback_debit" })).toBe(0);
    expect(await WalletEntry.countDocuments({ entryType: "dispute_release" })).toBe(2);
  });

  test("uses canonical resolution when a delayed create event arrives", async () => {
    const { purchase } = await createPaidMusicPurchase({
      reference: "delayed_create_resolved_purchase",
    });
    const disputeId = 2871;

    global.fetch = jest.fn().mockResolvedValue(
      providerResponse(
        buildCanonicalDispute({
          id: disputeId,
          reference: purchase.providerRef,
          refundAmountMinor: 250000,
          status: "resolved",
          resolution: "merchant-accepted",
          resolvedAt: "2026-07-15T12:45:00.000Z",
        })
      )
    );

    await expect(
      deliverDisputeEvent({
        eventType: "charge.dispute.create",
        disputeId,
        reference: purchase.providerRef,
      })
    ).resolves.toMatchObject({
      dispute: true,
      action: "chargeback",
      financialState: "debited",
      fullyChargedBack: true,
      accessRevoked: true,
    });

    expect(await WalletEntry.countDocuments({ entryType: "dispute_hold" })).toBe(0);
    expect(await WalletEntry.countDocuments({ entryType: "chargeback_debit" })).toBe(2);
    expect(await Entitlement.countDocuments({ buyerId: purchase.userId })).toBe(0);
  });

  test("applies a partial loss to Net Revenue while retaining the entitlement", async () => {
    const { purchase, track } = await createPaidMusicPurchase({
      reference: "partial_chargeback_purchase",
    });
    const disputeId = 2869;
    global.fetch = jest.fn().mockResolvedValue(
      providerResponse(
        buildCanonicalDispute({
          id: disputeId,
          reference: purchase.providerRef,
          amountMinor: 100000,
        })
      )
    );
    await deliverDisputeEvent({
      eventType: "charge.dispute.create",
      disputeId,
      reference: purchase.providerRef,
    });

    global.fetch = jest.fn().mockResolvedValue(
      providerResponse(
        buildCanonicalDispute({
          id: disputeId,
          reference: purchase.providerRef,
          amountMinor: 100000,
          refundAmountMinor: 100000,
          status: "resolved",
          resolution: "merchant-accepted",
          resolvedAt: "2026-07-15T13:00:00.000Z",
        })
      )
    );
    await expect(
      deliverDisputeEvent({
        eventType: "charge.dispute.resolve",
        disputeId,
        reference: purchase.providerRef,
      })
    ).resolves.toMatchObject({
      action: "chargeback",
      financialState: "debited",
      accessRevoked: false,
      fullyChargedBack: false,
    });

    expect(await PaymentDispute.findOne({ providerDisputeId: String(disputeId) }).lean()).toMatchObject({
      chargebackAmount: 1000,
      creatorChargebackAmount: 750,
      platformChargebackAmount: 250,
    });
    expect((await Purchase.findById(purchase._id).lean()).status).toBe("paid");
    expect(await Entitlement.countDocuments({ itemId: track._id })).toBe(1);
    expect((await Track.findById(track._id).lean()).purchaseCount).toBe(1);
  });

  test("marks a failed provider lookup and repairs the same event on retry", async () => {
    const { purchase } = await createPaidMusicPurchase({
      reference: "retry_dispute_purchase",
    });
    const disputeId = 2870;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ status: false, message: "temporary provider outage" }),
    });
    await expect(
      deliverDisputeEvent({
        eventType: "charge.dispute.create",
        disputeId,
        reference: purchase.providerRef,
      })
    ).rejects.toThrow(/temporary provider outage/i);
    expect(
      await PaymentWebhookEvent.findOne({
        eventId: `charge.dispute.create:${disputeId}`,
      }).lean()
    ).toMatchObject({ status: "failed" });

    global.fetch = jest.fn().mockResolvedValue(
      providerResponse(
        buildCanonicalDispute({ id: disputeId, reference: purchase.providerRef })
      )
    );
    await expect(
      deliverDisputeEvent({
        eventType: "charge.dispute.create",
        disputeId,
        reference: purchase.providerRef,
      })
    ).resolves.toMatchObject({ action: "hold", financialState: "held" });
    expect(
      await PaymentWebhookEvent.findOne({
        eventId: `charge.dispute.create:${disputeId}`,
      }).lean()
    ).toMatchObject({ status: "processed", duplicateCount: 1 });
    expect(await WalletEntry.countDocuments({ entryType: "dispute_hold" })).toBe(2);
  });
});
