# PF2e Afflictioner — Strings Needed for Another Locale Parsing

This file lists every English string the parser matches against item description text.
FoundryVTT enricher syntax (`@Damage[...]`, `@UUID[...]`, `@Check[...]`, `[[/r ...]]`) is
**not** listed — those are engine tokens that stay the same in all locales.

---

## 1. Affliction Trait Names

Used to detect affliction type from item traits.
These are matched against PF2e system trait slugs — they only need translating if the
system localises its trait slugs (most systems do not).

| English    | Another |
| ---------- | ------- |
| `poison`   | ?       |
| `disease`  | ?       |
| `curse`    | ?       |
| `virulent` | ?       |

---

## 2. Structural Section Headers

These appear as bold labels in item descriptions (often inside `<strong>` tags).
Defined as regex fragments in the locale file.

| English                                        | Another |
| ---------------------------------------------- | ------- |
| `Stage` (followed by a number, e.g. "Stage 1") | ?       |
| `Onset`                                        | ?       |
| `Maximum Duration`                             | ?       |

---

## 3. Effect Section Label

Used to detect the "Effect" header in items that have an effect section (e.g. contact poisons).

| English  | Another |
| -------- | ------- |
| `Effect` | ?       |

---

## 4. Stage Cross-Reference Phrase

Used when one stage says "same effects as stage N".

| English pattern                  | Another |
| -------------------------------- | ------- |
| `as stage N` (e.g. "as stage 2") | ?       |

---

## 5. Duration Units

Used in `parseDuration`. Both singular and plural forms are mapped explicitly.

| English (singular / plural) | Another |
| --------------------------- | ------- |
| `round` / `rounds`          | ?       |
| `minute` / `minutes`        | ?       |
| `hour` / `hours`            | ?       |
| `day` / `days`              | ?       |
| `week` / `weeks`            | ?       |

---

## 6. DC Label

Used when no structured DC data is present and the parser falls back to plain text.

| English                                   | Another |
| ----------------------------------------- | ------- |
| `DC` (followed by a number, e.g. "DC 18") | ?       |

---

## 7. Death-Detection Keywords

Any of these in a stage description marks it as a death stage.

| English         | Another |
| --------------- | ------- |
| `dead`          | ?       |
| `dies`          | ?       |
| `instant death` | ?       |

---

## 8. Manual-Handling Keywords

If a stage contains any of these, it is flagged for GM attention instead of being auto-applied.

| English      | Another |
| ------------ | ------- |
| `secret`     | ?       |
| `gm`         | ?       |
| `special`    | ?       |
| `ability`    | ?       |
| `save again` | ?       |
| `choose`     | ?       |
| `option`     | ?       |
| `or`         | ?       |
| `either`     | ?       |
| `instead`    | ?       |
| `permanent`  | ?       |

---

## 9. Damage Types (plain-text fallback)

Used when no `@Damage[...]` enricher is present. The parser scans for `NdN <type>` patterns.

| English       | Another |
| ------------- | ------- |
| `acid`        | ?       |
| `bludgeoning` | ?       |
| `cold`        | ?       |
| `electricity` | ?       |
| `fire`        | ?       |
| `force`       | ?       |
| `mental`      | ?       |
| `piercing`    | ?       |
| `poison`      | ?       |
| `slashing`    | ?       |
| `sonic`       | ?       |
| `bleed`       | ?       |
| `persistent`  | ?       |

---

## 10. "Or Damage" Pattern

Used to detect "NdN type or type damage" constructs (e.g. "2d6 fire or cold damage").

| English pattern                                                   | Another |
| ----------------------------------------------------------------- | ------- |
| `<dice> <type> or <type> damage` (e.g. "2d6 fire or cold damage") | ?       |

The keywords that need translating here are `or` and `damage`.

---

## 11. "For Duration" Pattern

Used to detect inline durations at the end of stage text (e.g. "stunned 1 for 1 round").

| English pattern                                          | Another |
| -------------------------------------------------------- | ------- |
| `for <N> <unit>` (e.g. "for 1 round", "for 2d6 hours") | ?       |

The keyword that needs translating here is `for`.

---

## 12. Condition Names

Matched against plain text in stage descriptions. Also used to identify conditions inside
`@UUID[...]{Display Name}` enrichers.

| English             | Another |
| ------------------- | ------- |
| `blinded`           | ?       |
| `broken`            | ?       |
| `clumsy`            | ?       |
| `concealed`         | ?       |
| `confused`          | ?       |
| `controlled`        | ?       |
| `cursebound`        | ?       |
| `dazzled`           | ?       |
| `deafened`          | ?       |
| `doomed`            | ?       |
| `drained`           | ?       |
| `dying`             | ?       |
| `encumbered`        | ?       |
| `enfeebled`         | ?       |
| `fascinated`        | ?       |
| `fatigued`          | ?       |
| `fleeing`           | ?       |
| `frightened`        | ?       |
| `friendly`          | ?       |
| `grabbed`           | ?       |
| `helpful`           | ?       |
| `hidden`            | ?       |
| `hostile`           | ?       |
| `immobilized`       | ?       |
| `indifferent`       | ?       |
| `invisible`         | ?       |
| `malevolence`       | ?       |
| `observed`          | ?       |
| `off-guard`         | ?       |
| `paralyzed`         | ?       |
| `persistent-damage` | ?       |
| `petrified`         | ?       |
| `prone`             | ?       |
| `quickened`         | ?       |
| `restrained`        | ?       |
| `sickened`          | ?       |
| `slowed`            | ?       |
| `stunned`           | ?       |
| `stupefied`         | ?       |
| `unconscious`       | ?       |
| `undetected`        | ?       |
| `unfriendly`        | ?       |
| `unnoticed`         | ?       |
| `wounded`           | ?       |

### Condition Aliases

These display names are remapped internally before matching.

| Display name in text | Maps to condition | Another display name |
| -------------------- | ----------------- | -------------------- |
| `Flat-Footed`        | `off-guard`       | ?                    |

### Word Boundaries

The locale has a `useWordBoundaries` flag (default `true`). Set to `false` for locales that
don't use ASCII word separators (e.g. Chinese, Japanese), so the condition search won't
require `\b` boundaries.

---

## 13. Weakness Patterns

Two plain-text patterns are matched.

| English pattern                                    | Another equivalent |
| -------------------------------------------------- | ------------------ |
| `weakness to <type> N` (e.g. "weakness to fire 5") | ?                  |
| `weakness N to <type>` (e.g. "weakness 5 to fire") | ?                  |

---

## 14. Speed Penalty Patterns

Detects speed penalties in stage descriptions.

| English pattern                                                                    | Another |
| ---------------------------------------------------------------------------------- | ------- |
| `–N-foot status penalty to (all) Speed` (e.g. "–10-foot status penalty to Speed") | ?       |

The keywords that need translating are `foot`, `status penalty to`, and `Speed`.

---

## 15. Referenced Affliction Patterns

Used to detect when a stage references another affliction by name
(e.g. "the target is exposed to Demon Fever").

| English pattern                                                 | Another |
| --------------------------------------------------------------- | ------- |
| `exposed to (the) <name>` (e.g. "exposed to Demon Fever")       | ?       |
| `subjected to (the) <name>` (e.g. "subjected to the curse")     | ?       |
| `contracts (the) <name>` (e.g. "contracts Filth Fever")         | ?       |
| `contract (the) <name>`                                         | ?       |
| `afflicted with (the) <name>` (e.g. "afflicted with Malaria")   | ?       |

---

## 16. Multiple Exposure Patterns

Patterns matched to detect "exposure stacks the affliction".

| English pattern                                                   | Another |
| ----------------------------------------------------------------- | ------- |
| `each time you're/are exposed … increase/advance … stage(s) by N` | ?       |
| `each additional exposure … increase/advance … stage(s) by N`     | ?       |
| `multiple exposures … increase/advance … stage(s) by N`           | ?       |
| `while/at/when (already) at stage N` (minimum stage qualifier)    | ?       |

---

## Notes for the translator

- **All matches are case-insensitive**, so only one form per term is needed.
- Duration units use an explicit map of singular and plural forms (not a trailing-`s` strip).
- Condition names in `@UUID` enrichers come from the display text inside `{...}`, e.g.
  `@UUID[Compendium.pf2e.conditionitems.Item.xyz]{Clumsy 1}` — the parser reads `Clumsy 1`.
- If the Another system uses different structural keywords (e.g. a different word for "Stage"
  in item HTML), those are the strings that matter — not necessarily a literal translation.
  Check an actual Another-localized affliction item's raw HTML to confirm.
- Set `useWordBoundaries: false` if the locale does not use spaces/ASCII word separators.
- The locale file lives at `scripts/locales/parser-locale-en.js` — copy it and adjust all
  strings, regex patterns, and maps for the target language.
