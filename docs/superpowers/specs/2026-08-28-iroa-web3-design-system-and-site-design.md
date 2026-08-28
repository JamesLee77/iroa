# IROA Web3 Design System and Public Site Design

**Date:** 2026-08-28

**Status:** Approved design; pending implementation plan

**Supersedes:** `2026-08-27-iroa-homepage-v1-design.md` for the public website

**Primary language:** Korean

**Canonical whitepaper:** `docs/whitepaper/IROA_WHITEPAPER_KO.md`

## 1. Decision Summary

IROA.AI will be presented as a **Human Utility Protocol**: a Web3 network that turns real-world requests into verified outcomes through AI orchestration, permissioned execution, verified Nodes, proof receipts, and B2B settlement.

The public experience will be rebuilt around four approved decisions:

1. The visual direction is the selected light **Network Atlas** concept, not the current photo-led institutional homepage.
2. A reusable **IROA Web3 Design System** must be built before page implementation.
3. The website will be content-first and statically generated with **Astro**, using React only for interactive islands.
4. The whitepaper will be a native web publication generated from the same canonical Markdown source as its downloadable document exports.

The implementation must preserve the approved Track A identity while making the protocol, Network, Base, Native USDC, privacy boundary, and document status immediately understandable.

## 2. Goals and Success Criteria

### 2.1 Product goals

- Make visitors understand within the first viewport that IROA coordinates real-world execution through a verifiable Web3 protocol.
- Give institutions, Node operators, contributors, developers, and users clear entry points without presenting planned capabilities as live services.
- Provide the full Korean whitepaper as navigable, linkable, accessible web content.
- Establish a reusable design system that governs the homepage, whitepaper, Network, economy, roadmap, and future public pages.

### 2.2 Acceptance outcomes

- The homepage no longer reads as a generic welfare, healthcare, or nonprofit brochure.
- The protocol flow is visible as `Request → Task Capsule → Verified Node → Proof Receipt → Base Settlement`.
- Base is identified as the primary operating network and Circle Native USDC as the B2B settlement asset.
- Consumer payments remain KRW, cards, bank transfers, and existing payment channels; gas and wallet management are not exposed as consumer requirements.
- IROA rewards are labeled as planned or under validation until issuance, legal review, deployment, and audit evidence exists.
- Personal and sensitive source data is explicitly kept off-chain.
- Every whitepaper chapter has a stable URL, table of contents entry, previous/next navigation, document status, and PDF download path.

## 3. Audience and Content Priority

The primary audiences are:

1. institutions considering pilots or integrations;
2. prospective Node operators and technical contributors;
3. accessibility, care, and community participants;
4. partners evaluating settlement and operational boundaries;
5. readers performing whitepaper, governance, legal, or technical diligence.

The content priority is:

1. verifiable real-world utility;
2. user authority and privacy;
3. protocol and Network architecture;
4. Base and Native USDC settlement;
5. IROA contribution rewards and token-economy status;
6. roadmap, validation gates, and participation paths.

Token price, yield, listing, guaranteed returns, and speculative trading language are prohibited.

## 4. Visual Direction

### 4.1 North star

The approved direction is a bright, premium **Network Atlas**:

- pale mineral and Ivory surfaces;
- deep Navy typography;
- precise engineering lines and restrained translucent layers;
- Teal for verified and safe states;
- Coral for the active request path and user actions;
- one memorable open-ring path connecting request, execution, proof, and settlement;
- no stock photography in the primary protocol story;
- no cyberpunk, coin imagery, candlestick charts, neon city scenes, or generic AI gradients.

The page should feel like accountable infrastructure that remains understandable to nontechnical people.

### 4.2 Homepage hero

The hero uses the message:

> **현실 세계를 위한 검증 가능한 실행 네트워크.**

The supporting copy explains that IROA coordinates AI, people, institutions, and verified Nodes. The visual shows four planes:

1. Interaction Plane
2. Control Plane
3. Execution Plane
4. Settlement Plane

The highlighted path is:

`Voice Request → Task Capsule → N2 Verified Node → Proof Receipt → Base / Native USDC`

Primary action: `네트워크 살펴보기`

Secondary action: `웹 백서 읽기`

Persistent facts near the hero:

- `Base Primary Network`
- `Native USDC Settlement`
- `Personal Data Off-chain`
- `IROA Rewards · Validation Stage`

## 5. IROA Web3 Design System

The design system is a prerequisite, not a post-implementation cleanup task. It consists of four layers.

### 5.1 Foundations

- Use only the approved Track A masters and preserve the published clear-space and minimum-size rules.
- Retain the existing brand values: Navy `#16263D`, Ivory `#F7F3EA`, Coral `#F06D5E`, Teal `#3D8B83`, Light Teal `#83CDC4`, Ink, and White.
- Add semantic aliases instead of hard-coded page colors: background, surface, text, text-muted, action, verified, warning, danger, border, focus, on-action, and on-dark.
- Coral may use Navy text when used as a filled action. White text on Coral is prohibited.
- Teal on Ivory is not used for normal-size body text.
- Use Noto Sans KR for Korean and Inter for Latin text and tabular data.
- Use a 4/8px spacing rhythm, responsive 12-column desktop grid, and defined 375, 768, 1024, and 1440px breakpoints.
- Define light and dark semantic themes together. Dark surfaces are reserved for execution, proof, and selected protocol contexts rather than used as a generic full-site effect.

### 5.2 Primitives

- Button, Link, Icon Button
- Badge, Status Label, Document Status
- Input, Toggle, Tabs, Accordion
- Surface, Divider, Tooltip
- Header, Footer, Desktop Navigation, Mobile Navigation
- Heading, Body, Label, Code, and Tabular Number roles

Every primitive includes default, hover, focus-visible, pressed, disabled, loading, error, and success states where applicable.

### 5.3 IROA patterns

- **Protocol Path:** ordered request-to-result flow with a text-list equivalent.
- **Task Capsule:** purpose, permitted actions, data class, duration, and approval state.
- **Verified Node:** trust level, qualification state, and current availability without unsupported certification claims.
- **Proof Receipt:** result status, proof identifier, policy version, privacy boundary, and dispute state.
- **Settlement Record:** Base, Native USDC, amount or status, and transaction reference when evidence exists.
- **Privacy Boundary:** visible on-chain versus off-chain separation.
- **Document Control:** title, version, date, language, and publication status.
- **Whitepaper Reader:** chapter index, progress, anchored headings, tables, figures, footnotes, previous/next navigation, and download actions.

### 5.4 Data visualization

- Protocol flow uses a labeled sequential flow, never color alone.
- Node topology includes a keyboard-readable hierarchy or adjacency-list alternative.
- Token allocation uses an accessible 100% stacked bar plus exact table, not a decorative donut as the only representation.
- Vesting uses an annotated timeline with exact values available in a table.
- Roadmap uses phases, entry gates, status labels, and evidence requirements.
- Every complex chart has a text or table fallback and remains understandable at 200% zoom.

### 5.5 Design-system outputs

- `design-system/MASTER.md`
- page overrides for homepage, whitepaper, Network, and economy
- semantic CSS tokens
- reusable Astro and React primitives and patterns
- `/design-system` internal visual-review route
- automated contrast, interaction-state, and responsive checks

## 6. Site Information Architecture

### 6.1 Public routes

| Route | Purpose |
|---|---|
| `/` | Protocol-first public homepage |
| `/protocol` | Interaction, Control, Execution, and Settlement planes |
| `/network` | Node roles, trust levels, execution, and proof |
| `/economy` | Service fees, Native USDC settlement, IROA reward status, allocation, and vesting |
| `/whitepaper` | Document overview, status, and complete chapter index |
| `/whitepaper/[chapter]` | Static page for each of the 22 whitepaper chapters |
| `/roadmap` | Delivery phases, entry criteria, status, and evidence |
| `/design-system` | Internal visual inventory and QA surface |

### 6.2 Global navigation

Desktop and mobile navigation use:

- Protocol
- Network
- Economy
- Whitepaper
- Roadmap

The primary header action is contextual rather than a permanent token or wallet CTA. The first release uses `웹 백서 읽기` or a validated institutional-contact action.

### 6.3 Homepage sequence

1. Network Atlas hero
2. One continuous protocol path
3. Human utility and privacy boundary
4. Four protocol planes
5. Node and proof model
6. Base and Native USDC settlement
7. IROA economy status and boundaries
8. Web-whitepaper entry and reader preview
9. Roadmap and evidence gates
10. Participation or institutional contact

The homepage avoids repetitive card walls. Spacing, type, alignment, dividers, and a single connected surface establish hierarchy before borders or shadows.

## 7. Technical Architecture

### 7.1 Framework decision

Use Astro for statically generated pages and React islands only for interactions that require client-side state.

Static Astro responsibilities:

- page shell, metadata, navigation, footer, and content sections;
- whitepaper chapter pages and document metadata;
- noninteractive diagrams with accessible text equivalents;
- SEO, sitemap, Open Graph metadata, and canonical URLs.

React-island responsibilities:

- mobile navigation if stateful behavior is not handled with native HTML;
- interactive Network-path exploration;
- whitepaper reading progress and enhanced chapter navigation;
- chart details or view switching where interaction adds genuine value.

JavaScript is not shipped for content that can remain semantic HTML and CSS.

### 7.2 Component boundaries

- `layouts/`: site shell, document shell, metadata, and navigation layout
- `components/primitives/`: reusable low-level UI
- `components/patterns/`: IROA-specific protocol, Node, proof, settlement, and document patterns
- `components/sections/`: page-level compositions
- `content/`: page copy, statuses, navigation, and structured facts
- `lib/whitepaper/`: source loading, heading normalization, chapter mapping, link resolution, and validation
- `styles/`: semantic tokens, foundations, components, utilities, and print rules

Page components must not embed unsupported business claims or raw color values.

## 8. Whitepaper Web Publication

### 8.1 Single source of truth

`docs/whitepaper/IROA_WHITEPAPER_KO.md` remains the canonical source. The build pipeline reads it directly; the web publication does not maintain a manually copied second version.

The document metadata contract includes:

- title;
- version;
- publication date;
- primary language;
- status such as draft, validation, reviewed, or published;
- controlling-version statement;
- PDF download path.

### 8.2 Chapter generation

- Level-two headings define the 22 primary chapters.
- Stable slugs are declared or deterministically generated and locked by validation.
- Lower headings produce anchored sections and local table-of-contents entries.
- Relative images, charts, and internal links resolve through a controlled asset map.
- Tables receive captions or accessible names.
- Previous and next links follow the canonical chapter order.

### 8.3 Reader experience

Desktop uses a sticky chapter index with a comfortable 60–75-character text measure. Mobile uses a chapter disclosure control and preserves the main document scroll.

The reader includes:

- document status and version at the top;
- chapter index and current chapter;
- reading progress as an enhancement, not the only location indicator;
- anchored headings and copyable chapter URLs;
- figure captions and source links;
- previous and next chapter controls;
- PDF download as a secondary action;
- print styling for readable browser output.

## 9. Truth and Status Model

Public claims use explicit statuses:

- **Current:** directly available or evidenced now.
- **Next:** committed near-term work with a defined gate.
- **Planned:** approved direction without operating proof.
- **Validation:** design, legal, security, or field validation is incomplete.
- **Long-term research:** exploratory work that is not a delivery commitment.

The same status vocabulary is used in the homepage, whitepaper, roadmap, Network, and economy pages.

The website must not imply that:

- IROA tokens are issued or transferable;
- rewards, yield, price, liquidity, or exchange listing are guaranteed;
- Base settlement is operating before deployment evidence exists;
- institutions, payment providers, or public agencies are partners without documented approval;
- Node qualification is a certification scheme unless such a scheme exists.

## 10. Data Flow and Build Validation

The content path is:

`Canonical Markdown → document loader → schema validation → chapter model → static web routes → document exports`

Build-time validation fails for:

- missing required document metadata;
- duplicate or changed locked slugs;
- broken internal links or missing local assets;
- duplicate heading IDs;
- unknown public status values;
- missing chapter navigation entries;
- malformed allocation totals or structured economy values;
- forbidden claim phrases configured by the project.

Build failure is preferable to silently publishing incomplete or contradictory content.

## 11. Error Handling

- Unknown routes show a branded 404 with links to the homepage and whitepaper index.
- Unknown whitepaper chapters show a document-specific not-found state and the complete chapter index.
- A missing figure fails the build rather than rendering a broken image.
- Optional enhanced interaction falls back to static content if JavaScript fails.
- Network diagrams always retain a readable ordered list or table.
- External links are visually identified and do not imply endorsement.
- Downloads expose file type and, when available, size.
- The contact surface does not pretend to submit data until an approved endpoint exists.

## 12. Accessibility and Responsive Contract

- WCAG 2.2 AA is the minimum product target; the brand guide's verified contrast pairs remain authoritative.
- Body text is at least 16px on mobile.
- Interactive targets are at least 44×44px with 8px separation where adjacent.
- Keyboard order follows visual and document order.
- Focus indication is visible on every interactive control.
- Color is never the only status or relationship signal.
- `prefers-reduced-motion` removes path drawing, parallax, and nonessential transitions.
- No scroll-jacking, auto-playing video, or forced horizontal page scroll.
- Whitepaper tables use responsive wrappers or alternate stacked views without losing headers.
- Pages are verified at 375, 768, 1024, and 1440px, at 200% zoom, and with mobile landscape orientation.
- Network and Sankey-like diagrams include accessible list or table alternatives.

## 13. Performance and Discoverability

- Static HTML is the default output.
- Client JavaScript is limited to explicit islands.
- Fonts are locally served with swap behavior and only required weights are loaded.
- Images declare dimensions and use responsive optimized formats.
- Below-fold media is lazy-loaded with reserved space.
- Every public route has a unique title, description, canonical URL, and share image.
- The build produces sitemap and robots metadata.
- Whitepaper chapter pages expose meaningful headings and stable anchor URLs.

## 14. Testing and Review

### 14.1 Automated

- unit tests for status, slug, chapter-order, and link validation;
- component tests for interaction states and accessible names;
- build tests for every public route;
- browser tests for navigation, direct chapter access, refresh, previous/next controls, and PDF links;
- responsive overflow checks at all defined breakpoints;
- automated accessibility checks for representative pages;
- internal-link and asset verification;
- source-to-render assertions for whitepaper headings, tables, and key numeric values.

### 14.2 Visual

- compare the selected Network Atlas visual target against the implementation at matching viewports;
- review homepage, whitepaper index, representative chapter, Network, economy, and design-system routes;
- verify typography, spacing, line connections, logo clear space, component states, chart labels, and responsive transformations;
- inspect both light and protocol-dark surfaces;
- reject broken, cropped, missing, or temporary substitute assets.

### 14.3 Evidence boundaries

Passing source tests does not prove browser quality. Passing browser screenshots does not prove deployment. Source, browser, deployment, and live-operation evidence are reported separately.

## 15. Delivery Sequence

1. Establish Astro project structure while preserving approved assets and whitepaper source.
2. Build the design-system foundations and internal `/design-system` route.
3. Build and verify primitives.
4. Build IROA protocol, Node, proof, settlement, and document patterns.
5. Implement the homepage from the selected Network Atlas target.
6. Implement whitepaper loading, validation, index, and chapter routes.
7. Implement Protocol, Network, Economy, and Roadmap routes.
8. Run automated, visual, responsive, and accessibility verification.
9. Produce the production build and deployment handoff evidence.

## 16. Out of Scope

- wallet connection and wallet onboarding;
- on-chain transactions, smart contracts, or live settlement;
- token sale, exchange, staking, yield, or price functionality;
- authenticated institution or Node dashboards;
- live inquiry backend without an approved endpoint;
- partner logos or operating claims without evidence;
- full English translation in this delivery;
- replacing the approved Track A brand identity.

## 17. Reference Sources

- Approved IROA BI guide and Track A masters under `docs/brand/`
- Canonical Korean whitepaper at `docs/whitepaper/IROA_WHITEPAPER_KO.md`
- Selected Network Atlas visual direction generated during the 2026-08-27 review
- SIMX live homepage and web-whitepaper reading structure as comparative information-architecture references, not as a visual clone
