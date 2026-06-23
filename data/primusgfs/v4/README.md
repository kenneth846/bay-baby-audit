# PrimusGFS v4.0 data

This folder contains a structured index generated from the public PrimusGFS v4.0 documents listed at:

https://primusauditingops.com/primusgfs/

The original PDFs were downloaded only into `tmp/primusgfs-v4/` for local extraction and are intentionally ignored by git. The app uses this folder as the audit-standard backbone:

- `index.json` - module-level summary, source URLs, question counts, scoring totals, and sections.
- `module-*.json` - extracted question IDs, question text, point values, expectation summaries, evidence tags, source page, and source URL.

Bay Baby's likely operational scope is Modules 1, 2, 4, 5, and 6. Module 3, Indoor Agriculture, is kept in the data because it is part of PrimusGFS v4.0, but the UI marks it optional/confirm until the actual audit scope requires it.

HeavyConnect reports should be mapped as evidence against these PrimusGFS v4.0 question IDs. HeavyConnect's older Primus v3.2 self-audit templates should be handled through a crosswalk rather than used as the source of truth.
