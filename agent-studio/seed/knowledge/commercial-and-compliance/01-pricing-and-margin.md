# Commercial standard — pricing, cost and margin

## Charge models

| Model | Use when | Watch out for |
|---|---|---|
| Per unit consumed | Consumption tracks cost closely | Bill shock; cap or alert the customer |
| Per seat or per tenant | Cost is driven by customers, not volume | Heavy users subsidised by light ones |
| Tiered subscription | Predictability matters to both sides | Tier boundaries that punish growth |
| Platform fee plus usage | Fixed cost to serve plus variable | Two numbers to explain and to forecast |
| Committed volume with overage | Large, predictable customers | Under-consumption disputes at renewal |

## Cost to serve

Unit cost is computed from all of:

- Infrastructure directly attributable to the service.
- Shared platform cost, allocated on a stated basis.
- Third-party licences and per-call fees.
- Operate effort: on-call, incident and request handling, at loaded cost.
- Support and onboarding effort.
- Amortised build cost over the expected life of the service.

A cost model that counts only infrastructure will always look profitable and
will always be wrong. Operate effort is usually the largest hidden component.

## Margin targets

| Service maturity | Gross margin target |
|---|---|
| Launch and first year | ≥ 30%, improving each quarter |
| Established | ≥ 55% |
| Commodity or high volume | ≥ 65% |
| Below 20% for two consecutive quarters | Portfolio review, with a decision to fix, reprice, or retire |

## What the service owner reviews monthly

- Revenue recognised against forecast.
- Cost to serve, split into infrastructure, licences and effort.
- Gross margin against target, and the trend over the last six months.
- Unit cost trend — the single best early indicator of a service going wrong.
- Cost anomalies over the alert threshold, with an explanation for each.
- Customers whose consumption pattern makes them individually unprofitable.

## Pricing changes

- Reviewed quarterly, changed no more than annually for existing customers
  unless the contract allows otherwise.
- Notice period per contract, minimum 90 days.
- A price rise is accompanied by a statement of what improved.
- Grandfathering is a decision with a stated end date, not a permanent state.

## Discounts

Approved within the service owner's delegated band. Beyond it, the commercial
lead approves. Every discount records the reason, the term, and the review date.
Discounts do not roll over silently at renewal.

## Waste and efficiency

Reviewed monthly, as part of the cost review:

- Idle and orphaned resources.
- Over-provisioned capacity against the measured peak plus headroom.
- Non-production environments running outside working hours.
- Storage in the wrong tier for its access pattern.
- Committed-use and reservation coverage against steady-state consumption.
- Data egress that could be avoided by placement.
