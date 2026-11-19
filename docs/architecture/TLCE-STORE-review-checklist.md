# TLCE STORE Reviewer Checklist

This checklist is an internal review standard. It is not a public approval mechanism and must not be treated as a substitute for automated security testing.

## A. Developer and ownership

- [ ] Developer identity and contact channel verified through an approved private process.
- [ ] Developer account is active and approved for publishing.
- [ ] Legal owner and distribution rights are documented.
- [ ] Trademark, copyright, and third-party license claims are checked.
- [ ] Reviewer is not the submitter and has no undisclosed conflict.

## B. Product integrity

- [ ] Product purpose and core features match the listing.
- [ ] Source repository or official product source is recorded.
- [ ] Release version and release notes are present.
- [ ] No misleading claims, deceptive UI, or hidden monetization.
- [ ] Support and vulnerability-reporting channels are valid.

## C. Privacy and data handling

- [ ] Privacy policy is reachable over HTTPS and matches observed behavior.
- [ ] Data collection, retention, sharing, and deletion are disclosed.
- [ ] Sensitive data handling is justified and minimized.
- [ ] Permissions are necessary, proportionate, and explained.
- [ ] No credential harvesting, recovery phrase collection, or covert tracking.

## D. Technical security

- [ ] Dependencies and known vulnerabilities reviewed.
- [ ] Authentication, authorization, and session handling tested where applicable.
- [ ] External links, redirects, downloads, and update mechanisms checked.
- [ ] No embedded secrets, private keys, debug endpoints, or unsafe test credentials.
- [ ] XSS, injection, path traversal, and unsafe deserialization checks completed.
- [ ] Build provenance and artifact checksum recorded.

## E. Android-specific release gate

- [ ] Package identifier and SDK metadata verified.
- [ ] APK/AAB malware scan completed with recorded tool/version/result.
- [ ] Signing certificate fingerprint matches approved release identity.
- [ ] SHA-256 checksum recorded and independently recomputed.
- [ ] Requested permissions match the product's declared behavior.
- [ ] Release artifact is immutable and stored outside the public source repository.
- [ ] Rollback and signing-key incident procedures exist.

## F. Decision and publication

- [ ] Decision is one of approved, changes_requested, or rejected.
- [ ] Reviewer identity, timestamp, product version, and evidence references recorded.
- [ ] Reasons and required remediation are documented.
- [ ] Publisher independently confirms the release record.
- [ ] Public catalogue record is generated from trusted server-side approval state.
- [ ] Takedown, suspension, and rollback path is available.

## Decision rule

A missing mandatory check means the release cannot be published. A catalogue flag, developer assertion, or passing static schema validation is not evidence that a product is safe.
