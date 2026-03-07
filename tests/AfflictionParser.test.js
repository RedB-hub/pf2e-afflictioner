import { AfflictionParser } from '../scripts/services/AfflictionParser.js';
import { resetParserLocaleCache } from '../scripts/locales/parser-locales.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Switch the parser locale by changing game.i18n.lang and clearing the cache. */
function setLang(lang) {
  game.i18n.lang = lang;
  resetParserLocaleCache();
}

// Reset to English after each test so locale bleeds don't affect other tests.
afterEach(() => setLang('en'));

// ═══════════════════════════════════════════════════════════════════════════════
// ENGLISH
// ═══════════════════════════════════════════════════════════════════════════════

describe('AfflictionParser — English', () => {
  beforeEach(() => setLang('en'));

  // ── extractStages ──────────────────────────────────────────────────────────

  test('parses inline HTML stages', () => {
    const html =
      '<p><strong>Stage 1</strong> 1d4 poison damage (1 round)</p>' +
      '<p><strong>Stage 2</strong> 1d6 poison damage and @UUID[Compendium.pf2e.conditionitems.Item.MIRkyAjyBeXivMa7]{Enfeebled 1} (1 round)</p>';

    const stages = AfflictionParser.extractStages(html);
    expect(stages).toHaveLength(2);
    expect(stages[0].number).toBe(1);
    expect(stages[0].duration).toEqual({ value: 1, unit: 'round', isDice: false });
    expect(stages[1].number).toBe(2);
    expect(stages[1].conditions).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'enfeebled', value: 1 })]),
    );
  });

  test('parses paragraph HTML stages', () => {
    const html =
      '<p><strong>Stage 1</strong> @Damage[1d4[poison]] damage (1 round)</p>' +
      '<p><strong>Stage 2</strong> @Damage[1d6[poison]] damage (1 round)</p>';

    const stages = AfflictionParser.extractStages(html);
    expect(stages).toHaveLength(2);
    expect(stages[0].damage).toEqual(
      expect.arrayContaining([expect.objectContaining({ formula: '1d4', type: 'poison' })]),
    );
  });

  test('parses stages with dice duration', () => {
    const html = '<p><strong>Stage 1</strong> 1d6 fire damage (2d6 hours)</p>';
    const stages = AfflictionParser.extractStages(html);
    expect(stages).toHaveLength(1);
    expect(stages[0].duration).toEqual({ formula: '2d6', value: null, unit: 'hour', isDice: true });
  });

  // ── extractDC ─────────────────────────────────────────────────────────────

  test('extracts DC from @Check enricher', () => {
    const desc = '<p><strong>Saving Throw</strong> @Check[fortitude|dc:15]</p>';
    const item = { system: { description: { value: desc } } };
    expect(AfflictionParser.extractDC(desc, item)).toBe(15);
  });

  test('extracts DC from data-pf2-dc attribute', () => {
    const desc = '<span data-pf2-dc="22">DC 22 Fortitude</span>';
    const item = { system: { description: { value: desc } } };
    expect(AfflictionParser.extractDC(desc, item)).toBe(22);
  });

  test('extracts DC from plain text', () => {
    const desc = 'DC 18 Fortitude save';
    const item = { system: {} };
    expect(AfflictionParser.extractDC(desc, item)).toBe(18);
  });

  test('prefers system DC over description', () => {
    const desc = 'DC 18 Fortitude save';
    const item = { system: { save: { dc: 20 } } };
    expect(AfflictionParser.extractDC(desc, item)).toBe(20);
  });

  // ── extractOnset ──────────────────────────────────────────────────────────

  test('extracts onset from HTML', () => {
    const desc = '<p><strong>Onset</strong> 1 round</p>';
    expect(AfflictionParser.extractOnset(desc)).toEqual({ value: 1, unit: 'round', isDice: false });
  });

  test('extracts onset from plain text', () => {
    const desc = 'Onset 10 minutes';
    expect(AfflictionParser.extractOnset(desc)).toEqual({ value: 10, unit: 'minute', isDice: false });
  });

  // ── extractMaxDuration ────────────────────────────────────────────────────

  test('extracts max duration from HTML', () => {
    const desc = '<p><strong>Maximum Duration</strong> 6 rounds</p>';
    expect(AfflictionParser.extractMaxDuration(desc)).toEqual({ value: 6, unit: 'round', isDice: false });
  });

  test('extracts max duration from plain text', () => {
    const desc = 'Maximum Duration 4 hours';
    expect(AfflictionParser.extractMaxDuration(desc)).toEqual({ value: 4, unit: 'hour', isDice: false });
  });

  // ── extractConditions ─────────────────────────────────────────────────────

  test('extracts conditions from UUID enricher', () => {
    const text = '@UUID[Compendium.pf2e.conditionitems.Item.abc]{Enfeebled 2}';
    const conditions = AfflictionParser.extractConditions(text);
    expect(conditions).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'enfeebled', value: 2 })]),
    );
  });

  test('extracts conditions from plain text', () => {
    const text = 'sickened 1 and slowed 1';
    const conditions = AfflictionParser.extractConditions(text);
    expect(conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'sickened', value: 1 }),
        expect.objectContaining({ name: 'slowed', value: 1 }),
      ]),
    );
  });

  // ── extractDamage ─────────────────────────────────────────────────────────

  test('extracts damage from @Damage enricher', () => {
    const text = '@Damage[1d6[poison]]';
    const damage = AfflictionParser.extractDamage(text);
    expect(damage).toEqual(
      expect.arrayContaining([expect.objectContaining({ formula: '1d6', type: 'poison' })]),
    );
  });

  test('extracts damage from plain text', () => {
    const text = '2d6 fire damage';
    const damage = AfflictionParser.extractDamage(text);
    expect(damage).toEqual(
      expect.arrayContaining([expect.objectContaining({ formula: '2d6', type: 'fire' })]),
    );
  });

  // ── parseDuration ─────────────────────────────────────────────────────────

  test('parses fixed duration', () => {
    expect(AfflictionParser.parseDuration('6 rounds')).toEqual({ value: 6, unit: 'round', isDice: false });
  });

  test('parses dice duration', () => {
    expect(AfflictionParser.parseDuration('2d6 hours')).toEqual({ formula: '2d6', value: null, unit: 'hour', isDice: true });
  });

  test('parses structured duration object', () => {
    expect(AfflictionParser.parseDuration({ value: 3, unit: 'days' })).toEqual({ value: 3, unit: 'day', isDice: false });
  });

  // ── parseFromItem (integration) ───────────────────────────────────────────

  test('parses a full poison item', () => {
    const item = {
      name: 'Spear Frog Poison',
      uuid: 'test-uuid',
      system: {
        traits: { value: ['poison'] },
        level: { value: 2 },
        description: {
          value:
            '<p><strong>Saving Throw</strong> @Check[fortitude|dc:15]</p>' +
            '<p><strong>Maximum Duration</strong> 6 rounds</p>' +
            '<p><strong>Stage 1</strong> @Damage[1d4[poison]] damage (1 round)</p>' +
            '<p><strong>Stage 2</strong> @Damage[1d6[poison]] damage and @UUID[Compendium.pf2e.conditionitems.Item.MIRkyAjyBeXivMa7]{Enfeebled 1} (1 round)</p>',
        },
      },
    };

    const result = AfflictionParser.parseFromItem(item);
    expect(result.skip).toBeUndefined();
    expect(result.name).toBe('Spear Frog Poison');
    expect(result.type).toBe('poison');
    expect(result.dc).toBe(15);
    expect(result.maxDuration).toEqual({ value: 6, unit: 'round', isDice: false });
    expect(result.stages).toHaveLength(2);
  });

  test('returns skip when no stages found', () => {
    const item = {
      name: 'Empty Poison',
      uuid: 'test-uuid',
      system: {
        traits: { value: ['poison'] },
        description: { value: '<p>This poison has no structured stages.</p>' },
      },
    };
    expect(AfflictionParser.parseFromItem(item)).toEqual({ skip: true });
  });

  test('returns null for non-affliction items', () => {
    const item = {
      name: 'Sword',
      uuid: 'test-uuid',
      system: { traits: { value: ['weapon'] }, description: { value: '' } },
    };
    expect(AfflictionParser.parseFromItem(item)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RUSSIAN
// ═══════════════════════════════════════════════════════════════════════════════

describe('AfflictionParser — Russian', () => {
  beforeEach(() => setLang('ru'));

  // ── extractStages ──────────────────────────────────────────────────────────

  test('parses stages with colon inside <strong> tag', () => {
    const html =
      '<p><strong>Стадия 1:</strong> @Damage[1d4[poison]] (1 раунд)</p>' +
      '<p><strong>Стадия 2:</strong> @Damage[1d6[poison]] и @UUID[Compendium.pf2e.conditionitems.Item.MIRkyAjyBeXivMa7]{Ослаблен 1} (1 раунд)</p>';

    const stages = AfflictionParser.extractStages(html);
    expect(stages).toHaveLength(2);
    expect(stages[0].number).toBe(1);
    expect(stages[0].duration).toEqual({ value: 1, unit: 'round', isDice: false });
    expect(stages[1].number).toBe(2);
  });

  test('parses stages with colon outside <strong> tag', () => {
    const html =
      '<p><strong>Стадия 1</strong>: @Damage[1d4[poison]] (1 раунд)</p>' +
      '<p><strong>Стадия 2</strong>: @Damage[1d6[poison]] (1 раунд)</p>';

    const stages = AfflictionParser.extractStages(html);
    expect(stages).toHaveLength(2);
    expect(stages[0].number).toBe(1);
    expect(stages[1].number).toBe(2);
  });

  test('parses stages without colon (fallback)', () => {
    const html =
      '<p><strong>Стадия 1</strong> @Damage[1d4[poison]] (1 раунд)</p>' +
      '<p><strong>Стадия 2</strong> @Damage[1d6[poison]] (1 раунд)</p>';

    const stages = AfflictionParser.extractStages(html);
    expect(stages).toHaveLength(2);
  });

  test('extracts Russian conditions from UUID enricher', () => {
    const html =
      '<p><strong>Стадия 1:</strong> @UUID[Compendium.pf2e.conditionitems.Item.MIRkyAjyBeXivMa7]{Ослаблен 1} (1 раунд)</p>';

    const stages = AfflictionParser.extractStages(html);
    expect(stages).toHaveLength(1);
    expect(stages[0].conditions).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'enfeebled', value: 1 })]),
    );
  });

  // ── extractDC ─────────────────────────────────────────────────────────────

  test('extracts DC from @Check enricher (Russian item)', () => {
    const desc = '<p><strong>Спасбросок:</strong> @Check[fortitude|dc:15]</p>';
    const item = { system: {} };
    expect(AfflictionParser.extractDC(desc, item)).toBe(15);
  });

  test('extracts DC from Russian plain text "КС 18"', () => {
    const desc = 'КС 18 Стойкость';
    const item = { system: {} };
    expect(AfflictionParser.extractDC(desc, item)).toBe(18);
  });

  // ── extractOnset ──────────────────────────────────────────────────────────

  test('extracts onset with colon', () => {
    const desc = '<p><strong>Возникновение:</strong> 1 раунд</p>';
    expect(AfflictionParser.extractOnset(desc)).toEqual({ value: 1, unit: 'round', isDice: false });
  });

  test('extracts onset without colon', () => {
    const desc = '<p><strong>Возникновение</strong> 10 минут</p>';
    expect(AfflictionParser.extractOnset(desc)).toEqual({ value: 10, unit: 'minute', isDice: false });
  });

  // ── extractMaxDuration ────────────────────────────────────────────────────

  test('extracts max duration with colon', () => {
    const desc = '<p><strong>Макс.продолжительность:</strong> 6 раундов</p>';
    expect(AfflictionParser.extractMaxDuration(desc)).toEqual({ value: 6, unit: 'round', isDice: false });
  });

  test('extracts max duration without colon', () => {
    const desc = '<p><strong>Макс.продолжительность</strong> 6 раундов</p>';
    expect(AfflictionParser.extractMaxDuration(desc)).toEqual({ value: 6, unit: 'round', isDice: false });
  });

  // ── parseDuration (Russian units) ─────────────────────────────────────────

  test.each([
    ['1 раунд', { value: 1, unit: 'round', isDice: false }],
    ['6 раундов', { value: 6, unit: 'round', isDice: false }],
    ['2 раунда', { value: 2, unit: 'round', isDice: false }],
    ['10 минут', { value: 10, unit: 'minute', isDice: false }],
    ['1 час', { value: 1, unit: 'hour', isDice: false }],
    ['3 дня', { value: 3, unit: 'day', isDice: false }],
  ])('parseDuration("%s")', (input, expected) => {
    expect(AfflictionParser.parseDuration(input)).toEqual(expected);
  });

  // ── parseFromItem (integration — Spear Frog Poison RU) ────────────────────

  test('parses full Russian poison item (colon variant)', () => {
    const item = {
      name: 'Яд копьеносной лягушки',
      uuid: 'test-uuid-ru',
      system: {
        traits: { value: ['poison'] },
        level: { value: 2 },
        description: {
          value:
            '<p><strong>Спасбросок:</strong> @Check[fortitude|dc:15]</p>' +
            '<p><strong>Макс.продолжительность:</strong> 6 раундов</p>' +
            '<p><strong>Стадия 1:</strong> @Damage[1d4[poison]] (1 раунд)</p>' +
            '<p><strong>Стадия 2:</strong> @Damage[1d6[poison]] и @UUID[Compendium.pf2e.conditionitems.Item.MIRkyAjyBeXivMa7]{Ослаблен 1} (1 раунд)</p>',
        },
      },
    };

    const result = AfflictionParser.parseFromItem(item);
    expect(result.skip).toBeUndefined();
    expect(result.name).toBe('Яд копьеносной лягушки');
    expect(result.type).toBe('poison');
    expect(result.dc).toBe(15);
    expect(result.maxDuration).toEqual({ value: 6, unit: 'round', isDice: false });
    expect(result.stages).toHaveLength(2);
    expect(result.stages[0].damage).toEqual(
      expect.arrayContaining([expect.objectContaining({ formula: '1d4', type: 'poison' })]),
    );
    expect(result.stages[1].conditions).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'enfeebled', value: 1 })]),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHINESE
// ═══════════════════════════════════════════════════════════════════════════════

describe('AfflictionParser — Chinese', () => {
  beforeEach(() => setLang('zh'));

  test('parses stages with optional whitespace', () => {
    const html =
      '<p><strong>阶段1</strong> @Damage[1d4[poison]]（1轮）</p>' +
      '<p><strong>阶段2</strong> @Damage[1d6[poison]]（1轮）</p>';

    const stages = AfflictionParser.extractStages(html);
    expect(stages).toHaveLength(2);
    expect(stages[0].number).toBe(1);
    expect(stages[0].duration).toEqual({ value: 1, unit: 'round', isDice: false });
  });

  test('parses stages with space before number', () => {
    const html =
      '<p><strong>阶段 1</strong> @Damage[1d4[poison]]（1轮）</p>';

    const stages = AfflictionParser.extractStages(html);
    expect(stages).toHaveLength(1);
    expect(stages[0].number).toBe(1);
  });

  test('extracts max duration', () => {
    const desc = '<p><strong>最大持续时间</strong> 6轮</p>';
    expect(AfflictionParser.extractMaxDuration(desc)).toEqual({ value: 6, unit: 'round', isDice: false });
  });

  test('parses Chinese duration units', () => {
    expect(AfflictionParser.parseDuration('6轮')).toEqual({ value: 6, unit: 'round', isDice: false });
    expect(AfflictionParser.parseDuration('1小时')).toEqual({ value: 1, unit: 'hour', isDice: false });
  });

  test('parses full Chinese poison item', () => {
    const item = {
      name: '矛蛙毒素',
      uuid: 'test-uuid-zh',
      system: {
        traits: { value: ['poison'] },
        level: { value: 2 },
        description: {
          value:
            '<p><strong>豁免</strong> @Check[fortitude|dc:15]</p>' +
            '<p><strong>最大持续时间</strong> 6轮</p>' +
            '<p><strong>阶段1</strong> @Damage[1d4[poison]]（1轮）</p>' +
            '<p><strong>阶段2</strong> @Damage[1d6[poison]] @UUID[Compendium.pf2e.conditionitems.Item.MIRkyAjyBeXivMa7]{力竭 1}（1轮）</p>',
        },
      },
    };

    const result = AfflictionParser.parseFromItem(item);
    expect(result.skip).toBeUndefined();
    expect(result.type).toBe('poison');
    expect(result.dc).toBe(15);
    expect(result.stages).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DEATH DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('AfflictionParser — death detection', () => {
  test.each([
    ['en', 'The target dies'],
    ['en', 'The creature is dead'],
    ['en', 'instant death'],
    ['ru', 'цель мёртв'],
    ['ru', 'цель мертв'],
    ['ru', 'жертва умирает'],
    ['zh', '死亡'],
    ['zh', '即死'],
  ])('[%s] detectDeath("%s")', (lang, text) => {
    setLang(lang);
    expect(AfflictionParser.detectDeath(text)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE REFERENCES
// ═══════════════════════════════════════════════════════════════════════════════

describe('AfflictionParser — stage references', () => {
  test('resolves "as stage N" in English', () => {
    setLang('en');
    const html =
      '<p><strong>Stage 1</strong> 1d6 poison damage (1 round)</p>' +
      '<p><strong>Stage 2</strong> as stage 1 (1 round)</p>';

    const stages = AfflictionParser.extractStages(html);
    expect(stages).toHaveLength(2);
    expect(stages[1].damage).toEqual(stages[0].damage);
  });

  test('resolves "как стадия N" in Russian', () => {
    setLang('ru');
    const html =
      '<p><strong>Стадия 1:</strong> 1d6 poison damage (1 раунд)</p>' +
      '<p><strong>Стадия 2:</strong> как стадия 1 (1 раунд)</p>';

    const stages = AfflictionParser.extractStages(html);
    expect(stages).toHaveLength(2);
    expect(stages[1].damage).toEqual(stages[0].damage);
  });
});
