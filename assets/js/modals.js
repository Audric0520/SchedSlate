/* SchedSlate — task modal, settings drawer and toasts */
(function (global) {
    'use strict';

    var U = global.SSUtil;
    var S = global.SSStore;
    var I = global.SSI18n;
    var Icons = global.SchedIcons;

    var layer = null;
    var toastLayer = null;
    var lastFocus = null;
    var activeForm = null;
    var activeOnClose = null;

    function clock() {
        return S.state.settings.clock;
    }

    function iconSvg(name, extraClass) {
        var markup = Icons.svg(name);
        if (extraClass) {
            markup = markup.replace('class="icon"', 'class="icon ' + extraClass + '"');
        }
        return markup;
    }

    /* --------------------------------------------------------------- layer */

    function focusables(scope) {
        return U.each('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', scope)
            .filter(function (node) {
                return node.offsetParent !== null || node === document.activeElement;
            });
    }

    function openLayer(content, options) {
        closeLayer(true);
        lastFocus = document.activeElement;
        layer.className = 'layer' + (options && options.drawer ? ' is-drawer' : '');
        layer.innerHTML = content;
        layer.hidden = false;
        document.body.classList.add('no-scroll');

        layer.onmousedown = function (event) {
            if (event.target === layer) {
                closeLayer();
            }
        };

        layer.onkeydown = function (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeLayer();
                return;
            }
            if (event.key !== 'Tab') {
                return;
            }
            var nodes = focusables(layer);
            if (!nodes.length) {
                return;
            }
            var first = nodes[0];
            var last = nodes[nodes.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        var autoFocus = layer.querySelector('[data-autofocus]');
        if (autoFocus) {
            autoFocus.focus();
            if (typeof autoFocus.select === 'function') {
                autoFocus.select();
            }
        }
    }

    function closeLayer(silent) {
        if (!layer || layer.hidden) {
            return;
        }
        var onClose = activeOnClose;
        activeOnClose = null;
        activeForm = null;
        layer.hidden = true;
        layer.innerHTML = '';
        layer.onkeydown = null;
        layer.onmousedown = null;
        document.body.classList.remove('no-scroll');

        if (lastFocus && document.contains(lastFocus) && !silent) {
            lastFocus.focus({ preventScroll: true });
        }
        lastFocus = null;
        if (onClose) {
            onClose();
        }
    }

    /* --------------------------------------------------------------- toast */

    function toast(message, options) {
        if (!toastLayer) {
            return;
        }
        var opts = options || {};
        var node = document.createElement('div');
        node.className = 'toast';
        node.innerHTML = '<span class="toast-msg"></span>';
        node.querySelector('.toast-msg').textContent = message;

        var timer = null;
        function dismiss() {
            if (timer) {
                global.clearTimeout(timer);
                timer = null;
            }
            if (!node.parentNode) {
                return;
            }
            node.classList.add('is-leaving');
            global.setTimeout(function () {
                if (node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            }, 190);
        }

        if (opts.actionLabel && typeof opts.onAction === 'function') {
            var action = document.createElement('button');
            action.type = 'button';
            action.className = 'toast-action';
            action.textContent = opts.actionLabel;
            action.addEventListener('click', function () {
                dismiss();
                opts.onAction();
            });
            node.appendChild(action);
        }

        toastLayer.appendChild(node);
        timer = global.setTimeout(dismiss, opts.duration || 4600);

        while (toastLayer.children.length > 3) {
            toastLayer.removeChild(toastLayer.firstElementChild);
        }
    }

    /* ----------------------------------------------------------- time opts */

    function timeLabel(minutes) {
        if (minutes >= U.MIN_PER_DAY) {
            return clock() === '12h' ? '12:00 AM' : '24:00';
        }
        return U.formatTime(minutes, clock());
    }

    function timeOptions(minutesArray, selected) {
        return minutesArray.map(function (minute) {
            return '<option value="' + minute + '"' + (minute === selected ? ' selected' : '') + '>' +
                U.esc(timeLabel(minute)) + '</option>';
        }).join('');
    }

    function startValues() {
        var out = [];
        for (var m = 0; m < U.MIN_PER_DAY; m += 30) {
            out.push(m);
        }
        return out;
    }

    function endValues(start) {
        var out = [];
        for (var m = start + 30; m <= U.MIN_PER_DAY; m += 30) {
            out.push(m);
        }
        return out;
    }

    /* ----------------------------------------------------------- task modal */

    var DEFAULT_START = 9 * 60;
    var DEFAULT_DURATION = 60;

    function sortedDays(times) {
        return Object.keys(times || {})
            .map(Number)
            .sort(function (a, b) {
                return a - b;
            });
    }

    /** Slot used when a day is newly selected: inherit the first day, else 09:00–10:00. */
    function starterSlot(times) {
        var days = sortedDays(times);
        if (!days.length) {
            return { start: DEFAULT_START, duration: DEFAULT_DURATION };
        }
        var slot = times[days[0]];
        return { start: slot.start, duration: slot.duration };
    }

    function defaultDraft(options) {
        var day = options.day;
        if (day === undefined || day === null) {
            day = U.todayIndex();
        }
        var start = options.start !== undefined ? options.start : DEFAULT_START;
        start = U.clamp(U.snap(start, 30), 0, U.MIN_PER_DAY - 30);
        var duration = options.duration || DEFAULT_DURATION;
        duration = U.clamp(U.snap(duration, 30), 30, U.MIN_PER_DAY - start);

        var times = {};
        times[day] = { start: start, duration: duration };

        return {
            id: null,
            title: '',
            note: '',
            theme: global.SSThemes.defaultTheme,
            times: times
        };
    }

    function dayTimeRowMarkup(day, slot) {
        var end = Math.min(slot.start + slot.duration, U.MIN_PER_DAY);
        return '<div class="day-time-row" data-day="' + day + '">' +
            '<span class="day-time-label">' + U.esc(I.dayName(day)) + '</span>' +
            '<div class="time-field">' + iconSvg('clock') +
            '<select class="select" data-field="start" data-day="' + day + '" aria-label="' +
            U.esc(I.t('startLabel') + ' · ' + I.dayName(day)) + '">' +
            timeOptions(startValues(), slot.start) + '</select>' +
            '<span class="select-chevron">' + iconSvg('chevron-down') + '</span>' +
            '</div>' +
            '<span class="time-sep" aria-hidden="true">–</span>' +
            '<div class="time-field">' + iconSvg('clock') +
            '<select class="select" data-field="end" data-day="' + day + '" aria-label="' +
            U.esc(I.t('endLabel') + ' · ' + I.dayName(day)) + '">' +
            timeOptions(endValues(slot.start), end) + '</select>' +
            '<span class="select-chevron">' + iconSvg('chevron-down') + '</span>' +
            '</div>' +
            '<span class="day-time-duration" data-duration-for="' + day + '">' +
            U.esc(I.duration(slot.duration)) + '</span>' +
            '<p class="error-text day-time-error" data-day-error="' + day + '" hidden></p>' +
            '</div>';
    }

    function dayTimesMarkup(draft) {
        var days = sortedDays(draft.times);
        if (!days.length) {
            return '<p class="field-hint">' + U.esc(I.t('noDaysSelected')) + '</p>';
        }
        return days.map(function (day) {
            return dayTimeRowMarkup(day, draft.times[day]);
        }).join('');
    }

    function taskModalMarkup(draft, editing) {
        var dayPills = U.dayOrder(1).map(function (day) {
            return '<button type="button" class="day-pill" data-day="' + day + '" aria-pressed="' +
                (draft.times[day] ? 'true' : 'false') + '" aria-label="' + U.esc(I.dayName(day)) + '">' +
                U.esc(I.dayMini(day)) + '</button>';
        }).join('');

        var themes = global.SSThemes.list.map(function (theme) {
            return '<button type="button" class="theme-choice" data-theme="' + theme.id + '" aria-pressed="' +
                (draft.theme === theme.id ? 'true' : 'false') + '" aria-label="' + U.esc(theme.name) + '">' +
                '<span class="theme-preview" aria-hidden="true">' +
                '<span class="accent-bar"><i></i><i></i><i></i></span>' +
                '<span class="theme-preview-title"></span>' +
                '<span class="theme-preview-meta"></span>' +
                '</span>' +
                '<span class="theme-choice-foot">' +
                '<span class="theme-choice-name">' + U.esc(theme.name) + '</span>' +
                '<span class="theme-dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
                '</span>' +
                '<span class="theme-check" aria-hidden="true">' + iconSvg('check') + '</span>' +
                '</button>';
        }).join('');

        return '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">' +
            '<div class="modal-head">' +
            '<div>' +
            '<h2 class="modal-title" id="task-modal-title">' + U.esc(I.t(editing ? 'editEvent' : 'addEvent')) + '</h2>' +
            '<p class="modal-sub" data-sub>' + U.esc(subtitle(draft)) + '</p>' +
            '</div>' +
            '<button type="button" class="icon-btn" data-close aria-label="' + U.esc(I.t('close')) + '" title="' + U.esc(I.t('close')) + '">' +
            iconSvg('x') + '</button>' +
            '</div>' +
            '<form class="modal-form" novalidate>' +
            '<div class="modal-body">' +
            '<div class="field">' +
            '<label class="field-label" for="task-title-input">' + U.esc(I.t('titleLabel')) + '</label>' +
            '<input id="task-title-input" class="input input-title" data-field="title" type="text" maxlength="120" autocomplete="off" ' +
            'placeholder="' + U.esc(I.t('titlePlaceholder')) + '" value="' + U.esc(draft.title) + '" data-autofocus />' +
            '<p class="error-text" data-error="title" hidden></p>' +
            '</div>' +

            '<div class="field">' +
            '<span class="field-label">' + U.esc(I.t('daysLabel')) + '</span>' +
            '<div class="day-pills" role="group" aria-label="' + U.esc(I.t('daysLabel')) + '">' + dayPills + '</div>' +
            '<p class="error-text" data-error="days" hidden></p>' +
            '</div>' +

            '<div class="field">' +
            '<span class="field-label">' + U.esc(I.t('timesLabel')) + '</span>' +
            '<div class="day-times" data-day-times>' + dayTimesMarkup(draft) + '</div>' +
            '<div class="quick-durations" role="group" aria-label="' + U.esc(I.t('quickPick')) + '">' +
            [30, 60, 90, 120].map(function (minutes) {
                return '<button type="button" class="chip-btn" data-duration="' + minutes + '">' +
                    U.esc(I.duration(minutes)) + '</button>';
            }).join('') +
            '</div>' +
            '<p class="field-hint">' + U.esc(I.t('quickPickHint')) + '</p>' +
            '</div>' +

            '<div class="field">' +
            '<span class="field-label">' + U.esc(I.t('themeLabel')) + '</span>' +
            '<div class="themes" role="group" aria-label="' + U.esc(I.t('themeLabel')) + '">' + themes + '</div>' +
            '</div>' +

            '<div class="field">' +
            '<label class="field-label" for="task-note-input">' + U.esc(I.t('noteLabel')) +
            '<span class="optional">(' + U.esc(I.t('optional')) + ')</span></label>' +
            '<textarea id="task-note-input" class="textarea" data-field="note" maxlength="400" rows="2" ' +
            'placeholder="' + U.esc(I.t('notePlaceholder')) + '">' + U.esc(draft.note) + '</textarea>' +
            '</div>' +
            '</div>' +

            '<div class="modal-foot">' +
            (editing ? '<button type="button" class="btn btn-danger" data-delete>' + iconSvg('trash-2') +
                '<span>' + U.esc(I.t('deleteEvent')) + '</span></button>' : '') +
            '<span class="spacer"></span>' +
            '<button type="button" class="btn btn-ghost" data-close>' + U.esc(I.t('cancel')) + '</button>' +
            '<button type="submit" class="btn btn-primary">' + U.esc(I.t(editing ? 'saveChanges' : 'addAction')) + '</button>' +
            '</div>' +
            '</form>' +
            '</div>';
    }

    function subtitle(draft) {
        var days = sortedDays(draft.times);
        if (!days.length) {
            return I.t('noDaysSelected');
        }
        var names = days.map(function (day) {
            return I.dayShort(day);
        }).join(', ');
        var first = draft.times[days[0]];
        var uniform = days.every(function (day) {
            var slot = draft.times[day];
            return slot.start === first.start && slot.duration === first.duration;
        });
        var summary = uniform
            ? U.formatRange(first.start, Math.min(first.start + first.duration, U.MIN_PER_DAY), clock())
            : I.t('varyingTimes');
        return names + ' · ' + summary;
    }

    function openTaskModal(options) {
        var opts = options || {};
        var existing = opts.id ? S.getTask(opts.id) : null;
        var draft = existing ? {
            id: existing.id,
            title: existing.title,
            note: existing.note,
            theme: S.themeOf(existing).id,
            times: JSON.parse(JSON.stringify(existing.times))
        } : defaultDraft(opts);

        openLayer(taskModalMarkup(draft, !!existing), { drawer: false });

        var form = layer.querySelector('.modal-form');
        var titleInput = form.querySelector('[data-field="title"]');
        var noteInput = form.querySelector('[data-field="note"]');
        var dayTimesBox = form.querySelector('[data-day-times]');
        var sub = layer.querySelector('[data-sub]');
        var titleError = form.querySelector('[data-error="title"]');
        var daysError = form.querySelector('[data-error="days"]');

        activeForm = form;

        /* the header close button lives outside the <form> */
        layer.querySelector('.modal').addEventListener('click', function (event) {
            if (event.target.closest('[data-close]')) {
                closeLayer();
            }
        });

        function refreshSubtitle() {
            sub.textContent = subtitle(draft);
        }

        function refreshRows() {
            dayTimesBox.innerHTML = dayTimesMarkup(draft);
            refreshSubtitle();
        }

        function setQuickDuration(minutes) {
            sortedDays(draft.times).forEach(function (day) {
                var slot = draft.times[day];
                var duration = U.clamp(minutes, 30, U.MIN_PER_DAY - slot.start);
                draft.times[day] = { start: slot.start, duration: duration };
            });
            refreshRows();
        }

        function refreshPills() {
            U.each('.day-pill', form).forEach(function (node) {
                var day = Number(node.getAttribute('data-day'));
                node.setAttribute('aria-pressed', draft.times[day] ? 'true' : 'false');
            });
        }

        titleInput.addEventListener('input', function () {
            if (titleInput.value.trim()) {
                titleError.hidden = true;
                titleInput.classList.remove('is-invalid');
            }
        });

        form.addEventListener('click', function (event) {
            if (event.target.closest('[data-close]')) {
                closeLayer();
                return;
            }

            var dayButton = event.target.closest('.day-pill');
            if (dayButton) {
                var day = Number(dayButton.getAttribute('data-day'));
                if (draft.times[day]) {
                    delete draft.times[day];
                } else {
                    var base = starterSlot(draft.times);
                    draft.times[day] = { start: base.start, duration: base.duration };
                }
                refreshPills();
                daysError.hidden = true;
                refreshRows();
                return;
            }

            var themeChoice = event.target.closest('.theme-choice');
            if (themeChoice) {
                draft.theme = themeChoice.getAttribute('data-theme');
                U.each('.theme-choice', form).forEach(function (node) {
                    node.setAttribute('aria-pressed', node === themeChoice ? 'true' : 'false');
                });
                return;
            }

            var quick = event.target.closest('[data-duration]');
            if (quick) {
                setQuickDuration(Number(quick.getAttribute('data-duration')));
                return;
            }

            if (event.target.closest('[data-delete]')) {
                deleteCurrent();
            }
        });

        dayTimesBox.addEventListener('change', function (event) {
            var select = event.target.closest('select[data-field]');
            if (!select) {
                return;
            }
            var day = Number(select.getAttribute('data-day'));
            var slot = draft.times[day];
            if (!slot) {
                return;
            }
            var row = select.closest('.day-time-row');
            var errorNode = row.querySelector('[data-day-error]');

            if (select.getAttribute('data-field') === 'start') {
                var start = Number(select.value);
                var end = U.clamp(start + slot.duration, start + 30, U.MIN_PER_DAY);
                draft.times[day] = { start: start, duration: end - start };
                var endSelect = row.querySelector('select[data-field="end"]');
                endSelect.innerHTML = timeOptions(endValues(start), end);
            } else {
                var endValue = Number(select.value);
                if (endValue <= slot.start) {
                    errorNode.textContent = I.t('errEnd');
                    errorNode.hidden = false;
                    return;
                }
                draft.times[day] = { start: slot.start, duration: endValue - slot.start };
            }

            errorNode.hidden = true;
            var durationNode = row.querySelector('[data-duration-for]');
            if (durationNode) {
                durationNode.textContent = I.duration(draft.times[day].duration);
            }
            refreshSubtitle();
        });

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var title = titleInput.value.trim();
            var valid = true;

            if (!title) {
                titleError.textContent = I.t('errTitle');
                titleError.hidden = false;
                titleInput.classList.add('is-invalid');
                valid = false;
            } else {
                titleError.hidden = true;
                titleInput.classList.remove('is-invalid');
            }

            var days = sortedDays(draft.times);
            if (!days.length) {
                daysError.textContent = I.t('errDays');
                daysError.hidden = false;
                valid = false;
            }

            /* every day needs its own valid range: end strictly after start */
            days.forEach(function (day) {
                var slot = draft.times[day];
                var row = dayTimesBox.querySelector('.day-time-row[data-day="' + day + '"]');
                var errorNode = row ? row.querySelector('[data-day-error]') : null;
                var invalid = slot.duration < 30 || slot.start + slot.duration > U.MIN_PER_DAY;
                if (invalid) {
                    valid = false;
                    if (errorNode) {
                        errorNode.textContent = I.t('errEnd');
                        errorNode.hidden = false;
                    }
                } else if (errorNode) {
                    errorNode.hidden = true;
                }
            });

            if (!valid) {
                if (!title) {
                    titleInput.focus();
                }
                return;
            }

            var times = {};
            days.forEach(function (day) {
                times[day] = { start: draft.times[day].start, duration: draft.times[day].duration };
            });

            var payload = {
                title: title,
                note: noteInput.value.trim(),
                theme: draft.theme,
                times: times
            };

            if (existing) {
                S.updateTask(existing.id, payload);
                toast(I.t('toastUpdated'));
            } else {
                S.addTask(payload);
                toast(I.t('toastAdded'));
            }
            closeLayer();
        });

        function deleteCurrent() {
            if (!existing) {
                closeLayer();
                return;
            }
            var removed = S.removeTask(existing.id);
            closeLayer();
            if (removed) {
                toast(I.t('toastDeleted', { title: removed.title }), {
                    actionLabel: I.t('toastUndo'),
                    onAction: function () {
                        S.restoreTask(removed);
                        toast(I.t('toastRestored'));
                    }
                });
            }
        }
    }

    /* -------------------------------------------------------- settings view */

    function pillGroup(setting, options, value) {
        return '<div class="pills" role="group" data-setting="' + setting + '">' +
            options.map(function (option) {
                return '<button type="button" class="pill" data-value="' + U.esc(option.value) + '" aria-pressed="' +
                    (String(option.value) === String(value) ? 'true' : 'false') + '">' + U.esc(option.label) + '</button>';
            }).join('') +
            '</div>';
    }

    function settingsBody(settings) {
        return '' +
            '<div class="setting">' +
            '<span class="setting-label">' + U.esc(I.t('clockType')) + '</span>' +
            pillGroup('clock', [
                { value: '12h', label: I.t('clock12') },
                { value: '24h', label: I.t('clock24') }
            ], settings.clock) +
            '</div>' +

            '<div class="setting">' +
            '<span class="setting-label">' + U.esc(I.t('showWeekend')) + '</span>' +
            pillGroup('showWeekend', [
                { value: 'true', label: I.t('yes') },
                { value: 'false', label: I.t('no') }
            ], String(settings.showWeekend)) +
            '</div>' +

            '<div class="setting">' +
            '<span class="setting-label">' + U.esc(I.t('weekStartTitle')) + '</span>' +
            pillGroup('weekStart', [
                { value: '1', label: I.t('monday') },
                { value: '0', label: I.t('sunday') }
            ], String(settings.weekStart)) +
            '</div>' +

            '<div class="setting">' +
            '<span class="setting-label">' + U.esc(I.t('incrementTitle')) + '</span>' +
            pillGroup('increment', [
                { value: '15', label: I.t('inc15') },
                { value: '30', label: I.t('inc30') },
                { value: '60', label: I.t('inc60') }
            ], String(settings.increment)) +
            '<span class="setting-note">' + U.esc(I.t('incrementNote')) + '</span>' +
            '</div>' +

            '<div class="setting">' +
            '<span class="setting-label">' + U.esc(I.t('minimizeTitle')) + '</span>' +
            pillGroup('compact', [
                { value: 'false', label: I.t('no') },
                { value: 'true', label: I.t('yes') }
            ], String(settings.compact)) +
            '</div>' +

            '<div class="setting">' +
            '<span class="setting-label">' + U.esc(I.t('minHeightTitle')) + '</span>' +
            '<div class="slider-row">' +
            '<input type="range" min="4" max="24" step="1" value="' + settings.minHours + '" data-slider="minHours" ' +
            'aria-label="' + U.esc(I.t('minHeightTitle')) + '" />' +
            '<span class="slider-value">' + U.esc(I.t('hoursShort', { n: settings.minHours })) + '</span>' +
            '</div>' +
            '</div>' +

            '<div class="setting">' +
            '<span class="setting-label">' + U.esc(I.t('languageTitle')) + '</span>' +
            pillGroup('language', [
                { value: 'en', label: I.t('langEn') },
                { value: 'de', label: I.t('langDe') }
            ], settings.language) +
            '</div>' +

            '<div class="setting">' +
            '<span class="setting-label">' + U.esc(I.t('resetTitle')) + '</span>' +
            '<button type="button" class="btn btn-danger btn-sm" data-reset style="align-self:flex-start">' +
            iconSvg('rotate-ccw') + '<span>' + U.esc(I.t('resetBtn')) + '</span></button>' +
            '<span class="setting-note">' + U.esc(I.t('resetNote')) + '</span>' +
            '</div>';
    }

    function openSettings() {
        var settings = S.state.settings;
        var html = '<div class="drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title">' +
            '<div class="drawer-head">' +
            '<h2 class="drawer-title" id="settings-title">' + U.esc(I.t('settingsTitle')) + '</h2>' +
            '<button type="button" class="icon-btn" data-close aria-label="' + U.esc(I.t('close')) + '" title="' +
            U.esc(I.t('close')) + '">' + iconSvg('x') + '</button>' +
            '</div>' +
            '<div class="drawer-body" data-settings-body>' + settingsBody(settings) + '</div>' +
            '<div class="drawer-foot">' +
            '<span class="note">' + U.esc(I.t('storedNote')) + '</span>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-close>' + U.esc(I.t('close')) + '</button>' +
            '</div>' +
            '</div>';

        openLayer(html, { drawer: true });

        var drawer = layer.querySelector('.drawer');
        var body = drawer.querySelector('[data-settings-body]');
        var previousScroll = 0;

        function rerender() {
            previousScroll = body.scrollTop;
            body.innerHTML = settingsBody(S.state.settings);
            body.scrollTop = previousScroll;
        }

        drawer.addEventListener('click', function (event) {
            if (event.target.closest('[data-close]')) {
                closeLayer();
                return;
            }

            var reset = event.target.closest('[data-reset]');
            if (reset) {
                if (global.confirm(I.t('confirmReset'))) {
                    S.reset();
                    closeLayer();
                    toast(I.t('toastReset'));
                }
                return;
            }

            var pill = event.target.closest('.pills .pill');
            if (!pill) {
                return;
            }
            var group = pill.closest('[data-setting]');
            if (!group) {
                return;
            }
            var setting = group.getAttribute('data-setting');
            var raw = pill.getAttribute('data-value');
            var patch = {};

            if (setting === 'clock') {
                patch.clock = raw;
            } else if (setting === 'showWeekend') {
                patch.showWeekend = raw === 'true';
            } else if (setting === 'weekStart') {
                patch.weekStart = Number(raw);
            } else if (setting === 'increment') {
                patch.increment = Number(raw);
            } else if (setting === 'compact') {
                patch.compact = raw === 'true';
            } else if (setting === 'language') {
                patch.language = raw;
            }

            S.setSettings(patch);
            if (patch.language) {
                openSettings();
                return;
            }
            rerender();
        });

        drawer.addEventListener('input', function (event) {
            var slider = event.target.closest('[data-slider="minHours"]');
            if (!slider) {
                return;
            }
            var value = Number(slider.value);
            var label = slider.parentNode.querySelector('.slider-value');
            if (label) {
                label.textContent = I.t('hoursShort', { n: value });
            }
            S.setSettings({ minHours: value });
        });
    }

    function init() {
        layer = document.getElementById('modal-layer');
        toastLayer = document.getElementById('toast-layer');

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && layer && !layer.hidden) {
                event.preventDefault();
                closeLayer();
            }
        });

        U.bus.on('modal:settings', openSettings);
        U.bus.on('modal:task', openTaskModal);
        U.bus.on('modal:close', function () {
            closeLayer();
        });
        U.bus.on('toast', function (detail) {
            toast(detail.message, detail);
        });
    }

    global.SSModals = {
        init: init,
        openTaskModal: openTaskModal,
        openSettings: openSettings,
        close: function () {
            closeLayer();
        },
        toast: toast,
        isOpen: function () {
            return layer && !layer.hidden;
        }
    };
})(window);
