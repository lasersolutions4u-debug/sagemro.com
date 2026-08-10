# Work Order Detail Section Order Design

Date: 2026-08-10
Status: User-approved direction; written specification awaiting final review

## 1. Scope

Adjust the Admin work-order detail drawer in both the international and China editions. Split the current combined reviews-and-messages section into two independent sections and reorder all major sections to match the real service workflow.

This change is presentation-only. It does not change work-order states, permissions, lifecycle gates, quote rules, message storage, review storage, API contracts, or database schema.

## 2. Confirmed section order

The sticky shortcut navigation and the corresponding detail sections use this exact order:

1. Overview / 概览
2. Messages / 沟通记录
3. Dispatch / 派工
4. Quote / 报价清单
5. Service Controls / 服务标准
6. Service Operations / 作业管理
7. Reviews / 服务评价

The order reflects how an operator handles a work order: first understand the order, then review communication, assign responsibility, confirm commercial terms, manage quality controls and execution records, and finally review service outcomes.

## 3. Content boundaries

### Messages / 沟通记录

Contains only:

- the customer-visible and internal message timeline;
- message count;
- internal-note composer and submit action when the viewer has write permission.

It appears immediately after Overview so operators can see recent context before dispatching or reviewing a quote.

### Reviews / 服务评价

Contains only:

- the customer service review and score details;
- the engineer internal customer review and risk note.

It appears last because reviews describe the completed service outcome rather than the active execution workflow.

### Service Operations / 作业管理

Retains the existing diagnostic attachments, field-work execution content, and service report. Internal labels such as “Diagnostic Images & Attachments” and “Service Report” remain unchanged inside the section.

All other section contents and business actions remain in their existing modules.

## 4. Interaction behavior

- The shortcut bar remains a set of scroll-to-section controls, not a tab switcher.
- Selecting a shortcut expands the target section if required and scrolls it into view.
- Existing state-based default expansion rules remain unchanged unless a renamed section key requires a direct mapping update.
- Messages and Reviews use separate stable section keys and disclosure states.
- Opening or closing one does not change the other.
- Each message timeline, customer review, and engineer review is rendered exactly once.

## 5. Localization

The same structure applies to both editions and both locale dictionaries:

| Section key | English | Simplified Chinese |
| --- | --- | --- |
| `overview` | Overview | 概览 |
| `messages` | Messages | 沟通记录 |
| `dispatch` | Dispatch | 派工 |
| `quote` | Quote | 报价清单 |
| `service-controls` | Service Controls | 服务标准 |
| `service-operations` | Service Operations | 作业管理 |
| `reviews` | Reviews | 服务评价 |

Dynamic customer, engineer, AI, note, and message content remains in its authored language.

## 6. Error handling and data behavior

No new fetching or mutation path is introduced. Existing detail-loading, stale-request, mutation-error, and read-only behavior remains unchanged. Splitting the sections must not duplicate requests, messages, reviews, or submit handlers.

## 7. Test and acceptance criteria

- A source/component contract test first fails against the current combined section.
- Navigation labels and stable section keys exist in both locale paths.
- Navigation and rendered section order match the seven-step sequence exactly.
- The legacy `reviews-messages` combined key and label are removed.
- Messages and Reviews are separate disclosures.
- Customer review, engineer review, and message timeline each render once.
- The existing `Service Operations` / `作业管理` naming remains intact.
- International Admin tests and production build pass.
- China Admin tests and China production build pass.

## 8. Non-goals

- No visual redesign of the drawer.
- No changes to work-order workflow or service-control strictness.
- No message or review feature additions.
- No new API endpoint, schema, or migration.
- No deployment until the implementation has passed verification and deployment is explicitly authorized.
