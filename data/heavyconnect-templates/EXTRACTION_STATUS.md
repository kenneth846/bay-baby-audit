# HeavyConnect Template Extraction Status

Verified active scope:

1. Daily Sanitation Log
2. FRESH Food, Risk, Enviornment, Health & Safety Committee Meeting
3. R001 Field Activity Log
4. R004 Tractor Inspection
5. R006 Daily Sanitation Log
6. R022 Risk Assessment
7. R024 Field Buffer Log

## Captured

- R001 Field Activity Log
  - Header, three sections, question order, required markers, field types
  - Activity Type options captured
  - Remaining select-option lists still pending
- R004 Tractor Inspection
  - All five sections, exact question text, ordering, required markers, field types
- R006 Daily Sanitation Log
  - All five sections, exact question text, ordering, required markers, field types
- Daily Sanitation Log
  - PDF-captured from submitted HeavyConnect reports
  - Field/warehouse sanitation checks represented
  - Remaining live dropdown and conditional-control behavior listed in `live-capture-gaps.json`
- FRESH Food, Risk, Enviornment, Health & Safety Committee Meeting
  - PDF-captured from submitted HeavyConnect report
  - Meeting agenda and attendance fields represented
  - Crew/employee selector behavior still needs live confirmation
- R022 Risk Assessment
  - PDF-captured from submitted HeavyConnect report
  - HeavyConnect `report_type=517` confirmed live
  - First risk-assessment dropdown options captured live
  - Remaining dropdown and conditional-control behavior listed in `live-capture-gaps.json`
- R024 Field Buffer Log
  - PDF-captured from submitted HeavyConnect report
  - Remaining live dropdown and conditional-control behavior listed in `live-capture-gaps.json`

## Remaining live-control capture

- Remaining R001 dropdown option lists
- R022 Planned Use and water-source dropdowns
- R024 dropdowns/conditional controls, if present
- Daily Sanitation Log variant/conditional controls
- FRESH crew and employee attendance controls

Extraction paused when browser automation access to HeavyConnect live internals was blocked after the Start Report picker was visible. No missing choices should be inferred.
