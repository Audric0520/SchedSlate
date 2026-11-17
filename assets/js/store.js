/* SchedSlate — application state + localStorage persistence */
(function (global) {
    'use strict';

    var Util = global.SSUtil;
    var STORAGE_KEY = 'schedslate.state.v1';
    var VERSION = 1;

    var PALETTE = [
        '#7c8cff', /* indigo  */
        '#38bdf8', /* sky     */
        '#2dd4bf', /* teal    */
        '#a3e635', /* lime    */
        '#fbbf24', /* amber   */
        '#fb923c', /* orange  */
        '#fb7185', /* rose    */
        '#c084fc', /* violet  */
        '#94a3b8'  /* slate   */
    ];

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

    function sanitizeTask(raw) {
        if (!isPlainObject(raw)) {
            return null;
        }
        var title = String(raw.title == null ? '' : raw.title).trim().slice(0, 120);
        if (!title) {
            return null;
        }
        var days = Array.isArray(raw.days) ? raw.days : [];
        days = days
            .map(function (day) {
                return Math.round(Number(day));
            })
            .filter(function (day) {
                return day >= 0 && day <= 6;
            });
        days = days.filter(function (day, index) {
            return days.indexOf(day) === index;
        }).sort(function (a, b) {
            return a - b;
        });
        if (!days.length) {
            return null;
        }

        var start = Util.snap(Util.normaliseMinutes(raw.start), 30);
        var duration = Math.round(Number(raw.duration) || 60);
        duration = Math.round(Util.clamp(duration, 30, Util.MIN_PER_DAY) / 30) * 30;
        if (start + duration > Util.MIN_PER_DAY) {
            duration = Math.max(30, Util.MIN_PER_DAY - start);
        }

        return {
            id: typeof raw.id === 'string' && raw.id ? raw.id : Util.uid('ev'),
            title: title,
            note: String(raw.note == null ? '' : raw.note).trim().slice(0, 400),
            days: days,
            start: start,
            duration: duration,
            color: Util.isHex(raw.color) ? String(raw.color).toLowerCase() : PALETTE[0],
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

    function tasksForDay(day) {
        return state.tasks
            .filter(function (task) {
                return task.days.indexOf(day) !== -1;
            })
            .sort(function (a, b) {
                return a.start - b.start || b.duration - a.duration;
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
            return total + task.days.length;
        }, 0);
    }

    function totalPlannedMinutes() {
        var total = 0;
        state.tasks.forEach(function (task) {
            total += task.duration * task.days.length;
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
            { title: t('sampleDeepWork'), days: [1], start: 540, duration: 90, color: PALETTE[0], note: '' },
            { title: t('sampleStandup'), days: [1, 3, 5], start: 600, duration: 30, color: PALETTE[1], note: '' },
            { title: t('sampleWorkout'), days: [2, 4], start: 420, duration: 60, color: PALETTE[6], note: '' },
            { title: t('sampleProject'), days: [2], start: 840, duration: 120, color: PALETTE[7], note: '' },
            { title: t('sampleLunch'), days: [1, 2, 3, 4, 5], start: 750, duration: 60, color: PALETTE[4], note: '' },
            { title: t('sampleStudy'), days: [3], start: 960, duration: 90, color: PALETTE[2], note: '' },
            { title: t('sampleDinner'), days: [5], start: 1080, duration: 60, color: PALETTE[5], note: '' },
            { title: t('sampleReading'), days: [6], start: 600, duration: 120, color: PALETTE[3], note: '' },
            { title: t('samplePlan'), days: [0], start: 1200, duration: 30, color: PALETTE[0], note: '' }
        ];
        state.tasks = samples.map(sanitizeTask).filter(Boolean);
        emit('seed');
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
        PALETTE: PALETTE,
        DEFAULT_SETTINGS: DEFAULT_SETTINGS,
        get state() {
            return state;
        },
        load: load,
        flush: flush,
        subscribe: subscribe,
        getTask: getTask,
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
        seedSample: seedSample
    };
})(window);
