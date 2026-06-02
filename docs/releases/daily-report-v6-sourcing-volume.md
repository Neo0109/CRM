# Daily Report V6 Sourcing Volume

Date: 2026-06-02

## Summary

- Upgraded daily report rules to `sourcing-rules-v6`.
- Fixed the low-volume failure mode where the daily report could publish only one or two usable sourcing leads.
- Increased the cloud Steam scan budget from 160 to 260 candidates.
- Added strict and expanded domestic media/Bilibili product extraction so concrete non-Steam leads can enter `未处理`.
- Added generation quality gates: fail if review candidates are below 18, or if domestic media/Bilibili signals are healthy but fewer than 10 become lead candidates.
- Fixed Steam fetch reliability: capped Steam search concurrency, capped AppDetails enrichment, added a curl fallback for Node DNS/TLS failures, and stopped retrying access/rate-limit errors as if they were parser failures.

## Intent

The daily report should help a Bilibili game publishing BD owner review a practical queue of products. A tiny lead list is not acceptable when upstream Steam, media, or Bilibili sources are available.
