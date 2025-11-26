# Changelog

## [Unreleased] - 2025-11-26

- Fix: normalize project metadata path lookup so `listProjects` finds projects created under test/data directories.
- Fix: improve `createProject` error message when target directory exists (now matches expected wording in tests).
- Fix: ensure templates directory resolution uses provided `dataDir` during tests to reliably load mock templates.
- Test: added/updated test harness and configuration; all tests passing locally.
- Maintenance: small robustness fixes for build/execute helpers and crypto usage in config manager.
