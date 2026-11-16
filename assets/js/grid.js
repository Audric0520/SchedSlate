/* SchedSlate — schedule grid (weekly / daily timeline + monthly calendar) */
(function (global) {
    'use strict';

    var U = global.SSUtil;
    var S = global.SSStore;
    var I = global.SSI18n;

    var root = null;
    var scrollEl = null;
    var didInitialScroll = false;
    var timelineScroll = { top: 0, left: 0 };
    var drag = null;
    var lastPointerType = 'mouse';

    var MIN_COL_WIDTH = 104;
    var GUTTER = 62;

    function settings() {
        return S.state.settings;
    }

    function pxPerMin() {
        return settings().compact ? 0.74 : 1.07;
    }

    function incMinutes() {
        return settings().increment || 30;
    }

    function bodyHeight() {
        return Math.round(pxPerMin() * U.MIN_PER_DAY);
    }

    function visibleDays() {
        var order = U.dayOrder(settings().weekStart);
        if (!settings().showWeekend) {
            order = order.filter(function (day) {
                return day !== 0 && day !== 6;
            });
        }
        return order;
    }

    function isToday(day) {
        return day === U.todayIndex();
    }

    /* ------------------------------------------------------------- layout */

    /** Greedy overlap layout: tasks that collide share the column width. */
    function layoutDay(day) {
        var tasks = S.tasksForDay(day);
        var clusters = [];
        var current = null;

        tasks.forEach(function (task) {
            var item = { task: task, start: task.start, end: task.start + task.duration };
            if (!current || item.start >= current.end) {
                current = { items: [], end: item.end };
                clusters.push(current);
            }
            current.items.push(item);
            current.end = Math.max(current.end, item.end);
        });

        var positioned = [];
        clusters.forEach(function (cluster) {
            var columnEnds = [];
            cluster.items.forEach(function (item) {
                var placed = false;
                for (var i = 0; i < columnEnds.length; i++) {
                    if (columnEnds[i] <= item.start) {
                        columnEnds[i] = item.end;
                        item.col = i;
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    item.col = columnEnds.length;
                    columnEnds.push(item.end);
                }
            });
            cluster.items.forEach(function (item) {
                item.cols = columnEnds.length;
                positioned.push(item);
            });
        });

        return positioned;
    }

    function taskMarkup(item, day) {
        var task = item.task;
        var ppm = pxPerMin();
        var top = task.start * ppm;
        var height = Math.max(task.duration * ppm - 3, 15);
        var cols = item.cols || 1;
        var col = item.col || 0;
        var tight = height < 38;
        var color = task.color;
        var range = U.formatRange(task.start, task.start + task.duration, settings().clock);
        var style = [
            'top:' + top.toFixed(2) + 'px',
            'height:' + height.toFixed(2) + 'px',
            'left:calc(' + ((col / cols) * 100).toFixed(4) + '% + 2px)',
            'width:calc(' + (100 / cols).toFixed(4) + '% - 4px)',
            '--task-color:' + color,
            '--task-border:' + U.rgba(color, 0.3),
            '--task-bg:' + 'linear-gradient(180deg, ' + U.rgba(color, 0.2) + ', ' + U.rgba(color, 0.12) + ')',
            '--task-bg-hover:' + 'linear-gradient(180deg, ' + U.rgba(color, 0.3) + ', ' + U.rgba(color, 0.2) + ')'
        ].join(';');

        var showNote = !tight && height >= 62 && task.note;
        var label = task.title + ', ' + I.dayName(day) + ', ' + range;

        return '<button type="button" class="task' + (tight ? ' is-tight' : '') + '"' +
            ' data-id="' + U.esc(task.id) + '" data-day="' + day + '"' +
            ' style="' + style + '" title="' + U.esc(task.title + ' · ' + range) + '"' +
            ' aria-label="' + U.esc(label) + '">' +
            '<span class="task-ico">' + global.SchedIcons.svg(task.icon) + '</span>' +
            '<span class="task-text">' +
            '<span class="task-title">' + U.esc(task.title) + '</span>' +
            '<span class="task-time">' + U.esc(range) + '</span>' +
            (showNote ? '<span class="task-note">' + U.esc(task.note) + '</span>' : '') +
            '</span>' +
            '</button>';
    }

    function dayColumnMarkup(day) {
        var items = layoutDay(day);
        var nowMinutes = U.nowMinutes();
        var nowLine = '';

        if (isToday(day)) {
            nowLine = '<div class="now-line" style="top:' + (nowMinutes * pxPerMin()).toFixed(2) + 'px" aria-hidden="true"></div>';
        }

        return '<div class="day-col' + (isToday(day) ? ' is-today' : '') + '" data-day="' + day + '">' +
            nowLine +
            items.map(function (item) {
                return taskMarkup(item, day);
            }).join('') +
            '</div>';
    }

    function plannedForDay(day) {
        return S.tasksForDay(day).reduce(function (total, task) {
            return total + task.duration;
        }, 0);
    }

    function timelineMarkup(days) {
        var ppm = pxPerMin();
        var height = bodyHeight();
        var inc = incMinutes();
        var labelStep = inc;
        var clock = settings().clock;
        var labels = [];

        for (var minute = 0; minute < U.MIN_PER_DAY; minute += labelStep) {
            labels.push('<span class="time-label' + (minute % 60 === 0 ? ' is-major' : '') + '"' +
                ' style="top:' + (minute * ppm).toFixed(2) + 'px">' +
                U.esc(U.formatAxisTime(minute, clock)) +
                '</span>');
        }

        var heads = days.map(function (day) {
            var planned = plannedForDay(day);
            return '<div class="day-head' + (isToday(day) ? ' is-today' : '') + '" data-day="' + day + '">' +
                '<span class="day-name">' + U.esc(I.dayName(day)) + '</span>' +
                '<span class="day-meta">' + (planned ? U.esc(I.duration(planned)) : '—') + '</span>' +
                '</div>';
        }).join('');

        var minWidth = days.length <= 1 ? '100%' : 'calc(' + GUTTER + 'px + ' + (days.length * MIN_COL_WIDTH) + 'px)';

        return '<div class="grid-scroll" tabindex="-1">' +
            '<div class="grid-inner" style="min-width:' + minWidth + '">' +
            '<div class="grid-head">' +
            '<div class="head-gutter">' + global.SchedIcons.svg('clock') + '</div>' +
            '<div class="day-heads" style="--cols:' + days.length + '">' + heads + '</div>' +
            '</div>' +
            '<div class="grid-body">' +
            '<div class="time-gutter" style="--body-h:' + height + 'px">' + labels.join('') + '</div>' +
            '<div class="cols" style="--cols:' + days.length + ';--body-h:' + height + 'px">' +
            days.map(dayColumnMarkup).join('') +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>';
    }

    function dayTabsMarkup() {
        var days = U.dayOrder(settings().weekStart);
        var active = S.state.ui.activeDay;
        if (!settings().showWeekend) {
            days = days.filter(function (day) {
                return day !== 0 && day !== 6;
            });
            if (days.indexOf(active) === -1) {
                S.state.ui.activeDay = active = days[0];
            }
        }
        return '<div class="day-tabs" role="group" aria-label="' + U.esc(I.t('daysLabel')) + '">' +
            days.map(function (day) {
                return '<button type="button" class="day-tab" data-day="' + day + '" aria-pressed="' +
                    (day === active ? 'true' : 'false') + '">' + U.esc(I.dayShort(day)) + '</button>';
            }).join('') +
            '</div>';
    }

    /* -------------------------------------------------------------- month */

    function parseCursor() {
        var cursor = S.state.ui.monthCursor || S.monthKey();
        var parts = cursor.split('-');
        return { year: Number(parts[0]), month: Number(parts[1]) - 1 };
    }

    function monthMarkup() {
        var cursor = parseCursor();
        var weekStart = settings().weekStart;
        var clock = settings().clock;
        var order = U.dayOrder(weekStart);
        var visible = settings().showWeekend ? order : order.filter(function (day) {
            return day !== 0 && day !== 6;
        });

        var first = new Date(cursor.year, cursor.month, 1);
        var lead = (first.getDay() - weekStart + 7) % 7;
        var gridStart = new Date(cursor.year, cursor.month, 1 - lead);
        var todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        var headers = visible.map(function (day) {
            return '<div class="month-weekday">' + U.esc(I.dayShort(day)) + '</div>';
        }).join('');

        var cells = [];
        for (var i = 0; i < 42; i++) {
            var date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
            var weekday = date.getDay();
            if (visible.indexOf(weekday) === -1) {
                continue;
            }
            var inMonth = date.getMonth() === cursor.month;
            var isTodayCell = date.getTime() === todayDate.getTime();
            var isWeekend = weekday === 0 || weekday === 6;
            var tasks = S.tasksForDay(weekday);
            var maxChips = 3;

            var chips = tasks.slice(0, maxChips).map(function (task) {
                var color = task.color;
                var style = '--chip-color:' + color + ';--chip-bg:' + U.rgba(color, 0.16);
                return '<button type="button" class="chip" data-id="' + U.esc(task.id) + '"' +
                    ' data-day="' + weekday + '" style="' + style + '"' +
                    ' title="' + U.esc(task.title + ' · ' + U.formatRange(task.start, task.start + task.duration, clock)) + '">' +
                    '<span class="chip-time">' + U.esc(U.formatTime(task.start, clock)) + '</span>' +
                    '<span class="chip-title">' + U.esc(task.title) + '</span>' +
                    '</button>';
            }).join('');

            var more = tasks.length > maxChips
                ? '<span class="chip-more">' + U.esc(I.t('moreCount', { n: tasks.length - maxChips })) + '</span>'
                : '';

            var classes = ['month-cell'];
            if (!inMonth) {
                classes.push('is-out');
            }
            if (isTodayCell) {
                classes.push('is-today');
            }
            if (isWeekend) {
                classes.push('is-weekend');
            }

            cells.push('<div class="' + classes.join(' ') + '" data-day="' + weekday + '" data-date="' +
                date.getFullYear() + '-' + U.pad2(date.getMonth() + 1) + '-' + U.pad2(date.getDate()) + '"' +
                ' role="group" aria-label="' + U.esc(I.dayName(weekday) + ' ' + date.getDate() + ' ' + I.monthName(date.getMonth())) + '">' +
                '<span class="month-date">' + date.getDate() + '</span>' +
                '<div class="month-chips">' + chips + more + '</div>' +
                '</div>');
        }

        return '<div class="month-wrap" style="--cols:' + visible.length + '">' +
            '<div class="month-toolbar">' +
            '<h2 class="month-title">' + U.esc(I.monthName(cursor.month)) + ' ' + cursor.year + '</h2>' +
            '<div class="month-nav">' +
            '<button type="button" class="icon-btn" data-month="prev" aria-label="' + U.esc(I.t('monthNavPrev')) + '" title="' + U.esc(I.t('monthNavPrev')) + '">' +
            global.SchedIcons.svg('chevron-left') + '</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-month="today">' + U.esc(I.t('monthNavToday')) + '</button>' +
            '<button type="button" class="icon-btn" data-month="next" aria-label="' + U.esc(I.t('monthNavNext')) + '" title="' + U.esc(I.t('monthNavNext')) + '">' +
            global.SchedIcons.svg('chevron-right') + '</button>' +
            '</div>' +
            '</div>' +
            '<div class="month-weekdays">' + headers + '</div>' +
            '<div class="month-grid">' + cells.join('') + '</div>' +
            '</div>';
    }

    /* ------------------------------------------------------------- render */

    function currentScroll() {
        return scrollEl ? { top: scrollEl.scrollTop, left: scrollEl.scrollLeft } : { top: 0, left: 0 };
    }

    function initialScrollTop() {
        var earliest = U.MIN_PER_DAY;
        S.state.tasks.forEach(function (task) {
            earliest = Math.min(earliest, task.start);
        });
        var target = earliest < U.MIN_PER_DAY ? Math.max(0, earliest - 60) : 7 * 60;
        return target * pxPerMin();
    }

    function render() {
        if (!root) {
            return;
        }
        var previous = currentScroll();
        if (scrollEl) {
            timelineScroll = previous;
        }
        var view = settings().view;
        var html;

        if (view === 'month') {
            html = monthMarkup();
            root.classList.add('is-month');
        } else {
            var days;
            if (view === 'day') {
                days = [S.state.ui.activeDay];
                var allowed = settings().showWeekend ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
                if (allowed.indexOf(days[0]) === -1) {
                    days = [allowed[0]];
                    S.state.ui.activeDay = allowed[0];
                }
            } else {
                days = visibleDays();
            }
            if (!days.length) {
                days = [S.state.ui.activeDay];
            }
            html = (view === 'day' ? dayTabsMarkup() : '') + timelineMarkup(days);
            root.classList.remove('is-month');
        }

        root.innerHTML = html;
        scrollEl = root.querySelector('.grid-scroll');

        if (scrollEl) {
            var target = didInitialScroll ? timelineScroll.top : initialScrollTop();
            scrollEl.scrollTop = target;
            scrollEl.scrollLeft = timelineScroll.left;
            didInitialScroll = true;
        }

        root.style.setProperty('--ppm', String(pxPerMin()));
        root.style.setProperty('--inc-min', String(incMinutes()));
        root.style.setProperty('--view-h', Math.round(settings().minHours * 60 * pxPerMin()) + 'px');
        root.setAttribute('data-inc', String(incMinutes()));
    }

    /** Reposition the "now" marker without a full re-render. */
    function tick() {
        if (!root) {
            return;
        }
        var lines = U.each('.now-line', root);
        var top = (U.nowMinutes() * pxPerMin()).toFixed(2) + 'px';
        lines.forEach(function (line) {
            line.style.top = top;
        });
    }

    /* -------------------------------------------------------- interactions */

    function minutesFromEvent(column, clientY) {
        var rect = column.getBoundingClientRect();
        return U.clamp((clientY - rect.top) / pxPerMin(), 0, U.MIN_PER_DAY - 1);
    }

    function slotFromEvent(column, clientY) {
        var minutes = minutesFromEvent(column, clientY);
        return U.clamp(Math.floor(minutes / 30) * 30, 0, U.MIN_PER_DAY - 30);
    }

    function newTask(day, start, duration) {
        var maxDuration = U.MIN_PER_DAY - start;
        var dur = U.clamp(duration || 60, 30, maxDuration);
        U.bus.emit('task:new', { day: day, start: start, duration: dur });
    }

    function defaultDuration(start) {
        return Math.min(60, U.MIN_PER_DAY - start);
    }

    function updateGhost(dragState) {
        if (!dragState.ghost) {
            return;
        }
        var ppm = pxPerMin();
        var lowSlot = Math.min(dragState.anchor, dragState.current);
        var highSlot = Math.max(dragState.anchor, dragState.current);
        var start = lowSlot;
        var end = Math.min(highSlot + 30, U.MIN_PER_DAY);
        dragState.range = { start: start, end: end };

        dragState.ghost.style.top = (start * ppm + 1).toFixed(2) + 'px';
        dragState.ghost.style.height = Math.max((end - start) * ppm - 3, 16).toFixed(2) + 'px';
        dragState.ghost.textContent = U.formatRange(start, end, settings().clock);
    }

    function onDragMove(event) {
        if (!drag || event.pointerId !== drag.pointerId) {
            return;
        }
        if (Math.abs(event.clientY - drag.startY) > 4) {
            drag.moved = true;
        }
        var slot = slotFromEvent(drag.column, event.clientY);
        if (slot !== drag.current) {
            drag.current = slot;
            updateGhost(drag);
        }
        if (drag.moved && event.cancelable) {
            event.preventDefault();
        }
    }

    function endDrag(event) {
        if (!drag) {
            return;
        }
        if (event && event.pointerId !== undefined && event.pointerId !== drag.pointerId) {
            return;
        }
        var dragState = drag;
        drag = null;
        global.removeEventListener('pointermove', onDragMove);
        global.removeEventListener('pointerup', endDrag);
        global.removeEventListener('pointercancel', cancelDrag);

        if (dragState.ghost && dragState.ghost.parentNode) {
            dragState.ghost.parentNode.removeChild(dragState.ghost);
        }

        if (!dragState.moved || !dragState.range) {
            newTask(dragState.day, dragState.anchor, defaultDuration(dragState.anchor));
            return;
        }
        newTask(dragState.day, dragState.range.start, dragState.range.end - dragState.range.start);
    }

    function cancelDrag() {
        if (!drag) {
            return;
        }
        if (drag.ghost && drag.ghost.parentNode) {
            drag.ghost.parentNode.removeChild(drag.ghost);
        }
        drag = null;
        global.removeEventListener('pointermove', onDragMove);
        global.removeEventListener('pointerup', endDrag);
        global.removeEventListener('pointercancel', cancelDrag);
    }

    function onPointerDown(event) {
        if (event.button !== 0) {
            return;
        }
        lastPointerType = event.pointerType || 'mouse';
        if (lastPointerType !== 'mouse' && lastPointerType !== 'pen') {
            return;
        }
        if (event.target.closest('.task') || event.target.closest('.day-tabs') || event.target.closest('.month-wrap')) {
            return;
        }
        var column = event.target.closest('.day-col');
        if (!column || !root.contains(column)) {
            return;
        }

        var slot = slotFromEvent(column, event.clientY);
        var ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        column.appendChild(ghost);

        drag = {
            column: column,
            day: Number(column.getAttribute('data-day')),
            anchor: slot,
            current: slot,
            startY: event.clientY,
            moved: false,
            pointerId: event.pointerId,
            ghost: ghost,
            range: null
        };
        updateGhost(drag);

        global.addEventListener('pointermove', onDragMove);
        global.addEventListener('pointerup', endDrag);
        global.addEventListener('pointercancel', cancelDrag);
        event.preventDefault();
    }

    function monthDelta(delta) {
        var cursor = parseCursor();
        var date = new Date(cursor.year, cursor.month + delta, 1);
        S.setUi({ monthCursor: date.getFullYear() + '-' + U.pad2(date.getMonth() + 1) });
    }

    function onClick(event) {
        var taskButton = event.target.closest('.task');
        if (taskButton && root.contains(taskButton)) {
            U.bus.emit('task:open', {
                id: taskButton.getAttribute('data-id'),
                day: Number(taskButton.getAttribute('data-day'))
            });
            return;
        }

        var chip = event.target.closest('.chip');
        if (chip && root.contains(chip)) {
            U.bus.emit('task:open', {
                id: chip.getAttribute('data-id'),
                day: Number(chip.getAttribute('data-day'))
            });
            return;
        }

        var tab = event.target.closest('.day-tab');
        if (tab) {
            S.setUi({ activeDay: Number(tab.getAttribute('data-day')) });
            return;
        }

        var monthButton = event.target.closest('[data-month]');
        if (monthButton) {
            var dir = monthButton.getAttribute('data-month');
            if (dir === 'today') {
                S.setUi({ monthCursor: S.monthKey(new Date()) });
            } else {
                monthDelta(dir === 'next' ? 1 : -1);
            }
            return;
        }

        var cell = event.target.closest('.month-cell');
        if (cell) {
            var day = Number(cell.getAttribute('data-day'));
            newTask(day, 9 * 60, 60);
            return;
        }

        if (lastPointerType === 'mouse' || lastPointerType === 'pen') {
            return;
        }

        var column = event.target.closest('.day-col');
        if (column && root.contains(column)) {
            var start = slotFromEvent(column, event.clientY);
            newTask(Number(column.getAttribute('data-day')), start, defaultDuration(start));
        }
    }

    function mount(container) {
        root = container;
        if (!root) {
            return;
        }
        root.addEventListener('pointerdown', onPointerDown);
        root.addEventListener('click', onClick);
        render();
    }

    global.SSGrid = {
        mount: mount,
        render: render,
        tick: tick,
        pxPerMin: pxPerMin,
        visibleDays: visibleDays,
        isToday: isToday
    };
})(window);
