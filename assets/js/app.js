/* SchedSlate — bootstrap, toolbar, inline title editing and shortcuts */
(function (global) {
    'use strict';

    var U = global.SSUtil;
    var S = global.SSStore;
    var I = global.SSI18n;
    var Grid = global.SSGrid;
    var Modals = global.SSModals;

    var dom = {};
    var lastLang = null;
    var DEFAULT_TITLES = ['My Schedule', 'Mein Zeitplan'];

    function hydrateIcons(root) {
        U.each('[data-icon]', root || document).forEach(function (node) {
            if (node.dataset.hydrated === 'true') {
                return;
            }
            node.innerHTML = global.SchedIcons.svg(node.getAttribute('data-icon'));
            node.dataset.hydrated = 'true';
        });
    }

    /* --------------------------------------------------------------- chrome */

    function renderEyebrow() {
        var now = new Date();
        if (!dom.eyebrow) {
            return;
        }
        dom.eyebrow.textContent = I.t('todayLabel') + ' · ' + I.t('dateEyebrow', {
            weekday: I.dayShort(now.getDay()),
            month: I.monthShort(now.getMonth()),
            day: now.getDate()
        });
    }

    function renderStats() {
        var blocks = S.countBlocks();
        var minutes = S.totalPlannedMinutes();
        var hours = Math.round((minutes / 60) * 10) / 10;
        var hoursLabel = I.t('hoursShort', { n: hours });

        dom.stats.innerHTML = '' +
            '<div class="stat">' +
            '<span class="stat-value">' + blocks + '</span>' +
            '<span class="stat-label">' + U.esc(I.t('statBlocks')) + '</span>' +
            '</div>' +
            '<div class="stat">' +
            '<span class="stat-value">' + U.esc(hoursLabel) + '</span>' +
            '<span class="stat-label">' + U.esc(I.t('statPlanned')) + '</span>' +
            '</div>';
    }

    function renderTitle() {
        var title = S.state.title;
        if (dom.title && dom.title.textContent !== title) {
            dom.title.textContent = title;
        }
        document.title = title + ' · SchedSlate';
    }

    function renderHint() {
        if (!dom.emptyHint) {
            return;
        }
        dom.emptyHint.hidden = S.state.tasks.length > 0;
    }

    function renderAll() {
        renderTitle();
        renderEyebrow();
        renderStats();
        renderHint();
        Grid.render();
    }

    /* ----------------------------------------------------------- title edit */

    function setupTitle() {
        var el = dom.title;
        var before = '';

        el.addEventListener('focus', function () {
            before = S.state.title;
            if (dom.titleHint) {
                dom.titleHint.classList.add('is-hidden');
            }
        });

        el.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                el.blur();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                el.textContent = before || S.state.title;
                el.blur();
            }
        });

        el.addEventListener('input', function () {
            var text = el.textContent.replace(/\n/g, ' ');
            if (text.length > 80) {
                el.textContent = text.slice(0, 80);
                var range = document.createRange();
                range.selectNodeContents(el);
                range.collapse(false);
                var selection = global.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });

        el.addEventListener('paste', function (event) {
            event.preventDefault();
            var text = (event.clipboardData || global.clipboardData).getData('text').replace(/[\r\n]+/g, ' ');
            document.execCommand('insertText', false, text);
        });

        el.addEventListener('blur', function () {
            var next = el.textContent.replace(/\s+/g, ' ').trim().slice(0, 80);
            if (!next) {
                next = S.state.title;
            }
            el.textContent = next;
            if (next !== S.state.title) {
                S.setTitle(next);
            }
            if (dom.titleHint) {
                dom.titleHint.classList.remove('is-hidden');
            }
        });
    }

    /* ---------------------------------------------------------- interaction */

    function openNewTask(prefill) {
        Modals.openTaskModal(prefill || {});
    }

    function setupToolbar() {
        document.getElementById('btn-add').addEventListener('click', function () {
            openNewTask({});
        });

        document.getElementById('btn-settings').addEventListener('click', function () {
            Modals.openSettings();
        });

        document.getElementById('btn-sample').addEventListener('click', function () {
            S.seedSample();
            Modals.toast(I.t('toastSample'));
        });
    }

    function isTypingTarget(target) {
        if (!target) {
            return false;
        }
        var tag = target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    }

    function setupShortcuts() {
        document.addEventListener('keydown', function (event) {
            if (event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }
            if (Modals.isOpen && Modals.isOpen()) {
                return;
            }
            var key = event.key.toLowerCase();

            if (key === 'n' && !isTypingTarget(event.target)) {
                event.preventDefault();
                openNewTask({});
                return;
            }

        });
    }

    /* ---------------------------------------------------------------- state */

    function handleState(state, reason) {
        I.apply(document);
        hydrateIcons();

        if (lastLang && lastLang !== state.settings.language &&
            DEFAULT_TITLES.indexOf(state.title) !== -1) {
            var nextDefault = I.t('defaultTitle');
            if (nextDefault && nextDefault !== state.title) {
                S.setTitle(nextDefault);
                return;
            }
        }
        lastLang = state.settings.language;

        renderAll();
    }

    function init() {
        dom.stats = document.getElementById('board-stats');
        dom.eyebrow = document.getElementById('eyebrow');
        dom.title = document.getElementById('schedule-title');
        dom.titleHint = document.getElementById('title-hint');
        dom.emptyHint = document.getElementById('empty-hint');

        S.load();
        lastLang = S.state.settings.language;
        I.apply(document);
        hydrateIcons();

        Grid.mount(document.getElementById('grid-root'));
        Modals.init();

        setupTitle();
        setupToolbar();
        setupShortcuts();

        U.bus.on('task:new', function (detail) {
            openNewTask(detail);
        });
        U.bus.on('task:open', function (detail) {
            if (detail && detail.id) {
                Modals.openTaskModal({ id: detail.id, day: detail.day });
            }
        });

        S.subscribe(handleState);
        renderAll();
        renderTitle();

        global.setInterval(Grid.tick, 60 * 1000);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') {
                Grid.tick();
            }
        });

        /* cross-tab sync is handled by the store, which notifies every subscriber */
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    global.SSApp = {
        renderAll: renderAll,
        openNewTask: openNewTask
    };
})(window);
