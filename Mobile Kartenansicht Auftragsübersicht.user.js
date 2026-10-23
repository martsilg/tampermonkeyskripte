// ==UserScript==
// @name         Mobile Kartenansicht Auftragsübersicht
// @namespace    https://github.com/martsilg/tampermonkeyskripte
// @version      1.1.2
// @description  PowerApps-artige Kartenansicht für die mobile Ticket-Übersicht (Betreff, Status, Priorität, Bearbeiter, Pool, Termine, Arbeitszeit, aktueller Stand)
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

  // Tooltips können HTML enthalten (data-bs-html) - per <template> in reinen
  // Text umwandeln. Inhalte eines <template> werden nicht ausgeführt.
  function plainText(html) {
    if (html.indexOf('<') === -1) return html;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    return tpl.content.textContent;
  }

  function textOf(row, colClass) {
    const cell = row.querySelector('td.' + colClass + ' .limiter');
    if (!cell) return '';
    return plainText(cell.getAttribute('data-bs-original-title') || cell.textContent || '').replace(/\s+/g, ' ').trim();
  }

  // Erster nicht leerer Wert aus mehreren möglichen Spalten - die Übersichten
  // blenden je nach Konfiguration unterschiedliche Spalten ein.
  function firstTextOf(row, colClasses) {
    for (let i = 0; i < colClasses.length; i++) {
      const v = textOf(row, colClasses[i]);
      if (v) return v;
    }
    return '';
  }

  // Fälligkeit im Format TT.MM.JJJJ (ggf. mit Uhrzeit) liegt in der Vergangenheit?
  function isOverdue(dueText) {
    const m = dueText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!m) return false;
    const due = new Date(+m[3], +m[2] - 1, +m[1], m[4] ? +m[4] : 23, m[5] ? +m[5] : 59);
    return due.getTime() < Date.now();
  }

  // Felder der Karte: [Beschriftung, Spalten in Prioritätsreihenfolge].
  // Zwei Gruppen: was sich während der Bearbeitung ändert, steht oben;
  // Stammdaten, die beim Anlegen feststehen, gesammelt in einem Kasten unten.
  const WORK_FIELDS = [
    ['Status',       ['lookup_tsticket_tsticketlc_id']],
    ['Priorität',    ['lookup_tsticket_tsprio_id']],
    ['Bearbeiter',   ['tsticket_staff']],
    ['Fälligkeit',   ['tsticket_due']],
    ['Arbeitszeit',  ['tsticket_worktimehours', 'tsticket_worktimeworkerhours', 'tsticket_workhours', 'tsticket_hours']]
  ];
  const MASTER_FIELDS = [
    ['Angelegt von', ['tsticket_creatorfullname', 'tsticket_creator']],
    ['Angelegt am',  ['tsticket_createtime']],
    ['Arbeitspool',  ['lookup_tsticket_tspool_id']]
  ];

  // Raster mit Beschriftung/Wert. Felder ohne Wert (Spalte in der
  // Übersicht nicht eingeblendet oder leer) entfallen. Liefert null,
  // wenn kein einziges Feld einen Wert hat.
  function buildFieldGrid(row, fields, className) {
    const grid = document.createElement('dl');
    grid.className = 'tm-card-details ' + className;
    fields.forEach(function (field) {
      let value = firstTextOf(row, field[1]);
      if (!value) return;
      if (field[0] === 'Arbeitszeit') value += ' h';
      const item = document.createElement('div');
      item.className = 'tm-card-field';
      if (field[0] === 'Fälligkeit' && isOverdue(value)) item.classList.add('tm-card-overdue');
      const dt = document.createElement('dt');
      dt.textContent = field[0];
      const dd = document.createElement('dd');
      dd.textContent = value;
      item.appendChild(dt);
      item.appendChild(dd);
      grid.appendChild(item);
    });
    return grid.children.length ? grid : null;
  }

  function buildCard(row) {
    const bearbeiter = textOf(row, 'tsticket_staff');
    const prio = textOf(row, 'lookup_tsticket_tsprio_id');
    const bezeichnung = textOf(row, 'tsticket_tssubjectmattername');
    const betreff = textOf(row, 'tsticket_subject');
    const meldungsId = textOf(row, 'tsticket_number');
    // Aktueller Stand: sichtbarer Zellentext statt Tooltip - so liest ihn
    // auch das Edge-Addon (ticket-monitor-edge).
    const standCell = row.querySelector('td.latest_tsticketlog .limiter');
    const stand = standCell ? standCell.textContent.replace(/\s+/g, ' ').trim() : '';

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

    if (meldungsId) {
      const idEl = document.createElement('span');
      idEl.className = 'tm-card-id';
      idEl.textContent = '#' + meldungsId;
      title.prepend(idEl);
    }

    const workGrid = buildFieldGrid(row, WORK_FIELDS, 'tm-card-work');
    const masterGrid = buildFieldGrid(row, MASTER_FIELDS, 'tm-card-master');

    body.appendChild(title);
    if (bezeichnung && bezeichnung !== betreff) body.appendChild(subtitle);
    if (workGrid) body.appendChild(workGrid);
    if (stand) {
      const standEl = document.createElement('div');
      standEl.className = 'tm-card-stand';
      const standLabel = document.createElement('span');
      standLabel.className = 'tm-card-stand-label';
      standLabel.textContent = 'Aktueller Stand';
      const standText = document.createElement('span');
      standText.textContent = stand;
      standEl.appendChild(standLabel);
      standEl.appendChild(standText);
      body.appendChild(standEl);
    }
    if (masterGrid) body.appendChild(masterGrid);

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
      tr.tm-card.tm-prio-critical { border-left-color: #dc2626; background: #fde8e8; }
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
      .tm-card-id {
        font-size: 11px;
        font-weight: 600;
        color: #6b7280;
        margin-right: 6px;
      }
      .tm-card-details {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px 10px;
        margin: 8px 0 0;
      }
      .tm-card-field { min-width: 0; }
      .tm-card-field dt {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        color: #9ca3af;
        margin: 0;
      }
      .tm-card-field dd {
        font-size: 12px;
        color: #374151;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tm-card-overdue dd { color: #dc2626; font-weight: 600; }
      /* Stammdaten: eigener, zurückhaltender Kasten am Kartenende -
         ändern sich normalerweise nicht und sind deshalb nachrangig. */
      .tm-card-details.tm-card-master {
        margin-top: 8px;
        padding: 6px 8px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
      }
      .tm-card-master dd { color: #6b7280; }
      .tm-card-stand {
        margin-top: 8px;
        padding: 6px 8px;
        border-radius: 6px;
        background: #f3f4f6;
        font-size: 12px;
        color: #374151;
        line-height: 1.35;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
      }
      .tm-card-stand-label {
        font-weight: 600;
        color: #6b7280;
        margin-right: 4px;
      }
      .tm-card-stand-label::after { content: ':'; }
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
