/* SchedSlate — application state + localStorage persistence */
(function (global) {
    'use strict';

    var Util = global.SSUtil;
    var STORAGE_KEY = 'schedslate.state.v1';
    var VERSION = 1;

    var DEFAULT_SETTINGS = {
        clock: '24h',
        showWeekend: true,
        weekStart: 1,
        increment: 30,
        compact: false,
        minHours: 14,
        language: 'en'
    };

    function defaultState() {
        return {
            version: VERSION,
            title: 'My Schedule',
            tasks: [],
            settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
        };
    }

    var state = defaultState();
    var listeners = [];
    var saveTimer = null;

    /* ---------------------------------------------------------- sanitising */

    function isPlainObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    }

    function normalizeStart(value) {
        return Util.clamp(Util.snap(Util.normaliseMinutes(value), 30), 0, Util.MIN_PER_DAY - 30);
    }

    function normalizeDuration(value, start) {
        var duration = Math.round(Number(value) || 60);
        duration = Math.round(Util.clamp(duration, 30, Util.MIN_PER_DAY) / 30) * 30;
        if (start + duration > Util.MIN_PER_DAY) {
            duration = Math.max(30, Util.MIN_PER_DAY - start);
        }
        return duration;
    }

    /**
     * A task keeps one time slot per weekday: { "1": { start, duration }, ... }.
     * Events stored before per-day times existed ({ days, start, duration }) are
     * migrated by stamping the shared slot onto every selected day.
     */
    function sanitizeTimes(raw) {
        var times = {};
        var source = raw.times;

        if (isPlainObject(source)) {
            Object.keys(source).forEach(function (key) {
                var day = Math.round(Number(key));
                var entry = source[key];
                if (!(day >= 0 && day <= 6) || !isPlainObject(entry)) {
                    return;
                }
                var start = normalizeStart(entry.start);
                times[day] = { start: start, duration: normalizeDuration(entry.duration, start) };
            });
        }

        if (!Object.keys(times).length && Array.isArray(raw.days)) {
            var start = normalizeStart(raw.start);
            var duration = normalizeDuration(raw.duration, start);
            raw.days.forEach(function (day) {
                var index = Math.round(Number(day));
                if (index >= 0 && index <= 6) {
                    times[index] = { start: start, duration: duration };
                }
            });
        }

        return times;
    }

    function sanitizeTask(raw) {
        if (!isPlainObject(raw)) {
            return null;
        }
        var title = String(raw.title == null ? '' : raw.title).trim().slice(0, 120);
        if (!title) {
            return null;
        }
        var times = sanitizeTimes(raw);
        if (!Object.keys(times).length) {
            return null;
        }

        return {
            id: typeof raw.id === 'string' && raw.id ? raw.id : Util.uid('ev'),
            title: title,
            note: String(raw.note == null ? '' : raw.note).trim().slice(0, 400),
            times: times,
            theme: global.SSThemes.has(raw.theme) ? raw.theme : global.SSThemes.fromLegacyColor(raw.color),
            createdAt: Number(raw.createdAt) || Date.now()
        };
    }

    function sanitizeSettings(raw) {
        var settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        if (!isPlainObject(raw)) {
            return settings;
        }
        if (raw.clock === '12h' || raw.clock === '24h') {
            settings.clock = raw.clock;
        }
        if (typeof raw.showWeekend === 'boolean') {
            settings.showWeekend = raw.showWeekend;
        }
        if (raw.weekStart === 0 || raw.weekStart === 1) {
            settings.weekStart = raw.weekStart;
        }
        if ([15, 30, 60].indexOf(Number(raw.increment)) !== -1) {
            settings.increment = Number(raw.increment);
        }
        if (typeof raw.compact === 'boolean') {
            settings.compact = raw.compact;
        }
        if (raw.minHours !== undefined) {
            settings.minHours = Util.clamp(Math.round(Number(raw.minHours) || 14), 4, 24);
        }
        if (raw.language === 'en' || raw.language === 'de') {
            settings.language = raw.language;
        }
        return settings;
    }

    /* ------------------------------------------------------------ persistence */

    function readStorage() {
        try {
            var raw = global.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return null;
            }
            var parsed = JSON.parse(raw);
            if (!isPlainObject(parsed)) {
                return null;
            }
            return parsed;
        } catch (error) {
            return null;
        }
    }

    function hydrate(raw) {
        var next = defaultState();
        if (!isPlainObject(raw)) {
            return next;
        }
        if (typeof raw.title === 'string' && raw.title.trim()) {
            next.title = raw.title.trim().slice(0, 80);
        }
        if (Array.isArray(raw.tasks)) {
            next.tasks = raw.tasks.map(sanitizeTask).filter(Boolean).slice(0, 800);
        }
        next.settings = sanitizeSettings(raw.settings);
        return next;
    }

    function persist() {
        try {
            global.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                version: VERSION,
                title: state.title,
                tasks: state.tasks,
                settings: state.settings
            }));
        } catch (error) {
            /* storage might be blocked or full — the app keeps working in memory */
        }
    }

    function scheduleSave() {
        if (saveTimer) {
            global.clearTimeout(saveTimer);
        }
        saveTimer = global.setTimeout(function () {
            saveTimer = null;
            persist();
        }, 120);
    }

    function flush() {
        if (saveTimer) {
            global.clearTimeout(saveTimer);
            saveTimer = null;
        }
        persist();
    }

    /* --------------------------------------------------------------- events */

    function emit(reason) {
        scheduleSave();
        listeners.forEach(function (fn) {
            try {
                fn(state, reason || 'update');
            } catch (error) {
                /* a broken listener must never take the store down */
                if (global.console) {
                    global.console.error(error);
                }
            }
        });
        Util.bus.emit('state', { reason: reason || 'update' });
    }

    /* ------------------------------------------------------------------ api */

    function load() {
        state = hydrate(readStorage());
        if (state.settings.language) {
            global.SSI18n.setLang(state.settings.language);
        }
        return state;
    }

    function getTask(id) {
        for (var i = 0; i < state.tasks.length; i++) {
            if (state.tasks[i].id === id) {
                return state.tasks[i];
            }
        }
        return null;
    }

    /** Resolved theme for a task (always valid, falls back to the default). */
    function themeOf(task) {
        return global.SSThemes.get(task && task.theme);
    }

    /** Weekdays a task repeats on, ascending. */
    function daysOf(task) {
        if (!task || !task.times) {
            return [];
        }
        return Object.keys(task.times)
            .map(Number)
            .sort(function (a, b) {
                return a - b;
            });
    }

    /** The concrete slot a recurring task occupies on one weekday, or null. */
    function occurrence(task, day) {
        var entry = task && task.times ? task.times[day] : null;
        if (!entry) {
            return null;
        }
        return {
            day: day,
            start: entry.start,
            duration: entry.duration,
            end: entry.start + entry.duration
        };
    }

    function tasksForDay(day) {
        return state.tasks
            .filter(function (task) {
                return !!task.times[day];
            })
            .sort(function (a, b) {
                return a.times[day].start - b.times[day].start ||
                    b.times[day].duration - a.times[day].duration;
            });
    }

    function addTask(raw) {
        var task = sanitizeTask(raw);
        if (!task) {
            return null;
        }
        state.tasks.push(task);
        emit('add');
        return task;
    }

    function updateTask(id, patch) {
        var existing = getTask(id);
        if (!existing) {
            return null;
        }
        var merged = sanitizeTask(Object.assign({}, existing, patch, { id: existing.id }));
        if (!merged) {
            return null;
        }
        var index = state.tasks.indexOf(existing);
        state.tasks[index] = merged;
        emit('update');
        return merged;
    }

    function removeTask(id) {
        var existing = getTask(id);
        if (!existing) {
            return null;
        }
        state.tasks = state.tasks.filter(function (task) {
            return task.id !== id;
        });
        emit('remove');
        return existing;
    }

    function restoreTask(task) {
        var restored = sanitizeTask(task);
        if (!restored) {
            return null;
        }
        if (!getTask(restored.id)) {
            state.tasks.push(restored);
        }
        emit('restore');
        return restored;
    }

    function setTitle(title) {
        var next = String(title == null ? '' : title).replace(/\s+/g, ' ').trim().slice(0, 80);
        if (!next || next === state.title) {
            return state.title;
        }
        state.title = next;
        emit('title');
        return state.title;
    }

    function setSettings(patch) {
        state.settings = sanitizeSettings(Object.assign({}, state.settings, patch));
        if (patch && patch.language) {
            global.SSI18n.setLang(state.settings.language);
        }
        emit('settings');
        return state.settings;
    }

    function countBlocks() {
        return state.tasks.reduce(function (total, task) {
            return total + daysOf(task).length;
        }, 0);
    }

    function totalPlannedMinutes() {
        var total = 0;
        state.tasks.forEach(function (task) {
            daysOf(task).forEach(function (day) {
                total += task.times[day].duration;
            });
        });
        return total;
    }

    function reset() {
        var language = state.settings.language;
        state = defaultState();
        state.settings.language = language;
        global.SSI18n.setLang(language);
        emit('reset');
    }

    function seedSample() {
        var t = global.SSI18n.t;
        var samples = [
            /* one recurring event with different hours per day */
            { title: t('sampleDeepWork'), theme: 'mobile-legends', note: '', times: { 1: { start: 450, duration: 180 }, 6: { start: 450, duration: 120 } } },
            { title: t('sampleStandup'), theme: 'gengar', note: '', times: { 1: { start: 600, duration: 30 }, 3: { start: 600, duration: 30 }, 5: { start: 600, duration: 30 } } },
            { title: t('sampleWorkout'), theme: 'kamen-rider-ooo', note: '', times: { 2: { start: 420, duration: 60 }, 4: { start: 420, duration: 60 } } },
            { title: t('sampleProject'), theme: 'wednesday', note: '', times: { 2: { start: 840, duration: 120 } } },
            { title: t('sampleLunch'), theme: 'mobile-legends', note: '', times: { 1: { start: 750, duration: 60 }, 2: { start: 750, duration: 60 }, 3: { start: 750, duration: 60 }, 4: { start: 750, duration: 60 }, 5: { start: 750, duration: 60 } } },
            { title: t('sampleStudy'), theme: 'gengar', note: '', times: { 3: { start: 960, duration: 90 } } },
            { title: t('sampleDinner'), theme: 'kamen-rider-ooo', note: '', times: { 5: { start: 1080, duration: 60 } } },
            { title: t('sampleReading'), theme: 'wednesday', note: '', times: { 6: { start: 600, duration: 120 } } },
            { title: t('samplePlan'), theme: 'mobile-legends', note: '', times: { 0: { start: 1200, duration: 30 } } }
        ];
        state.tasks = samples.map(sanitizeTask).filter(Boolean);
        emit('seed');
    }

    /**
     * Replaces the whole slate (used by JSON import). Title, settings and tasks
     * all pass through the same sanitisers as stored data, then the new state is
     * emitted and written to localStorage immediately.
     */
    function replaceSchedule(payload) {
        var raw = isPlainObject(payload) ? payload : {};
        var next = defaultState();

        if (typeof raw.title === 'string' && raw.title.trim()) {
            next.title = raw.title.trim().slice(0, 80);
        }
        /* keep the user's current grid preferences unless the file sets them */
        next.settings = sanitizeSettings(Object.assign({}, state.settings, raw.settings));
        if (Array.isArray(raw.tasks)) {
            next.tasks = raw.tasks.map(sanitizeTask).filter(Boolean).slice(0, 800);
        }

        state = next;
        global.SSI18n.setLang(state.settings.language);
        emit('import');
        flush();
        return state;
    }

    function subscribe(handler) {
        listeners.push(handler);
        return function unsubscribe() {
            listeners = listeners.filter(function (fn) {
                return fn !== handler;
            });
        };
    }

    /* keep multiple tabs in sync */
    global.addEventListener('storage', function (event) {
        if (event.key !== STORAGE_KEY || !event.newValue) {
            return;
        }
        try {
            state = hydrate(JSON.parse(event.newValue));
            global.SSI18n.setLang(state.settings.language);
            listeners.forEach(function (fn) {
                fn(state, 'external');
            });
            Util.bus.emit('state', { reason: 'external' });
        } catch (error) {
            /* ignore malformed payloads from other tabs */
        }
    });

    global.addEventListener('pagehide', flush);
    global.addEventListener('beforeunload', flush);
    if (document) {
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') {
                flush();
            }
        });
    }

    global.SSStore = {
        STORAGE_KEY: STORAGE_KEY,
        DEFAULT_SETTINGS: DEFAULT_SETTINGS,
        get state() {
            return state;
        },
        load: load,
        flush: flush,
        subscribe: subscribe,
        getTask: getTask,
        themeOf: themeOf,
        daysOf: daysOf,
        occurrence: occurrence,
        tasksForDay: tasksForDay,
        addTask: addTask,
        updateTask: updateTask,
        removeTask: removeTask,
        restoreTask: restoreTask,
        setTitle: setTitle,
        setSettings: setSettings,
        countBlocks: countBlocks,
        totalPlannedMinutes: totalPlannedMinutes,
        reset: reset,
        seedSample: seedSample,
        replaceSchedule: replaceSchedule
    };
})(window);
