/* SchedSlate — JSON backup: download the slate as a readable .json file and
 *  restore one from disk. The file format is versioned and documented in the
 *  README; imports are normalised through the same sanitisers as stored data. */
(function (global) {
    'use strict';

    var S = global.SSStore;
    var U = global.SSUtil;

    var VERSION = 1;
    var SLOT_MINUTES = 30;
    var MAX_EVENTS = 800;

    /* index matches the app's weekday numbering (0 = Sunday) */
    var DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    var DAY_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    function isObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function dayName(day) {
        return DAY_NAMES[day] || null;
    }

    function dayIndex(value) {
        var key = String(value == null ? '' : value).trim().toLowerCase();
        var index = DAY_NAMES.indexOf(key);
        if (index === -1) {
            index = DAY_SHORT.indexOf(key.slice(0, 3));
        }
        if (index === -1 && /^[0-6]$/.test(key)) {
            index = Number(key);
        }
        return index;
    }

    function themeId(value, colorHint) {
        if (global.SSThemes.has(value)) {
            return value;
        }
        return global.SSThemes.fromLegacyColor(colorHint);
    }

    /* ------------------------------------------------------------- export */

    /** Builds the versioned document that gets downloaded. */
    function build() {
        var state = S.state;
        var events = [];

        state.tasks.forEach(function (task) {
            S.daysOf(task).forEach(function (day) {
                var slot = task.times[day];
                events.push({
                    id: task.id,
                    title: task.title,
                    note: task.note || '',
                    day: dayName(day),
                    startSlot: Math.round(slot.start / SLOT_MINUTES),
                    durationSlots: Math.round(slot.duration / SLOT_MINUTES),
                    theme: S.themeOf(task).id,
                    /* the app has no event icons; the field is kept for schema
                       compatibility and ignored on import */
                    icon: null
                });
            });
        });

        return {
            version: VERSION,
            exportedAt: new Date().toISOString(),
            schedule: {
                title: state.title,
                settings: {
                    view: 'weekly',
                    showWeekends: state.settings.showWeekend !== false,
                    timeFormat: state.settings.clock === '12h' ? '12h' : '24h',
                    language: state.settings.language === 'de' ? 'de' : 'en'
                },
                events: events
            }
        };
    }

    function text() {
        return JSON.stringify(build(), null, 2);
    }

    function fileName() {
        return U.slugify(S.state.title, 'schedule') + '.json';
    }

    /** Downloads the current slate as a formatted .json file. */
    function download() {
        var body = text();
        var blob = new Blob([body], { type: 'application/json' });
        U.download(URL.createObjectURL(blob), fileName(), true);
        return { fileName: fileName(), bytes: body.length };
    }

    /* ------------------------------------------------------------- import */

    /**
     * Accepts the documented v1 document, a bare { events: [...] } payload and
     * the app's own stored shape ({ title, settings, tasks: [{ times }] }) so
     * older backups still load.
     */
    function extractSchedule(payload) {
        if (!isObject(payload)) {
            return null;
        }
        if (isObject(payload.schedule)) {
            return payload.schedule;
        }
        if (Array.isArray(payload.events) || Array.isArray(payload.tasks)) {
            return { title: payload.title, settings: payload.settings, events: payload.events, tasks: payload.tasks };
        }
        return null;
    }

    function occurrence(raw) {
        if (!isObject(raw)) {
            return null;
        }
        var title = String(raw.title == null ? '' : raw.title).trim();
        var day = dayIndex(raw.day);
        var startSlot = Math.round(Number(raw.startSlot));
        var durationSlots = Math.round(Number(raw.durationSlots));

        if (!title || day === -1 || !isFinite(startSlot) || !isFinite(durationSlots)) {
            return null;
        }
        if (startSlot < 0 || durationSlots <= 0) {
            return null;
        }

        var start = U.clamp(startSlot * SLOT_MINUTES, 0, U.MIN_PER_DAY - SLOT_MINUTES);
        return {
            id: typeof raw.id === 'string' && raw.id ? raw.id : null,
            title: title.slice(0, 120),
            note: String(raw.note == null ? '' : raw.note).trim().slice(0, 400),
            theme: themeId(raw.theme, raw.color),
            day: day,
            start: start,
            duration: U.clamp(durationSlots * SLOT_MINUTES, SLOT_MINUTES, U.MIN_PER_DAY - start)
        };
    }

    /** Flattens the payload's events into one occurrence per weekday. */
    function collect(rawEvents) {
        var out = [];

        rawEvents.forEach(function (raw) {
            if (isObject(raw) && raw.day === undefined && isObject(raw.times)) {
                var shared = {
                    id: raw.id,
                    title: raw.title,
                    note: raw.note,
                    theme: themeId(raw.theme, raw.color),
                    color: raw.color
                };
                Object.keys(raw.times).forEach(function (key) {
                    var slot = raw.times[key];
                    if (!isObject(slot)) {
                        return;
                    }
                    var occ = occurrence({
                        id: shared.id,
                        title: shared.title,
                        note: shared.note,
                        theme: shared.theme,
                        color: shared.color,
                        day: Number(key),
                        startSlot: Number(slot.start) / SLOT_MINUTES,
                        durationSlots: Number(slot.duration) / SLOT_MINUTES
                    });
                    if (occ) {
                        out.push(occ);
                    }
                });
                return;
            }
            var single = occurrence(raw);
            if (single) {
                out.push(single);
            }
        });

        return out;
    }

    /** Regroups per-day occurrences back into the app's grouped tasks. */
    function group(occurrences) {
        var byId = {};
        var order = [];

        occurrences.forEach(function (occ, index) {
            var id = occ.id || 'ev_import_' + index;
            var task = byId[id];
            if (!task) {
                task = byId[id] = {
                    id: id,
                    title: occ.title,
                    note: occ.note,
                    theme: occ.theme,
                    times: {}
                };
                order.push(id);
            }
            if (!task.times[occ.day]) {
                task.times[occ.day] = { start: occ.start, duration: occ.duration };
            }
        });

        return order.map(function (id) {
            return byId[id];
        });
    }

    function normalizeSettings(raw) {
        var out = {};
        if (!isObject(raw)) {
            return out;
        }
        var format = raw.timeFormat || raw.clock;
        if (format === '12h' || format === '24h') {
            out.clock = format;
        }
        if (typeof raw.showWeekends === 'boolean') {
            out.showWeekend = raw.showWeekends;
        }
        if (typeof raw.showWeekend === 'boolean') {
            out.showWeekend = raw.showWeekend;
        }
        if (raw.language === 'en' || raw.language === 'de') {
            out.language = raw.language;
        }
        return out;
    }

    /** Validates a parsed payload and, when valid, replaces the live slate. */
    function apply(payload) {
        var schedule = extractSchedule(payload);
        if (!schedule) {
            return { ok: false, reason: 'schema' };
        }

        var rawEvents = Array.isArray(schedule.events) ? schedule.events
            : (Array.isArray(schedule.tasks) ? schedule.tasks : null);
        if (!rawEvents) {
            return { ok: false, reason: 'schema' };
        }

        var occurrences = collect(rawEvents);
        if (rawEvents.length && !occurrences.length) {
            return { ok: false, reason: 'events' };
        }

        var tasks = group(occurrences).slice(0, MAX_EVENTS);
        var title = typeof schedule.title === 'string' ? schedule.title : '';

        S.replaceSchedule({
            title: title,
            settings: normalizeSettings(schedule.settings),
            tasks: tasks
        });

        return { ok: true, tasks: tasks.length, blocks: occurrences.length };
    }

    function readFile(file) {
        return new Promise(function (resolve, reject) {
            if (!file) {
                reject(new Error('no file'));
                return;
            }
            var reader = new global.FileReader();
            reader.onload = function () {
                resolve(String(reader.result || ''));
            };
            reader.onerror = function () {
                reject(reader.error || new Error('read failed'));
            };
            reader.readAsText(file);
        });
    }

    /** Parses text / a File and applies it. Never throws. */
    function importText(body) {
        var payload;
        try {
            payload = JSON.parse(body);
        } catch (error) {
            return { ok: false, reason: 'json' };
        }
        try {
            return apply(payload);
        } catch (error) {
            return { ok: false, reason: 'schema' };
        }
    }

    function importFile(file) {
        return readFile(file).then(function (body) {
            return importText(body);
        }).catch(function () {
            return { ok: false, reason: 'read' };
        });
    }

    global.SSBackup = {
        VERSION: VERSION,
        build: build,
        text: text,
        fileName: fileName,
        download: download,
        importFile: importFile,
        importText: importText,
        /* internals exposed for the jsdom suite */
        _apply: apply,
        _normalizeSettings: normalizeSettings,
        _dayIndex: dayIndex
    };
})(window);
