/*! SchedSlate — icon geometry from Lucide (v1.73.0, ISC License).
 *  https://lucide.dev — see THIRD_PARTY.md for the license text. */
(function (global) {
  'use strict';

  var ICONS = {
  'plus': '<path d="M5 12h14" /> <path d="M12 5v14" />',
  'settings-2': '<path d="M14 17H5" /> <path d="M19 7h-9" /> <circle cx="17" cy="17" r="3" /> <circle cx="7" cy="7" r="3" />',
  'pencil': '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /> <path d="m15 5 4 4" />',
  'circle-check': '<circle cx="12" cy="12" r="10" /> <path d="m16 9-5.5 5.5L8 12" />',
  'sparkles': '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /> <path d="M20 2v4" /> <path d="M22 4h-4" /> <circle cx="4" cy="20" r="2" />',
  'x': '<path d="M18 6 6 18" /> <path d="m6 6 12 12" />',
  'check': '<path d="M20 6 9 17l-5-5" />',
  'clock': '<circle cx="12" cy="12" r="10" /> <path d="M12 6v6l4 2" />',
  'chevron-down': '<path d="m6 9 6 6 6-6" />',
  'trash-2': '<path d="M10 11v6" /> <path d="M14 11v6" /> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /> <path d="M3 6h18" /> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" />',
  'circle-dot': '<circle cx="12" cy="12" r="1" /> <circle cx="12" cy="12" r="10" />'
  };

  /** Returns the inner SVG markup for an icon name. */
  function iconBody(name) {
    return ICONS[name] || ICONS['circle-dot'];
  }

  /** Builds a full inline SVG string. */
  function svg(name, attrs) {
    var extra = attrs ? ' ' + attrs : '';
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"' + extra + '>' + iconBody(name) + '</svg>';
  }

  global.SchedIcons = { list: Object.keys(ICONS), body: iconBody, svg: svg };
})(window);
