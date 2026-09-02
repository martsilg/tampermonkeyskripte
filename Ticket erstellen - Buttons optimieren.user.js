// ==UserScript==
// @name         Ticket erstellen - Buttons optimieren
// @namespace    https://github.com/martsilg/tampermonkeyskripte
// @version      1.0.0
// @description  Meldungserstellung: "Nein" (Prod.-Stillstand) zusätzlich unten an Weiter-Position, Meldungskategorien als Buttons
// @author       martsilg
// @match        https://pf-prod.vossko.de/WebApp/layout_termui*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/martsilg/tampermonkeyskripte/main/Ticket%20erstellen%20-%20Buttons%20optimieren.user.js
// @downloadURL  https://raw.githubusercontent.com/martsilg/tampermonkeyskripte/main/Ticket%20erstellen%20-%20Buttons%20optimieren.user.js
// ==/UserScript==

(function () {
    'use strict';

    // === PROD.-STILLSTAND: "Nein" zusätzlich unten neben "Weiter" ===
    function insertQuickNeinButton() {
        const neinBtn = Array.from(document.querySelectorAll('button.btn-outline-success, button.btn-success'))
            .find(b => b.textContent.trim() === 'Nein');
        if (!neinBtn) return;

        const stepPane = neinBtn.closest('.v-window-item');
        if (!stepPane || !stepPane.classList.contains('v-window-item--active')) return;

        const navRow = document.querySelector('.d-flex.justify-content-between.mt-auto');
        if (!navRow) return;
        if (navRow.dataset.quickNeinAdded === "true") return;

        const weiterBtn = Array.from(navRow.querySelectorAll('button')).find(b => b.textContent.includes('Weiter'));
        if (!weiterBtn) return;

        const quickNein = document.createElement('button');
        quickNein.type = 'button';
        quickNein.className = neinBtn.className + ' flex-fill mx-1';
        quickNein.textContent = 'Nein';
        quickNein.addEventListener('click', () => neinBtn.click());

        weiterBtn.insertAdjacentElement('afterend', quickNein);

        navRow.dataset.quickNeinAdded = "true";
    }

    function removeQuickNeinButton() {
        const navRow = document.querySelector('.d-flex.justify-content-between.mt-auto[data-quick-nein-added="true"]');
        if (!navRow) return;
        const quickNein = Array.from(navRow.querySelectorAll('button')).find(b => b.textContent.trim() === 'Nein');
        if (quickNein) quickNein.remove();
        delete navRow.dataset.quickNeinAdded;
    }

    function updateStillstandStep() {
        const neinBtn = Array.from(document.querySelectorAll('button.btn-outline-success, button.btn-success'))
            .find(b => b.textContent.trim() === 'Nein');
        const stepPane = neinBtn ? neinBtn.closest('.v-window-item') : null;
        const isActiveStillstandStep = stepPane && stepPane.classList.contains('v-window-item--active');

        if (isActiveStillstandStep) {
            insertQuickNeinButton();
        } else {
            removeQuickNeinButton();
        }
    }

    // === MELDUNGSKATEGORIE: Kategorien zusätzlich als Buttons ===

    // Fest hinterlegt statt per Klick aus dem Dropdown ausgelesen: das Öffnen/Schließen des
    // Vuetify-Overlays zum reinen Auslesen der Optionen hat einen Sidebar-Toggle-Bug ausgelöst
    // (Inhalt wurde nach rechts verschoben/links abgeschnitten). Bei neuen Kategorien in Perfact
    // muss diese Liste manuell nachgeführt werden.
    const MELDUNGS_KATEGORIEN = [
        'Elektrik - Produktion',
        'Elektrik - Verpackung',
        'IT',
        'IT->IT - Hardware',
        'IT->IT - Software',
        'Mechanik - Produktion',
        'Mechanik - Verpackung',
        'Reinigung',
        'Verbesserungsvorschlag',
        'Versorgungstechnik',
    ];

    // Vuetify-Listeneinträge reagieren auf eine echte Pointer-Sequenz, nicht auf ein einzelnes click()
    function simulateRealClick(el) {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
            const EventCtor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
            el.dispatchEvent(new EventCtor(type, opts));
        });
    }

    function getOpenMenuItems(combobox) {
        const menuId = combobox.getAttribute('aria-controls');
        const menu = menuId ? document.getElementById(menuId) : null;
        return menu ? Array.from(menu.querySelectorAll('[role="option"], .v-list-item')) : [];
    }

    function selectCategoryByLabel(combobox, label) {
        simulateRealClick(combobox);
        setTimeout(() => {
            const target = getOpenMenuItems(combobox).find(el => el.textContent.trim() === label);
            if (target) simulateRealClick(target);

            // Nach der Auswahl automatisch zur nächsten Seite springen
            setTimeout(() => {
                const weiterBtn = Array.from(document.querySelectorAll('button'))
                    .find(b => b.textContent.trim() === 'Weiter' && !b.disabled);
                if (weiterBtn) simulateRealClick(weiterBtn);
            }, 150);
        }, 150);
    }

    function insertCategoryButtons() {
        const categoryField = document.querySelector('[data-testid="tscategory_id"]');
        if (!categoryField) return;

        const stepPane = categoryField.closest('.v-window-item');
        if (!stepPane || !stepPane.classList.contains('v-window-item--active')) return;

        const col = categoryField.closest('.col');
        if (!col || col.dataset.categoryButtonsAdded === "true") return;

        const combobox = categoryField.querySelector('[role="combobox"]');
        if (!combobox) return;

        col.dataset.categoryButtonsAdded = "true";

        const btnContainer = document.createElement('div');
        // col statt nur d-flex, damit der Container innerhalb des Bootstrap-.row dasselbe
        // Padding wie sein Geschwister-.col bekommt. Das Eltern-.row hat zusätzlich
        // "row-cols-2", das jedem .col-Kind eine feste 50%-Breite aufzwingt – w-100 erzwingt
        // hier die volle Breite.
        btnContainer.className = 'col col-12 w-100 d-flex flex-wrap gap-1 mb-3';

        MELDUNGS_KATEGORIEN.forEach(label => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-sm btn-outline-secondary';
            btn.textContent = label;
            btn.addEventListener('click', () => selectCategoryByLabel(combobox, label));
            btnContainer.appendChild(btn);
        });

        col.insertAdjacentElement('afterend', btnContainer);
    }

    // === ZUSAMMENFASSUNG: "Meldung erstellen" zusätzlich unten in der Navigationsleiste ===
    function insertQuickSubmitButton() {
        const submitBtn = Array.from(document.querySelectorAll('.summary-container button'))
            .find(b => b.textContent.trim() === 'Meldung erstellen');
        if (!submitBtn) return;

        const stepPane = submitBtn.closest('.v-window-item');
        if (!stepPane || !stepPane.classList.contains('v-window-item--active')) return;

        const navRow = document.querySelector('.d-flex.justify-content-between.mt-auto');
        if (!navRow) return;
        if (navRow.dataset.quickSubmitAdded === "true") return;

        const quickSubmit = document.createElement('button');
        quickSubmit.type = 'button';
        quickSubmit.className = submitBtn.className;
        quickSubmit.innerHTML = submitBtn.innerHTML;
        quickSubmit.addEventListener('click', () => submitBtn.click());

        navRow.appendChild(quickSubmit);

        navRow.dataset.quickSubmitAdded = "true";
    }

    function removeQuickSubmitButton() {
        const navRow = document.querySelector('.d-flex.justify-content-between.mt-auto[data-quick-submit-added="true"]');
        if (!navRow) return;
        const quickSubmit = Array.from(navRow.querySelectorAll('button'))
            .find(b => b.textContent.trim() === 'Meldung erstellen');
        if (quickSubmit) quickSubmit.remove();
        delete navRow.dataset.quickSubmitAdded;
    }

    function updateSummaryStep() {
        const submitBtn = Array.from(document.querySelectorAll('.summary-container button'))
            .find(b => b.textContent.trim() === 'Meldung erstellen');
        const stepPane = submitBtn ? submitBtn.closest('.v-window-item') : null;
        const isActiveSummaryStep = stepPane && stepPane.classList.contains('v-window-item--active');

        if (isActiveSummaryStep) {
            insertQuickSubmitButton();
        } else {
            removeQuickSubmitButton();
        }
    }

    function initializeAllControls() {
        updateStillstandStep();
        insertCategoryButtons();
        updateSummaryStep();
    }

    window.addEventListener('load', initializeAllControls);
    const observer = new MutationObserver(initializeAllControls);
    observer.observe(document.body, { childList: true, subtree: true });
})();
