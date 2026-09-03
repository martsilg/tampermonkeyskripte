// ==UserScript==
// @name         Mobile Ticket-Detailansicht
// @namespace    https://github.com/martsilg/tampermonkeyskripte
// @version      1.0.3
// @description  Kompaktere Tab-Leiste (horizontal scrollbar, Swipe-Wechsel) und kompaktere Aktions-Buttons für die Ticket-Detailseite auf dem Smartphone
// @author       martsilg
// @match        https://pf-prod.vossko.de/WebApp/MPA/Tickets/*/db_page_edit*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/martsilg/tampermonkeyskripte/main/Mobile%20Ticket-Detailansicht.user.js
// @downloadURL  https://raw.githubusercontent.com/martsilg/tampermonkeyskripte/main/Mobile%20Ticket-Detailansicht.user.js
// ==/UserScript==

(function () {
  'use strict';

  const css = `
    @media (max-width: 900px) {
      /* --- Tab-Leiste: horizontal scrollbar statt Umbruch ---
         #tabs selbst und ggf. umgebende Container dürfen die Breite nicht auf
         100% beschränkt mit overflow:hidden erzwingen, sonst greift das
         Scrollen auf der <ul> darunter nicht sichtbar. */
      #tabs {
        max-width: 100%;
        overflow-x: hidden;
      }
      #tabs > ul.ui-tabs-nav {
        display: flex !important;
        flex-wrap: nowrap !important;
        align-items: stretch !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        white-space: nowrap;
        max-width: 100%;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        /* sichtbarer Hinweis, dass mehr folgt: dezenter Fade am rechten Rand */
        background: linear-gradient(to right, transparent calc(100% - 24px), rgba(0,0,0,0.08) 100%);
      }
      #tabs > ul.ui-tabs-nav > li {
        flex: 0 0 auto !important;
        display: flex !important;
        align-items: center !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
      }
      #tabs > ul.ui-tabs-nav > li > a {
        display: flex !important;
        align-items: center !important;
        white-space: nowrap;
        padding: 8px 10px !important;
        font-size: 13px !important;
        line-height: normal !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
      }
      /* Aktiven Tab beim Wechsel automatisch in den sichtbaren Bereich scrollen */
      #tabs > ul.ui-tabs-nav > li.ui-tabs-active {
        scroll-margin-inline: 12px;
      }

      /* Original-Footer ausblenden - wird durch die schwebenden Mini-FABs
         rechts unten ersetzt (siehe #tm-fab-stack). Bleibt im DOM (nur
         unsichtbar), damit die Seiten-eigene Formularlogik/JS-Referenzen
         auf die Original-Buttons weiter funktionieren; die FABs klicken
         diese Originale per JS an statt eigene Aktionen nachzubauen. */
      #footer.perfact-layout--footer {
        display: none !important;
      }

      /* --- Tab-Inhalt: Breite auf Viewport fixieren, kein Leerraum-Scroll ---
         Manche Unterelemente (z.B. leere Tabellen, feste Breiten aus dem
         Desktop-Layout) sind breiter als der Bildschirm und erzeugen dadurch
         horizontales Scrollen auf einer sonst leeren Fläche. */
      #tabs.tab-container {
        max-width: 100vw;
        overflow-x: hidden;
      }
      #tabs > .ui-tabs-panel {
        max-width: 100%;
        overflow-x: hidden;
        box-sizing: border-box;
        /* Panel füllt mindestens die restliche Bildschirmhöhe (unterhalb von
           Header/Tab-Leiste), damit bei wenig Inhalt kein "totes", nicht auf
           Swipe reagierendes Leerfeld darunter entsteht. 45vh als grober,
           konservativer Richtwert - besser zu niedrig als eine Scrollbar zu
           erzwingen, wo keine nötig wäre. */
        min-height: 45vh;
      }
      #tabs > .ui-tabs-panel * {
        max-width: 100%;
        box-sizing: border-box;
      }
      /* Tabellen dürfen intern scrollen statt die Panel-Breite zu sprengen */
      #tabs > .ui-tabs-panel table {
        display: block;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      /* --- Schwebende Mini-FABs rechts unten: Klone der Original-Aktions-
         Buttons (Speichern/Freigeben/Klärungsbedarf/Schließen/...), fingerfreundlich
         gestapelt statt in der bisherigen unteren Leiste. */
      #tm-fab-stack {
        position: fixed;
        right: 12px;
        bottom: max(12px, env(safe-area-inset-bottom));
        z-index: 9999;
        display: flex;
        flex-direction: column-reverse; /* wichtigster Button (Speichern) unten, naeher am Daumen */
        gap: 10px;
        align-items: flex-end;
      }
      .tm-fab {
        min-width: 56px;
        height: 56px;
        padding: 0 16px;
        border-radius: 28px;
        border: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        font-size: 12px;
        font-weight: 600;
        line-height: 1.15;
        color: #fff;
        background: #6b7280;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        white-space: normal;
      }
      .tm-fab:active {
        filter: brightness(0.9);
      }
      .tm-fab.tm-fab-save { background: #2563eb; }
      .tm-fab.tm-fab-primary { background: #16a34a; }
      .tm-fab.tm-fab-danger { background: #dc2626; }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // Beim Wechsel des aktiven Tabs diesen automatisch in den sichtbaren
  // Bereich der scrollbaren Tab-Leiste scrollen (falls er außerhalb liegt).
  function scrollActiveTabIntoView() {
    const active = document.querySelector('#tabs > ul.ui-tabs-nav > li.ui-tabs-active');
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  document.addEventListener('click', function (e) {
    const link = e.target.closest('#tabs > ul.ui-tabs-nav > li > a');
    if (link) {
      setTimeout(scrollActiveTabIntoView, 50);
    }
  });

  // --- Reihenfolge der Reiter anpassen: die hier gelisteten Reiter erscheinen
  // in genau dieser Reihenfolge direkt nach "Basisinformationen", statt an
  // ihrer ursprünglichen Position weiter hinten. Verschiebt sowohl den
  // Reiter-Link (<li> in der Nav-Leiste) als auch sein zugehöriges Panel
  // (<div id="tabs-...">) im DOM an die neue Position - jQuery UI Tabs
  // verknüpft Reiter und Panel per Index in der DOM-Reihenfolge, ein reines
  // CSS-"order" auf nur einer der beiden Listen würde diese Zuordnung
  // durcheinanderbringen (Klick auf Reiter X würde dann Panel Y zeigen).
  const TAB_ORDER_AFTER_FIRST = ['#tabs-qualification', '#tabs-staff'];

  function reorderTabs() {
    const nav = document.querySelector('#tabs > ul.ui-tabs-nav');
    if (!nav || nav.dataset.tmReordered === '1') return;

    const firstLi = nav.querySelector(':scope > li');
    if (!firstLi) return;

    let afterLi = firstLi;
    let afterPanel = document.getElementById(
      firstLi.querySelector('a').getAttribute('href').slice(1)
    );

    TAB_ORDER_AFTER_FIRST.forEach(function (href) {
      const li = nav.querySelector(':scope > li > a[href="' + href + '"]')?.closest('li');
      if (!li || li === afterLi) return;

      const panel = document.getElementById(href.slice(1));

      afterLi.insertAdjacentElement('afterend', li);
      if (afterPanel && panel) {
        afterPanel.insertAdjacentElement('afterend', panel);
      }

      afterLi = li;
      afterPanel = panel || afterPanel;
    });

    nav.dataset.tmReordered = '1';

    // jQuery UI Tabs neu synchronisieren, falls das Widget bereits
    // initialisiert ist, damit intern Reiter-Index <-> Panel wieder stimmt.
    if (window.jQuery) {
      try {
        window.jQuery('#tabs').tabs('refresh');
      } catch (err) {
        // Widget evtl. noch nicht initialisiert - nicht kritisch, das
        // erneute Verschieben passiert dann einfach vor der Initialisierung.
      }
    }
  }

  reorderTabs();
  const reorderObserver = new MutationObserver(reorderTabs);
  const tabsContainer = document.getElementById('tabs');
  if (tabsContainer) {
    reorderObserver.observe(tabsContainer, { childList: true, subtree: false });
  }

  // --- Swipe links/rechts zum Tab-Wechsel ---
  // Nur auf schmalen Viewports aktiv (mobile Nutzung). Wechselt zum
  // vorherigen/nächsten SICHTBAREN Tab-Link (überspringt versteckte,
  // z.B. Wartungsmanager/Arbeitsanweisungen bei style="display:none").
  const SWIPE_MIN_DISTANCE_PX = 60;
  const SWIPE_MAX_VERTICAL_PX = 50; // zu viel Vertikalbewegung -> normales Scrollen, kein Swipe
  const SWIPE_MAX_DURATION_MS = 600;

  function visibleTabLinks() {
    return Array.from(document.querySelectorAll('#tabs > ul.ui-tabs-nav > li'))
      .filter(function (li) { return li.style.display !== 'none' && li.offsetParent !== null; })
      .map(function (li) { return li.querySelector('a'); })
      .filter(Boolean);
  }

  function goToAdjacentTab(direction) {
    const links = visibleTabLinks();
    const activeLink = document.querySelector('#tabs > ul.ui-tabs-nav > li.ui-tabs-active > a');
    const idx = links.indexOf(activeLink);
    if (idx === -1) return;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= links.length) return; // am Rand: kein Wrap-Around
    links[nextIdx].click();
    setTimeout(scrollActiveTabIntoView, 50);
  }

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let swipeTrackingActive = false;

  function isNarrowViewport() {
    return window.innerWidth <= 900;
  }

  document.addEventListener('touchstart', function (e) {
    if (!isNarrowViewport()) return;
    const panel = e.target.closest('#tabs > .ui-tabs-panel');
    if (!panel) return; // nur Swipes innerhalb des Tab-Inhalts werten
    // Nicht in Formularfeldern/Editoren starten (dort will man Text markieren,
    // nicht den Tab wechseln).
    if (e.target.closest('input, textarea, select, [contenteditable], iframe, .tox-tinymce')) return;
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    swipeTrackingActive = true;
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!swipeTrackingActive) return;
    swipeTrackingActive = false;
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const duration = Date.now() - touchStartTime;
    if (duration > SWIPE_MAX_DURATION_MS) return;
    if (Math.abs(dy) > SWIPE_MAX_VERTICAL_PX) return; // eher vertikales Scrollen
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE_PX) return;
    goToAdjacentTab(dx < 0 ? 1 : -1); // nach links wischen = nächster Tab
  }, { passive: true });

  // --- Schwebende Mini-FABs rechts unten statt der bisherigen unteren
  // Button-Leiste. Baut keine eigene Aktionslogik nach, sondern klickt beim
  // Antippen den jeweils passenden ORIGINAL-Button per JS an (der Original-
  // Footer bleibt per CSS nur unsichtbar im DOM, siehe #footer.display:none
  // oben) - dadurch bleiben alle serverseitigen Validierungen, Bestätigungs-
  // Dialoge (data-confirm) und Lifecycle-Übergänge exakt wie im Original.
  function isVisibleButton(btn) {
    if (!btn || btn.disabled) return false;
    // Container-Sichtbarkeit prüfen, nicht nur den Button selbst: inaktive
    // Lifecycle-Status-Container tragen style="display:none" (z.B. Buttons
    // für den Status "Geschlossen", während das Ticket in "Dispatch" ist).
    // Die Traversierung stoppt bewusst VOR #footer: #footer selbst ist per
    // eigenem CSS unsichtbar gemacht (siehe display:none oben) - das darf
    // nicht als "Button ist für den aktuellen Status unsichtbar" gewertet
    // werden, sonst würden ALLE Buttons als unsichtbar gelten.
    let node = btn;
    while (node && node.id !== 'footer' && node !== document.body) {
      if (node.style && node.style.display === 'none') return false;
      node = node.parentElement;
    }
    return true;
  }

  function fabColorClass(label) {
    const l = label.toLowerCase();
    if (l.includes('schließ') || l.includes('schliess')) return 'tm-fab-danger';
    if (l.includes('freigeben') || l.includes('weiter')) return 'tm-fab-primary';
    return '';
  }

  function collectActionButtons() {
    const buttons = [];

    const saveBtn = document.querySelector('#footer .save_button button#save_button');
    if (saveBtn && isVisibleButton(saveBtn)) {
      buttons.push({ original: saveBtn, label: saveBtn.textContent.trim() || 'Speichern', cls: 'tm-fab-save' });
    }

    document.querySelectorAll('#footer .perfact-form--buttons .action').forEach(function (btn) {
      if (!isVisibleButton(btn)) return;
      const label = btn.textContent.trim();
      buttons.push({ original: btn, label: label, cls: fabColorClass(label) });
    });

    document.querySelectorAll('#footer .perfact-layout--lcc-button-container button.lc_to').forEach(function (btn) {
      if (!isVisibleButton(btn)) return;
      const label = btn.textContent.trim();
      buttons.push({ original: btn, label: label, cls: fabColorClass(label) });
    });

    return buttons;
  }

  function rebuildFabStack() {
    if (!isNarrowViewport()) {
      const existing = document.getElementById('tm-fab-stack');
      if (existing) existing.remove();
      return;
    }

    let stack = document.getElementById('tm-fab-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'tm-fab-stack';
      document.body.appendChild(stack);
    }
    stack.innerHTML = '';

    collectActionButtons().forEach(function (entry) {
      const fab = document.createElement('button');
      fab.type = 'button';
      fab.className = 'tm-fab' + (entry.cls ? ' ' + entry.cls : '');
      fab.textContent = entry.label;
      fab.addEventListener('click', function () {
        entry.original.click();
      });
      stack.appendChild(fab);
    });
  }

  rebuildFabStack();
  window.addEventListener('resize', rebuildFabStack);
  const fabObserver = new MutationObserver(function () {
    // Debounced über rAF, da Formular-Interaktionen viele DOM-Mutationen
    // in kurzer Folge auslösen können.
    if (fabObserver._pending) return;
    fabObserver._pending = true;
    requestAnimationFrame(function () {
      fabObserver._pending = false;
      rebuildFabStack();
    });
  });
  const footerEl = document.getElementById('footer');
  if (footerEl) {
    fabObserver.observe(footerEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'disabled'] });
  }
})();
