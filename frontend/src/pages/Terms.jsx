import SeoHead from "../components/seo/SeoHead";

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <SeoHead
        title="Terms of Service | Tengacion"
        description="Read the Tengacion Terms of Service covering platform rules, creator responsibilities, and paid features."
        canonical="/terms"
      />
      <h1>Terms of Service</h1>
      <p>By using Tengacion, you agree to follow platform rules, applicable laws, and community standards.</p>
      <p>Accounts may be suspended for abuse, fraud, or repeated policy violations.</p>
      <p>Paid features are subject to billing terms and refund policy where applicable.</p>
      <p>Contact support for disputes or account-related issues.</p>
    </main>
  );
}
