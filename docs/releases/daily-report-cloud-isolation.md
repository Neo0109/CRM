# Daily Report Cloud Isolation

Date: 2026-06-03

## Motivation

Product/UI/auth changes should not accidentally trigger or break production daily reports. The daily report is a cloud automation module and must stay stable while the CRM product iterates.

## Changes

- Removed `push` from the primary daily report workflow. It now runs only by schedule or manual dispatch.
- Changed the watchdog to run repeatedly during the China workday so it can heal missing or delayed primary runs.
- Changed import-volume checks from hard failures to diagnostics after `synced=true`, because production dedupe can convert new candidates into updates.
- Updated cloud automation documentation and root agent rules to keep daily automation, product features, and UI iteration separate.

## Verification

- The primary workflow still has scheduled runs at 09:30 and 14:00 Asia/Shanghai.
- The watchdog now checks hourly from 10:15 to 16:15 Asia/Shanghai.
- Daily report health is based on generated files, contract validation, candidate volume, and successful CRM sync receipt.
