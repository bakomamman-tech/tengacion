process.env.NODE_ENV = "test";
process.env.PAYSTACK_CURRENCY = process.env.PAYSTACK_CURRENCY || "NGN";

const {
  normalizePaystackResponse,
  resolvePaystackTransactionDeductions,
} = require("../services/paystackService");

describe("Paystack tax provenance", () => {
  test.each([
    [0, 0],
    [50000, 500],
  ])("accepts a valid provider minor-unit tax value %#", (taxAmountMinor, expected) => {
    const transaction = normalizePaystackResponse({
      data: {
        status: "success",
        amount: 1000000,
        currency: "NGN",
        tax_amount: taxAmountMinor,
      },
    });

    expect(transaction).toMatchObject({
      taxAmount: expected,
      taxProviderReported: true,
    });
    expect(
      resolvePaystackTransactionDeductions({
        transaction,
        grossAmount: 10000,
        taxAmount: 697.67,
      })
    ).toMatchObject({
      taxAmount: expected,
      taxProviderReported: true,
    });
  });

  test.each(["invalid", -1, "-50", Number.NaN])(
    "does not treat malformed provider tax %p as reported",
    (providerTax) => {
      const transaction = normalizePaystackResponse({
        data: {
          status: "success",
          amount: 1000000,
          currency: "NGN",
          tax_amount: providerTax,
        },
      });

      expect(transaction.taxAmount).toBeNull();
      expect(transaction.taxProviderReported).toBe(false);
      expect(
        resolvePaystackTransactionDeductions({
          transaction,
          grossAmount: 10000,
          taxAmount: 697.67,
        })
      ).toMatchObject({
        taxAmount: 697.67,
        taxProviderReported: false,
      });
    }
  );

  test("requires a valid amount even when a provider-reported flag is present", () => {
    expect(
      resolvePaystackTransactionDeductions({
        transaction: {
          taxProviderReported: true,
          taxAmount: null,
        },
        grossAmount: 10000,
        taxAmount: 697.67,
      })
    ).toMatchObject({
      taxAmount: 697.67,
      taxProviderReported: false,
    });
  });

  test("accepts a valid major-unit tax value from transaction metadata", () => {
    expect(
      resolvePaystackTransactionDeductions({
        transaction: {
          metadata: { taxAmount: "125.50" },
        },
        grossAmount: 10000,
        taxAmount: 697.67,
      })
    ).toMatchObject({
      taxAmount: 125.5,
      taxProviderReported: true,
    });
  });
});
