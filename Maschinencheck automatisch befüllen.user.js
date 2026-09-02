// ==UserScript==
// @name         Maschinencheck automatisch befüllen
// @namespace    https://github.com/martsilg/tampermonkeyskripte
// @version      1.0.0
// @description  Beim Start des Maschinen-Checks wird die Bezeichnung des Tickets automatisch ins Suchfeld übernommen und bei eindeutigem Treffer bestätigt
// @author       martsilg
// @match        https://pf-prod.vossko.de/WebApp/layout_termui*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/martsilg/tampermonkeyskripte/main/Maschinencheck%20automatisch%20bef%C3%BCllen.user.js
// @downloadURL  https://raw.githubusercontent.com/martsilg/tampermonkeyskripte/main/Maschinencheck%20automatisch%20bef%C3%BCllen.user.js
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'maschinencheckAutoFillBezeichnung';
    const LOG_PREFIX = '[Maschinencheck]';
    const log = (...args) => console.log(LOG_PREFIX, ...args);

    // Vuetify-Komponenten reagieren auf eine echte Pointer-Sequenz, nicht auf ein einzelnes click()
    function simulateRealClick(el) {
        log('simulateRealClick auf:', el, 'text=', JSON.stringify(el.textContent?.trim().slice(0, 40)));
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
            const EventCtor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
            el.dispatchEvent(new EventCtor(type, opts));
        });
    }

    // Zeichenweises Eintippen mit echten input-Events, damit die Server-Suche (Debounce) zuverlässig anspringt
    function typeCharByChar(input, text, delayMs = 60) {
        return new Promise((resolve) => {
            input.focus();
            let i = 0;
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            const step = () => {
                if (i >= text.length) return resolve();
                nativeSetter.call(input, text.slice(0, i + 1));
                input.dispatchEvent(new Event('input', { bubbles: true }));
                i++;
                setTimeout(step, delayMs);
            };
            step();
        });
    }

    // === SCHRITT 1: Bezeichnung merken + "Maschinen-Check" automatisch anklicken,
    //     sobald "Bearbeitung starten" geklickt wird ===
    function armBearbeitungStartenCapture() {
        if (document.body.dataset.maschinencheckCaptureArmed === "true") return;
        document.body.dataset.maschinencheckCaptureArmed = "true";
        log('Klick-Listener für "Bearbeitung starten" aktiviert');

        document.body.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const label = btn.textContent.trim();
            if (label !== 'Bearbeitung starten') return;

            // Bezeichnung erst JETZT auslesen (nicht beim Skriptstart, da das Feld da evtl. noch leer ist)
            const bezeichnungEl = document.querySelector('[data-testid="tssubjectmatter_termuiname"] .form-control');
            const bezeichnung = bezeichnungEl ? bezeichnungEl.textContent.trim() : '';
            log('"Bearbeitung starten" geklickt, Bezeichnung:', JSON.stringify(bezeichnung));

            if (!bezeichnung) {
                log('WARNUNG: keine Bezeichnung gefunden, breche ab');
                return;
            }

            sessionStorage.setItem(STORAGE_KEY, bezeichnung);
            log('In sessionStorage gespeichert unter', STORAGE_KEY);

            // Nach "Bearbeitung starten" schließt sich das Flyout-Menü zunächst wieder.
            // Wir müssen den FAB-Button (blauer Kreis unten rechts) erneut anklicken,
            // damit es sich neu öffnet und "Maschinen-Check" sichtbar wird.
            setTimeout(() => {
                const fabBtn = document.querySelector('.termui-fab');
                if (fabBtn) {
                    log('FAB-Button erneut anklicken, um das Flyout-Menü zu öffnen');
                    simulateRealClick(fabBtn);
                } else {
                    log('WARNUNG: FAB-Button (.termui-fab) nicht gefunden');
                }

                waitFor(() => {
                    const candidates = Array.from(document.querySelectorAll('button'))
                        .filter(b => b.textContent.trim() === 'Maschinen-Check' && b.offsetParent !== null);
                    log('Kandidaten für "Maschinen-Check":', candidates.length, candidates);
                    return candidates.length === 1 ? candidates[0] : null;
                }).then(maschinencheckBtn => {
                    if (maschinencheckBtn) {
                        log('"Maschinen-Check" automatisch anklicken');
                        simulateRealClick(maschinencheckBtn);
                    } else {
                        log('ABBRUCH: "Maschinen-Check"-Button nicht eindeutig gefunden');
                    }
                });
            }, 500);
        }, true);
    }

    // === SCHRITT 2: Auf der Maschinencheck-Seite automatisch ausfüllen ===
    function isMaschinencheckPage() {
        const h5 = document.querySelector('main h5');
        return !!(h5 && h5.textContent.trim() === 'Maschinen-Check');
    }

    function getOpenMenuItems(combobox) {
        const menuId = combobox.getAttribute('aria-controls');
        const menu = menuId ? document.getElementById(menuId) : null;
        return menu ? Array.from(menu.querySelectorAll('[role="option"], .v-list-item')) : [];
    }

    function waitFor(conditionFn, { timeout = 6000, interval = 150 } = {}) {
        return new Promise((resolve) => {
            const start = Date.now();
            const tick = () => {
                const result = conditionFn();
                if (result) return resolve(result);
                if (Date.now() - start >= timeout) return resolve(null);
                setTimeout(tick, interval);
            };
            tick();
        });
    }

    async function runAutoFill(bezeichnung) {
        log('runAutoFill gestartet mit Bezeichnung:', JSON.stringify(bezeichnung));

        const field = document.querySelector('[data-testid="tssubjectmatter_id"]');
        if (!field) { log('ABBRUCH: Feld [data-testid="tssubjectmatter_id"] nicht gefunden'); return; }

        const input = field.querySelector('input');
        const combobox = field.querySelector('[role="combobox"]');
        if (!input || !combobox) { log('ABBRUCH: input oder combobox im Feld nicht gefunden', { input, combobox }); return; }

        if (field.dataset.autoFillRunning === "true") { log('ABBRUCH: läuft bereits'); return; }
        field.dataset.autoFillRunning = "true";

        // Die Seite/Komponente braucht nach dem Rendern noch einen Moment, bis sie
        // wirklich interaktionsbereit ist (Vue-Setup, evtl. Nachladen der Datenquelle).
        log('Warte kurz, bis das Feld interaktionsbereit ist …');
        await waitFor(() => {
            const stillLoading = field.querySelector('.v-progress-linear__indeterminate, [aria-hidden="false"].v-progress-linear');
            return (!input.disabled && !stillLoading) ? true : null;
        }, { timeout: 4000, interval: 100 });
        await new Promise(r => setTimeout(r, 1500)); // zusätzlicher Sicherheitspuffer

        log('Beginne mit Eintippen …');
        await typeCharByChar(input, bezeichnung);
        log('Zeichenweise eingetippt, warte auf aktualisierte Trefferliste (Debounce) …');

        // Nach dem letzten Tastendruck muss die Server-Suche erst noch debouncen + antworten.
        // Wir warten daher fix eine kurze Zeit, bevor wir die Liste auslesen.
        await new Promise(r => setTimeout(r, 1000));

        const items = await waitFor(() => {
            const found = getOpenMenuItems(combobox);
            return found.length ? found : null;
        }, { timeout: 10000, interval: 150 });

        if (!items) {
            log('ABBRUCH: keine Trefferliste innerhalb des Timeouts erschienen');
            delete field.dataset.autoFillRunning;
            return;
        }

        log('Trefferliste erhalten:', items.map(el => el.textContent.trim()));

        const exactMatch = items.find(el => el.textContent.trim() === bezeichnung.trim());

        if (exactMatch) {
            log('Exakter Treffer gefunden, wähle aus:', exactMatch.textContent.trim());
            simulateRealClick(exactMatch);

            const weiterBtn = await waitFor(() => {
                const candidates = Array.from(document.querySelectorAll('button'))
                    .filter(b => b.textContent.trim() === 'Weiter' && !b.disabled && b.offsetParent !== null);
                log('Kandidaten für "Weiter":', candidates.length, candidates);
                return candidates.length === 1 ? candidates[0] : null;
            });
            if (weiterBtn) {
                log('"Weiter" eindeutig gefunden und aktiv, klicke automatisch weiter');
                simulateRealClick(weiterBtn);
            } else {
                log('ABBRUCH: "Weiter" nicht eindeutig oder nicht aktiv innerhalb des Timeouts – kein Auto-Klick, um Fehlklicks zu vermeiden');
            }
        } else {
            log('Kein exakter Treffer -> Dropdown bleibt offen, manuelle Auswahl nötig');
        }

        delete field.dataset.autoFillRunning;
    }

    function tryAutoFillOnce() {
        const bezeichnung = sessionStorage.getItem(STORAGE_KEY);
        if (!bezeichnung) return;

        if (!isMaschinencheckPage()) return;

        const field = document.querySelector('[data-testid="tssubjectmatter_id"]');
        if (!field) { log('Maschinencheck-Seite erkannt, aber Feld noch nicht im DOM – warte auf nächsten Versuch'); return; }
        if (field.dataset.autoFillDone === "true") return;
        field.dataset.autoFillDone = "true";

        log('Maschinencheck-Seite erkannt, gespeicherte Bezeichnung gefunden:', JSON.stringify(bezeichnung));
        sessionStorage.removeItem(STORAGE_KEY);
        runAutoFill(bezeichnung);
    }

    // Zusätzlich zum MutationObserver aktiv pollen, solange eine Bezeichnung "wartet":
    // falls nach dem automatischen Klick auf "Maschinen-Check" kein weiterer DOM-Mutation-
    // Callback mehr feuert (z.B. weil der Seitenaufbau schon vor dem nächsten Observer-Tick
    // fertig war), würde tryAutoFillOnce() sonst nie erneut laufen.
    setInterval(() => {
        if (sessionStorage.getItem(STORAGE_KEY)) tryAutoFillOnce();
    }, 400);

    function init() {
        armBearbeitungStartenCapture();
        tryAutoFillOnce();
    }

    window.addEventListener('load', init);
    const observer = new MutationObserver(tryAutoFillOnce);
    observer.observe(document.body, { childList: true, subtree: true });
    init();
})();
