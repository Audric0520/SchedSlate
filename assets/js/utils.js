/* SchedSlate — shared helpers (time math, colour math, DOM + event bus) */
(function (global) {
    'use strict';

    var MIN_PER_DAY = 1440;
    var bus = new EventTarget();

    function pad2(n) {
        return (n < 10 ? '0' : '') + n;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function uid(prefix) {
        return (prefix || 't') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    /* ------------------------------------------------------------- time */

    function normaliseMinutes(minutes) {
        var m = Math.round(Number(minutes) || 0);
        m = m % MIN_PER_DAY;
        return m < 0 ? m + MIN_PER_DAY : m;
    }

    function formatTime(minutes, clock) {
        var m = normaliseMinutes(minutes);
        var h = Math.floor(m / 60);
        var mm = m % 60;
        if (clock === '12h') {
            var suffix = h < 12 ? 'AM' : 'PM';
            var h12 = h % 12 === 0 ? 12 : h % 12;
            return h12 + ':' + pad2(mm) + ' ' + suffix;
        }
        return pad2(h) + ':' + pad2(mm);
    }

    /** Short axis label: "8 AM" / "08:00" on the hour, otherwise full time. */
    function formatAxisTime(minutes, clock) {
        var m = normaliseMinutes(minutes);
        if (clock === '12h' && m % 60 === 0) {
            var h = m / 60;
            return (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? ' AM' : ' PM');
        }
        return formatTime(m, clock);
    }

    function formatRange(start, end, clock) {
        return formatTime(start, clock) + ' – ' + formatTime(end, clock);
    }

    function durationParts(minutes) {
        var total = Math.max(0, Math.round(minutes));
        return { hours: Math.floor(total / 60), minutes: total % 60 };
    }

    function snap(minutes, step) {
        var s = step || 30;
        return Math.round(minutes / s) * s;
    }

    /* --------------------------------------------------------------- dom */

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function each(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    }

    /* ------------------------------------------------------------- dates */

    function dayOrder(weekStart) {
        var start = weekStart === 0 ? 0 : 1;
        var out = [];
        for (var i = 0; i < 7; i++) {
            out.push((start + i) % 7);
        }
        return out;
    }

    function todayIndex() {
        return new Date().getDay();
    }

    function nowMinutes() {
        var d = new Date();
        return d.getHours() * 60 + d.getMinutes();
    }

    /* --------------------------------------------------------------- bus */

    var busApi = {
        on: function (type, handler) {
            bus.addEventListener(type, function (event) {
                handler(event.detail);
            });
        },
        emit: function (type, detail) {
            bus.dispatchEvent(new CustomEvent(type, { detail: detail }));
        }
    };

    global.SSUtil = {
        MIN_PER_DAY: MIN_PER_DAY,
        clamp: clamp,
        uid: uid,
        normaliseMinutes: normaliseMinutes,
        formatTime: formatTime,
        formatAxisTime: formatAxisTime,
        formatRange: formatRange,
        durationParts: durationParts,
        snap: snap,
        esc: esc,
        each: each,
        dayOrder: dayOrder,
        todayIndex: todayIndex,
        nowMinutes: nowMinutes,
        bus: busApi
    };
})(window);
