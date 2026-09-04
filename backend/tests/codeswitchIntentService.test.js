const {
  analyzeCodeswitchIntent,
} = require(
  "../services/codeswitchIntentService"
);

describe(
  "VoiceBridge deterministic intent service",
  () => {
    test(
      "extracts Hausa-English payment intent",
      () => {
        const result =
          analyzeCodeswitchIntent({
            transcript:
              "Don Allah, check my payment, na biya naira dubu biyar jiya amma ban samu confirmation ba.",
            languagePair: "ha-en",
          });

        expect(result.intent).toBe(
          "payment_confirmation_check"
        );

        expect(result.entities).toEqual({
          amount: 5000,
          currency: "NGN",
          timeReference: "yesterday",
          transactionReference: null,
        });

        expect(
          result.requestedAction
        ).toBe("check_payment_status");

        expect(
          result.actionPolicy
            .moneyMovementAllowed
        ).toBe(false);
      }
    );

    test(
      "extracts Pidgin payment intent",
      () => {
        const result =
          analyzeCodeswitchIntent({
            transcript:
              "Abeg check my payment, I pay five thousand naira yesterday but I never get confirmation.",
            languagePair: "pcm-en",
          });

        expect(result.intent).toBe(
          "payment_confirmation_check"
        );

        expect(result.entities.amount)
          .toBe(5000);
      }
    );

    test.each([
      "Don Allah check my payment na biya naira dubu biyar jiya amma ban samu conformation ba",
      "Dan Allah check my payment na biya naira dubu biyar jiya amma ban samu confirmation ba",
      "Check my payment, I pay five thousand naira but I never get konfirmation",
    ])(
      "tolerates observed ASR confirmation variants",
      (transcript) => {
        const result =
          analyzeCodeswitchIntent({
            transcript,
            languagePair: "ha-en",
          });

        expect(result.intent).toBe(
          "payment_confirmation_check"
        );
      }
    );

    test(
      "refund requests never move money",
      () => {
        const result =
          analyzeCodeswitchIntent({
            transcript:
              "Please refund my payment and give me my money back.",
            languagePair: "pcm-en",
          });

        expect(result.intent).toBe(
          "refund_request"
        );

        expect(
          result.requestedAction
        ).toBe(
          "prepare_refund_support_case"
        );

        expect(
          result.actionPolicy
            .moneyMovementAllowed
        ).toBe(false);

        expect(
          result.actionPolicy
            .manualReviewRequired
        ).toBe(true);
      }
    );

    test(
      "refund intent takes precedence over confirmation status",
      () => {
        const result =
          analyzeCodeswitchIntent({
            transcript:
              "I did not get confirmation for my payment, please refund my money.",
            languagePair: "pcm-en",
          });

        expect(result.intent).toBe(
          "refund_request"
        );

        expect(
          result.requestedAction
        ).toBe(
          "prepare_refund_support_case"
        );

        expect(
          result.actionPolicy
            .moneyMovementAllowed
        ).toBe(false);

        expect(
          result.actionPolicy
            .manualReviewRequired
        ).toBe(true);
      }
    );

    test(
      "unknown requests go to manual review",
      () => {
        const result =
          analyzeCodeswitchIntent({
            transcript:
              "Hello I need some help",
            languagePair: "ha-en",
          });

        expect(result.intent).toBe(
          "unknown"
        );

        expect(
          result.requestedAction
        ).toBe(
          "manual_support_review"
        );
      }
    );
  }
);
