# Required artifacts and the gate decision record

## Artifact register by stage

| Stage | Artifact | Owner | Lives in |
|---|---|---|---|
| Intake | Service concept brief | Service owner | Portfolio register |
| Intake | Build-versus-buy assessment | Architecture | Portfolio register |
| Design | Service design package | Service owner | Service repo `/docs/design` |
| Design | SLA and SLO definition | Service owner | Service repo `/docs/slo.md` |
| Design | Threat model and security review | Security | Security register |
| Design | Unit cost model | Commercial | Finance model |
| Build | Infrastructure as code | Platform engineering | Service repo |
| Build | Runbook set | Operate team | Runbook library |
| Build | Disaster recovery plan | Platform engineering | Service repo `/docs/dr.md` |
| Validate | Operational readiness review record | Operate team | ORR register |
| Validate | Penetration test report | Security | Security register |
| Validate | DR rehearsal record | Platform engineering | ORR register |
| Launch | Catalogue entry | Service owner | Service catalogue |
| Launch | Contract and order form template | Commercial and Legal | Contract library |
| Launch | Hypercare exit record | Service owner | Service repo |
| Operate | Monthly service report | Service owner | Customer portal |
| Operate | Risk register entries | Service owner | Risk register |
| Improve | CSI backlog | Service owner | Delivery backlog |
| Retire | Retirement plan and notices | Service owner | Portfolio register |
| Retire | Data disposal certificate | Security | Compliance evidence |

An artifact that does not exist at its gate is a gap. An artifact that exists
but is more than one stage out of date is also a gap — staleness is treated the
same as absence.

## Gate decision record

Every gate decision produces a record with this shape. It is short on purpose:
if it takes more than a page, the decision is not yet clear enough to make.

```
Service:            <name>
Gate:               <n> — <from stage> to <to stage>
Date:               <ISO date>
Service owner:      <name>
Decision:           Pass | Pass with conditions | Hold

Evidence reviewed:
  - <artifact> — <link or location> — <current | stale since ...>

Criteria met:
  - <criterion>

Gaps:
  - <criterion> — <what is missing> — <severity>

Conditions (only for "Pass with conditions"):
  - <condition> — owner: <name> — due: <date>

Risks accepted:
  - <risk> — <impact> — accepted by: <name> — review: <date>

Rationale:
  <two or three sentences on why this decision and not the adjacent one>
```

## Rules for writing the record

- Every claim of "met" names the evidence that supports it. A criterion with no
  evidence is a gap, not a pass.
- Gaps are graded: **blocking** (cannot pass), **material** (pass with
  conditions), **minor** (note it and move on).
- A risk can only be accepted by the service owner, and only with a review date.
  "Accepted indefinitely" is not an acceptable outcome.
- If the recommendation and the decision differ, the rationale must say why.
