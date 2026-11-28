/* SchedSlate — save the current schedule as a high-resolution PNG.
 *  Renders a clean, self-contained sheet (title + full grid) off-screen with
 *  html-to-image (vendored under assets/vendor) so scroll boundaries, hover
 *  states and toolbar chrome never reach the exported image. */
(function (global) {
    'use strict';

    var S = global.SSStore;
    var U = global.SSUtil;
    var I = global.SSI18n;

    /* A 2x ratio keeps text crisp while staying inside the per-canvas limits
       older Safari builds enforce (a 2x sheet is well under 16.7 megapixels). */
    var PIXEL_RATIO = 2;
    var MIN_WIDTH = 1080;
    var MAX_WIDTH = 1440;
    var running = false;

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

    function exportWidth() {
        var panel = document.querySelector('.sched-panel') || document.getElementById('grid-root');
        var width = panel ? panel.getBoundingClientRect().width : 0;
        return Math.round(U.clamp(width || MIN_WIDTH, MIN_WIDTH, MAX_WIDTH));
    }

    function headMarkup() {
        var eyebrow = document.getElementById('eyebrow');
        var stats = document.getElementById('board-stats');
        return '' +
            '<div class="export-head">' +
            '<div class="export-titles">' +
            '<p class="export-eyebrow">' + U.esc(eyebrow ? eyebrow.textContent : '') + '</p>' +
            '<h1 class="export-title">' + U.esc(scheduleTitle() || I.t('defaultTitle')) + '</h1>' +
            '</div>' +
            '<div class="export-stats">' + (stats ? stats.innerHTML : '') + '</div>' +
            '</div>';
    }

    /**
     * The live grid scrolls inside .grid-scroll and pins its head/gutter with
     * position: sticky. Both are neutralised on the clone so the PNG shows the
     * whole 24-hour range and no scroll furniture.
     */
    function normaliseGrid(clone) {
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

        /* Cards are <button>s in the live grid; swap them for inert divs so no UA
           button chrome (or focus ring) can leak into the static image. */
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

    /** Builds the off-screen capture sheet: header title + full expanded grid. */
    function buildSheet() {
        var panel = document.getElementById('grid-root');
        if (!panel) {
            return null;
        }

        var width = exportWidth();
        var sheet = document.createElement('div');
        sheet.className = 'export-sheet';
        sheet.setAttribute('aria-hidden', 'true');
        sheet.style.width = width + 'px';
        sheet.innerHTML = headMarkup();

        var clone = panel.cloneNode(true);
        clone.removeAttribute('id');
        sheet.appendChild(normaliseGrid(clone));

        return { sheet: sheet, width: width };
    }

    function mount(sheet) {
        var stage = document.createElement('div');
        stage.className = 'export-stage';
        stage.setAttribute('aria-hidden', 'true');
        stage.appendChild(sheet);
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

    /** Natural height of the fully expanded sheet (never the clipped viewport). */
    function sheetHeight(sheet) {
        var rect = sheet.getBoundingClientRect();
        var height = rect && rect.height ? rect.height : (sheet.offsetHeight || sheet.scrollHeight || 0);
        return Math.max(1, Math.ceil(height));
    }

    function background() {
        var value = global.getComputedStyle(document.documentElement).getPropertyValue('--bg');
        value = String(value || '').trim();
        return value || '#080b13';
    }

    /**
     * Renders the sheet. Resolves with { blob } (preferred) or { dataUrl } so the
     * caller can download without holding a multi-megabyte string around.
     */
    function render() {
        var lib = global.htmlToImage;
        if (!lib) {
            return Promise.reject(new Error('html-to-image is not loaded'));
        }

        var built = buildSheet();
        if (!built) {
            return Promise.reject(new Error('grid is not mounted'));
        }

        var stage = mount(built.sheet);

        var options = {
            pixelRatio: PIXEL_RATIO,
            cacheBust: false,
            backgroundColor: background(),
            width: built.width,
            height: sheetHeight(built.sheet)
        };

        return fontsReady()
            .then(nextFrame)
            .then(function () {
                /* the sheet can reflow once webfonts land, so measure again */
                options.height = sheetHeight(built.sheet);
                return lib.toBlob(built.sheet, options);
            })
            .then(function (blob) {
                if (blob) {
                    return { blob: blob };
                }
                return lib.toPng(built.sheet, options).then(function (dataUrl) {
                    return { dataUrl: dataUrl };
                });
            })
            .then(function (result) {
                unmount(stage);
                return result;
            }, function (error) {
                unmount(stage);
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
        _buildSheet: buildSheet,
        _render: render
    };
})(window);
