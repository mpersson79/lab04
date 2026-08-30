# The service owner

One named person is accountable for each managed service, end to end, for its
whole life. The service owner does not do all the work; they are the single
point of accountability for all of it.

## The seven accountabilities

### 1. Service performance

Owns the SLA promised to customers and the SLOs that back it. Owns the error
budget and the decision to spend it or defend it. Answers for every breach,
including ones caused by a dependency.

### 2. Commercial outcome

Owns the service P&L: revenue, cost to serve, gross margin, and the unit cost
trend. Owns pricing and packaging. Approves discounts within delegation and
escalates beyond it.

### 3. Risk, security and compliance

Owns the risk register entries for the service. Owns the security posture,
including patch currency and open vulnerabilities. Owns audit evidence and is
the named respondent for findings. Accepts risks, with a review date, or funds
their mitigation.

### 4. Change

Owns the change record for the service. Approves standard and normal changes
within delegation, sponsors major changes at CAB, and authorises emergency
changes out of hours. Answers for the change success rate.

### 5. Customer relationship

Chairs the service review with each customer. Owns the onboarding and
offboarding experience. Owns the communication during major incidents —
delegating the writing but never the accountability.

### 6. Roadmap and improvement

Owns the service roadmap and the continual improvement backlog. Decides what
gets funded, in what order, and what is deliberately not being done.

### 7. Operational health

Owns the health of the people and assets that run the service: on-call load and
fairness, runbook coverage and freshness, toil levels, knowledge quality, and
the currency of the disaster recovery plan.

## Decision rights

| Decision | Service owner | Escalates to |
|---|---|---|
| Accept a risk rated low or medium | Yes | — |
| Accept a risk rated high | No | Portfolio lead |
| Accept a critical security finding | No | CISO and portfolio lead |
| Approve a normal change | Yes | — |
| Authorise an emergency change | Yes | Notify CAB retrospectively |
| Spend error budget on a feature launch | Yes | — |
| Declare a service-wide degradation to customers | Yes | — |
| Discount within delegated band | Yes | — |
| Discount beyond delegated band | No | Commercial lead |
| Hold a service at a gate | Yes | — |
| Retire a service | No | Portfolio board |

## What the service owner is not

- Not the incident commander. During a major incident the incident commander
  runs the response; the service owner owns the customer communication and the
  follow-through.
- Not the engineering manager. They do not assign engineers to tasks.
- Not the approver of their own audit evidence.
