# ADR-062: KV-Cache-Optimized Prompt Structure & Provider-Agnostic Caching

**Status:** Proposed
**Date:** 2026-04-04
**Deciders:** Sebastian Hanke
**Feature:** FEATURE-1801 (Prompt Caching)

## Context

Der System Prompt (~25k Tokens) wird bei jeder Iteration identisch gesendet.
Anthropic Prompt Caching ist bereits teilweise implementiert (cache_control
Breakpoints in `anthropic.ts:60-89`), aber zwei Design-Probleme verhindern
effektives Caching:

1. **DateTime an Position 1**: `getDateTimeSection()` steht am Anfang des
   System Prompts und enthaelt den aktuellen Zeitstempel. Jeder neue API-Call
   hat einen anderen Timestamp → der gesamte KV-Cache wird invalidiert.

2. **Skills an Position 3**: Skills werden pro User-Message dynamisch via
   LLM-Klassifikation zusammengestellt. Unterschiedliche Skills → Cache-Invalidierung
   fuer alles danach.

Manus Context Engineering zeigt: Ein einziger veraenderter Token im Prefix
invalidiert den gesamten KV-Cache. Die Section-Reihenfolge ist entscheidend.

**Triggering ASR:**
- C-3: Prompt Caching darf die Prompt-Semantik nicht veraendern
- Quality Attributes: Cost Efficiency, Compatibility

## Decision Drivers

- **KV-Cache-Stabilitaet**: Stabiler Prefix > 90% der System-Prompt-Tokens
- **Provider-Agnostik**: Pattern muss mit allen Providern funktionieren
- **Qualitaetserhalt**: Section-Umordnung darf Agent-Verhalten nicht verschlechtern
- **Bestehende Implementierung nutzen**: Anthropic cache_control ist bereits da

## Considered Options

### Option 1: Nur Section-Reordering (Stabile zuerst, Dynamische zuletzt)

System Prompt Sections umordnen: Alles Stabile (Tools, Routing, Capabilities)
zuerst, alles Dynamische (DateTime, Skills, Memory, Recipes) zuletzt.

- Pro: Maximale Cache-Stabilitaet fuer alle Provider (auch automatisches Prefix-Caching)
- Pro: Keine neue Abstraktion noetig
- Pro: Funktioniert ohne Provider-spezifischen Code
- Con: Skills verlieren "Primacy Effect" (aktuell an Position 3)
- Con: DateTime am Ende ist ungewoehnlich

### Option 2: Zwei-Block System Prompt (Stable + Dynamic)

System Prompt in zwei separate Bloecke aufteilen:
Block 1 (cached): Alle stabilen Sections
Block 2 (nicht cached): Alle dynamischen Sections
Bei Anthropic: cache_control Breakpoint zwischen Block 1 und 2.
Bei anderen: Block 1 bleibt identisch → automatisches Prefix-Caching.

- Pro: Explizite Trennung von cached und nicht-cached
- Pro: Anthropic cache_control praezise platziert
- Pro: Andere Provider profitieren automatisch vom stabilen Prefix
- Con: System Prompt ist jetzt ein Array statt String (API-Aenderung)
- Con: Erfordert Anpassung in allen Providern (Typ-Aenderung)

### Option 3: Reordering + Adapter-Pattern fuer Cache-Hints

Section-Reordering (Option 1) kombiniert mit einem leichtgewichtigen
Adapter-Interface das Provider-spezifische Cache-Hints einfuegt.
System Prompt bleibt ein String. Adapter markiert nur wo der stabile
Anteil endet (fuer Provider die explizite Markierung brauchen).

- Pro: Einfachstes Adapter-Interface (`markCacheBreakpoint(systemPrompt, position)`)
- Pro: Section-Reordering funktioniert fuer ALLE Provider (auch ohne Adapter)
- Pro: System Prompt bleibt ein String (minimale API-Aenderung)
- Pro: Neuer Provider = nur Adapter registrieren (<30 Zeilen)
- Con: Weniger praezise als Zwei-Block-System
- Con: Breakpoint-Position muss deterministisch berechnet werden

## Decision

**Vorgeschlagene Option:** Option 3 -- Reordering + Adapter-Pattern

**Begruendung:**

Die Section-Umordnung ist der wichtigste Hebel und funktioniert fuer ALLE Provider
ohne Code-Aenderung (Prefix-Caching bei OpenAI/DeepSeek ist automatisch). Das
Adapter-Pattern ist nur fuer Provider noetig die explizite Markierung brauchen
(Anthropic). Damit ist die Loesung von Anfang an Provider-agnostisch.

Option 2 waere praeziser, erfordert aber eine Typ-Aenderung (String → Array) die
durch alle Provider-Implementierungen propagiert. Das ist unverhaeltnismaessig viel
Aufwand fuer den Mehrwert.

**Section-Reihenfolge (neu):**

```
STABIL (Position 1-9, aendert sich NIE innerhalb einer Session):
  1. Mode Definition
  2. Capabilities
  3. Obsidian Conventions
  4. Tools Section (~8k Tokens, groesster stabiler Block)
  5. Plugin Skills (stabil innerhalb einer Session)
  6. Tool Routing Rules
  7. Objective
  8. Response Format
  9. Security Boundary
  ═══ CACHE BREAKPOINT ═══

DYNAMISCH (Position 10-15, aendert sich pro Message/Session):
  10. Active Skills (LLM-klassifiziert, pro Message anders)
  11. Memory Context (aendert sich ueber Sessions)
  12. Procedural Recipes (pro Message unterschiedlich)
  13. Self-Authored Skills
  14. Custom Instructions + Rules
  15. Vault Context + DateTime
```

**Primacy Effect Mitigation:**
Skills rutschen von Position 3 auf Position 10. Der "Primacy Effect" geht
verloren. Mitigation: Die Todo-Liste als Recency-Anker am Ende des Kontexts
(FEATURE-1800) kompensiert dies. Ausserdem: Skills werden weiterhin mit
`SKILL PRECEDENCE (MANDATORY)` markiert, was bei allen getesteten Modellen
ausreichend stark ist.

## Implementation Sketch

### systemPrompt.ts Aenderung

```typescript
// Neue Section-Reihenfolge (KV-Cache-optimiert)
const sections: string[] = [
    // STABIL (cached) ─────────────────────────
    getModeDefinitionSection(mode),
    getCapabilitiesSection(webEnabled),
    getObsidianConventionsSection(),
    getToolsSection(mode.toolGroups, mcpClient, allowedMcpServers, webEnabled, !isSubtask),
    getPluginSkillsSection(pluginSkillsSection),
    getToolRoutingSection(configDir),
    getObjectiveSection(),
    isSubtask ? '' : getResponseFormatSection(),
    getSecurityBoundarySection(),
    // ═══ CACHE BREAKPOINT (injiziert via Adapter) ═══
    // DYNAMISCH (nicht cached) ────────────────
    isSubtask ? '' : getSkillsSection(skillsSection),
    isSubtask ? '' : getMemorySection(memoryContext),
    (isSubtask || !recipesSection) ? '' : recipesSection,
    (isSubtask || !selfAuthoredSkillsSection) ? '' : selfAuthoredSkillsSection,
    isSubtask ? '' : getCustomInstructionsSection(globalCustomInstructions, mode.customInstructions),
    getRulesSection(rulesContent),
    getExplicitInstructionsSection(),
    getDateTimeSection(includeTime) + getVaultContextSection(),
];
```

### Adapter-Interface

```typescript
interface PromptCacheAdapter {
    /** Inject provider-specific cache hints into the system prompt or messages. */
    applyCacheHints(systemPrompt: string, breakpointOffset: number): string | object;
}
```

Anthropic-Adapter: Setzt cache_control Breakpoint (bestehendes Pattern erweitern).
OpenAI/DeepSeek-Adapter: No-op (automatisches Prefix-Caching, kein Marker noetig).
Fallback: Kein Adapter = keine Cache-Hints (Prompt bleibt identischer String).

### Breakpoint-Position berechnen

```typescript
// In systemPrompt.ts: Markiere die Grenze zwischen stabil und dynamisch
const stableSections = sections.slice(0, CACHE_BREAKPOINT_INDEX);
const dynamicSections = sections.slice(CACHE_BREAKPOINT_INDEX);
const breakpointOffset = stableSections.filter(Boolean).join('\n').length;
```

## Consequences

### Positive
- KV-Cache-Stabilitaet fuer ~80% des System Prompts
- Automatisches Prefix-Caching bei OpenAI, DeepSeek (Zero-Config)
- Explizites Caching bei Anthropic (praeziser Breakpoint)
- Neuer Provider mit Caching = 1 Adapter (<30 Zeilen), kein neues Feature
- ~50-90% Kostenreduktion auf den stabilen Anteil (Provider-abhaengig)

### Negative
- Skills verlieren Primacy Effect (Position 3 → 10)
- Plugin Skills rutschen VOR Tool Routing (waren danach)
- DateTime am Ende statt am Anfang (LLM sieht es spaeter)

### Risks
- **Primacy-Effect-Verlust verschlechtert Skill-Befolgung**: Mitigation durch
  empirischen A/B-Test VOR dem Release. Falls messbare Verschlechterung:
  Skills-Precedence-Reminder als letzten dynamischen Block hinzufuegen.
- **Cache-Invalidierung durch Plugin-Skills-Aenderung**: Plugin Skills aendern
  sich wenn Plugins enabled/disabled werden. Mitigation: Innerhalb einer Task-Session
  aendern sich Plugins nicht. Cache ist pro-Session stabil.

## Related Decisions

- ADR-008: Modular Prompt Sections (bestehende Section-Architektur)
- ADR-061: Fast Path (profitiert vom Cache, interagiert via History)

## References

- FEATURE-1801: Prompt Caching (Provider-agnostisch)
- Manus Context Engineering: "Keep your prompt prefix stable"
- Anthropic Prompt Caching Docs: cache_control Breakpoints
- OpenAI Prompt Caching: Automatisches Prefix-Caching ab 1024 Tokens
