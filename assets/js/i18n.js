/* SchedSlate — tiny localization layer (en / de) */
(function (global) {
    'use strict';

    var DAYS = {
        en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        de: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
    };

    var DAYS_SHORT = {
        en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
    };

    var DAYS_MINI = {
        en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
        de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
    };

    var MONTHS_SHORT = {
        en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
    };

    var STRINGS = {
        en: {
            brandTagline: 'Visual time blocking',
            skipToSchedule: 'Skip to schedule',
            add: 'Add',
            settings: 'Settings',
            schedule: 'Schedule',
            scheduleTitle: 'Schedule title',
            titleHint: 'Click the title to rename your slate',
            emptyHint: 'Your slate is empty — click any cell on the grid to block out your first event.',
            loadSample: 'Try a sample week',
            autosaved: 'Saved automatically in this browser',
            shortcutNew: 'new event',
            shortcutClose: 'close',
            todayLabel: 'Today',
            defaultTitle: 'My Schedule',
            dateEyebrow: '{weekday}, {month} {day}',
            statBlocks: 'blocks',
            statPlanned: 'planned',
            addEvent: 'Add event',
            editEvent: 'Edit event',
            titleLabel: 'Title',
            titlePlaceholder: 'e.g. Deep work, Lecture, Gym',
            colorLabel: 'Color',
            daysLabel: 'Repeat on',
            startLabel: 'Start',
            endLabel: 'End',
            durationSummary: 'Lasts {duration}',
            quickPick: 'Quick pick',
            noteLabel: 'Note',
            optional: 'optional',
            notePlaceholder: 'Anything worth remembering (optional)',
            saveChanges: 'Save changes',
            addAction: 'Add to schedule',
            cancel: 'Cancel',
            deleteEvent: 'Delete',
            close: 'Close',
            errTitle: 'Give this block a title.',
            errDays: 'Pick at least one day.',
            toastAdded: 'Event added',
            toastUpdated: 'Event updated',
            toastDeleted: 'Deleted “{title}”',
            toastUndo: 'Undo',
            toastRestored: 'Event restored',
            toastSample: 'Sample week loaded',
            toastReset: 'Schedule reset',
            settingsTitle: 'Settings',
            clockType: 'Clock type',
            clock12: '12 hours',
            clock24: '24 hours',
            showWeekend: 'Show weekend',
            yes: 'Yes',
            no: 'No',
            weekStartTitle: 'Start of the week',
            monday: 'Monday',
            sunday: 'Sunday',
            incrementTitle: 'Time increment',
            incrementNote: 'Ruler density. Blocks always snap to 30-minute slots.',
            inc15: '15 min',
            inc30: '30 min',
            inc60: '1 hour',
            minimizeTitle: 'Minimize schedule height',
            minHeightTitle: 'Min schedule height (hours)',
            languageTitle: 'Language',
            langEn: 'English',
            langDe: 'Deutsch',
            resetTitle: 'Reset',
            resetBtn: 'Reset schedule',
            resetNote: 'Deletes every block and restores the default settings.',
            confirmReset: 'Delete every block and reset all settings?',
            storedNote: 'Everything stays on this device.',
            unitHour: 'h',
            unitMin: 'min',
            hoursShort: '{n} h',
            sampleDeepWork: 'Deep work',
            sampleStandup: 'Team stand-up',
            sampleWorkout: 'Morning workout',
            sampleProject: 'Project sprint',
            sampleStudy: 'Study session',
            sampleDinner: 'Family dinner',
            sampleReading: 'Reading time',
            samplePlan: 'Plan the week',
            sampleLunch: 'Lunch break'
        },
        de: {
            brandTagline: 'Visuelles Zeitblocken',
            skipToSchedule: 'Zum Zeitplan springen',
            add: 'Hinzufügen',
            settings: 'Einstellungen',
            schedule: 'Zeitplan',
            scheduleTitle: 'Titel des Zeitplans',
            titleHint: 'Klicke auf den Titel, um deine Tafel zu benennen',
            emptyHint: 'Deine Tafel ist leer – klicke auf eine beliebige Zelle, um deinen ersten Block einzutragen.',
            loadSample: 'Beispielwoche laden',
            autosaved: 'Automatisch in diesem Browser gespeichert',
            shortcutNew: 'neuer Termin',
            shortcutClose: 'schließen',
            todayLabel: 'Heute',
            defaultTitle: 'Mein Zeitplan',
            dateEyebrow: '{weekday}, {day}. {month}',
            statBlocks: 'Blöcke',
            statPlanned: 'geplant',
            addEvent: 'Termin hinzufügen',
            editEvent: 'Termin bearbeiten',
            titleLabel: 'Titel',
            titlePlaceholder: 'z. B. Fokusarbeit, Vorlesung, Gym',
            colorLabel: 'Farbe',
            daysLabel: 'Wiederholen am',
            startLabel: 'Beginn',
            endLabel: 'Ende',
            durationSummary: 'Dauer: {duration}',
            quickPick: 'Schnellauswahl',
            noteLabel: 'Notiz',
            optional: 'optional',
            notePlaceholder: 'Alles, was du dir merken möchtest (optional)',
            saveChanges: 'Änderungen speichern',
            addAction: 'Zum Zeitplan hinzufügen',
            cancel: 'Abbrechen',
            deleteEvent: 'Löschen',
            close: 'Schließen',
            errTitle: 'Gib diesem Block einen Titel.',
            errDays: 'Wähle mindestens einen Tag.',
            toastAdded: 'Termin hinzugefügt',
            toastUpdated: 'Termin aktualisiert',
            toastDeleted: '„{title}“ gelöscht',
            toastUndo: 'Rückgängig',
            toastRestored: 'Termin wiederhergestellt',
            toastSample: 'Beispielwoche geladen',
            toastReset: 'Zeitplan zurückgesetzt',
            settingsTitle: 'Einstellungen',
            clockType: 'Zeitformat',
            clock12: '12 Stunden',
            clock24: '24 Stunden',
            showWeekend: 'Wochenende zeigen',
            yes: 'Ja',
            no: 'Nein',
            weekStartTitle: 'Wochenbeginn',
            monday: 'Montag',
            sunday: 'Sonntag',
            incrementTitle: 'Zeitraster',
            incrementNote: 'Dichte der Zeitleiste. Blöcke rasten immer im 30-Minuten-Raster ein.',
            inc15: '15 Min.',
            inc30: '30 Min.',
            inc60: '1 Stunde',
            minimizeTitle: 'Kalenderhöhe minimieren',
            minHeightTitle: 'Mindesthöhe (Stunden)',
            languageTitle: 'Sprache',
            langEn: 'English',
            langDe: 'Deutsch',
            resetTitle: 'Zurücksetzen',
            resetBtn: 'Zeitplan zurücksetzen',
            resetNote: 'Löscht alle Blöcke und stellt die Standardeinstellungen wieder her.',
            confirmReset: 'Alle Blöcke löschen und alle Einstellungen zurücksetzen?',
            storedNote: 'Alles bleibt auf diesem Gerät.',
            unitHour: 'Std.',
            unitMin: 'Min.',
            hoursShort: '{n} Std.',
            sampleDeepWork: 'Fokusarbeit',
            sampleStandup: 'Team-Stand-up',
            sampleWorkout: 'Morgen-Training',
            sampleProject: 'Projekt-Sprint',
            sampleStudy: 'Lernsession',
            sampleDinner: 'Familienessen',
            sampleReading: 'Lesezeit',
            samplePlan: 'Woche planen',
            sampleLunch: 'Mittagspause'
        }
    };

    var current = 'en';

    function format(template, vars) {
        if (!vars) {
            return template;
        }
        return template.replace(/\{(\w+)\}/g, function (match, key) {
            return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match;
        });
    }

    function t(key, vars) {
        var table = STRINGS[current] || STRINGS.en;
        var value = table[key];
        if (value === undefined) {
            value = STRINGS.en[key] !== undefined ? STRINGS.en[key] : key;
        }
        return format(value, vars);
    }

    function duration(minutes) {
        var parts = global.SSUtil.durationParts(minutes);
        var hourUnit = t('unitHour');
        var minUnit = t('unitMin');
        if (parts.hours && parts.minutes) {
            return parts.hours + ' ' + hourUnit + ' ' + parts.minutes + ' ' + minUnit;
        }
        if (parts.hours) {
            return parts.hours + ' ' + hourUnit;
        }
        return parts.minutes + ' ' + minUnit;
    }

    function plural(key, keyOther, count) {
        return t(count === 1 ? key : keyOther, { n: count });
    }

    function apply(root) {
        var scope = root || document;
        Array.prototype.forEach.call(scope.querySelectorAll('[data-i18n]'), function (node) {
            node.textContent = t(node.getAttribute('data-i18n'));
        });
        Array.prototype.forEach.call(scope.querySelectorAll('[data-i18n-aria]'), function (node) {
            node.setAttribute('aria-label', t(node.getAttribute('data-i18n-aria')));
        });
        Array.prototype.forEach.call(scope.querySelectorAll('[data-i18n-title]'), function (node) {
            node.setAttribute('title', t(node.getAttribute('data-i18n-title')));
        });
    }

    function setLang(lang) {
        current = STRINGS[lang] ? lang : 'en';
        document.documentElement.setAttribute('lang', current);
        apply(document);
        return current;
    }

    global.SSI18n = {
        languages: ['en', 'de'],
        t: t,
        duration: duration,
        plural: plural,
        apply: apply,
        setLang: setLang,
        get lang() {
            return current;
        },
        dayName: function (index) {
            return (DAYS[current] || DAYS.en)[((index % 7) + 7) % 7];
        },
        dayShort: function (index) {
            return (DAYS_SHORT[current] || DAYS_SHORT.en)[((index % 7) + 7) % 7];
        },
        dayMini: function (index) {
            return (DAYS_MINI[current] || DAYS_MINI.en)[((index % 7) + 7) % 7];
        },
        monthShort: function (index) {
            return (MONTHS_SHORT[current] || MONTHS_SHORT.en)[((index % 12) + 12) % 12];
        }
    };
})(window);
