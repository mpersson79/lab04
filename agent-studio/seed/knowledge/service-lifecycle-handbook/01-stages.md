# Managed service lifecycle — the eight stages

Every managed service in the portfolio moves through the same eight stages. A
service may sit in Operate for years and re-enter Design for a major revision,
but it never skips a gate. The service owner is accountable for the service at
every stage; the delivery, platform and commercial teams are accountable for
their contributions within a stage.

## 1. Intake

The service concept is captured and screened. Nothing is built. The question at
this stage is "should this be a managed service at all, and is it ours to run?"

Typical work: demand capture, customer and segment definition, rough sizing,
build-versus-buy assessment, portfolio fit, initial commercial shape, naming a
service owner.

## 2. Design

The service design package is produced. This is the single most consequential
stage: an SLO promised here is one the operate team lives with for years.

Typical work: target architecture, service boundaries and dependencies, SLA and
SLO definition, capacity and scaling model, security and data classification,
support and escalation model, cost model and unit economics, tooling and
observability design, draft catalogue entry.

## 3. Build

The service is implemented as code, including everything needed to run it, not
only the happy path.

Typical work: infrastructure as code, deployment pipelines, environment
provisioning, observability instrumentation and dashboards, alert rules bound to
the SLOs, runbooks for every alert, backup and restore, disaster recovery plan,
test strategy including failure injection.

## 4. Validate

Independent verification that the service is fit to operate. The operate team
has a veto here; this is where they accept or refuse the service.

Typical work: operational readiness review (ORR), security review and
penetration test, disaster recovery rehearsal with a measured RTO and RPO, load
and soak testing against the capacity model, runbook walkthrough by someone who
did not write them, on-call rota staffed and trained, documentation complete.

## 5. Launch

The service becomes buyable and the first customers are onboarded under
heightened support.

Typical work: catalogue entry published with pricing, contract and order form
templates ready, go-to-market and internal comms, first customer onboarding,
hypercare period with named engineers and a daily review, exit criteria from
hypercare agreed in advance.

## 6. Operate

Steady state. Most of the service's life and almost all of its cost sit here.

Typical work: incident, problem, change and request management, SLO reporting
and error budget management, patching and currency, capacity and demand
management, cost and margin management, on-call health, customer onboarding and
offboarding, service reviews, audit evidence collection.

## 7. Improve

Continual improvement running alongside Operate, funded and prioritised
deliberately rather than absorbed as unplanned work.

Typical work: service review actions, CSI backlog grooming, toil reduction,
technical debt paydown, automation of repeated manual steps, benchmark against
market alternatives, customer feedback loops, pricing and packaging revisions.

## 8. Retire

The service is withdrawn in a controlled way. A service that is quietly
abandoned rather than retired is a liability with no owner.

Typical work: deprecation decision and notice period, published migration path,
customer and contract exit, final invoices and credits, data export and
certified disposal, decommission of infrastructure and licences, removal from
the catalogue, archival of records for the retention period, post-retirement
review.

## Stage transitions

- Forward movement through a gate requires a gate decision record (see
  `02-gates.md`) signed by the service owner.
- Re-entering Design from Operate is normal for a major revision. It requires a
  new Design gate but not a new Intake.
- A service may be held at a gate. A hold is a legitimate outcome and must carry
  a named owner, a specific set of gaps, and a review date.
