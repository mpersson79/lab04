# RACI and escalation

## RACI across the lifecycle

R = responsible, A = accountable, C = consulted, I = informed.
The service owner is accountable at every stage; the R moves.

| Activity | Service owner | Delivery | Platform eng | Operate | Security | Commercial |
|---|---|---|---|---|---|---|
| Service concept brief | A/R | C | C | C | I | C |
| Service design package | A | R | C | C | C | C |
| SLA and SLO definition | A/R | C | C | C | I | C |
| Unit cost model | A | I | C | C | I | R |
| Build and IaC | A | R | R | C | C | I |
| Runbooks | A | C | C | R | I | I |
| Operational readiness review | A | C | C | R | C | I |
| Penetration test | A | I | C | I | R | I |
| DR plan and rehearsal | A | C | R | R | I | I |
| Catalogue entry and pricing | A/R | I | I | I | I | C |
| Customer onboarding | A | C | C | R | I | C |
| Incident response | I | C | C | R | C | I |
| Major incident comms | A/R | I | I | C | I | C |
| Post-incident review | A | C | C | R | C | I |
| Change approval | A/R | C | C | C | C | I |
| Monthly service report | A/R | I | I | C | I | C |
| Risk acceptance | A/R | I | C | C | C | I |
| Margin management | A/R | I | I | C | I | C |
| CSI backlog | A/R | C | C | C | I | I |
| Retirement | A/R | C | C | C | C | C |

## Incident severity and who gets involved

| Severity | Definition | Service owner role | Customer comms |
|---|---|---|---|
| 1 | Service unavailable or unusable for most customers, or confirmed data loss or breach | Engaged immediately, owns comms | Within 30 minutes, then hourly |
| 2 | Major function degraded, or a single large customer down | Engaged within the hour | Within 2 hours, then every 4 |
| 3 | Degraded but with a workaround | Informed at the daily review | On request, and in the monthly report |
| 4 | Minor, no customer impact | Informed in the weekly review | Monthly report only |

## Escalation path

1. On-call engineer
2. On-call lead
3. Operate manager
4. Service owner
5. Portfolio lead
6. Executive sponsor

Escalate on time, not on certainty. If the next step is not obviously going to
resolve the situation inside the customer-facing target, escalate now and stand
it down later.

## Standing meetings the service owner chairs or attends

| Meeting | Frequency | Chair | Purpose |
|---|---|---|---|
| Service health review | Weekly | Service owner | Incidents, problems, toil, on-call |
| Change advisory board | Weekly | Change manager | Approve normal and major changes |
| Customer service review | Monthly | Service owner | SLO attainment, roadmap, escalations |
| Margin and cost review | Monthly | Commercial | P&L, unit cost, forecast |
| Risk review | Monthly | Risk lead | Re-score, close, escalate |
| Portfolio review | Quarterly | Portfolio lead | Continue, change, or retire |
| Post-incident review | Per sev 1 or 2 | Operate | Root cause and actions |
