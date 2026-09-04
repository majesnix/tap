repo: majesnix/tap
branch: main
path: src

## Last sync
date: 2026-09-03T18:12:15Z

### Updated in this project
- Recreated the current Tap UI (main view empty/loaded, block library, plans, profile modal, AMQP properties sheet) in `Tap — Current.dc.html`
- Copied `public/tap-mark.svg`, `public/tap-icon.svg` and the Lucide icons the UI uses into `icons/`
- Built two MajesNix redesign directions in `Tap — Redesign.dc.html`

## Screen map
| Screen | Repo files |
|---|---|
| 0a/0b Main view (sidebar, publish bar, form, right panel) | src/App.tsx, src/index.css, src/components/layout/AppLayout.tsx, src/components/sidebar/Sidebar.tsx, src/components/sidebar/FileSection.tsx, src/components/sidebar/IncludePathManager.tsx, src/components/sidebar/SchemaExplorer.tsx, src/components/sidebar/ConnectionSection.tsx, src/components/sidebar/ThemeToggle.tsx, src/components/sidebar/ClearLocalDataButton.tsx, src/components/publish/PublishBar.tsx, src/components/form/FormPanel.tsx, src/components/form/ProtoFormRenderer.tsx, src/components/form/fields/*.tsx, src/components/layout/RightPanel.tsx, src/components/preview/HexPreviewPanel.tsx, src/components/ui/*.tsx, examples/order.proto |
| 0c Block Library + History | src/components/blocks/BlockLibraryPanel.tsx, src/components/history/MessageHistoryPanel.tsx, src/components/history/HistoryTable.tsx, src/components/history/HistoryFilterBar.tsx |
| 0d Plans view | src/components/plans/PlanView.tsx, src/components/plans/PlanListPanel.tsx, src/components/plans/PlanDetailPanel.tsx, src/components/plans/PlanRunBar.tsx, src/components/plans/StepListPanel.tsx, src/components/plans/StepFieldEditor.tsx, src/components/plans/StepStatusBadge.tsx |
| 0e Connection Profiles modal | src/components/connection/ProfileManagementModal.tsx, src/components/ui/dialog.tsx |
| 0f AMQP Properties sheet | src/components/publish/AmqpPropertiesSheet.tsx, src/components/ui/sheet.tsx |
| Response tab (redesign only) | src/components/response/MessageFeedTab.tsx, src/components/response/ResponseQueuePicker.tsx, src/components/response/SubscribePanel.tsx, src/components/response/MessageFeedRow.tsx |
