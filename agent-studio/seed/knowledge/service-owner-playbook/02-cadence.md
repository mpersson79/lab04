# Service owner cadence — the recurring task inventory

This is the full set of recurring tasks a service owner performs. The
**Service owner control desk** workflow is built around these lanes: the
reliability lane covers the SLO and incident items, the change lane covers the
change and release items, the commercial lane covers cost and margin, the risk
lane covers security and compliance, and the customer lane covers demand,
feedback and onboarding.

## Daily

- Review overnight incidents and anything still open at severity 1 or 2.
- Check error budget burn against the trailing window; flag if the burn rate
  would exhaust the budget before the period ends.
- Review the change queue for anything landing today that touches a customer.
- Scan the on-call handover notes for unresolved issues and for pages that had
  no runbook.
- Clear anything in the escalation inbox.

## Weekly

- Service health review with the operate team: incidents, problems without a
  root cause, repeat pages, toil.
- Change review: last week's success rate, any failed or backed-out changes,
  the count of emergency changes and whether each was genuinely unavoidable.
- Vulnerability review: new critical and high findings, and the age of the
  oldest open one against the remediation SLA.
- Cost check: week-on-week spend movement and any anomaly over the alert
  threshold.
- Onboarding pipeline: customers in flight, blockers, and dates at risk.
- Groom the CSI backlog and confirm the next two weeks of improvement work.
- Runbook check: any alert that paged without a runbook gets one written this
  week.

## Monthly

- Publish the service report: SLO attainment, incident summary, changes,
  planned work, and any credits due.
- Service review with each major customer.
- Margin review: revenue, cost to serve, gross margin against target, and the
  unit cost trend.
- Capacity review against the growth curve; adjust the forecast.
- Risk register review: re-score, close what is mitigated, escalate what has
  aged past its review date.
- Problem management review: are root causes actually being found and fixed.
- Compliance evidence check: what expires in the next 90 days.
- On-call health: page volume per engineer, out-of-hours pages, and fairness of
  the rota.

## Quarterly

- Portfolio review: the service's position, investment case, and whether it
  should continue, change shape, or be retired.
- Disaster recovery rehearsal, with measured RTO and RPO recorded against
  target.
- SLA and SLO review: are the promises still the right ones, given a quarter of
  real data.
- Pricing and packaging review against cost trend and market.
- Third-party and vendor review: performance, spend, contract dates, and
  concentration risk.
- Access review: who has production access and why.
- Roadmap refresh and re-commitment with the sponsor.

## Annually

- Contract renewals and price adjustments.
- Full security review and penetration test.
- Business continuity test at the portfolio level.
- Refresh of the service design package, so that the documented design still
  matches the running system.
- Service owner succession and handover documentation.

## Triggered, not scheduled

- Major incident: own the customer communication, chair the post-incident
  review, and drive the actions to closure.
- SLA breach: confirm the credit, communicate it before the customer asks, and
  record the cause.
- Customer escalation: own it personally until it is closed.
- New regulatory requirement: assess applicability and fund the response.
- Loss of a key dependency or vendor: invoke the contingency and reassess risk.
