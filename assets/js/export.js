/* SchedSlate — save the current schedule as a high-resolution PNG.
 *
 *  The capture never touches the app window: a dedicated #export-root container
 *  (schedule header + timetable only) is rendered into an off-screen stage, the
 *  grid scroll box is unclamped so the whole 00:00–23:30 day is included, and
 *  html-to-image rasterises just that node at 2x. The stage is removed again as
 *  soon as the download is triggered, so the page never flickers. */
(function (global) {
    'use strict';

    var S = global.SSStore;
    var U = global.SSUtil;
    var I = global.SSI18n;

    /* A fixed desktop layout keeps exports crisp and identical on phones: the
       app only has the weekly view, so 1280px is the right canvas width. */
    var EXPORT_WIDTH = 1280;
    var EXPORT_BG = '#0f172a';
    /* 2x is sharp on high-DPI screens and stays well inside the per-canvas
       limits older Safari builds enforce. */
    var PIXEL_RATIO = 2;
    var running = false;

    /* Nothing matching these ever belongs in the saved image. The container is
       already built from the grid alone; this filter is a second safety net. */
    var CHROME_SELECTORS = [
        '.topbar', '.brand', '.topbar-actions', '.board-stats', '.stat',
        '.btn', '.btn-save', '.icon-btn', '.hint-bar', '.board-foot',
        '.toast', '.toasts', '.layer', '.modal', '.drawer', '.skip-link',
        '.drag-ghost', '.now-line', '[data-export-hide]'
    ];

    function t(key) {
        return I.t(key);
    }

    function button() {
        return document.getElementById('btn-save');
    }

    function scheduleTitle() {
        return String(S.state.title || '').trim();
    }

    /** "Fall Semester" → "fall-semester.png"; empty/odd titles → "schedule.png". */
    function fileName() {
        var slug = scheduleTitle()
            .toLowerCase()
            .replace(/['\u2019\u2018"]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 64)
            .replace(/-+$/g, '');
        return (slug || 'schedule') + '.png';
    }

    /** Text-only summary ("17 blocks · 20.5 h planned") — no pill-shaped UI. */
    function statsLine() {
        var stats = document.getElementById('board-stats');
        if (!stats) {
            return '';
        }
        var parts = [];
        U.each('.stat', stats).forEach(function (stat) {
            var words = U.each('.stat-value, .stat-label', stat).map(function (node) {
                return String(node.textContent || '').trim();
            }).filter(Boolean);
            var text = words.length ? words.join(' ') : String(stat.textContent || '').trim();
            if (text) {
                parts.push(text);
            }
        });
        return parts.join(' · ');
    }

    function headNode() {
        var eyebrow = document.getElementById('eyebrow');
        var head = document.createElement('header');
        head.className = 'export-head';
        head.innerHTML = '' +
            '<div class="export-titles">' +
            '<p class="export-eyebrow">' + U.esc(eyebrow ? eyebrow.textContent : '') + '</p>' +
            '<h1 class="export-title">' + U.esc(scheduleTitle() || I.t('defaultTitle')) + '</h1>' +
            '<p class="export-meta">' + U.esc(statsLine()) + '</p>' +
            '</div>';
        return head;
    }

    /**
     * Unclamps the cloned grid: no scroll viewport, no sticky offsets, no
     * ghosts, and no <button> cards (so no focus ring or UA chrome can appear).
     */
    function normaliseGrid(clone) {
        clone.removeAttribute('id');

        U.each('.grid-scroll', clone).forEach(function (node) {
            node.style.height = 'auto';
            node.style.maxHeight = 'none';
            node.style.overflow = 'visible';
            node.style.scrollbarWidth = 'none';
            node.style.overscrollBehavior = 'auto';
            node.removeAttribute('tabindex');
        });

        U.each('.grid-head, .head-gutter, .time-gutter', clone).forEach(function (node) {
            node.style.position = 'static';
            node.style.zIndex = 'auto';
        });

        U.each('.drag-ghost', clone).forEach(function (node) {
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
        });

        U.each('.task', clone).forEach(function (node) {
            var card = document.createElement('div');
            Array.prototype.forEach.call(node.attributes, function (attr) {
                if (attr.name === 'type' || attr.name === 'title' || attr.name === 'aria-label') {
                    return;
                }
                card.setAttribute(attr.name, attr.value);
            });
            card.style.cursor = 'default';
            while (node.firstChild) {
                card.appendChild(node.firstChild);
            }
            node.parentNode.replaceChild(card, node);
        });

        return clone;
    }

    /** Dedicated container: schedule header + full timetable, nothing else. */
    function buildExportRoot() {
        var grid = document.getElementById('grid-root');
        if (!grid) {
            return null;
        }

        var root = document.createElement('div');
        root.id = 'export-root';
        root.className = 'export-canvas is-exporting';
        root.setAttribute('role', 'presentation');
        root.style.width = EXPORT_WIDTH + 'px';

        root.appendChild(headNode());
        root.appendChild(normaliseGrid(grid.cloneNode(true)));
        return root;
    }

    /** Off-screen stage: `position: fixed` far to the left, no layout flicker. */
    function mount(root) {
        var stage = document.createElement('div');
        stage.className = 'export-stage';
        stage.setAttribute('aria-hidden', 'true');
        stage.style.cssText = 'position:fixed;top:0;left:-9999px;z-index:-1;pointer-events:none;';
        stage.appendChild(root);
        document.body.appendChild(stage);
        return stage;
    }

    function unmount(stage) {
        if (stage && stage.parentNode) {
            stage.parentNode.removeChild(stage);
        }
    }

    function fontsReady() {
        if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
            return document.fonts.ready.catch(function () {});
        }
        return Promise.resolve();
    }

    function nextFrame() {
        return new Promise(function (resolve) {
            if (typeof global.requestAnimationFrame !== 'function') {
                resolve();
                return;
            }
            global.requestAnimationFrame(function () {
                global.requestAnimationFrame(resolve);
            });
        });
    }

    /** Natural height of the fully expanded canvas (never the clipped viewport). */
    function canvasHeight(root) {
        var rect = root.getBoundingClientRect();
        var height = rect && rect.height ? rect.height : (root.offsetHeight || root.scrollHeight || 0);
        return Math.max(1, Math.ceil(height));
    }

    function captureOptions(root) {
        return {
            pixelRatio: PIXEL_RATIO,
            backgroundColor: EXPORT_BG,
            width: EXPORT_WIDTH,
            height: canvasHeight(root),
            cacheBust: false,
            filter: function (node) {
                if (!node || node.nodeType !== 1 || !node.matches) {
                    return true;
                }
                return !CHROME_SELECTORS.some(function (selector) {
                    return node.matches(selector);
                });
            }
        };
    }

    /**
     * Renders the isolated canvas. Resolves with { blob } (preferred) or
     * { dataUrl }, and always tears the off-screen stage down again.
     */
    function render() {
        var lib = global.htmlToImage;
        if (!lib) {
            return Promise.reject(new Error('html-to-image is not loaded'));
        }

        var root = buildExportRoot();
        if (!root) {
            return Promise.reject(new Error('grid is not mounted'));
        }

        var stage = null;

        try {
            stage = mount(root);
        } catch (error) {
            unmount(stage);
            return Promise.reject(error);
        }

        function cleanup() {
            unmount(stage);
        }

        var options = captureOptions(root);

        return fontsReady()
            .then(nextFrame)
            .then(function () {
                /* the canvas can reflow once webfonts land, so measure again */
                options.height = canvasHeight(root);
                return lib.toBlob(root, options).then(function (blob) {
                    if (blob) {
                        return { blob: blob };
                    }
                    return lib.toPng(root, options).then(function (dataUrl) {
                        return { dataUrl: dataUrl };
                    });
                });
            })
            .then(function (result) {
                cleanup();
                return result;
            }, function (error) {
                cleanup();
                throw error;
            });
    }

    function download(href, revoke) {
        var link = document.createElement('a');
        link.href = href;
        link.download = fileName();
        link.rel = 'noopener';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        global.setTimeout(function () {
            if (link.parentNode) {
                link.parentNode.removeChild(link);
            }
            if (revoke) {
                URL.revokeObjectURL(href);
            }
        }, 4000);
    }

    function setBusy(busy) {
        var btn = button();
        if (!btn) {
            return;
        }
        var label = btn.querySelector('[data-save-label]');
        btn.disabled = busy;
        btn.classList.toggle('is-busy', busy);
        btn.setAttribute('aria-busy', busy ? 'true' : 'false');
        if (label) {
            label.textContent = busy ? t('saveBusy') : t('save');
        }
    }

    function toast(message) {
        if (global.SSModals && typeof global.SSModals.toast === 'function') {
            global.SSModals.toast(message);
        }
    }

    /** Entry point: build the PNG, hand it to the browser, then report back. */
    function save() {
        if (running) {
            return Promise.resolve(null);
        }
        if (!global.htmlToImage) {
            toast(t('saveFailed'));
            return Promise.resolve(null);
        }

        running = true;
        setBusy(true);

        return render().then(function (result) {
            if (result.blob) {
                download(URL.createObjectURL(result.blob), true);
            } else if (result.dataUrl) {
                download(result.dataUrl, false);
            }
            toast(t('savedPng'));
            return result;
        }).catch(function (error) {
            if (global.console && global.console.warn) {
                global.console.warn('[SchedSlate] PNG export failed', error);
            }
            toast(t('saveFailed'));
            return null;
        }).then(function (result) {
            running = false;
            setBusy(false);
            return result;
        });
    }

    function init() {
        var btn = button();
        if (!btn) {
            return;
        }
        btn.addEventListener('click', function () {
            save();
        });
        if (!global.htmlToImage) {
            btn.disabled = true;
            btn.classList.add('is-unavailable');
        }
    }

    global.SSExport = {
        init: init,
        save: save,
        fileName: fileName,
        isBusy: function () {
            return running;
        },
        /* internals exposed for the jsdom suite */
        _buildRoot: buildExportRoot,
        _render: render,
        _chromeSelectors: CHROME_SELECTORS,
        WIDTH: EXPORT_WIDTH,
        PIXEL_RATIO: PIXEL_RATIO
    };
})(window);
