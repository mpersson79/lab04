# Change and release standard

## Change classes

| Class | Definition | Approval | Lead time |
|---|---|---|---|
| Standard | Pre-approved, automated, proven rollback, low risk | None — logged only | None |
| Normal | Everything not standard or emergency | Service owner, and CAB if major | 3 business days |
| Major | Architecture, data migration, or customer-visible behaviour change | CAB with service owner sponsorship | 10 business days |
| Emergency | Required to restore or protect service | Service owner, out of band | None; CAB informed retrospectively |

The goal is to move as much as possible into **standard**. A high proportion of
normal changes usually means the automation and rollback story is weak, not that
the service is unusually risky.

## Requirements for every change

- A stated customer impact, including "none" with a reason.
- A rollback plan that has been executed at least once, in a non-production
  environment at minimum.
- A verification step that proves the change worked from the customer's side.
- A named implementer and a named approver, who must be different people.
- Change window respected, unless emergency.

## Change freezes

- Automatic during a customer's contractual freeze windows.
- Automatic when the error budget policy triggers a freeze.
- Around major customer events, by request, agreed at the service review.

A freeze never blocks a security fix rated critical, or an emergency change to
restore service. Both are logged and reviewed afterwards.

## Emergency changes

Emergency is a genuine category, not a way around lead time. Each emergency
change is reviewed at the weekly change review with one question: could this
have been foreseen? A pattern of foreseeable emergencies is a planning defect
and goes to the CSI backlog.

## Metrics the service owner watches

| Metric | Target | Meaning when it drifts |
|---|---|---|
| Change success rate | ≥ 95% | Testing or rollback is inadequate |
| Emergency change ratio | ≤ 5% | Planning or monitoring is weak |
| Failed change causing sev 1 or 2 | 0 | Verification is not proving customer impact |
| Lead time for standard changes | Same day | Automation is not being used |
| Backed-out changes | Tracked, no target | High counts point at environment drift |

## Release practice

- Deploy to production behind a flag or to a small slice first, wherever the
  architecture allows.
- Every release is observable: it appears on the dashboard as an annotation, so
  an incident can be correlated with a deploy in seconds.
- No manual production changes. Anything done by hand during an incident is
  captured as a follow-up to codify or remove.
- Configuration is versioned with the same rigour as code.
