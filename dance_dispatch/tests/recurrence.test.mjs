import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeriesRrule, getRecurrenceSummary } from '../lib/recurrence-options.ts';

test('weekly rule with instance count', () => {
    assert.equal(
        buildSeriesRrule('2025-05-02', { frequency: 'weekly', dayOfWeek: 5, endType: 'instances', instances: 10 }),
        'FREQ=WEEKLY;BYDAY=FR;COUNT=10'
    );
});

test('biweekly rule uses INTERVAL=2', () => {
    assert.equal(
        buildSeriesRrule('2025-05-02', { frequency: 'biweekly', dayOfWeek: 1, endType: 'instances', instances: 4 }),
        'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;COUNT=4'
    );
});

test('monthly rule with duration is capped at 12 months', () => {
    assert.equal(
        buildSeriesRrule('2025-05-15', { frequency: 'monthly', dayOfMonth: 15, endType: 'duration', durationMonths: 99 }),
        'FREQ=MONTHLY;BYMONTHDAY=15;UNTIL=20260515T235959'
    );
});

test('instances are clamped to 2-52', () => {
    assert.match(buildSeriesRrule('2025-05-02', { frequency: 'weekly', dayOfWeek: 5, endType: 'instances', instances: 500 }), /COUNT=52/);
});

test('summary text', () => {
    assert.equal(
        getRecurrenceSummary({ frequency: 'weekly', dayOfWeek: 5, endType: 'duration', durationMonths: 3 }),
        'Every Friday for 3 months'
    );
});
