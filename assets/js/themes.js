/* SchedSlate — curated dark-mode "Theme Inspirations" for schedule cards.
 *  Colours live in assets/styles.css under [data-theme="<id>"]; this module is the
 *  single source of truth for ids, labels, the default and legacy migration. */
(function (global) {
    'use strict';

    var THEMES = [
        { id: 'kamen-rider-ooo', name: 'Kamen Rider OOO' },
        { id: 'wednesday', name: 'Wednesday' },
        { id: 'gengar', name: 'Gengar' },
        { id: 'mobile-legends', name: 'Mobile Legends' }
    ];

    var DEFAULT_THEME = 'mobile-legends';

    /* Events saved before themes existed carry one of the old flat colours.
     * Map each to the closest curated theme instead of losing the distinction. */
    var LEGACY_COLORS = {
        '#7c8cff': 'mobile-legends',
        '#38bdf8': 'mobile-legends',
        '#2dd4bf': 'gengar',
        '#a3e635': 'kamen-rider-ooo',
        '#fbbf24': 'kamen-rider-ooo',
        '#fb923c': 'kamen-rider-ooo',
        '#fb7185': 'gengar',
        '#c084fc': 'gengar',
        '#94a3b8': 'wednesday'
    };

    var byId = {};
    THEMES.forEach(function (theme) {
        byId[theme.id] = theme;
    });

    function has(id) {
        return typeof id === 'string' && Object.prototype.hasOwnProperty.call(byId, id);
    }

    function get(id) {
        return has(id) ? byId[id] : byId[DEFAULT_THEME];
    }

    function fromLegacyColor(color) {
        return LEGACY_COLORS[String(color || '').toLowerCase()] || DEFAULT_THEME;
    }

    global.SSThemes = {
        list: THEMES,
        ids: THEMES.map(function (theme) {
            return theme.id;
        }),
        defaultTheme: DEFAULT_THEME,
        has: has,
        get: get,
        fromLegacyColor: fromLegacyColor
    };
})(window);
