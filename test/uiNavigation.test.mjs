import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('TradeCraft AI — UI Navigation & Dropdown Suite Integrity (Sprint 26/27 UI Tests)', () => {
  const headerPath = path.resolve('src/components/Header.tsx');
  assert.ok(fs.existsSync(headerPath), 'Header.tsx component file must exist');
  const headerContent = fs.readFileSync(headerPath, 'utf8');

  test('UI-TEST-01: Zero invalid Tailwind classes (e.g. w-76) in Header.tsx', () => {
    assert.strictEqual(
      headerContent.includes('w-76'),
      false,
      'Header.tsx must not contain invalid Tailwind class "w-76"'
    );
  });

  test('UI-TEST-02: All 4 dropdown containers enforce viewport height clamping with overflow-y-auto', () => {
    const marketsMatch = headerContent.includes("activeMenu === 'markets'");
    const executionMatch = headerContent.includes("activeMenu === 'execution'");
    const quantMatch = headerContent.includes("activeMenu === 'quant'");
    const hubMatch = headerContent.includes("activeMenu === 'hub'");

    assert.ok(marketsMatch, 'Markets dropdown block exists');
    assert.ok(executionMatch, 'Execution dropdown block exists');
    assert.ok(quantMatch, 'Quant Lab dropdown block exists');
    assert.ok(hubMatch, 'Desks & Hub dropdown block exists');

    // Check overflow and max-h protection across dropdown containers
    const overflowMatches = (headerContent.match(/overflow-y-auto/g) || []).length;
    assert.ok(
      overflowMatches >= 4,
      `Expected at least 4 dropdowns with overflow-y-auto, found ${overflowMatches}`
    );
  });

  test('UI-TEST-03: Dropdown containers enforce maximum viewport width protection', () => {
    const maxWidthMatches = (headerContent.match(/max-w-\[calc\(100vw-1\.5rem\)\]/g) || []).length;
    assert.ok(
      maxWidthMatches >= 4,
      `Expected at least 4 dropdowns with max-w-[calc(100vw-1.5rem)], found ${maxWidthMatches}`
    );
  });

  test('UI-TEST-04: Quant Lab Suite implements 2-column grid to prevent vertical clutter', () => {
    assert.ok(
      headerContent.includes('grid grid-cols-1 sm:grid-cols-2'),
      'Quant Lab dropdown must render in a responsive 2-column grid layout on sm+ screens'
    );
  });

  test('UI-TEST-05: Quant Lab and Execution menus do not suffer from left-side off-screen overflow', () => {
    // Verify that right-0 sm:left-auto is eliminated from Quant Lab dropdown
    assert.strictEqual(
      headerContent.includes('right-0 sm:left-auto mt-2 w-76'),
      false,
      'Quant Lab must not use right-0 sm:left-auto with w-76 which clips off-screen'
    );
    // Verify Quant Lab starts from left-0
    assert.ok(
      headerContent.includes('absolute left-0 mt-2 w-84 sm:w-[620px]'),
      'Quant Lab dropdown must anchor left-0 with clean responsive width'
    );
  });

  test('UI-TEST-06: Tool icon containers enforce shrink-0 to prevent icon squishing', () => {
    const shrinkMatches = (headerContent.match(/group-hover:[a-z0-9\/-]+ shrink-0/g) || []).length;
    assert.ok(
      shrinkMatches >= 4,
      `Expected tool icon wrappers to include shrink-0 to prevent layout collapse, found ${shrinkMatches}`
    );
  });

  test('UI-TEST-07: All 4 major navigation categories are present in allTools model registry', () => {
    const categories = ["'Markets'", "'Execution'", "'Quant Lab'", "'Desks & Hub'"];
    for (const cat of categories) {
      assert.ok(
        headerContent.includes(`category: ${cat}`),
        `allTools registry must contain items for category ${cat}`
      );
    }
  });

  test('UI-TEST-08: Header exposes Quick Command Palette (Ctrl+K / ⌘K) shortcut', () => {
    assert.ok(
      headerContent.includes('setIsCommandPaletteOpen(true)'),
      'Header must expose command palette activation'
    );
    assert.ok(
      headerContent.includes('⌘K') || headerContent.includes('Ctrl+K'),
      'Header must display shortcut badge'
    );
  });
});
