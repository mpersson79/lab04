#!/usr/bin/env python3
"""
AI C-Suite Boardroom — Corporate Strategy Decision Engine
Five C-level executives debate corporate decisions until consensus is reached.
"""

import subprocess
import sys
import textwrap

# ── Executive personas ────────────────────────────────────────────────────────

EXECUTIVES = {
    "CEO": {
        "title": "Chief Executive Officer",
        "color": "\033[95m",
        "system": """You are the CEO (Chief Executive Officer) in a live corporate boardroom.
Your expertise: organizational vision, long-term competitive strategy, stakeholder and board
relations, culture, M&A rationale, and final accountability. You balance short-term performance
with durable value creation and synthesize cross-functional input into decisive direction.

Conduct: Speak with authority. Reference specific strategic trade-offs. Hold other executives
accountable for blind spots. When you feel the board has enough to decide, include the exact
token [READY_TO_CONCLUDE] anywhere in your response.

Length: 4-6 sentences. Do NOT start with "I".""",
    },
    "CFO": {
        "title": "Chief Financial Officer",
        "color": "\033[93m",
        "system": """You are the CFO (Chief Financial Officer) in a live corporate boardroom.
Your expertise: capital allocation, ROI modeling, free cash flow, P&L impact, balance sheet risk,
funding structures (debt vs equity), covenant implications, IRR/NPV analysis, financial regulations,
and shareholder return expectations. You quantify every proposal and flag where the numbers break.

Conduct: Be specific — name figures, ranges, ratios, or thresholds where possible. Challenge
assumptions that aren't financially grounded. Push back on optimistic projections.

Length: 4-6 sentences. Do NOT start with "I".""",
    },
    "CTO": {
        "title": "Chief Technology Officer",
        "color": "\033[96m",
        "system": """You are the CTO (Chief Technology Officer) in a live corporate boardroom.
Your expertise: technology roadmap, R&D investment, build vs buy vs partner decisions, engineering
capacity, technical debt, scalability architecture, emerging tech (AI/ML, cloud, automation), IP
strategy, and time-to-market realism. You ground strategy in what is technically achievable.

Conduct: Name specific technologies, stack decisions, or capability gaps. Give realistic timelines.
Call out technical risks that business leaders underestimate.

Length: 4-6 sentences. Do NOT start with "I".""",
    },
    "CIO": {
        "title": "Chief Information Officer",
        "color": "\033[94m",
        "system": """You are the CIO (Chief Information Officer) in a live corporate boardroom.
Your expertise: enterprise information systems, data strategy and governance, digital transformation,
IT infrastructure and cloud migration, cybersecurity posture, ERP/CRM/data platform decisions,
system integration complexity, and regulatory data compliance (GDPR, SOC2, etc.).

Conduct: Focus on data readiness, integration risk, and legacy system constraints. Flag where
information gaps could derail execution. Raise compliance and security implications.

Length: 4-6 sentences. Do NOT start with "I".""",
    },
    "CSO": {
        "title": "Chief Strategy Officer",
        "color": "\033[91m",
        "system": """You are the CSO (Chief Strategy Officer) in a live corporate boardroom.
Your expertise: competitive intelligence, market positioning, organic vs inorganic growth, M&A
screening, portfolio optimization, strategic partnerships, market entry/exit, scenario planning,
industry disruption patterns, and alignment between corporate capabilities and market opportunity.

Conduct: Ground every argument in market dynamics, competitor moves, or strategic frameworks
(Porter's Five Forces, Ansoff, BCG matrix, etc.). Stress-test proposals against alternative futures.

Length: 4-6 sentences. Do NOT start with "I".""",
    },
}

SPEAKING_ORDER = ["CSO", "CFO", "CTO", "CIO", "CEO"]
MIN_ROUNDS = 2
MAX_ROUNDS = 8
MODEL = "sonnet"

RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
GREEN = "\033[92m"


# ── Formatting helpers ────────────────────────────────────────────────────────

def wrap(text: str, width: int = 76, indent: str = "    ") -> str:
    out = []
    for para in text.split("\n"):
        if para.strip():
            out.append(textwrap.fill(para.strip(), width=width, subsequent_indent=indent))
        else:
            out.append("")
    return "\n".join(out)


def divider(char: str = "─", width: int = 72) -> str:
    return f"{DIM}{char * width}{RESET}"


def print_phase(label: str) -> None:
    print(f"\n{divider('─')}")
    print(f"  {BOLD}{label}{RESET}")
    print(divider("─"))


def print_turn(role: str, text: str, tag: str = "") -> None:
    info = EXECUTIVES[role]
    color = info["color"]
    label = tag or f"{role}  ·  {info['title']}"
    # Strip the consensus token before printing
    display = text.replace("[READY_TO_CONCLUDE]", "").strip()
    print(f"\n{color}{BOLD}▶  {label}{RESET}")
    print(f"{color}{wrap(display)}{RESET}")


def print_header(topic: str) -> None:
    w = 72
    print(f"\n{BOLD}{'═' * w}{RESET}")
    print(f"{BOLD}   AI C-SUITE BOARDROOM  ·  CORPORATE DECISION ENGINE{RESET}")
    print(f"{BOLD}{'═' * w}{RESET}")
    print(f"\n{BOLD}  AGENDA ITEM:{RESET}")
    print(f"  {topic}\n")
    print(f"{DIM}  Participants:{RESET}")
    for role, info in EXECUTIVES.items():
        print(f"  {info['color']}{BOLD}{role:4}{RESET}  {info['title']}")
    print(f"\n{divider('═')}")


# ── Prompt builders ───────────────────────────────────────────────────────────

def opening_prompt(role: str, topic: str) -> str:
    info = EXECUTIVES[role]
    return (
        f"BOARDROOM AGENDA: {topic}\n\n"
        f"You are opening this discussion as {role} ({info['title']}). "
        f"Deliver your initial assessment: the key considerations, risks, and strategic "
        f"questions this decision raises from your functional perspective. "
        f"End with the most critical question you need answered by another executive."
    )


def discussion_prompt(role: str, history: list, topic: str, round_num: int) -> str:
    info = EXECUTIVES[role]
    recent = history[-10:]
    transcript = "\n\n".join(f"{e['role']}: {e['text']}" for e in recent)

    conclude_instruction = (
        "\n\nIMPORTANT: If you believe the board now has sufficient information and alignment "
        "to reach a decision, include [READY_TO_CONCLUDE] anywhere in your response. "
        "Only signal this if major objections have been addressed and a clear direction exists."
        if round_num >= MIN_ROUNDS else ""
    )

    return (
        f"BOARDROOM AGENDA: {topic}\n\n"
        f"RECENT DISCUSSION:\n{transcript}\n\n"
        f"Respond as {role} ({info['title']}). Build directly on what was just discussed. "
        f"Bring new domain-specific insight, challenge ungrounded assumptions, or resolve "
        f"open questions in your area. Be direct and substantive."
        f"{conclude_instruction}"
    )


def final_position_prompt(role: str, history: list, topic: str) -> str:
    info = EXECUTIVES[role]
    full = "\n\n".join(f"{e['role']}: {e['text']}" for e in history)
    return (
        f"BOARDROOM AGENDA: {topic}\n\n"
        f"FULL DISCUSSION:\n{full}\n\n"
        f"The board is moving to a decision. As {role} ({info['title']}), state your "
        f"FINAL POSITION in 2-3 sentences: your recommendation and the single most "
        f"critical condition for success. Be decisive and specific."
    )


def synthesis_prompt(topic: str, history: list, final_positions: dict) -> str:
    positions = "\n".join(
        f"{role} ({EXECUTIVES[role]['title']}): {text}"
        for role, text in final_positions.items()
    )
    full = "\n\n".join(f"{e['role']}: {e['text']}" for e in history)
    return (
        f"BOARDROOM AGENDA: {topic}\n\n"
        f"FULL DELIBERATION:\n{full}\n\n"
        f"FINAL POSITIONS:\n{positions}\n\n"
        f"As CEO, deliver the official board decision using this structure:\n\n"
        f"DECISION\n"
        f"One authoritative sentence stating exactly what the company will do.\n\n"
        f"RATIONALE\n"
        f"3 sentences on why this is the right call given the deliberation.\n\n"
        f"SUCCESS CONDITIONS\n"
        f"• [condition 1]\n"
        f"• [condition 2]\n"
        f"• [condition 3]\n\n"
        f"IMMEDIATE NEXT STEPS\n"
        f"• [action 1 — owner]\n"
        f"• [action 2 — owner]\n"
        f"• [action 3 — owner]\n\n"
        f"RISKS TO MONITOR\n"
        f"• [risk 1]\n"
        f"• [risk 2]\n\n"
        f"Be authoritative, specific, and actionable."
    )


# ── Claude call ───────────────────────────────────────────────────────────────

def call_claude(system: str, prompt: str) -> str:
    result = subprocess.run(
        ["claude", "-p",
         "--model", MODEL,
         "--system-prompt", system,
         "--no-session-persistence",
         prompt],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"claude error: {result.stderr.strip()}")
    return result.stdout.strip()


def thinking(msg: str) -> None:
    print(f"  {DIM}{msg}...{RESET}", end="\r", flush=True)
    print(" " * 60, end="\r")  # clear line


# ── Main flow ─────────────────────────────────────────────────────────────────

def run_boardroom(topic: str) -> None:
    print_header(topic)
    history: list = []

    # ── Round 1: Opening statements ──────────────────────────────────────────
    print_phase("ROUND 1  ·  OPENING STATEMENTS")
    for role in SPEAKING_ORDER:
        thinking(f"{role} preparing opening statement")
        text = call_claude(EXECUTIVES[role]["system"], opening_prompt(role, topic))
        history.append({"role": role, "text": text})
        print_turn(role, text)

    # ── Discussion rounds ─────────────────────────────────────────────────────
    round_num = 2
    while round_num <= MAX_ROUNDS:
        print_phase(f"ROUND {round_num}  ·  DELIBERATION")

        ready_count = 0
        for role in SPEAKING_ORDER:
            thinking(f"{role} responding")
            text = call_claude(
                EXECUTIVES[role]["system"],
                discussion_prompt(role, history, topic, round_num)
            )
            history.append({"role": role, "text": text})
            print_turn(role, text)
            if "[READY_TO_CONCLUDE]" in text:
                ready_count += 1

        # Conclude if CEO signals ready, or majority (3+) signal ready
        ceo_ready = "[READY_TO_CONCLUDE]" in history[-1]["text"]
        if ceo_ready or ready_count >= 3:
            note = "CEO called for decision" if ceo_ready else f"{ready_count}/5 executives ready"
            print(f"\n  {GREEN}{BOLD}✓ Consensus reached ({note}){RESET}")
            break

        round_num += 1
    else:
        print(f"\n  {DIM}Max rounds reached — moving to decision.{RESET}")

    # ── Final positions ───────────────────────────────────────────────────────
    print_phase("FINAL POSITIONS  ·  EACH EXECUTIVE'S RECOMMENDATION")
    final_positions: dict = {}
    for role in SPEAKING_ORDER:
        thinking(f"{role} stating final position")
        text = call_claude(
            EXECUTIVES[role]["system"],
            final_position_prompt(role, history, topic)
        )
        final_positions[role] = text
        history.append({"role": role, "text": text})
        print_turn(role, text, tag=f"{role}  ·  FINAL POSITION")

    # ── CEO decision synthesis ────────────────────────────────────────────────
    print_phase("BOARD DECISION  ·  CEO SYNTHESIS")
    thinking("CEO synthesizing board decision")
    decision = call_claude(EXECUTIVES["CEO"]["system"], synthesis_prompt(topic, history, final_positions))

    color = EXECUTIVES["CEO"]["color"]
    print(f"\n{color}{BOLD}{'═' * 72}{RESET}")
    print(f"{color}{BOLD}  OFFICIAL BOARD DECISION{RESET}")
    print(f"{color}{BOLD}{'═' * 72}{RESET}")
    print(f"{color}{wrap(decision)}{RESET}")
    print(f"{color}{BOLD}{'═' * 72}{RESET}\n")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    print(f"\n{BOLD}=== AI C-SUITE BOARDROOM ==={RESET}")
    print("CEO · CFO · CTO · CIO · CSO will deliberate until a board decision is reached.\n")

    if len(sys.argv) > 1:
        topic = " ".join(sys.argv[1:])
    else:
        topic = input("Enter the corporate decision or strategic question: ").strip()
        if not topic:
            print("No topic entered. Exiting.")
            sys.exit(1)

    run_boardroom(topic)


if __name__ == "__main__":
    main()
