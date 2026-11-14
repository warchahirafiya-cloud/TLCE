# TLCE Voice-First Productivity

## Purpose
An internal TLCE productivity branch focused on a voice-first experience. Users capture spoken ideas, turn selected ideas into project plans, and draft software, marketing and operational tasks using natural-language commands.

## User journey
1. Capture: record or dictate an idea with explicit microphone permission and visible recording state.
2. Transcribe: convert speech to text; show the transcript and allow correction before processing.
3. Understand: classify intent and extract entities, constraints and outcomes.
4. Structure: create a draft idea, project outline, milestones and suggested tasks.
5. Review: read results aloud on request; allow editing, rejection and confirmation.
6. Route: send only approved tasks to the appropriate internal TLCE branch.

## Voice interaction requirements
- Push-to-talk is the safe default; hands-free mode must be explicit and visibly indicated.
- Clear recording, processing, error and playback states; interruptible speech playback.
- Multilingual design beginning with Arabic and English; measure dialect quality rather than assume it.
- Accessible text fallback and editable transcripts. Do not record continuously or retain raw audio by default.

## Provider boundary
Speech-to-text, text-to-speech and language-model providers remain replaceable adapters. Review provider, data residency, retention, pricing, latency and consent before activation. Never send audio or transcripts externally without disclosure and consent.

## Security and governance
- A transcript is not authorization to spend, publish, send messages, deploy code, change DNS or modify production.
- Require preview and explicit confirmation before every external side effect.
- Treat generated code and commands as untrusted drafts; review, test and sandbox before execution.
- Minimize transcript retention, protect tenant data, apply quotas and audit approvals.
- Never request passwords, private keys or seed phrases through voice capture.

## Current limitations
This branch does not activate microphone access, speech recognition, text-to-speech, LLM providers, persistence, notifications or task execution. The deterministic draft builder receives a transcript and classified intent from its caller; it does not interpret raw audio or autonomously plan projects. The /voice route is reserved, but browser-shell allowlisting and a user interface still require integration.

## Release gates
Build accessible voice UI and microphone consent; add provider adapters; evaluate Arabic dialect recognition; add persistence, identity, audit and approval workflows; route approved tasks into TLCE branches; test privacy, security, cost and latency; confirm CI and obtain explicit deployment approval.
