#!/usr/bin/env python3
"""
Two-Agent Discussion App
Two AI agents with distinct personas debate a user-chosen topic.
Uses the claude CLI for API calls.
"""

import subprocess
import sys
import textwrap

AGENTS = {
    "Alex": {
        "system": (
            "You are Alex, an optimistic and forward-thinking debater. "
            "You tend to focus on opportunities, progress, and the positive potential of ideas. "
            "You engage genuinely with what the other speaker said and build on or challenge it directly. "
            "Keep your responses concise — 3 to 5 sentences. "
            "Do NOT start your response with 'I' as the first word."
        ),
        "color": "\033[94m",  # blue
    },
    "Jordan": {
        "system": (
            "You are Jordan, a critical and pragmatic debater. "
            "You focus on risks, trade-offs, and unintended consequences. "
            "You engage directly with what the other speaker just said, agreeing when warranted but often pushing back. "
            "Keep your responses concise — 3 to 5 sentences. "
            "Do NOT start your response with 'I' as the first word."
        ),
        "color": "\033[92m",  # green
    },
}

RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
MODEL = "haiku"


def wrap_text(text: str, width: int = 72, indent: str = "    ") -> str:
    lines = []
    for paragraph in text.split("\n"):
        if paragraph.strip():
            lines.append(
                textwrap.fill(paragraph, width=width, subsequent_indent=indent)
            )
        else:
            lines.append("")
    return "\n".join(lines)


def build_prompt(agent_name: str, history: list, topic: str) -> str:
    if not history:
        return (
            f"The discussion topic is: {topic}\n\n"
            "Please give your opening statement on this topic."
        )

    lines = [f"The discussion topic is: {topic}\n", "Here is the conversation so far:\n"]
    for entry in history:
        lines.append(f"{entry['speaker']}: {entry['text']}\n")

    other = [name for name in AGENTS if name != agent_name][0]
    last_speaker = history[-1]["speaker"]
    if last_speaker == other:
        lines.append(f"\nNow respond as {agent_name}, addressing what {other} just said.")
    else:
        lines.append(f"\nContinue the discussion as {agent_name}.")

    return "\n".join(lines)


def get_response(agent_name: str, history: list, topic: str) -> str:
    agent = AGENTS[agent_name]
    prompt = build_prompt(agent_name, history, topic)

    result = subprocess.run(
        [
            "claude",
            "-p",
            "--model", MODEL,
            "--system-prompt", agent["system"],
            "--no-session-persistence",
            prompt,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"claude CLI error: {result.stderr.strip()}")
    return result.stdout.strip()


def print_turn(agent_name: str, text: str, turn: int) -> None:
    color = AGENTS[agent_name]["color"]
    print(f"\n{color}{BOLD}[Turn {turn}] {agent_name}{RESET}")
    print(f"{color}{wrap_text(text)}{RESET}")


def run_discussion(topic: str, num_turns: int = 6) -> None:
    print(f"\n{BOLD}Topic:{RESET} {topic}")
    print(f"{DIM}{'─' * 60}{RESET}")
    print(f"{DIM}Agents: Alex (optimist) vs Jordan (pragmatist){RESET}")
    print(f"{DIM}{'─' * 60}{RESET}")

    history: list = []
    agent_order = ["Alex", "Jordan"]

    for turn in range(1, num_turns + 1):
        agent_name = agent_order[(turn - 1) % 2]
        print(f"\n{DIM}  Waiting for {agent_name}...{RESET}", end="\r")

        text = get_response(agent_name, history, topic)
        history.append({"speaker": agent_name, "text": text})
        print_turn(agent_name, text, turn)

    print(f"\n{DIM}{'─' * 60}")
    print("Discussion complete.")
    print(f"{'─' * 60}{RESET}\n")


def main() -> None:
    print(f"\n{BOLD}=== Two-Agent AI Discussion ==={RESET}")
    print("Two AI agents — Alex (optimist) and Jordan (pragmatist) — will debate your topic.\n")

    if len(sys.argv) > 1:
        topic = " ".join(sys.argv[1:])
        turns_input = input("How many turns? (default 6, max 20): ").strip()
    else:
        topic = input("Enter a topic to discuss: ").strip()
        if not topic:
            print("No topic provided. Exiting.")
            sys.exit(1)
        turns_input = input("How many turns? (default 6, max 20): ").strip()

    try:
        num_turns = int(turns_input) if turns_input else 6
        num_turns = max(2, min(num_turns, 20))
    except ValueError:
        num_turns = 6

    run_discussion(topic, num_turns)


if __name__ == "__main__":
    main()
