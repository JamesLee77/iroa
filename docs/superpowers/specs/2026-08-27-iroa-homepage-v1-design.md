# IROA.AI Homepage V1 Design

**Date:** 2026-08-27  
**Status:** Approved for implementation  
**Audience:** Korean institutions, field partners, caregivers, prospective users, and international ecosystem partners  
**Primary language:** Korean, with a future full English mirror

## 1. Objective

The IROA.AI homepage has two jobs:

1. Convert municipalities, welfare organizations, hospitals, CSR programs, and service partners into pilot conversations.
2. Explain IROA's whitepaper-level purpose, operating model, safety boundaries, and network architecture without making the visitor read the full whitepaper first.

The primary conversion is **기관 도입·PoC 상담**. The secondary conversion is **IROA 백서 보기**.

## 2. Approved Positioning

### Hero promise

> **말로 요청하면, 현실의 일이 안전하게 완료됩니다.**

Supporting copy:

> IROA는 디지털 접근이 어려운 사람의 요청을 이해하고, 필요한 서비스와 사람을 연결해 실행부터 확인까지 돕는 현실 실행 네트워크입니다.

### Brand character

The visual direction is **Warm Institutional Precision**:

- institutional clarity without cold medical styling;
- warm, dignified real-life photography without pity or passive stereotypes;
- purpose-built diagrams for processes, safety, products, and settlement;
- no speculative Web3 visual language, neon, coins, orbital graphics, or AI purple gradients;
- no important copy or controls placed over photography.

## 3. Brand System

Use only the approved IROA identity and semantic tokens derived from the BI guide:

| Token | Value | Use |
|---|---:|---|
| IROA Ivory | `#F7F3EA` | primary surface |
| IROA Navy | `#16263D` | headings, body, primary dark surfaces |
| IROA Coral | `#F06D5E` | large action accents and diagram markers |
| IROA Teal | `#3D8B83` | large secondary graphics, never normal text on Ivory |
| IROA Light Teal | `#83CDC4` | secondary text/accent on Navy |
| White | `#FFFFFF` | elevated surfaces and text on Navy |

Text contrast follows the verified BI guide. Coral on white and Teal on Ivory are not allowed for small text. Color never carries state without a label, icon shape, or position.

Use the official wordmark master at `docs/brand/masters/wordmark/iroa-wordmark-color.svg`. Use the local Noto Sans KR font assets. Preserve the published logo clear space and proportions.

## 4. Page Architecture

The first implementation is a single, complete homepage with anchored sections. The navigation anticipates future routes but only links to content that exists now.

1. Hero
2. How IROA Works
3. Real-Life Scenarios
4. Institutional Adoption
5. Safety & Trust
6. IROA Ecosystem
7. Network & Settlement
8. Roadmap
9. Institutional pilot contact
10. Footer and source/status disclosures

Desktop navigation labels:

- 작동 방식
- 활용 사례
- 안전과 신뢰
- 생태계
- 네트워크
- 기관 도입

The mobile navigation uses an accessible disclosure menu with a 44px minimum control target, correct `aria-expanded`, Escape-to-close behavior, and visible keyboard focus.

## 5. Hero

The hero is a two-column composition on large screens and a single-column composition on mobile. Copy and actions sit on an Ivory information plane. The selected documentary photograph sits in a separate editorial frame. No copy overlays the image.

Content:

- eyebrow: `REAL-WORLD ORCHESTRATION FOR EVERYONE`
- H1: `말로 요청하면, 현실의 일이 안전하게 완료됩니다.`
- supporting copy: approved positioning copy
- primary CTA: `기관 도입·PoC 상담`
- secondary CTA: `IROA 작동 방식 보기`
- trust strip: `사용자 승인 중심`, `사람에게 연결`, `개인정보 최소화`, `완료 검증`

The hero uses `cover-conversation-6248760.jpg`. The image is documentary context, not evidence of a partnership or an IROA user.

## 6. How IROA Works

Render the whitepaper lifecycle as a true connected diagram:

`요청 → 계획 → 선택 → 승인 → 실행 → 검증 → 복구·사람 인계`

Each node contains one short explanation. Connectors must touch the correct nodes and show direction. Desktop uses a horizontally composed orchestration path with a second-row recovery return. Mobile changes to a vertical sequence instead of shrinking the desktop diagram.

Three explicit protection rails sit beneath the lifecycle:

- 사용자 통제: irreversible actions require understandable approval;
- 사람 연결: uncertainty and failure can transfer to an approved person;
- 완료 책임: external results, not screen changes, establish completion.

## 7. Real-Life Scenarios

Use three editorial stories, not a generic feature-card wall:

1. Hospital visit support: appointment, accessible transport, reminder, completion.
2. Home service support: scope, price, approval, verified provider, completion.
3. Caregiver/institution continuity: minimum authorized status, delay detection, human handoff.

Each story has one supporting image, the spoken request, a concise flow, and a status tag. The initial public status is `목표 경험`; nothing is labeled as an operating service without proof.

## 8. Institutional Adoption

Show one common IROA orchestration core serving three adoption models:

| Model | Initial use |
|---|---|
| Municipality and welfare | mobility, visit, and daily-life support requests |
| Hospital and care organization | reservation, visit preparation, transport, return confirmation |
| Enterprise, franchise, and CSR | accessible ordering and verifiable support programs |

The institution diagram is:

`사용자·보호자 → IROA Orchestration → 기관·현장 제공자·지역 서비스 → 결과 확인·보고·정산`

Expected value is expressed as request visibility, responsible recovery, and evidence-based reporting—not generalized cost reduction claims.

## 9. Safety & Trust

Explain safety as five operational layers:

1. 사용자 권한
2. 정보 보호
3. 실행 통제
4. 사람 중심 회복
5. 완료 검증과 정산

Publish these non-negotiable boundaries:

- health, disability, identity, location, conversation, audio, and video source data are not written to a public blockchain;
- only minimum settlement records or receipt hashes may be anchored on-chain;
- automation does not guess and execute when confidence or authority is insufficient;
- current, in-development, pilot, and long-term capabilities are visibly distinguished.

## 10. Ecosystem Diagram

The ecosystem is a layered operating diagram rather than a collection of disconnected product icons:

1. **Access:** Mobile, Watch, Kiosk, Companion
2. **Agent:** request understanding, planning, proposals, approval management
3. **Orchestration & Safety Core:** state, authority, recovery, completion verification
4. **Execution:** institutions, partners, Node, human support, future Robot
5. **Settlement:** Base and Circle Native USDC

Robot is shown as a future execution interface, not a shipping flagship product.

## 11. Base and Native USDC

The approved network decision is:

- primary chain: **Base**;
- settlement asset: **Circle Native USDC**;
- initial scope: B2B settlement among institutions, merchants, Nodes, and support providers;
- consumer experience: KRW, cards, bank transfer, and existing e-wallets;
- user experience: gas, ETH, chain switching, and wallet management remain hidden;
- no IROA-issued stablecoin in V1;
- no sensitive source data on-chain;
- a chain-adapter boundary preserves future Solana or BNB integration without presenting multi-chain support as current.

The visual flow is:

`사용자 원화·카드 결제 → IROA 요청·승인 → 완료 검증 → 기관·제공자 정산 → Base Native USDC`

## 12. Roadmap and Truthful Status

Use four phases with explicit status language:

1. **Foundation — 현재:** whitepaper, approved BI, service and pilot design.
2. **Institutional Pilot — 다음:** scoped request lifecycle, partner integration, human handoff, measured completion.
3. **Settlement Pilot — 계획:** Base Native USDC B2B reconciliation after completion proof and legal/operational review.
4. **Network Expansion — 장기:** qualified Nodes, broader partner modules, and optional chain adapters including Solana.

Do not use dates, user counts, partner logos, performance percentages, or live-service labels unless evidence exists.

## 13. Contact Boundary

The homepage must not silently collect or pretend to submit inquiry data before an official endpoint or email is configured. The V1 contact section explains the pilot intake fields—organization, target users, target workflow—and presents a clearly labeled channel-pending state. The internal content configuration keeps the contact URL separate so it can be activated without redesign.

## 14. Accessibility and Responsive Contract

- semantic landmarks and sequential heading levels;
- visible skip link and visible focus ring;
- keyboard-operable navigation and controls;
- minimum interactive target of 44×44px;
- body text minimum 16px on mobile;
- no horizontal overflow at 375px;
- layouts verified at 375, 768, 1024, and 1440px;
- meaningful image alt text from the photo manifest;
- decorative SVGs hidden from assistive technology;
- reduced-motion preference removes nonessential transitions;
- diagrams retain labels and reading order without relying on color;
- no auto-playing video, carousel, parallax, or scroll-jacking.

## 15. Technical Direction

Build a static, componentized React and TypeScript homepage with Vite. Use CSS design tokens and focused component styles rather than a generic template framework. Content and status labels live in a typed content module so Korean copy, English expansion, and contact activation remain separable from layout.

Verification includes:

- component behavior and accessibility-oriented assertions with Vitest and Testing Library;
- TypeScript compilation;
- production build;
- Playwright browser checks for navigation, overflow, and key viewport layouts;
- visual review of desktop and mobile screenshots;
- link and asset verification.

## 16. Out of Scope for Homepage V1

- wallet connection;
- on-chain transactions or smart contracts;
- institution portal or authenticated dashboard;
- live inquiry backend;
- token sale, exchange, yield, or price content;
- full subpages and full English translation;
- claims of deployed Base settlement or operating partners.
