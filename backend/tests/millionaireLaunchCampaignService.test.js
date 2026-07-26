process.env.NODE_ENV = "test";
process.env.APP_URL = "https://tengacion.com";

const {
  CAMPAIGN_KEY,
  CAMPAIGN_SUBJECT,
  buildMillionaireLaunchEmail,
} = require("../services/millionaireLaunchCampaignService");

describe("Millionaire launch campaign email", () => {
  test("includes the flyer, launch time, guiding rules, verified prizes and registration link", () => {
    const email = buildMillionaireLaunchEmail({
      name: "Ada Lovelace",
      flyerUrl:
        "https://tengacion.com/assets/campaigns/tengacion-millionaire-2026.png?v=20260726-daily-prizes",
      registrationUrl: "https://tengacion.com/millionaire/register",
    });

    expect(CAMPAIGN_KEY).toBe("millionaire-launch-2026-07-26");
    expect(CAMPAIGN_SUBJECT).toContain("starts today");
    expect(email.html).toContain(
      'src="https://tengacion.com/assets/campaigns/tengacion-millionaire-2026.png?v=20260726-daily-prizes"'
    );
    expect(email.html).toContain("Sunday, 26 July 2026");
    expect(email.html).toContain("15 multiple-choice questions");
    expect(email.html).toContain("one Ask AI hint");
    expect(email.html).toContain("₦100");
    expect(email.html).toContain("₦400");
    expect(email.html).toContain("₦1,000");
    expect(email.html).toContain("20-second");
    expect(email.html).toContain("https://tengacion.com/millionaire/register");
    expect(email.html).toContain("will not be asked to enter more profile details");
    expect(email.text).toContain("Flyer:");
  });

  test("escapes a recipient name before adding it to email HTML", () => {
    const email = buildMillionaireLaunchEmail({
      name: "<script>alert(1)</script>",
      flyerUrl: "https://tengacion.com/flyer.png",
      registrationUrl: "https://tengacion.com/millionaire/register",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
