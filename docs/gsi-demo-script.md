# TEAM ARCHIVE Demo Script

Target length: 3–4 minutes.

1. Open `https://www.tengacion.com/gsi` on a desktop or phone.
2. Explain the promise: an editor can move a journal from hard to discover to permanently recorded without learning new infrastructure.
3. Search for a known journal by ISSN. Point out that the results are live OpenAlex Sources data and include publisher, country, ISSN, and indexed-work count.
4. Select the correct result. Show the imported source reference, total work count, editable journal details, and recent publication list.
5. Mention the recovery paths: similar names require selection; missing data is visibly labeled; empty searches give next-step guidance.
6. Calculate the score. Expand two components and read the numerator, denominator, weight, and earned points. Call out the fairness box: visibility is measured, prestige is not.
7. Continue to confirmation. Show that the source, import time, score formula, and publication evidence will be retained together.
8. Check the editor confirmation and select **Publish Journal Record** once.
9. On success, copy the public Tengacion link. Open the public certificate and show the GSI Score, archived publications, OpenAlex source, integrity fingerprint, and independent copy.
10. Close with the architecture: React → Express → OpenAlex → transparent scorer → server-managed public IPFS record. The editor completed a familiar academic workflow with no infrastructure account, payment, or signing step.

## Backup plan

- Keep one previously published public certificate open in a second tab.
- Keep screenshots of search results, score breakdown, confirmation, and certificate.
- If OpenAlex is temporarily unavailable, show the helpful retry state, then use the existing certificate to demonstrate scoring and verification.
- If a newly published record is still propagating, use its success screen first and refresh the public certificate after a short interval.

## Likely judge questions

**Is the score random?** No. `docs/gsi-scoring-model.md` documents all six formulas, and every archived record contains the component evidence.

**Can the browser fake a high score?** No. Publication evidence and the score are fetched and recalculated on the server during the final save.

**How is missing Global South metadata treated?** It remains visible as missing discoverability evidence; the fairness note prevents interpreting that as low research quality.

**Why public IPFS?** It returns a content-derived reference for immutable public JSON, is permitted by the brief, and lets the backend hide the entire archival operation behind one clear action.
