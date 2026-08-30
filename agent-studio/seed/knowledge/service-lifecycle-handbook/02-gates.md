# Gate criteria

Each gate has exit criteria. A gate decision is one of **Pass**, **Pass with
conditions**, or **Hold**. Every decision is recorded (see `03-artifacts.md`).

"Pass with conditions" carries a named owner and a due date per condition. A
condition that is still open at the next gate is automatically an escalation to
the portfolio review.

## Gate 1 — Intake to Design

- Named service owner, accepted in writing.
- Customer segment and the problem the service solves, stated in one paragraph.
- Rough order of magnitude cost to build and to run per year.
- Build-versus-buy assessment with a recommendation.
- Portfolio fit: does this overlap an existing service, and if so why keep both.
- Named sponsor and funding source for the Design stage.

## Gate 2 — Design to Build

- Target architecture with the trust and failure boundaries drawn.
- SLA published to customers and the internal SLOs that back it, with the error
  budget stated. The internal SLO must be strictly tighter than the SLA.
- Every external dependency listed with its own availability and what happens
  when it fails.
- Data classification, residency and retention decided.
- Security review of the design completed, with threats and mitigations recorded.
- Support model: hours of cover, escalation path, who is on call, response and
  resolution targets per severity.
- Unit cost model: what one unit of this service costs to run, and the target
  gross margin at the expected volume.
- Capacity model with the assumed growth curve and the scaling trigger points.

## Gate 3 — Build to Validate

- Infrastructure defined as code; no hand-built production resources.
- Deployment pipeline with an automated rollback path proven at least once.
- Observability: SLIs actually measured, dashboards published, alerts bound to
  the SLOs rather than to raw resource metrics.
- A runbook for every alert that can page a human.
- Backup implemented and a restore proven, not just configured.
- Disaster recovery plan written with an RTO and RPO that match the design.
- Test evidence: unit, integration and failure-injection results attached.

## Gate 4 — Validate to Launch

- Operational readiness review passed, with the operate team's explicit
  acceptance.
- Penetration test complete; no open critical or high findings without an
  accepted risk signed by the service owner.
- Disaster recovery rehearsal executed end to end with the measured RTO and RPO
  recorded against target.
- Load and soak test results within the capacity model's assumptions.
- On-call rota staffed for at least two full rotations with trained engineers.
- Runbooks walked through by an engineer who did not write them.
- Customer-facing documentation and status page in place.

## Gate 5 — Launch to Operate

- Catalogue entry live with pricing, SLA and order form.
- At least one customer onboarded end to end, including billing.
- Hypercare exit criteria met: agreed period elapsed with no severity 1
  incidents open and no more than the agreed number of severity 2 incidents.
- Support queues, routing and escalation verified with a real ticket.
- Billing verified against a real invoice line.
- Known issues and their workarounds published.

## Gate 6 — Operate to Retire

- Retirement rationale with the commercial and risk case.
- Notice period served to every affected customer per contract.
- Migration path published and tested, with named support for customers moving.
- Contract exits, final invoices and any credits settled.
- Data exported to customers, then disposed of with certification.
- Infrastructure, licences and third-party contracts terminated.
- Records archived for the retention period.
- Post-retirement review completed and lessons recorded.

## Continuous criteria — applied at every gate after Launch

These are checked at each service review, not only at gates:

- SLO attainment over the trailing period, and error budget consumed.
- Open severity 1 and 2 incidents, and problem records without a root cause.
- Change success rate and number of emergency changes.
- Patch currency and open critical vulnerabilities against the agreed SLA.
- Gross margin against target, and cost per unit trend.
- Runbook coverage and staleness.
- Open audit findings and expiring compliance evidence.
