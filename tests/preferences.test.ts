import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPreferences,latestSlot,nextSlot,preferenceSchema} from '../lib/preferences.ts';
test('9 AM IST is 03:30 UTC and the next window follows today',()=>{assert.equal(latestSlot(defaultPreferences,new Date('2026-09-11T03:30:00Z')),'2026-09-11T03:30:00.000Z');assert.equal(nextSlot(defaultPreferences,new Date('2026-09-11T03:30:00Z')),'2026-09-12T03:30:00.000Z');});
test('paused schedules have no windows',()=>assert.equal(nextSlot({...defaultPreferences,enabled:false}),null));
test('weekday schedules skip Saturday and Sunday',()=>assert.equal(nextSlot({...defaultPreferences,cadence:'weekdays'},new Date('2026-09-11T04:00:00Z')),'2026-09-14T03:30:00.000Z'));
test('weekly schedules use chosen weekday',()=>assert.equal(nextSlot({...defaultPreferences,cadence:'weekly',weekday:0},new Date('2026-09-11T04:00:00Z')),'2026-09-13T03:30:00.000Z'));
test('invalid names and unsupported precision are rejected',()=>{assert.equal(preferenceSchema.safeParse({...defaultPreferences,time:'09:30'}).success,false);assert.equal(preferenceSchema.safeParse({...defaultPreferences,agents:{...defaultPreferences.agents,KAN:' '}}).success,false);});
