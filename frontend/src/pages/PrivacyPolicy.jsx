import SeoHead from "../components/seo/SeoHead";

export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <SeoHead
        title="Privacy Policy | Tengacion"
        description="Learn how Tengacion processes account information, creator content, and privacy controls across the platform."
        canonical="/privacy"
      />
      <h1>Privacy Policy</h1>
      <p>We process account information, content, and usage events to provide Tengacion features.</p>
      <p>You can control profile visibility, messaging permissions, and notification preferences in settings.</p>
      <p>Security events and moderation actions are logged for platform safety and abuse prevention.</p>
      <p>Contact support to request access, correction, or deletion of your personal data.</p>
    </main>
  );
}
