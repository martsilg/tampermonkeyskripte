// ==UserScript==
// @name         Mobile Ticket-Detailansicht
// @namespace    https://github.com/martsilg/tampermonkeyskripte
// @version      1.1.0
// @description  Kompaktere Tab-Leiste (horizontal scrollbar, Swipe-Wechsel), kompaktere Aktions-Buttons und Personal-Auswahl mit Favoriten für die Ticket-Detailseite auf dem Smartphone
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

      /* Ein-/Ausblenden-Handle: bleibt immer sichtbar, blendet die
         restlichen FABs darüber ein/aus. */
      .tm-fab-handle {
        width: 40px;
        height: 40px;
        min-width: 40px;
        border-radius: 50%;
        background: #374151;
        font-size: 16px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      }
      #tm-fab-stack.tm-collapsed .tm-fab:not(.tm-fab-handle) {
        display: none;
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

  const FAB_COLLAPSED_KEY = 'tmTicketFabCollapsed';

  function isFabCollapsed() {
    try {
      return localStorage.getItem(FAB_COLLAPSED_KEY) === '1';
    } catch (err) {
      return false; // z.B. privater Modus ohne localStorage-Zugriff
    }
  }

  function setFabCollapsed(collapsed) {
    try {
      localStorage.setItem(FAB_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch (err) {
      // localStorage nicht verfügbar - Zustand bleibt dann nur für die
      // aktuelle Seitenansicht erhalten (kein Fehler, nur kein Merken).
    }
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
    stack.classList.toggle('tm-collapsed', isFabCollapsed());

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

    // Handle zuletzt anhängen: dank column-reverse landet er unten, direkt
    // erreichbar, unabhängig davon wie viele Aktions-FABs es gerade gibt.
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'tm-fab tm-fab-handle';
    handle.setAttribute('aria-label', 'Aktions-Buttons ein-/ausblenden');
    handle.textContent = isFabCollapsed() ? '‹' : '›';
    handle.addEventListener('click', function () {
      const collapsed = !stack.classList.contains('tm-collapsed');
      stack.classList.toggle('tm-collapsed', collapsed);
      setFabCollapsed(collapsed);
      handle.textContent = collapsed ? '‹' : '›';
    });
    stack.appendChild(handle);
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

  // --- Personal-Auswahl als Kachel-Fenster statt nativer Android-Liste ---
  // Antippen eines Benutzer-Selects im Personal-Reiter öffnet ein Fenster
  // von unten: Favoriten (per Stern), zuletzt genutzte Personen, der Rest
  // hinter "Weitere". Die Wahl wird in das ORIGINAL-Select geschrieben und
  // dessen change-Event ausgelöst - die Inline-Handler von perfact
  // (validate_options, check_all, tab_setchanged) laufen dadurch wie bei
  // einer normalen Auswahl. Gespeichert werden nur Benutzer-IDs, die Namen
  // kommen immer frisch aus den <option>s der Seite.
  const STAFF_SELECT_SELECTOR = 'select[name="elements.tsticketxuser_tsuser_id:records"]';
  const STAFF_FAV_KEY = 'tmStaffPickFavorites';
  const STAFF_RECENT_KEY = 'tmStaffPickRecent';
  const STAFF_RECENT_SHOWN = 6;   // so viele "Zuletzt genutzt" werden angezeigt
  const STAFF_RECENT_STORED = 20; // mehr speichern, weil Favoriten beim Anzeigen herausgefiltert werden
  const TAP_MAX_MOVE_PX = 10;

  const staffSheetCss = `
    #tm-staff-sheet-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10000; /* über dem FAB-Stack (9999) */
      background: rgba(0,0,0,0.45);
      display: flex;
      align-items: flex-end;
    }
    #tm-staff-sheet {
      width: 100%;
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      background: #fff;
      border-radius: 14px 14px 0 0;
      box-shadow: 0 -4px 16px rgba(0,0,0,0.25);
      padding-bottom: env(safe-area-inset-bottom);
      font-size: 14px;
    }
    .tm-ss-head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px 6px;
    }
    .tm-ss-title { flex: 1; font-weight: 700; font-size: 16px; }
    .tm-ss-close {
      width: 40px; height: 40px;
      border: none; border-radius: 50%;
      background: #f1f1f1; font-size: 18px;
    }
    .tm-ss-search {
      margin: 0 12px 8px;
      padding: 9px 12px;
      border: 1px solid #ccc;
      border-radius: 8px;
      font-size: 15px;
    }
    .tm-ss-body {
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 0 12px 12px;
    }
    .tm-ss-section-title {
      margin: 10px 0 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #777;
    }
    .tm-ss-hint { color: #999; font-style: italic; font-size: 13px; }
    .tm-ss-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }
    .tm-ss-chip {
      display: flex;
      align-items: stretch;
      min-height: 44px;
      border: 1px solid #d6d6d6;
      border-radius: 8px;
      background: #fafafa;
      overflow: hidden;
    }
    .tm-ss-chip.tm-ss-selected {
      border-color: #2563eb;
      background: #e8efff;
    }
    .tm-ss-name {
      flex: 1;
      min-width: 0;
      border: none;
      background: transparent;
      padding: 0 4px 0 10px;
      text-align: left;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tm-ss-chip.tm-ss-selected .tm-ss-name { font-weight: 700; color: #1d4ed8; }
    .tm-ss-star {
      flex: 0 0 38px;
      border: none;
      background: transparent;
      font-size: 18px;
      color: #b5b5b5;
    }
    .tm-ss-star.tm-ss-fav { color: #f59e0b; }
    .tm-ss-more, .tm-ss-clear {
      display: block;
      width: 100%;
      margin-top: 10px;
      padding: 11px;
      border: 1px dashed #bbb;
      border-radius: 8px;
      background: #fff;
      font-size: 14px;
      font-weight: 600;
      color: #444;
    }
    .tm-ss-clear { border-style: solid; color: #dc2626; border-color: #f3b4b4; }
  `;
  const staffSheetStyle = document.createElement('style');
  staffSheetStyle.textContent = staffSheetCss;
  document.head.appendChild(staffSheetStyle);

  function loadIdList(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (err) {
      return [];
    }
  }

  function saveIdList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch (err) {
      // localStorage nicht verfügbar - Favoriten/Verlauf gelten dann nur
      // bis zum Schließen der Seite.
    }
  }

  function staffOptions(select) {
    return Array.from(select.options)
      .filter(function (o) { return o.value !== ''; })
      .map(function (o) { return { id: o.value, name: o.textContent.trim() }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }); });
  }

  // Teilt die Personen in Favoriten / Zuletzt genutzt / Weitere. Reihenfolge
  // der Favoriten alphabetisch, die der zuletzt Genutzten nach Aktualität.
  function groupStaff(people, favIds, recentIds) {
    const byId = {};
    people.forEach(function (p) { byId[p.id] = p; });
    const favSet = new Set(favIds);
    const favorites = people.filter(function (p) { return favSet.has(p.id); });
    const recent = recentIds
      .filter(function (id) { return byId[id] && !favSet.has(id); })
      .slice(0, STAFF_RECENT_SHOWN)
      .map(function (id) { return byId[id]; });
    const shown = new Set(favorites.concat(recent).map(function (p) { return p.id; }));
    const others = people.filter(function (p) { return !shown.has(p.id); });
    return { favorites: favorites, recent: recent, others: others };
  }

  function applyStaffChoice(select, id) {
    select.value = id;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    if (id) {
      const recent = loadIdList(STAFF_RECENT_KEY).filter(function (x) { return x !== id; });
      recent.unshift(id);
      saveIdList(STAFF_RECENT_KEY, recent.slice(0, STAFF_RECENT_STORED));
    }
  }

  function toggleFavorite(id) {
    const favs = loadIdList(STAFF_FAV_KEY);
    const idx = favs.indexOf(id);
    if (idx === -1) favs.push(id); else favs.splice(idx, 1);
    saveIdList(STAFF_FAV_KEY, favs);
  }

  function closeStaffSheet() {
    const backdrop = document.getElementById('tm-staff-sheet-backdrop');
    if (backdrop) backdrop.remove();
    document.documentElement.style.overflow = '';
  }

  function openStaffSheet(select) {
    closeStaffSheet();
    const people = staffOptions(select);
    let showOthers = false;

    const backdrop = document.createElement('div');
    backdrop.id = 'tm-staff-sheet-backdrop';
    backdrop.innerHTML =
      '<div id="tm-staff-sheet" role="dialog" aria-label="Personal wählen">' +
        '<div class="tm-ss-head">' +
          '<span class="tm-ss-title">Personal wählen</span>' +
          '<button type="button" class="tm-ss-close" aria-label="Schließen">✕</button>' +
        '</div>' +
        '<input type="search" class="tm-ss-search" placeholder="Name suchen …" autocomplete="off">' +
        '<div class="tm-ss-body"></div>' +
      '</div>';
    const body = backdrop.querySelector('.tm-ss-body');
    const search = backdrop.querySelector('.tm-ss-search');

    function chipGrid(list) {
      const grid = document.createElement('div');
      grid.className = 'tm-ss-grid';
      const favSet = new Set(loadIdList(STAFF_FAV_KEY));
      list.forEach(function (p) {
        const chip = document.createElement('div');
        chip.className = 'tm-ss-chip' + (p.id === select.value ? ' tm-ss-selected' : '');
        const name = document.createElement('button');
        name.type = 'button';
        name.className = 'tm-ss-name';
        name.textContent = p.name; // textContent: Namen nie als HTML einsetzen
        name.addEventListener('click', function () {
          applyStaffChoice(select, p.id);
          closeStaffSheet();
        });
        const star = document.createElement('button');
        star.type = 'button';
        star.className = 'tm-ss-star' + (favSet.has(p.id) ? ' tm-ss-fav' : '');
        star.setAttribute('aria-label', favSet.has(p.id) ? 'Favorit entfernen' : 'Als Favorit markieren');
        star.textContent = favSet.has(p.id) ? '★' : '☆';
        star.addEventListener('click', function () {
          toggleFavorite(p.id);
          render();
        });
        chip.appendChild(name);
        chip.appendChild(star);
        grid.appendChild(chip);
      });
      return grid;
    }

    function section(title, list, emptyHint) {
      const frag = document.createDocumentFragment();
      const h = document.createElement('div');
      h.className = 'tm-ss-section-title';
      h.textContent = title;
      frag.appendChild(h);
      if (list.length) {
        frag.appendChild(chipGrid(list));
      } else if (emptyHint) {
        const hint = document.createElement('div');
        hint.className = 'tm-ss-hint';
        hint.textContent = emptyHint;
        frag.appendChild(hint);
      }
      return frag;
    }

    function render() {
      const scrollTop = body.scrollTop;
      body.innerHTML = '';
      const term = search.value.trim().toLowerCase();

      if (term) {
        const hits = people.filter(function (p) { return p.name.toLowerCase().includes(term); });
        body.appendChild(section('Treffer', hits, 'Kein Name gefunden.'));
      } else {
        const groups = groupStaff(people, loadIdList(STAFF_FAV_KEY), loadIdList(STAFF_RECENT_KEY));
        const firstUse = !groups.favorites.length && !groups.recent.length;
        body.appendChild(section('Favoriten', groups.favorites, 'Noch keine – ☆ neben einem Namen antippen.'));
        if (groups.recent.length) {
          body.appendChild(section('Zuletzt genutzt', groups.recent));
        }
        // Beim allerersten Öffnen gibt es weder Favoriten noch Verlauf -
        // dann gleich alle zeigen statt eines leeren Fensters.
        if (showOthers || firstUse) {
          body.appendChild(section(firstUse ? 'Alle' : 'Weitere', groups.others));
        }
        if (!firstUse && groups.others.length) {
          const more = document.createElement('button');
          more.type = 'button';
          more.className = 'tm-ss-more';
          more.textContent = showOthers ? 'Weitere ausblenden ▲' : 'Weitere (' + groups.others.length + ') ▼';
          more.addEventListener('click', function () {
            showOthers = !showOthers;
            render();
          });
          body.appendChild(more);
        }
      }

      if (select.value) {
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'tm-ss-clear';
        clear.textContent = 'Auswahl entfernen';
        clear.addEventListener('click', function () {
          applyStaffChoice(select, '');
          closeStaffSheet();
        });
        body.appendChild(clear);
      }
      body.scrollTop = scrollTop;
    }

    search.addEventListener('input', render);
    backdrop.querySelector('.tm-ss-close').addEventListener('click', closeStaffSheet);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closeStaffSheet();
    });

    render();
    document.body.appendChild(backdrop);
    document.documentElement.style.overflow = 'hidden'; // Seite dahinter nicht mitscrollen
  }

  // Natives Aufklappen des Selects verhindern und stattdessen das Fenster
  // öffnen. Auf Touch-Geräten über touchend (preventDefault unterdrückt
  // die nachfolgenden Maus-/Klick-Events und damit die Android-Liste),
  // aber nur bei einem echten Antippen - wer auf dem Select zu scrollen
  // beginnt, soll weiter scrollen können. mousedown deckt Maus/Stift ab.
  let staffTapX = 0;
  let staffTapY = 0;

  function staffSelectFromEvent(e) {
    if (!isNarrowViewport()) return null;
    const select = e.target.closest && e.target.closest(STAFF_SELECT_SELECTOR);
    return select && !select.disabled ? select : null;
  }

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    staffTapX = e.touches[0].clientX;
    staffTapY = e.touches[0].clientY;
  }, { passive: true, capture: true });

  document.addEventListener('touchend', function (e) {
    const select = staffSelectFromEvent(e);
    if (!select) return;
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    if (Math.abs(touch.clientX - staffTapX) > TAP_MAX_MOVE_PX ||
        Math.abs(touch.clientY - staffTapY) > TAP_MAX_MOVE_PX) return;
    e.preventDefault();
    select.blur();
    openStaffSheet(select);
  }, { passive: false, capture: true });

  document.addEventListener('mousedown', function (e) {
    const select = staffSelectFromEvent(e);
    if (!select) return;
    e.preventDefault();
    openStaffSheet(select);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeStaffSheet();
  });
})();
