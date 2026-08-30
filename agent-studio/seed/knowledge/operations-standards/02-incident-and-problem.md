# Incident and problem management standard

## Incident lifecycle

Detect → triage → declare severity → assign incident commander → mitigate →
restore → communicate → close → post-incident review.

Restoring service comes before finding the cause. Diagnosis that does not
shorten the outage happens after restoration, not during it.

## Roles during a major incident

| Role | Held by | Does |
|---|---|---|
| Incident commander | On-call lead | Runs the response, makes the calls, is not hands-on-keyboard |
| Operations lead | On-call engineer | Executes mitigations |
| Communications lead | Service owner or delegate | Customer and internal updates on the clock |
| Scribe | Anyone available | Timestamps every action and decision |

The incident commander can be overridden only by the operate manager, and only
by taking the role.

## Severity and response targets

| Severity | Response | Update cadence | Restore target |
|---|---|---|---|
| 1 | 15 min (Platinum) / 30 min (Gold) | 30 min internal, 60 min customer | 4 hours |
| 2 | 1 hour | 2 hours | 1 business day |
| 3 | 1 business day | Daily | 5 business days |
| 4 | 3 business days | On close | Next release |

Severity is set on customer impact, never on the difficulty of the fix. It can
be raised at any time by anyone and lowered only by the incident commander.

## Post-incident review

Required for every severity 1 and 2, and for any severity 3 that recurs three
times in a quarter. Held within five business days while memory is fresh.

Rules:

- Blameless. The output is a system that fails better, not a person who tries
  harder.
- Every action has a named owner and a due date. "The team will look at it" is
  not an action.
- Actions land in the CSI backlog and are tracked to closure by the service
  owner. Actions that slip twice are escalated.
- The timeline is reconstructed from evidence, not memory.
- The review asks what made this hard to detect and hard to fix, not only what
  broke.

## Problem management

A problem is the underlying cause of one or more incidents. An incident is
closed when service is restored; the problem stays open until the cause is
removed or a risk is formally accepted.

- Every severity 1 incident creates a problem record.
- Three or more severity 3 incidents with the same symptom create a problem
  record.
- A problem record with no progress for 30 days is reviewed by the service owner
  and either resourced, deferred with a date, or closed with an accepted risk.
- Known errors with workarounds are published to the runbook library and, if
  customer-visible, to the known-issues page.

## Runbook standard

Every alert that can page a human has a runbook. A runbook contains:

1. What the alert means, in one sentence.
2. Customer impact if it is real.
3. How to confirm it is real, with the exact query or command.
4. Immediate mitigation, in order, with the expected effect of each step.
5. When to escalate and to whom.
6. Links to the relevant dashboard and to the last three incidents that used it.

Runbooks are reviewed when used. If a runbook did not work during an incident,
fixing it is part of closing the incident, not a follow-up action.
