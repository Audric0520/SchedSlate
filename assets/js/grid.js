/* SchedSlate — weekly schedule grid (24h × 30-minute slots) */
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
    var SLOT = 30;

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

    /** Greedy overlap layout: blocks that collide share the column width. */
    function layoutDay(day) {
        var tasks = S.tasksForDay(day);
        var clusters = [];
        var current = null;

        tasks.forEach(function (task) {
            var slot = S.occurrence(task, day);
            var item = { task: task, start: slot.start, end: slot.end };
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
        var top = item.start * ppm;
        var height = Math.max((item.end - item.start) * ppm - 3, 15);
        var cols = item.cols || 1;
        var col = item.col || 0;
        var tight = height < 38;
        var theme = S.themeOf(task);
        var range = U.formatRange(item.start, item.end, settings().clock);
        var style = [
            'top:' + top.toFixed(2) + 'px',
            'height:' + height.toFixed(2) + 'px',
            'left:calc(' + ((col / cols) * 100).toFixed(4) + '% + 2px)',
            'width:calc(' + (100 / cols).toFixed(4) + '% - 4px)'
        ].join(';');

        var showNote = !tight && height >= 62 && task.note;
        var label = task.title + ', ' + I.dayName(day) + ', ' + range;

        return '<button type="button" class="task' + (tight ? ' is-tight' : '') + '"' +
            ' data-id="' + U.esc(task.id) + '" data-day="' + day + '"' +
            ' data-theme="' + U.esc(theme.id) + '"' +
            ' style="' + style + '" title="' + U.esc(task.title + ' · ' + range) + '"' +
            ' aria-label="' + U.esc(label) + '">' +
            '<span class="task-accent accent-bar" aria-hidden="true"><i></i><i></i><i></i></span>' +
            '<span class="task-text">' +
            '<span class="task-title">' + U.esc(task.title) + '</span>' +
            '<span class="task-time">' + U.esc(range) + '</span>' +
            (showNote ? '<span class="task-note">' + U.esc(task.note) + '</span>' : '') +
            '</span>' +
            '</button>';
    }

    /** Solid 1px rules for every increment, heavier on the hour. */
    function gridLinesMarkup() {
        var ppm = pxPerMin();
        var inc = incMinutes();
        var lines = [];

        for (var minute = inc; minute < U.MIN_PER_DAY; minute += inc) {
            lines.push('<span class="grid-line' + (minute % 60 === 0 ? ' is-hour' : '') + '"' +
                ' style="top:' + (minute * ppm).toFixed(2) + 'px" aria-hidden="true"></span>');
        }
        return lines.join('');
    }

    function dayColumnMarkup(day) {
        var items = layoutDay(day);
        var nowLine = '';

        if (isToday(day)) {
            nowLine = '<div class="now-line" style="top:' + (U.nowMinutes() * pxPerMin()).toFixed(2) +
                'px" aria-hidden="true"></div>';
        }

        return '<div class="day-col' + (isToday(day) ? ' is-today' : '') + '" data-day="' + day + '">' +
            gridLinesMarkup() +
            nowLine +
            items.map(function (item) {
                return taskMarkup(item, day);
            }).join('') +
            '</div>';
    }

    function plannedForDay(day) {
        return S.tasksForDay(day).reduce(function (total, task) {
            return total + task.times[day].duration;
        }, 0);
    }

    function timelineMarkup(days) {
        var ppm = pxPerMin();
        var height = bodyHeight();
        var labelStep = incMinutes();
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

        return '<div class="grid-scroll" tabindex="-1">' +
            '<div class="grid-inner" style="min-width:calc(' + GUTTER + 'px + ' + (days.length * MIN_COL_WIDTH) + 'px)">' +
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

    /* ------------------------------------------------------------- render */

    function initialScrollTop() {
        var earliest = U.MIN_PER_DAY;
        S.state.tasks.forEach(function (task) {
            S.daysOf(task).forEach(function (day) {
                earliest = Math.min(earliest, task.times[day].start);
            });
        });
        var target = earliest < U.MIN_PER_DAY ? Math.max(0, earliest - 60) : 7 * 60;
        return target * pxPerMin();
    }

    function render() {
        if (!root) {
            return;
        }
        if (scrollEl) {
            timelineScroll = { top: scrollEl.scrollTop, left: scrollEl.scrollLeft };
        }

        root.innerHTML = timelineMarkup(visibleDays());
        scrollEl = root.querySelector('.grid-scroll');

        if (scrollEl) {
            scrollEl.scrollTop = didInitialScroll ? timelineScroll.top : initialScrollTop();
            scrollEl.scrollLeft = timelineScroll.left;
            didInitialScroll = true;
        }

        root.style.setProperty('--view-h', Math.round(settings().minHours * 60 * pxPerMin()) + 'px');
        root.setAttribute('data-inc', String(incMinutes()));
    }

    /** Reposition the "now" marker without a full re-render. */
    function tick() {
        if (!root) {
            return;
        }
        var top = (U.nowMinutes() * pxPerMin()).toFixed(2) + 'px';
        U.each('.now-line', root).forEach(function (line) {
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
        return U.clamp(Math.floor(minutes / SLOT) * SLOT, 0, U.MIN_PER_DAY - SLOT);
    }

    function newTask(day, start, duration) {
        var dur = U.clamp(duration || 60, SLOT, U.MIN_PER_DAY - start);
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
        var end = Math.min(highSlot + SLOT, U.MIN_PER_DAY);
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
        if (event.target.closest('.task')) {
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

    function onClick(event) {
        var taskButton = event.target.closest('.task');
        if (taskButton && root.contains(taskButton)) {
            U.bus.emit('task:open', {
                id: taskButton.getAttribute('data-id'),
                day: Number(taskButton.getAttribute('data-day'))
            });
            return;
        }

        /* touch devices: a tap (without drag) creates a one-hour block */
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
