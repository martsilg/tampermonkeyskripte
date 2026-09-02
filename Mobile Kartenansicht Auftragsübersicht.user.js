// ==UserScript==
// @name         Mobile Kartenansicht Auftragsübersicht
// @namespace    https://github.com/martsilg/tampermonkeyskripte
// @version      1.0.0
// @description  PowerApps-artige Kartenansicht für die mobile Ticket-Übersicht (Bearbeiter, Priorität, Betreff)
// @author       martsilg
// @match        https://pf-prod.vossko.de/WebApp/MPA/Tickets/Dispatch/*
// @match        https://pf-prod.vossko.de/WebApp/MPA/Tickets/Work/*
// @match        https://pf-prod.vossko.de/WebApp/MPA/Tickets/Released/*
// @match        https://pf-prod.vossko.de/WebApp/MPA/Tickets/WaitingState/*
// @match        https://pf-prod.vossko.de/WebApp/MPA/Tickets/Closed/*
// @match        https://pf-prod.vossko.de/WebApp/MPA/Tickets/Mine/My_Work/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/martsilg/tampermonkeyskripte/main/Mobile%20Kartenansicht%20Auftrags%C3%BCbersicht.user.js
// @downloadURL  https://raw.githubusercontent.com/martsilg/tampermonkeyskripte/main/Mobile%20Kartenansicht%20Auftrags%C3%BCbersicht.user.js
// ==/UserScript==

(function () {
  'use strict';

  const ROW_SEL = 'tr[pkey].clickable, tr[id^="searchrow_"]';
  const DONE_ATTR = 'data-tm-card';

  const AVATAR_COLORS = [
    '#e11d48', '#ea580c', '#d97706', '#65a30d', '#059669',
    '#0891b2', '#2563eb', '#7c3aed', '#c026d3', '#db2777'
  ];

  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function initialsFor(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function priorityClass(priorityText) {
    if (!priorityText) return 'tm-prio-medium';
    const numMatch = priorityText.match(/(\d+)/);
    const num = numMatch ? parseInt(numMatch[1], 10) : NaN;
    if (!isNaN(num)) {
      if (num >= 400) return 'tm-prio-critical';
      if (num >= 300) return 'tm-prio-high';
      if (num >= 250) return 'tm-prio-weekend';
      if (num >= 200) return 'tm-prio-medium';
      return 'tm-prio-low';
    }
    const p = priorityText.toLowerCase();
    if (p.includes('stillstand') || p.includes('kritisch')) return 'tm-prio-critical';
    if (p.includes('hoch')) return 'tm-prio-high';
    if (p.includes('wochenende')) return 'tm-prio-weekend';
    if (p.includes('niedrig')) return 'tm-prio-low';
    return 'tm-prio-medium';
  }

  function textOf(row, colClass) {
    const cell = row.querySelector('td.' + colClass + ' .limiter');
    if (!cell) return '';
    return (cell.getAttribute('data-bs-original-title') || cell.textContent || '').trim();
  }

  function buildCard(row) {
    const bearbeiter = textOf(row, 'tsticket_staff');
    const prio = textOf(row, 'lookup_tsticket_tsprio_id');
    const bezeichnung = textOf(row, 'tsticket_tssubjectmattername');
    const betreff = textOf(row, 'tsticket_subject');
    const angelegt = textOf(row, 'tsticket_createtime');
    const meldungsId = textOf(row, 'tsticket_number');
    const pool = textOf(row, 'lookup_tsticket_tspool_id');

    row.classList.add('tm-card', priorityClass(prio));
    row.setAttribute(DONE_ATTR, '1');

    const wrap = document.createElement('div');
    wrap.className = 'tm-card-inner';

    const avatarColor = AVATAR_COLORS[hashString(bearbeiter || '?') % AVATAR_COLORS.length];
    const avatar = document.createElement('div');
    avatar.className = 'tm-card-avatar';
    avatar.style.background = avatarColor;
    avatar.textContent = bearbeiter ? initialsFor(bearbeiter) : '?';
    avatar.title = bearbeiter;

    const body = document.createElement('div');
    body.className = 'tm-card-body';

    const title = document.createElement('div');
    title.className = 'tm-card-title';
    title.textContent = betreff || bezeichnung || '(ohne Betreff)';

    const subtitle = document.createElement('div');
    subtitle.className = 'tm-card-subtitle';
    subtitle.textContent = bezeichnung;

    const meta = document.createElement('div');
    meta.className = 'tm-card-meta';
    const metaParts = [bearbeiter, angelegt, pool, meldungsId ? '#' + meldungsId : ''].filter(Boolean);
    meta.textContent = metaParts.join(' · ');

    body.appendChild(title);
    if (bezeichnung && bezeichnung !== betreff) body.appendChild(subtitle);
    body.appendChild(meta);

    wrap.appendChild(avatar);
    wrap.appendChild(body);

    // Alle originalen <td> ausblenden statt zu löschen, damit onclick/Daten
    // und eventuelle andere Skripte (z.B. Sortierung) unangetastet bleiben.
    Array.from(row.children).forEach(function (td) {
      if (td.tagName === 'TD') td.classList.add('tm-card-hidden-cell');
    });
    row.appendChild(wrap);
  }

  function upgradeAll() {
    document.querySelectorAll(ROW_SEL).forEach(function (row) {
      if (row.hasAttribute(DONE_ATTR)) return;
      if (!row.querySelector('td.tsticket_subject, td.tsticket_staff')) return;
      buildCard(row);
    });
  }

  const css = `
    @media (max-width: 900px) {
      tr.tm-card {
        display: block !important;
        border-radius: 10px;
        margin: 8px 6px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        background: #fff;
        border-left: 6px solid #9ca3af;
        overflow: hidden;
      }
      tr.tm-card.tm-prio-critical { border-left-color: #dc2626; }
      tr.tm-card.tm-prio-high     { border-left-color: #f97316; }
      tr.tm-card.tm-prio-weekend  { border-left-color: #a855f7; }
      tr.tm-card.tm-prio-medium   { border-left-color: #3b82f6; }
      tr.tm-card.tm-prio-low      { border-left-color: #9ca3af; }

      tr.tm-card td.tm-card-hidden-cell { display: none !important; }
      tr.tm-card td.click_entry { display: none !important; }

      .tm-card-inner {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 12px;
      }
      .tm-card-avatar {
        flex: 0 0 auto;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        letter-spacing: 0.5px;
      }
      .tm-card-body {
        flex: 1 1 auto;
        min-width: 0;
      }
      .tm-card-title {
        font-size: 15px;
        font-weight: 600;
        color: #111827;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
      .tm-card-subtitle {
        font-size: 12px;
        color: #6b7280;
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tm-card-meta {
        font-size: 11px;
        color: #9ca3af;
        margin-top: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  upgradeAll();

  const observer = new MutationObserver(function () {
    upgradeAll();
  });
  const tbody = document.querySelector('table tbody');
  if (tbody) observer.observe(tbody, { childList: true, subtree: false });

  // Fallback-Tick für dynamisch nachgeladene Zeilen ohne DOM-Insert-Event
  setInterval(upgradeAll, 2000);
})();
