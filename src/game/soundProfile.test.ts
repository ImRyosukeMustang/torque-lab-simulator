import { describe, it, expect } from "vitest";
import { SLOT_ORDER, partsForSlot, STOCK_BUILD } from './sim/parts';
import type { Build, SlotId } from './sim/types';
import { soundProfile, describeSound } from './soundProfile';
const stock = soundProfile(STOCK_BUILD);
const swap = (slot: SlotId, id: string) => soundProfile({ ...STOCK_BUILD, [slot]: id });
describe('physical sound profiles', () => {
  for (const slot of SLOT_ORDER) {
    for (const part of partsForSlot(slot)) {
      if (part.id === STOCK_BUILD[slot]) continue;
      it(`${slot}: ${part.name} changes the stock sound`, () => {
        expect(swap(slot, part.id)).not.toEqual(stock);
      });
    }
  }
  it('lowers whistle pitch as turbo flow grows', () => {
    const turbos = partsForSlot('turbo').filter(p => p.slot === 'turbo' && p.maximumFlow > 0)
      .sort((a, b) => a.slot === 'turbo' && b.slot === 'turbo' ? a.maximumFlow - b.maximumFlow : 0);
    for (let i = 1; i < turbos.length; i++) expect(swap('turbo', turbos[i]!.id).whistleHz).toBeLessThan(swap('turbo', turbos[i - 1]!.id).whistleHz);
    for (const turbo of turbos) expect(swap('turbo', turbo.id).whistleLevel).toBeGreaterThan(0);
    expect(swap('turbo', 'turbo-none').whistleLevel).toBe(0);
  });
  it.each([
    ["engine-i4-20", "inline-turbo", 850],
    ["engine-v6-32", "v6-full-throttle", 800],
    ["engine-v8-40", "v-engine-collection", 800],
  ] as const)("selects the supplied %s recording and idle speed", (engineId, sample, idleRpm) => {
    expect(swap("engine", engineId).engineSample).toBe(sample);
    expect(swap("engine", engineId).idleRpm).toBe(idleRpm);
  });
  it('gives race cams more lope', () => expect(swap('camshaft', 'cam-race').lopeDepth).toBeGreaterThan(stock.lopeDepth));
  it.each(['exh-3in', 'exh-header'])('gives %s more rasp', id => expect(swap('exhaust', id).rasp).toBeGreaterThan(stock.rasp));
  it('gives standalone a harder cut than stock and piggyback', () => {
    expect(swap('ecu', 'ecu-standalone').limiterHardness).toBeGreaterThan(swap('ecu', 'ecu-piggy').limiterHardness);
    expect(swap('ecu', 'ecu-piggy').limiterHardness).toBeGreaterThan(stock.limiterHardness);
  });
  it('adds sequential gear whine', () => expect(swap('gearbox', 'gbx-seq6').gearWhine).toBeGreaterThan(stock.gearWhine));
  it('softens ethanol pops and sharpens race-fuel pops', () => {
    expect(swap('fuel', 'fuel-e85').popSharpness).toBeLessThan(stock.popSharpness);
    expect(swap('fuel', 'fuel-race').popSharpness).toBeGreaterThan(stock.popSharpness);
  });
  it('is deterministic and does not mutate the build', () => {
    const build: Build = { ...STOCK_BUILD }; Object.freeze(build);
    expect(soundProfile(build)).toEqual(soundProfile(build)); expect(build).toEqual(STOCK_BUILD);
  });
  it('provides readable descriptors', () => {
    expect(describeSound(swap('camshaft', 'cam-race'))).toContain('Lumpy cam idle');
    expect(describeSound(swap('gearbox', 'gbx-seq6'))).toContain('Straight-cut gear whine');
  });
  it('keeps levels normalized and numeric fields finite across all swaps', () => {
    for (const slot of SLOT_ORDER) for (const part of partsForSlot(slot)) {
      for (const [key, value] of Object.entries(swap(slot, part.id))) if (typeof value === 'number') {
        expect(Number.isFinite(value), key).toBe(true); expect(value, key).toBeGreaterThanOrEqual(0);
        if (!/Hz$|Rpm$|DurationS$|TimeS$|Factor$/.test(key)) expect(value, key).toBeLessThanOrEqual(1);
      }
    }
  });
});
