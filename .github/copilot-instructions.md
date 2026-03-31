# Project Guidelines

## Design Principle
Following are the design principle, in order.
- Security
- Reliability
- Performance
- Cost
- Pleasant Visual
- Accessibility

## Architecture

- Treat this repository as a modern, well-architected software project.
- Optimize for security first, then usability, and avoid solutions that trade away safety for convenience without calling it out.
- Prefer clear module boundaries, small composable units, and designs that stay easy to extend and review.
- Favor readability, maintainability, and explicit behavior over clever abstractions.

## Agent Workflow

- The main agent should make deliberate make best use of the repository's specialized subagents and skills. Especially when a task benefits from focused expertise or isolated exploration.
- Treat subagent usage as a HIGHLY RECOMMENDED on all tasks related to available subagents such as architecting, design review, code review, testing, documentation, or isolated codebase exploration.
- Use architecture and design review agents for structural decisions, the test automation agent for test authoring, and the documentation agent for docs-heavy tasks.
- Keep subagent usage purposeful: use them to improve quality and throughput, not as a substitute for basic implementation work.

## Implementation Conventions

- Write code that is easy to read first; extract helpers instead of letting functions become dense.
- Preserve strong typing, clear names, and straightforward control flow.
- When introducing persistence or a database, default to SQLite unless the task explicitly requires a different database.
- MUST update documentations when behavior, setup, or developer workflows change.

## Python Toolchain

- Target Python 3.13 or newer.
- Use `uv` for dependency management, environment management, and command execution.
- Use a modern Python project structure, with a `src/` layout as the default when introducing application packages.
- Keep dependencies minimal and justified.

## Build And Test - Python

- Prefer `uv sync` for environment setup.
- Prefer `uv run pytest` for test execution.
- Prefer `uv run python -m ...` for runnable modules and scripts.

## General Operating Guidelines

- Use `uv` to run python code
- Ensure changes are committed into git as appropriate
- commit message must be clear and concise
- use sementic versioning
- proper update versioning as appropriate