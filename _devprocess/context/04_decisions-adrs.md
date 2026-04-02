# Architectural Decisions

Vollstaendige Liste aller ADRs. Details in `_devprocess/architecture/ADR-NNN-*.md`.

## Core Architecture

| ADR | Titel | Status |
|-----|-------|--------|
| ADR-001 | Central Tool Execution Pipeline | Akzeptiert |
| ADR-002 | isomorphic-git Checkpoints | Akzeptiert |
| ADR-003 | vectra Semantic Index | Akzeptiert |
| ADR-004 | Mode-basierte Tool-Filterung via Tool-Gruppen | Akzeptiert |
| ADR-005 | Fail-Closed Approval | Akzeptiert |
| ADR-006 | Sliding Window Repetition Detection | Akzeptiert |
| ADR-007 | Event Separation (Callbacks) | Akzeptiert |
| ADR-008 | Modular Prompt Sections | Akzeptiert |
| ADR-009 | Local Skills (Markdown-based) | Akzeptiert |
| ADR-010 | Permissions Audit Trail | Akzeptiert |
| ADR-011 | Multi-Provider API (Adapter Pattern) | Akzeptiert |
| ADR-012 | Context Condensing (Keep-First-Last, Smart Tail, Emergency Auto-Retry) | Akzeptiert |
| ADR-013 | 3-Tier Memory Architecture | Akzeptiert |
| ADR-014 | VaultDNA Plugin Discovery | Akzeptiert |
| ADR-015 | Hybrid Search (Semantic + BM25 + RRF) | Akzeptiert |
| ADR-016 | Rich Tool Descriptions | Akzeptiert |
| ADR-017 | Procedural Recipes | Akzeptiert |
| ADR-018 | Episodic Task Memory | Akzeptiert |
| ADR-019 | Electron SafeStorage (OS Keychain) | Akzeptiert |
| ADR-020 | Global Storage (~/.obsidian-agent/) | Akzeptiert |

## Extended Features

| ADR | Titel | Status |
|-----|-------|--------|
| ADR-021 | Sandbox OS-Level Process Isolation | Akzeptiert, implementiert |
| ADR-022 | Chat-Linking (Pipeline Post-Write Hook) | Akzeptiert, implementiert |
| ADR-023 | Document Parser als wiederverwendbare Tools | Akzeptiert, implementiert |
| ADR-024 | Leichtgewicht-Parsing (JSZip + Custom OOXML) | Akzeptiert, implementiert |
| ADR-025 | On-Demand Bild-Nachlade (Lazy Extraction) | Akzeptiert, geplant |
| ADR-026 | Post-Processing Hook fuer Task Extraction | Akzeptiert, implementiert |
| ADR-027 | Task-Note Frontmatter Schema | Akzeptiert, implementiert |
| ADR-028 | Base Plugin Integration (Task-Uebersicht) | Akzeptiert, teilweise implementiert |

## Office Document Creation & PPTX Pipeline

| ADR | Titel | Status |
|-----|-------|--------|
| ADR-029 | Office-Tool Input-Schema | Akzeptiert, implementiert |
| ADR-030 | Office-Library-Auswahl (docx, ExcelJS) | Akzeptiert, implementiert (PPTX-Teil superseded by ADR-046) |
| ADR-031 | Binary-Write-Pattern (writeBinaryToVault) | Akzeptiert, implementiert |
| ~~ADR-032~~ | ~~Template-basierte PPTX (JSZip + OOXML)~~ | Deprecated, superseded by ADR-046 |
| ~~ADR-033~~ | ~~Multimodaler Template-Analyzer~~ | Deprecated, nie implementiert |
| ~~ADR-034~~ | ~~Visual Design Language Document~~ | Deprecated, nie implementiert |
| ~~ADR-035~~ | ~~Embedding-Enhanced Template Analysis~~ | Deprecated, superseded by ADR-046 |
| ~~ADR-044~~ | ~~CSS-SVG Slide Engine~~ | Deprecated, superseded by ADR-046 |
| ~~ADR-045~~ | ~~pptx-automizer Pipeline~~ | Deprecated, superseded by ADR-046 |
| ADR-046 | Direct Template Mode (groupByLayoutName + physische Shape-Namen) | Akzeptiert, implementiert |
| ADR-047 | Schema-Constrained Slide Generation | Akzeptiert, implementiert |
| ADR-048 | plan_presentation Pipeline (interner LLM-Call) | Akzeptiert, implementiert |
| ADR-049 | Raw XML Clear-Generate | Vorgeschlagen, in Evaluation |

## GitHub Copilot Provider

| ADR | Titel | Status |
|-----|-------|--------|
| ADR-036 | Copilot Streaming Strategy | Akzeptiert, implementiert |
| ADR-037 | Copilot Provider Architecture | Akzeptiert, implementiert |
| ADR-038 | Copilot Token Storage | Akzeptiert, implementiert |
| ADR-039 | Copilot Content Normalization | Akzeptiert, implementiert |

## Kilo Gateway Provider

| ADR | Titel | Status |
|-----|-------|--------|
| ADR-040 | Kilo Provider Architecture | Akzeptiert, implementiert |
| ADR-041 | Kilo Auth & Session Architecture | Akzeptiert, implementiert |
| ADR-042 | Kilo Metadata Discovery | Akzeptiert, implementiert |
| ADR-043 | Kilo Embedding Gating Strategy | Akzeptiert, implementiert |

## Unified Knowledge Layer

| ADR | Titel | Status |
|-----|-------|--------|
| ADR-050 | SQLite Knowledge DB (sql.js WASM) | Akzeptiert, implementiert |
| ADR-051 | Retrieval Pipeline (Two-Pass Background Enrichment) | Akzeptiert, implementiert |
| ADR-052 | Local Reranker (@huggingface/transformers Cross-Encoder) | Akzeptiert, implementiert |

## MCP Connector

| ADR | Titel | Status |
|-----|-------|--------|
| ADR-053 | MCP Server Architecture (stdio Bridge) | Akzeptiert, implementiert |
| ADR-054 | MCP Tool Mapping (3-Tier) | Akzeptiert, implementiert |
| ADR-055 | Remote Relay (Cloudflare Workers) | Vorgeschlagen, in Arbeit |
