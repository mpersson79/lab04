# Risk, security and compliance standard

## Risk register

Every service has entries in the risk register, owned by the service owner.

Each entry records: description, cause, impact if realised, likelihood, current
score, existing controls, target score, mitigation with owner and date, and a
review date.

Scoring is likelihood times impact on a 5x5 scale.

| Score | Rating | Handling |
|---|---|---|
| 1–4 | Low | Service owner accepts, reviews annually |
| 5–9 | Medium | Service owner accepts with a mitigation plan, reviews quarterly |
| 10–15 | High | Portfolio lead accepts, reviews monthly, mitigation funded |
| 16–25 | Critical | Executive acceptance, reviewed weekly until reduced |

A risk with no review date is not accepted, it is ignored. Acceptance always
expires.

## Vulnerability remediation SLA

Measured from the date the finding is available to us, not from the date someone
noticed it.

| Severity | Internet-facing | Internal | Non-production |
|---|---|---|---|
| Critical | 48 hours | 7 days | 30 days |
| High | 7 days | 30 days | 90 days |
| Medium | 30 days | 90 days | Best effort |
| Low | 90 days | Best effort | Best effort |

Breaching a remediation SLA creates a risk register entry automatically. It
cannot be closed by re-scanning; it is closed by fixing or by an accepted risk
with an expiry.

## Access

- Production access is role-based, time-bound and reviewed quarterly.
- Standing administrative access is an exception with a named justification and
  an expiry.
- Break-glass access is logged, alerts the service owner in real time, and is
  reviewed within one business day.
- Access is removed on the day a person changes role, not at the next review.

## Data

- Every data store carries a classification, a residency constraint and a
  retention period.
- Retention is enforced by automation, not by intention.
- Customer data leaving the service boundary requires a documented legal basis.
- Backups inherit the classification and residency of their source.
- Deletion on request is proven with evidence, including from backups within the
  backup retention window.

## Compliance evidence

The service owner keeps evidence current and is the named respondent for
findings against the service.

| Evidence | Frequency | Expires |
|---|---|---|
| Access review | Quarterly | 90 days |
| Penetration test | Annual | 12 months |
| DR rehearsal record | Quarterly | 90 days |
| Backup restore proof | Monthly | 30 days |
| Vulnerability scan | Continuous, reported monthly | 30 days |
| Change sample audit | Quarterly | 90 days |
| Vendor assurance review | Annual | 12 months |

Evidence expiring within 90 days appears on the service owner's monthly review.
Expired evidence is treated as a failed control until it is refreshed.

## Third parties

- Every third party the service depends on is registered with its own criticality
  rating, contract dates and assurance status.
- A critical dependency without a contingency plan is a high risk by definition.
- Vendor incidents affecting our SLA are our incidents from the customer's point
  of view. We own the communication and the credit.
