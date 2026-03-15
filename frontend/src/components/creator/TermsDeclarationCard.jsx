import { Link } from "react-router-dom";

export default function TermsDeclarationCard({
  acceptedTerms,
  acceptedCopyrightDeclaration,
  onAcceptedTermsChange,
  onAcceptedCopyrightChange,
  errors = {},
}) {
  return (
    <section className="creator-terms-card">
      <div className="creator-form-block-head">
        <div>
          <h3>Terms and copyright declaration</h3>
          <p>Every creator account must confirm platform terms and upload rights before publishing.</p>
        </div>
      </div>

      <label className="creator-check-row">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(event) => onAcceptedTermsChange(event.target.checked)}
        />
        <span>
          I agree to the <Link to="/terms">Terms of Service</Link>.
        </span>
      </label>
      {errors.acceptedTerms ? <p className="creator-field-error">{errors.acceptedTerms}</p> : null}

      <label className="creator-check-row">
        <input
          type="checkbox"
          checked={acceptedCopyrightDeclaration}
          onChange={(event) => onAcceptedCopyrightChange(event.target.checked)}
        />
        <span>
          I confirm that I own the rights or have legal authorization to upload the content I publish on Tengacion. Read the{" "}
          <Link to="/copyright-policy">Copyright Policy</Link>.
        </span>
      </label>
      {errors.acceptedCopyrightDeclaration ? (
        <p className="creator-field-error">{errors.acceptedCopyrightDeclaration}</p>
      ) : null}
    </section>
  );
}
