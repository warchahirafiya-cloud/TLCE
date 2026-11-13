# TLCE Serverless & Edge Infrastructure

This directory contains the provider-neutral infrastructure boundary shared by TLCE Core, the independent Runtime Engine, and internal product modules.

## Boundaries
- `contracts/`: TLCE-owned interfaces and shared types.
- `runtime/`: runtime integration and execution policies.
- `functions/`: serverless function entry points.
- `edge-gateway/`: edge request routing and gateway policies.
- `distributed-cache/`: cache abstractions and namespace policy.
- `event-processing/`: event envelopes, queues, retries, and idempotency.
- `security/`: security controls and policy adapters.
- `monitoring/`: telemetry contracts and health reporting.
- `providers/`: vendor-specific adapters only.

Do not import provider SDKs outside `providers/`. Keep secrets out of this repository. No cloud resource is provisioned by this scaffold.
