import type { Task, TaskRecurrence, UUID } from '../types/user';
import { generateUUID } from './generateUUID';

const MS_IN_DAY = 24 * 60 * 60 * 1000;

function toStartOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function clampDayOfMonth(year: number, monthIndex: number, dayOfMonth: number): number {
    // monthIndex is 0-based for JS Date
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return Math.min(Math.max(1, dayOfMonth), lastDay);
}

function toYmd(date: Date): string {
    // Use local date components (not UTC) so recurrence aligns with user's locale day boundaries.
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseYmd(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map((v) => Number(v));
    return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * MS_IN_DAY);
}

function addMonthsPreserveDay(date: Date, months: number, dayOfMonth: number): Date {
    const y = date.getFullYear();
    const m = date.getMonth();
    const targetMonth = m + months;
    const year = y + Math.floor(targetMonth / 12);
    const monthIndex = ((targetMonth % 12) + 12) % 12;
    const clampedDay = clampDayOfMonth(year, monthIndex, dayOfMonth);
    return new Date(year, monthIndex, clampedDay);
}

function isAfterUntil(date: Date, until?: Date): boolean {
    if (!until) return false;
    return toStartOfDay(date).getTime() > toStartOfDay(until).getTime();
}

function isSameOrBefore(date: Date, other: Date): boolean {
    return toStartOfDay(date).getTime() <= toStartOfDay(other).getTime();
}

function getDefaultDaysOfWeek(anchorDate: Date): number[] {
    return [anchorDate.getDay()];
}

function getDefaultDayOfMonth(anchorDate: Date): number {
    return anchorDate.getDate();
}

function getNextOccurrenceDate(anchor: Date, recurrence: TaskRecurrence, afterDate: Date): Date | null {
    const interval = Math.max(1, recurrence.interval || 1);
    const start = toStartOfDay(anchor);
    const after = toStartOfDay(afterDate);

    if (recurrence.frequency === 'daily') {
        // Next occurrence is start + k*interval days, strictly after "after"
        const diffDays = Math.floor((after.getTime() - start.getTime()) / MS_IN_DAY);
        const steps = Math.floor(diffDays / interval) + 1;
        const next = addDays(start, steps * interval);
        if (isAfterUntil(next, recurrence.until)) return null;
        return next;
    }

    if (recurrence.frequency === 'weekly') {
        const daysOfWeek = recurrence.daysOfWeek?.length
            ? recurrence.daysOfWeek
            : getDefaultDaysOfWeek(start);

        // We'll scan forward day-by-day up to a bounded horizon to find the next matching day
        // that also matches the week interval.
        // Bound: 366 days is plenty for typical usage and prevents infinite loops.
        for (let i = 1; i <= 366; i++) {
            const candidate = addDays(after, i);
            if (isAfterUntil(candidate, recurrence.until)) return null;

            const candidateDow = candidate.getDay();
            if (!daysOfWeek.includes(candidateDow)) continue;

            const weeksSinceStart = Math.floor(
                (toStartOfDay(candidate).getTime() - start.getTime()) / (7 * MS_IN_DAY),
            );
            if (weeksSinceStart < 0) continue;
            if (weeksSinceStart % interval === 0) return candidate;
        }
        return null;
    }

    // monthly
    const dayOfMonth = recurrence.dayOfMonth ?? getDefaultDayOfMonth(start);

    // Find the next month boundary based on "after"
    const afterStart = toStartOfDay(after);

    // If "after" is before start, base off start to avoid generating earlier dates.
    const base = afterStart.getTime() < start.getTime() ? start : afterStart;

    // Move forward month-by-month until we find a date strictly after "after".
    for (let k = 0; k <= 24; k++) {
        const monthsToAdd = k === 0 ? 0 : 1;
        const candidateMonthBase = addMonthsPreserveDay(base, monthsToAdd, 1);
        const candidate = new Date(
            candidateMonthBase.getFullYear(),
            candidateMonthBase.getMonth(),
            clampDayOfMonth(candidateMonthBase.getFullYear(), candidateMonthBase.getMonth(), dayOfMonth),
        );

        // Ensure strictly after "after"
        if (!isSameOrBefore(candidate, after)) {
            // Check interval relative to start month
            const monthDiff =
                (candidate.getFullYear() - start.getFullYear()) * 12 +
                (candidate.getMonth() - start.getMonth());
            if (monthDiff >= 0 && monthDiff % interval === 0) {
                if (isAfterUntil(candidate, recurrence.until)) return null;
                return candidate;
            }
        }

        base.setMonth(base.getMonth() + 1);
    }

    return null;
}

/**
 * PUBLIC_INTERFACE
 * Returns a user-facing label for a recurrence rule.
 */
export function formatRecurrenceLabel(recurrence?: TaskRecurrence): string | null {
    if (!recurrence) return null;

    const interval = Math.max(1, recurrence.interval || 1);
    if (recurrence.frequency === 'daily') {
        return interval === 1 ? 'Repeats daily' : `Repeats every ${interval} days`;
    }
    if (recurrence.frequency === 'weekly') {
        const intervalLabel = interval === 1 ? 'weekly' : `every ${interval} weeks`;
        const days = recurrence.daysOfWeek?.length ? recurrence.daysOfWeek : undefined;
        if (!days || days.length === 0) return `Repeats ${intervalLabel}`;

        const weekdayFormatter = new Intl.DateTimeFormat(navigator.language || 'en-US', {
            weekday: 'short',
        });
        // Create stable labels using a fixed reference week.
        const refSunday = new Date(2024, 0, 7); // Sunday
        const labels = days
            .slice()
            .sort((a, b) => a - b)
            .map((dow) => weekdayFormatter.format(addDays(refSunday, dow)));

        return `Repeats ${intervalLabel} on ${labels.join(', ')}`;
    }

    // monthly
    const dom = recurrence.dayOfMonth;
    if (!dom) {
        return interval === 1 ? 'Repeats monthly' : `Repeats every ${interval} months`;
    }
    return interval === 1 ? `Repeats monthly on day ${dom}` : `Repeats every ${interval} months on day ${dom}`;
}

function cloneTaskForOccurrence(template: Task, occurrenceDate: Date): Task {
    const copy: Task = {
        ...template,
        id: generateUUID(),
        done: false,
        pinned: false,
        date: new Date(occurrenceDate),
        lastSave: undefined,
        // Keep recurrence on the template only; occurrences are plain tasks.
        recurrence: undefined,
        recurrenceState: undefined,
        sharedBy: template.sharedBy, // keep attribution if it came from share
        position: undefined,
    };

    // If original has a deadline, align deadline's time-of-day to occurrence day.
    if (template.deadline) {
        const original = new Date(template.deadline);
        const aligned = new Date(
            occurrenceDate.getFullYear(),
            occurrenceDate.getMonth(),
            occurrenceDate.getDate(),
            original.getHours(),
            original.getMinutes(),
            0,
            0,
        );
        copy.deadline = aligned;
    }

    return copy;
}

/**
 * PUBLIC_INTERFACE
 * Materializes recurring tasks into concrete task instances up to "now".
 *
 * This function:
 * - keeps the original recurring task as a template (recurrence remains on that task)
 * - adds newly generated non-recurring occurrences to the list
 * - updates template.recurrenceState.lastGeneratedYmd to avoid duplicates
 */
export function materializeRecurringTasks(tasks: Task[], now: Date = new Date()): Task[] {
    const updated: Task[] = [];
    const toAdd: Task[] = [];

    for (const task of tasks) {
        if (!task.recurrence) {
            updated.push(task);
            continue;
        }

        const recurrence = task.recurrence;
        const anchor = task.deadline ? new Date(task.deadline) : new Date(task.date);

        // If recurrence ended, just keep template (still visible for editing).
        if (recurrence.until && toStartOfDay(now).getTime() > toStartOfDay(recurrence.until).getTime()) {
            updated.push(task);
            continue;
        }

        const lastGenerated = task.recurrenceState?.lastGeneratedYmd
            ? parseYmd(task.recurrenceState.lastGeneratedYmd)
            : toStartOfDay(anchor);

        let cursor = lastGenerated;
        // Generate forward while next occurrence <= now (day-based)
        // Hard bound to prevent runaway loops in corrupted data.
        for (let i = 0; i < 366; i++) {
            const next = getNextOccurrenceDate(anchor, recurrence, cursor);
            if (!next) break;
            if (toStartOfDay(next).getTime() > toStartOfDay(now).getTime()) break;

            toAdd.push(cloneTaskForOccurrence(task, next));
            cursor = next;
        }

        const newStateYmd = toYmd(cursor);
        updated.push({
            ...task,
            recurrenceState: {
                ...(task.recurrenceState || {}),
                lastGeneratedYmd: newStateYmd,
            },
        });
    }

    // Keep stable ordering: append generated tasks.
    return [...updated, ...toAdd];
}

/**
 * PUBLIC_INTERFACE
 * Validates and normalizes a recurrence object.
 */
export function normalizeRecurrence(recurrence: TaskRecurrence): TaskRecurrence {
    const interval = Math.max(1, recurrence.interval || 1);

    if (recurrence.frequency === 'weekly') {
        const days = recurrence.daysOfWeek?.length
            ? Array.from(new Set(recurrence.daysOfWeek))
                  .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
                  .sort((a, b) => a - b)
            : undefined;

        return {
            ...recurrence,
            interval,
            daysOfWeek: days,
        };
    }

    if (recurrence.frequency === 'monthly') {
        const dom = recurrence.dayOfMonth;
        const normalizedDom =
            dom == null ? undefined : Math.min(31, Math.max(1, Math.floor(dom)));
        return {
            ...recurrence,
            interval,
            dayOfMonth: normalizedDom,
        };
    }

    return {
        ...recurrence,
        interval,
    };
}
