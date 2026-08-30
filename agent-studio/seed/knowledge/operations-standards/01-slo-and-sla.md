# SLA, SLO and error budget standard

## Definitions

- **SLI** — a measured indicator of service behaviour, expressed as a ratio of
  good events to valid events.
- **SLO** — the internal target for an SLI over a stated window. Always tighter
  than the SLA.
- **SLA** — the contractual promise to the customer, with a credit attached to
  a breach.
- **Error budget** — one minus the SLO, over the window. The permitted amount
  of unreliability.

## Rules

- Every service publishes at least an availability SLO and a latency SLO.
- SLIs are measured from the customer's side of the boundary wherever possible.
  A health check that only proves the process is running is not an SLI.
- The internal SLO must leave at least a 2x margin against the SLA. If the SLA
  is 99.5%, the SLO is at least 99.75%.
- The window is 28 days rolling unless the contract says otherwise. Calendar
  months create end-of-month cliffs and are avoided.
- Alerts page on error budget burn rate, not on raw resource metrics. A CPU
  alert that does not correspond to customer harm does not page.

## Standard tiers

| Tier | SLA | SLO | Monthly error budget | Cover |
|---|---|---|---|---|
| Platinum | 99.95% | 99.99% | ~4 min | 24x7, 15 min response sev 1 |
| Gold | 99.9% | 99.95% | ~22 min | 24x7, 30 min response sev 1 |
| Silver | 99.5% | 99.75% | ~1h 50m | Business hours, 1h response |
| Bronze | 99.0% | 99.5% | ~3h 40m | Business hours, next business day |

## Error budget policy

Burn rate is measured against the trailing window. The response is graduated:

| Budget consumed | Response |
|---|---|
| Under 50% | Normal operation. Feature work proceeds. |
| 50–75% | Service owner informed. Review the top contributor at the weekly. |
| 75–90% | Change freeze for non-essential changes. Reliability work prioritised over features. |
| Over 90% | Full freeze except fixes and security. Service owner reports to portfolio lead. |
| Exhausted | Feature work stops until the budget recovers over a full window. |

A freeze is lifted by the service owner, not by the passage of time.

## Breach handling

1. Confirm the breach against the measured SLI, not against a customer's
   perception or a monitoring gap.
2. Calculate the credit per the contract terms.
3. Communicate the breach and the credit before the customer raises it. A credit
   the customer had to ask for costs more goodwill than the money is worth.
4. Record the cause against the incident or problem record.
5. If the cause was a dependency, the credit is still owed to the customer.
   Recovering it from the vendor is a separate matter.

## Reporting

The monthly service report states, for each SLO: the target, the attainment,
the error budget consumed, the largest single contributor to the burn, and what
is being done about it. Attainment is reported to two decimal places and is
never rounded up.
