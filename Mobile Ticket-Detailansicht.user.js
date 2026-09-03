// ==UserScript==
// @name         Mobile Ticket-Detailansicht
// @namespace    https://github.com/martsilg/tampermonkeyskripte
// @version      1.0.1
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

      /* --- Fixe Aktions-Buttons unten: kompakter, als Raster statt gestapelt ---
         Nur Container gridden, die nicht bereits per Inline-style="display:none"
         als inaktiver Lifecycle-Status ausgeblendet sind (sonst werden z.B. die
         Buttons des Status "Geschlossen" fälschlich neben denen von "Dispatch"
         sichtbar, weil !important das Inline-display:none überschreibt). */
      #footer .perfact-form--buttons {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 6px !important;
      }
      #footer .perfact-layout--lcc-button-container:not([style*="display: none"]):not([style*="display:none"]) {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 6px !important;
      }
      #footer .perfact-form--buttons .action,
      #footer .perfact-layout--lcc-button-container button.lc_to {
        width: 100% !important;
        margin: 0 !important;
        padding: 8px 4px !important;
        font-size: 12px !important;
        line-height: 1.2 !important;
        min-height: 0 !important;
        white-space: normal !important;
      }
      #footer .perfact-form--save-button .save_button button#save_button {
        padding: 8px 12px !important;
        font-size: 13px !important;
      }
      /* Footer insgesamt weniger Innenabstand, damit er weniger Platz frisst */
      #footer.perfact-layout--footer {
        padding-top: 4px !important;
        padding-bottom: 4px !important;
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

  // --- Reihenfolge der Reiter anpassen: "Personal" direkt nach
  // "Basisinformationen" statt an seiner ursprünglichen Position weiter
  // hinten. Verschiebt sowohl den Reiter-Link (<li> in der Nav-Leiste) als
  // auch sein zugehöriges Panel (<div id="tabs-staff">) im DOM an die neue
  // Position - jQuery UI Tabs verknüpft Reiter und Panel per Index in der
  // DOM-Reihenfolge, ein reines CSS-"order" auf nur einer der beiden Listen
  // würde diese Zuordnung durcheinanderbringen (Klick auf Reiter X würde
  // dann Panel Y zeigen).
  function reorderPersonalTab() {
    const nav = document.querySelector('#tabs > ul.ui-tabs-nav');
    if (!nav || nav.dataset.tmReordered === '1') return;

    const firstLi = nav.querySelector(':scope > li');
    const personalLi = nav.querySelector(':scope > li > a[href="#tabs-staff"]')?.closest('li');
    if (!firstLi || !personalLi || firstLi === personalLi) return;

    const personalPanelId = personalLi.querySelector('a').getAttribute('href'); // "#tabs-staff"
    const personalPanel = document.querySelector('#tabs > ' + personalPanelId);

    firstLi.insertAdjacentElement('afterend', personalLi);
    if (personalPanel) {
      const firstPanel = document.getElementById(
        firstLi.querySelector('a').getAttribute('href').slice(1)
      );
      if (firstPanel) firstPanel.insertAdjacentElement('afterend', personalPanel);
    }

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

  reorderPersonalTab();
  const reorderObserver = new MutationObserver(reorderPersonalTab);
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
})();
