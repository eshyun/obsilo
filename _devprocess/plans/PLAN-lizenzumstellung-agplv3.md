# Plan: Lizenzumstellung Apache 2.0 -> AGPL-v3 (Dual-Licensing)

> Status: GEPLANT
> Erstellt: 2026-03-16
> Ziel: Schutz vor Kommerzialisierung durch Dritte, Dual-Licensing-Faehigkeit

---

## 1. Kontext

### Warum die Umstellung?
Obsilo ist aktuell unter Apache 2.0 lizenziert. Das erlaubt Dritten, den Code
in proprietaere Produkte einzubauen, ohne Aenderungen offenzulegen oder den
Autor zu beteiligen. AGPL-v3 mit Dual-Licensing schliesst diese Luecke:

- **AGPL-v3 (oeffentlich):** Copyleft + Network-Copyleft -- Dritte muessen
  Aenderungen offenlegen, auch bei SaaS-Nutzung
- **Kommerzielle Lizenz (individuell):** Unternehmen koennen eine Lizenz ohne
  Copyleft-Pflicht erwerben

### Lizenzkompatibilitaet
| Upstream-Lizenz | Kompatibel mit AGPL-v3? | Pflichten |
|-----------------|------------------------|-----------|
| Apache 2.0 (Kilo Code) | Ja (vorwaerts-kompatibel) | Attribution + NOTICE beibehalten |
| MIT (OpenClaw) | Ja | Copyright-Notice beibehalten |
| Apache 2.0 (npm: openai, orama, fast-diff, pdfjs-dist) | Ja | Keine zusaetzlichen Pflichten |
| MIT (npm: anthropic-sdk, docx, pptxgenjs, etc.) | Ja | Keine zusaetzlichen Pflichten |
| BSD-3-Clause (npm: diff) | Ja | Keine zusaetzlichen Pflichten |
| MIT OR GPL-3.0+ (npm: jszip) | Ja, unter MIT-Variante waehlen | Explizit MIT waehlen dokumentieren |

**Ergebnis:** Alle Upstream-Lizenzen sind AGPL-v3-kompatibel. Keine Blocker.

---

## 2. Attribution-Audit (IST-Zustand)

### 2.1 Aktuell dokumentierte Attributions (NOTICE)

| Herkunft | Copyright | Lizenz | Status |
|----------|-----------|--------|--------|
| Obsilo Agent | 2025 Sebastian Hanke | Apache 2.0 -> AGPL-v3 | Aendern |
| Kilo Code | 2025- Kilo Code LLC | Apache 2.0 | OK |
| Cline (Upstream) | 2025 Cline Bot Inc | Apache 2.0 | OK |
| Roo Code (Upstream) | 2025 Roo Veterinary Inc | Apache 2.0 | OK |
| Continue Dev | 2023 Continue Dev, Inc | Apache 2.0 | OK |
| OpenClaw | 2025 Peter Steinberger | MIT | OK |

### 2.2 Abgeleitete Codebestandteile (verifiziert in src/)

Die folgenden Dateien enthalten explizite "Adapted from Kilo Code" Kommentare:

**API Layer (src/api/):**
- `src/api/index.ts` -- buildApiHandler Factory-Pattern
- `src/api/types.ts` -- ApiHandler Interface, Message-Format
- `src/api/providers/anthropic.ts` -- Anthropic Streaming Provider
- `src/api/providers/openai.ts` -- OpenAI Provider + Base-Provider Pattern

**Core (src/core/):**
- `src/core/AgentTask.ts` -- Conversation Loop (stark vereinfacht gegenueber Kilo Code)
- `src/core/systemPrompt.ts` -- System Prompt Modularisierung
- `src/core/tool-execution/ToolRepetitionDetector.ts` -- Loop-Detection Pattern
- `src/core/tool-execution/ToolExecutionPipeline.ts` -- Checkpoint-Pattern
- `src/core/checkpoints/GitCheckpointService.ts` -- In-Memory Checkpoint Tracking
- `src/core/prompts/sections/objective.ts` -- Objective Prompt Section
- `src/core/prompts/sections/capabilities.ts` -- Capabilities Prompt Section
- `src/core/context/ContextTracker.ts` -- Context-Window Utility
- `src/core/context/WorkflowLoader.ts` -- Slash-Commands Pattern
- `src/core/context/RulesLoader.ts` -- Instructions/Rules Pattern

**UI (src/ui/):**
- `src/ui/AgentSidebarView.ts` -- Sidebar UI/UX Patterns, Tool Display, Context Chips
- `src/ui/sidebar/CondensationFeedback.ts` -- CondensationResultRow Component
- `src/ui/sidebar/ContextDisplay.ts` -- ContextWindowProgress Component

**Types:**
- `src/types/model-registry.ts` -- Model-Registry Struktur

**Inspiriert von OpenClaw (MIT):**
- `src/core/memory/OnboardingService.ts` -- SOUL.md Konzept
- `src/core/memory/MemoryService.ts` -- soul.md Integration

### 2.3 Continue Dev Code

Continue Dev Code existiert NUR in `forked-kilocode/` (Referenz-Verzeichnis).
Es wurde KEIN Continue Dev Code direkt in `src/` uebernommen.
Die Attribution in NOTICE ist korrekt als Teil der Upstream-Kette (Kilo Code
enthaelt Continue Dev Code, wir referenzieren Kilo Code).

### 2.4 NPM-Abhaengigkeiten (Production)

| Paket | Lizenz | Kompatibel | Anmerkung |
|-------|--------|------------|-----------|
| @anthropic-ai/sdk | MIT | Ja | |
| @modelcontextprotocol/sdk | MIT | Ja | |
| @orama/orama | Apache-2.0 | Ja | |
| delay | MIT | Ja | |
| diff | BSD-3-Clause | Ja | |
| docx | MIT | Ja | |
| exceljs | MIT | Ja | |
| fast-diff | Apache-2.0 | Ja | |
| isomorphic-git | MIT | Ja | |
| jszip | MIT OR GPL-3.0+ | Ja | MIT-Variante waehlen |
| lodash.debounce | MIT | Ja | |
| openai | Apache-2.0 | Ja | |
| p-wait-for | MIT | Ja | |
| pdfjs-dist | Apache-2.0 | Ja | |
| pptxgenjs | MIT | Ja | |
| serialize-error | MIT | Ja | |
| uuid | MIT | Ja | |
| vectra | MIT | Ja | |

### 2.5 Befund: Fehlende Attributions

**Keine fehlenden Attributions gefunden.**

- Alle Kilo Code Ableitungen sind durch explizite Kommentare in den Source-Dateien
  UND durch die NOTICE-Datei dokumentiert
- OpenClaw ist in NOTICE dokumentiert + in Source-Kommentaren referenziert
- Continue Dev ist korrekt als Upstream-Kette dokumentiert
- Kein externer Code ohne Attribution in src/ gefunden

**Verbesserungsempfehlung:**
- jszip Dual-Lizenz explizit auf MIT festlegen (in NOTICE oder THIRD-PARTY-LICENSES)

---

## 3. Aenderungen (Detail)

### 3.1 LICENSE ersetzen

**VORHER:** Apache License 2.0 (vollstaendiger Text)
**NACHHER:** GNU Affero General Public License v3.0 (vollstaendiger Text)

Datei: `LICENSE`

Den vollstaendigen AGPL-v3-Text von https://www.gnu.org/licenses/agpl-3.0.txt
uebernehmen. Am Ende den Copyright-Header anpassen:

```
Copyright (C) 2025 Sebastian Hanke

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, version 3 of the License.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.
```

### 3.2 package.json anpassen

**VORHER:**
```json
"license": "Apache-2.0",
```

**NACHHER:**
```json
"license": "AGPL-3.0-only",
```

### 3.3 NOTICE aktualisieren

**VORHER:**
```
Obsilo Agent
Copyright 2025 Sebastian Hanke

Licensed under the Apache License, Version 2.0 (the "License");
...
```

**NACHHER:**
```
Obsilo Agent
Copyright (C) 2025 Sebastian Hanke
Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0-only).

This product includes software adapted from Kilo Code
(https://github.com/Kilo-Org/kilocode).
Copyright 2025- Kilo Code LLC.
Licensed under the Apache License, Version 2.0.

Kilo Code is a fork of Roo Code, which is a fork of Cline.
Original work: Copyright 2025 Cline Bot Inc.
Modified work (Roo Code): Copyright 2025 Roo Veterinary Inc.
Modified work (Kilo Code): Copyright 2025- Kilo Code LLC.

This product includes software developed by Continue Dev, Inc.
Copyright 2023 Continue Dev, Inc.
Licensed under the Apache License, Version 2.0.

Portions of the agent identity system are inspired by OpenClaw
(https://github.com/openclaw/openclaw).
Copyright 2025 Peter Steinberger.
Licensed under the MIT License.

Derived components from Kilo Code (Apache 2.0) include:
  src/api/          API handler interfaces, streaming providers, factory patterns
  src/core/         Agent loop, system prompt, tool pipeline, context loaders,
                    mode system, skills and workflow system, checkpoint patterns
  src/ui/           Sidebar UI patterns, context display, condensation feedback
  src/types/        Model registry structure

---
Third-party npm dependencies are listed in THIRD-PARTY-LICENSES.md.
JSZip is used under its MIT license option (dual-licensed MIT OR GPL-3.0+).
```

### 3.4 THIRD-PARTY-LICENSES.md erstellen (neu)

Neue Datei im Projekt-Root mit allen Production-Dependencies und ihren Lizenzen.
Standardpraxis fuer npm-Projekte. Inhalt: Tabelle aus Abschnitt 2.4 oben.

### 3.5 README.md aktualisieren

License-Badge und License-Section auf AGPL-3.0 aendern.
Dual-Licensing-Hinweis hinzufuegen:

```markdown
## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

For commercial licensing options (without AGPL obligations), contact
[sebastian@example.com](mailto:sebastian@example.com).
```

### 3.6 Source-Header (optional, empfohlen)

AGPL-v3 empfiehlt einen kurzen Header am Anfang jeder Source-Datei.
Dies ist OPTIONAL -- die LICENSE-Datei im Root reicht rechtlich aus.

Falls gewuenscht, Header fuer EIGENE Dateien (nicht Kilo-Code-abgeleitete):
```typescript
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025 Sebastian Hanke
```

Fuer Kilo-Code-abgeleitete Dateien (die bereits "Adapted from Kilo Code" haben):
```typescript
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025 Sebastian Hanke
// Adapted from Kilo Code (Apache-2.0), Copyright 2025- Kilo Code LLC
```

**Entscheidung:** SPDX-Header ja/nein vor Implementierung klaeren.

---

## 4. Dateien-Zusammenfassung

| Datei | Aenderung | Risiko |
|-------|-----------|--------|
| `LICENSE` | Apache 2.0 -> AGPL-v3 Volltext ersetzen | Niedrig |
| `package.json` | license-Feld aendern | Niedrig |
| `NOTICE` | Header aktualisieren, jszip-Klausel, Derived-Liste erweitern | Niedrig |
| `THIRD-PARTY-LICENSES.md` | Neu erstellen | Niedrig |
| `README.md` | License-Section + Badge aendern | Niedrig |
| `src/**/*.ts` (optional) | SPDX-Header einfuegen | Mittel (viele Dateien) |

## 5. NICHT betroffen

- `forked-kilocode/` -- Bleibt unveraendert (Referenz-Repo, eigene Apache-2.0 Lizenz)
- `_devprocess/` -- Interne Docs, nicht oeffentlich
- `node_modules/` -- Unveraendert (Upstream-Lizenzen bleiben)
- Source-Code-Logik -- Kein funktionaler Code wird geaendert
- Build/Deploy Pipeline -- Keine Aenderungen

---

## 6. Verifikation

1. [ ] LICENSE-Datei enthaelt vollstaendigen AGPL-v3-Text
2. [ ] package.json zeigt `"license": "AGPL-3.0-only"`
3. [ ] NOTICE enthaelt alle Attributions (Kilo Code, Cline, Roo, Continue Dev, OpenClaw)
4. [ ] NOTICE spezifiziert jszip MIT-Wahl
5. [ ] THIRD-PARTY-LICENSES.md listet alle 18 Production-Dependencies
6. [ ] README.md hat AGPL-v3 Badge + Dual-Licensing-Hinweis
7. [ ] `npm run build` laeuft erfolgreich (keine funktionalen Aenderungen)
8. [ ] Git-Commit mit klarer Message: "chore: switch license from Apache-2.0 to AGPL-3.0-only"
9. [ ] (Optional) SPDX-Header in Source-Dateien

---

## 7. Offene Entscheidungen

| # | Frage | Optionen | Empfehlung |
|---|-------|----------|------------|
| 1 | SPDX-Header in Source-Dateien? | Ja (alle Dateien) / Nein (nur LICENSE) | Nein -- LICENSE reicht, Header ist Aufwand ohne rechtlichen Mehrwert |
| 2 | Kontakt-E-Mail fuer kommerzielle Lizenzen? | E-Mail / Webformular / GitHub Issue | Vor README-Update festlegen |
| 3 | Dual-Licensing-Seite erstellen? | Eigene Webseite / README-Section | README-Section reicht initial |
| 4 | CLA fuer externe Contributors? | Ja / Nein | Ja, falls externe Contributors geplant -- sonst spaeter |
| 5 | Wann umstellen? | Sofort / Vor Public Release | Vor Public Release (sync-public Pipeline) |
