import { initAmcThreeScene } from './scene3d.js';

const POLL_INTERVAL_SEC = 10;
const STORAGE_KEYS = {
  theme: 'amc_mail_theme',
  activeAddress: 'amc_mail_active_address',
  history: 'amc_mail_history',
  adminToken: 'amc_mail_admin_token',
};

const RANDOM_PREFIXES = [
  'karya', 'surya', 'nusa', 'bima', 'raka', 'tara', 'lintang', 'darma',
  'citra', 'senja', 'bayu', 'langit', 'prima', 'mega', 'satya', 'wira',
  'nadi', 'cakra', 'galih', 'laras', 'pandu', 'dimas', 'indra', 'artha',
  'amc', 'cloud', 'mail', 'promo', 'order', 'akun', 'verify', 'studio',
];

const LOCAL_PART_REGEX = /^[a-z0-9][a-z0-9._+-]{0,62}$/;

let threeController = null;

const state = {
  domains: [],
  defaultDomain: 'amc.web.id',
  blockedUsernames: [],
  retentionHours: 168,
  simulatorEnabled: false,

  activeLocalPart: '',
  activeDomain: '',
  history: [],

  filter: 'all',
  searchQuery: '',
  messages: [],
  counts: { all: 0, inbox: 0, bounce: 0, otp: 0, unread: 0 },
  inboxLoading: false,
  inboxError: null,
  knownMessageIds: new Set(),
  hasLoadedInitialInbox: false,

  selectedId: null,
  selectedDetail: null,
  readerLoading: false,
  readerError: null,
  readerTab: 'html',
  allowExternalImages: false,

  autoPoll: true,
  pollCountdown: POLL_INTERVAL_SEC,
  pollTimer: null,

  adminToken: '',
  adminAuthenticated: false,
  adminDefaultPin: false,
  adminActiveTab: 'monitor',
  adminDomains: [],
  adminMessages: [],
  adminInspectorDetail: null,
  adminInspectorTab: 'html',
  adminInspectorImages: false,
  lastFocusedBeforeModal: null,
};

const $ = (id) => document.getElementById(id);

const els = {
  hero3dCanvas: $('hero-3d-canvas'),
  ambient3dCanvas: $('ambient-3d-canvas'),
  btnToggle3d: $('btn-toggle-3d'),

  sidebarActiveAddr: $('sidebar-active-addr'),
  btnSidebarCopy: $('btn-sidebar-copy'),
  btnSidebarRandom: $('btn-sidebar-random'),
  sideCountAll: $('side-count-all'),
  sideCountInbox: $('side-count-inbox'),
  sideCountBounce: $('side-count-bounce'),
  sideCountOtp: $('side-count-otp'),
  sideDomainCount: $('side-domain-count'),
  btnSidebarAdmin: $('btn-sidebar-admin'),
  sidebarAdminDot: $('sidebar-admin-dot'),
  btnSidebarTheme: $('btn-sidebar-theme'),
  sidebarThemeLabel: $('sidebar-theme-label'),

  heroDomainCount: $('hero-domain-count'),
  heroInboxCount: $('hero-inbox-count'),
  heroBounceCount: $('hero-bounce-count'),

  btnThemeToggle: $('btn-theme-toggle'),
  iconMoon: $('icon-moon'),
  iconSun: $('icon-sun'),
  btnOpenAdmin: $('btn-open-admin'),
  adminActiveDot: $('admin-active-dot'),

  mobNavInbox: $('mob-nav-inbox'),
  mobNavBounce: $('mob-nav-bounce'),
  mobNavRandom: $('mob-nav-random'),
  mobNavAdmin: $('mob-nav-admin'),

  btnToggleAutoPoll: $('btn-toggle-autopoll'),
  pollStatusText: $('poll-status-text'),

  addressForm: $('address-form'),
  inputUsername: $('input-username'),
  selectDomain: $('select-domain'),
  btnApplyCustom: $('btn-apply-custom'),
  btnCopyEmail: $('btn-copy-email'),
  btnCopyLabel: $('btn-copy-label'),
  builderError: $('builder-error'),

  btnRandomUser: $('btn-random-user'),
  btnRandomAll: $('btn-random-all'),
  btnRefreshInbox: $('btn-refresh-inbox'),

  simMenuWrap: $('sim-menu-wrap'),
  btnSimMenu: $('btn-sim-menu'),
  simDropdown: $('sim-dropdown'),

  mailboxHistory: $('mailbox-history'),
  historyChips: $('history-chips'),

  mailWorkspace: $('mail-workspace'),
  inboxActiveLabel: $('inbox-active-label'),
  btnClearInbox: $('btn-clear-inbox'),
  inputInboxSearch: $('input-inbox-search'),
  inboxList: $('inbox-list'),
  countAll: $('count-all'),
  countInbox: $('count-inbox'),
  countBounce: $('count-bounce'),
  countOtp: $('count-otp'),
  tabFilterBounce: $('tab-filter-bounce'),

  readerEmpty: $('reader-empty'),
  readerContent: $('reader-content'),

  domainPills: $('domain-pills'),
  retentionInfo: $('retention-info'),
  footerYear: $('footer-year'),

  adminModal: $('admin-modal'),
  adminModalPanel: $('admin-modal-panel'),
  btnCloseAdmin: $('btn-close-admin'),
  btnAdminLogout: $('btn-admin-logout'),
  adminLoginForm: $('admin-login-form'),
  inputAdminPin: $('input-admin-pin'),
  adminLoginError: $('admin-login-error'),
  adminWorkspace: $('admin-workspace'),
  adminDefaultPinWarning: $('admin-default-pin-warning'),

  kpiTotalEmails: $('kpi-total-emails'),
  kpiEmails24h: $('kpi-emails-24h'),
  kpiTotalBounces: $('kpi-total-bounces'),
  kpiBounces24h: $('kpi-bounces-24h'),
  kpiActiveDomains: $('kpi-active-domains'),
  kpiPendingDomains: $('kpi-pending-domains'),
  kpiUniqueMailboxes: $('kpi-unique-mailboxes'),
  kpiTotalOtps: $('kpi-total-otps'),

  adminFilterDomain: $('admin-filter-domain'),
  adminFilterType: $('admin-filter-type'),
  adminFilterSearch: $('admin-filter-search'),
  btnAdminRefreshMsgs: $('btn-admin-refresh-msgs'),
  adminMessagesTbody: $('admin-messages-tbody'),

  adminAddDomainForm: $('admin-add-domain-form'),
  inputNewDomains: $('input-new-domains'),
  selectNewDomainStatus: $('select-new-domain-status'),
  inputNewDomainNotes: $('input-new-domain-notes'),
  adminDomainsTbody: $('admin-domains-tbody'),

  adminSettingsForm: $('admin-settings-form'),
  selectRetentionHours: $('select-retention-hours'),
  checkAutoRegister: $('check-auto-register'),
  inputBlockedUsers: $('input-blocked-users'),
  btnAdminPurge: $('btn-admin-purge'),

  adminSimForm: $('admin-sim-form'),
  inputAdminSimTo: $('input-admin-sim-to'),
  selectAdminSimType: $('select-admin-sim-type'),
  inputAdminSimFailed: $('input-admin-sim-failed'),

  inspectorModal: $('inspector-modal'),
  inspectorBody: $('inspector-body'),
  btnCloseInspector: $('btn-close-inspector'),

  toastStack: $('toast-stack'),
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getActiveAddress() {
  if (!state.activeLocalPart || !state.activeDomain) return '';
  return `${state.activeLocalPart}@${state.activeDomain}`;
}

function generateRandomUsername() {
  const word = RANDOM_PREFIXES[Math.floor(Math.random() * RANDOM_PREFIXES.length)];
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${word}.${suffix}`;
}

function formatRelativeTime(ts) {
  if (!ts) return '-';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 15) return 'baru saja';
  if (diffSec < 60) return `${diffSec} dtk lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function formatFullDateTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatRetentionLabel(hours) {
  const h = Number(hours || 168);
  if (h < 48) return `${h} jam`;
  return `${Math.round(h / 24)} hari`;
}

function showToast(message, variant = 'default') {
  const div = document.createElement('div');
  div.className = `toast ${variant === 'error' ? 'is-error' : variant === 'success' ? 'is-success' : ''}`;
  div.textContent = message;
  els.toastStack.appendChild(div);
  setTimeout(() => {
    div.remove();
  }, 3000);
}

async function copyText(text, successMsg = 'Disalin ke clipboard') {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    showToast(successMsg, 'success');
    return true;
  } catch {
    showToast('Gagal menyalin ke clipboard', 'error');
    return false;
  }
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.admin && state.adminToken) {
    headers.set('Authorization', `Bearer ${state.adminToken}`);
  }
  const res = await fetch(path, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const errMsg = (data && data.error) || `HTTP ${res.status}`;
    const err = new Error(errMsg);
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data;
}

function syncThemeUI() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  els.iconMoon.classList.toggle('hidden', isDark);
  els.iconSun.classList.toggle('hidden', !isDark);
  els.btnThemeToggle.setAttribute('aria-pressed', String(isDark));
  els.sidebarThemeLabel.textContent = isDark ? 'Mode Terang' : 'Mode Gelap';
  threeController?.setTheme(isDark ? 'dark' : 'light');
}

function toggleTheme() {
  const root = document.documentElement;
  root.classList.add('theme-switching');
  const isDark = root.getAttribute('data-theme') === 'dark';
  if (isDark) {
    root.removeAttribute('data-theme');
    try { localStorage.setItem(STORAGE_KEYS.theme, 'light'); } catch {}
  } else {
    root.setAttribute('data-theme', 'dark');
    try { localStorage.setItem(STORAGE_KEYS.theme, 'dark'); } catch {}
  }
  syncThemeUI();
  void root.offsetHeight;
  requestAnimationFrame(() => root.classList.remove('theme-switching'));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.history);
    const arr = raw ? JSON.parse(raw) : [];
    state.history = Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && x.includes('@')).slice(0, 8) : [];
  } catch {
    state.history = [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history.slice(0, 8)));
  } catch {}
}

function addToHistory(address) {
  if (!address) return;
  state.history = [address, ...state.history.filter((a) => a !== address)].slice(0, 8);
  saveHistory();
  renderHistoryChips();
}

function removeFromHistory(address) {
  state.history = state.history.filter((a) => a !== address);
  saveHistory();
  renderHistoryChips();
}

function renderHistoryChips() {
  const active = getActiveAddress();
  if (state.history.length <= 1) {
    els.mailboxHistory.classList.add('hidden');
    return;
  }
  els.mailboxHistory.classList.remove('hidden');
  els.historyChips.innerHTML = state.history
    .map((addr) => {
      const isCurrent = addr === active;
      return `
        <span class="mailbox-chip ${isCurrent ? 'is-active' : ''}">
          <button type="button" class="chip-select-btn" data-switch-addr="${escapeHtml(addr)}">${escapeHtml(addr)}</button>
          ${!isCurrent ? `<button type="button" class="chip-remove-btn" data-remove-addr="${escapeHtml(addr)}" aria-label="Hapus ${escapeHtml(addr)} dari riwayat">x</button>` : ''}
        </span>
      `;
    })
    .join('');
}

function setFilter(nextFilter, { scrollToInbox = false } = {}) {
  state.filter = nextFilter;

  document.querySelectorAll('.filter-tab').forEach((t) => {
    const active = t.dataset.filter === nextFilter;
    t.classList.toggle('is-active', active);
    t.setAttribute('aria-selected', String(active));
  });

  document.querySelectorAll('[data-nav-filter]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.navFilter === nextFilter);
  });

  els.mobNavInbox.classList.toggle('is-active', nextFilter !== 'bounce');
  els.mobNavBounce.classList.toggle('is-active', nextFilter === 'bounce');

  if (scrollToInbox) {
    els.mailWorkspace.classList.remove('is-reading');
    els.mailWorkspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  fetchInbox({ silent: false });
}

function setActiveAddress(localPart, domain, { pushUrl = true, animate3d = true } = {}) {
  const cleanUser = String(localPart || '').trim().toLowerCase();
  const cleanDomain = String(domain || state.defaultDomain).trim().toLowerCase();

  state.activeLocalPart = cleanUser;
  state.activeDomain = cleanDomain;
  state.selectedId = null;
  state.selectedDetail = null;
  state.hasLoadedInitialInbox = false;
  state.knownMessageIds = new Set();

  els.inputUsername.value = cleanUser;
  if ([...els.selectDomain.options].some((o) => o.value === cleanDomain)) {
    els.selectDomain.value = cleanDomain;
  }
  els.btnApplyCustom.classList.add('hidden');
  els.builderError.classList.add('hidden');

  const full = getActiveAddress();
  els.inboxActiveLabel.textContent = full;
  els.sidebarActiveAddr.textContent = full;
  els.mailWorkspace.classList.remove('is-reading');

  try {
    localStorage.setItem(STORAGE_KEYS.activeAddress, full);
  } catch {}

  if (pushUrl && window.history?.replaceState) {
    const u = new URL(window.location.href);
    u.searchParams.set('email', full);
    window.history.replaceState({}, '', u.toString());
  }

  addToHistory(full);
  renderDomainCards();
  renderReaderEmpty();
  if (animate3d) {
    threeController?.pulse('generate');
  }
  fetchInbox({ silent: false });
  resetPollCountdown();
}

function validateUsernameInput(rawUser) {
  const clean = String(rawUser || '').trim().toLowerCase();
  if (!clean) {
    return { valid: false, error: 'Username tidak boleh kosong.' };
  }
  if (!LOCAL_PART_REGEX.test(clean)) {
    return {
      valid: false,
      error: 'Gunakan huruf kecil, angka, titik (.), strip (-), atau underscore (_), diawali huruf atau angka.',
    };
  }
  if (clean.includes('..')) {
    return { valid: false, error: 'Username tidak boleh mengandung dua titik berurutan (..).' };
  }
  if (state.blockedUsernames.includes(clean)) {
    return { valid: false, error: `Username "${clean}" dibatasi oleh Admin.` };
  }
  return { valid: true, value: clean };
}

function renderDomainControls() {
  const list = state.domains;
  els.sideDomainCount.textContent = String(list.length);
  els.heroDomainCount.textContent = String(list.length);
  els.retentionInfo.textContent = `Retensi otomatis: ${formatRetentionLabel(state.retentionHours)}`;
  threeController?.setDomainCount(list.length);

  const currentSelection = state.activeDomain || state.defaultDomain;
  els.selectDomain.innerHTML = list
    .map((d) => `<option value="${escapeHtml(d.domain)}">${escapeHtml(d.domain)}</option>`)
    .join('');

  if (list.some((d) => d.domain === currentSelection)) {
    els.selectDomain.value = currentSelection;
  } else if (list[0]) {
    els.selectDomain.value = list[0].domain;
  }

  renderDomainCards();
}

function renderDomainCards() {
  els.domainPills.innerHTML = state.domains
    .map((d) => {
      const active = d.domain === state.activeDomain;
      const tag = active ? 'Aktif' : d.isDefault ? 'Utama' : 'Pilih';
      return `
        <button type="button" class="domain-card-btn ${active ? 'is-current' : ''}" data-pick-domain="${escapeHtml(d.domain)}">
          <span class="domain-card-name">@${escapeHtml(d.domain)}</span>
          <span class="domain-card-tag">${tag}</span>
        </button>
      `;
    })
    .join('');
}

async function fetchInbox({ silent = false } = {}) {
  const address = getActiveAddress();
  if (!address) return;

  if (!silent) {
    state.inboxLoading = true;
    state.inboxError = null;
    els.inboxList.setAttribute('aria-busy', 'true');
    if (!state.hasLoadedInitialInbox) {
      renderInboxList();
    }
  }

  try {
    const params = new URLSearchParams({
      address,
      filter: state.filter,
      q: state.searchQuery,
    });
    const data = await apiFetch(`/api/inbox?${params.toString()}`);

    const incomingIds = new Set(data.messages.map((m) => m.id));
    if (state.hasLoadedInitialInbox && silent) {
      const newlyArrived = data.messages.filter((m) => !state.knownMessageIds.has(m.id));
      if (newlyArrived.length > 0) {
        const first = newlyArrived[0];
        if (first.isBounce) {
          threeController?.pulse('bounce');
          showToast(`Bounce terdeteksi (${first.bounceSummary?.smtpCode || 'DSN'}): ${first.subject}`, 'error');
        } else if (first.otpCode) {
          threeController?.pulse('otp');
          showToast(`Kode OTP baru masuk: ${first.otpCode}`, 'success');
        } else {
          threeController?.pulse('inbox');
          showToast(`${newlyArrived.length} pesan baru masuk ke ${address}`, 'success');
        }
      }
    }

    state.knownMessageIds = incomingIds;
    state.hasLoadedInitialInbox = true;
    state.inboxLoading = false;
    state.inboxError = null;
    state.messages = data.messages;
    state.counts = data.counts;

    els.inboxList.setAttribute('aria-busy', 'false');
    renderCounts();
    renderInboxList();
  } catch (err) {
    state.inboxLoading = false;
    state.inboxError = err.message;
    els.inboxList.setAttribute('aria-busy', 'false');
    renderInboxList();
    if (!silent) {
      showToast(`Gagal memuat inbox: ${err.message}`, 'error');
    }
  }
}

function renderCounts() {
  els.countAll.textContent = state.counts.all;
  els.countInbox.textContent = state.counts.inbox;
  els.countBounce.textContent = state.counts.bounce;
  els.countOtp.textContent = state.counts.otp;
  els.sideCountAll.textContent = state.counts.all;
  els.sideCountInbox.textContent = state.counts.inbox;
  els.sideCountBounce.textContent = state.counts.bounce;
  els.sideCountOtp.textContent = state.counts.otp;
  els.heroInboxCount.textContent = state.counts.all;
  els.heroBounceCount.textContent = state.counts.bounce;
  els.tabFilterBounce.classList.toggle('has-items', state.counts.bounce > 0);
}

function renderInboxList() {
  const address = getActiveAddress();

  if (state.inboxLoading && !state.hasLoadedInitialInbox) {
    els.inboxList.innerHTML = `
      <div class="state-panel" role="status">
        <h3>Memuat kotak masuk</h3>
        <p>Mengambil daftar pesan untuk <span class="mono">${escapeHtml(address)}</span>.</p>
      </div>
    `;
    return;
  }

  if (state.inboxError) {
    els.inboxList.innerHTML = `
      <div class="state-panel" role="alert">
        <h3 class="state-error-title">Gagal memuat kotak masuk</h3>
        <p>${escapeHtml(state.inboxError)}</p>
        <button type="button" class="btn btn-sm" id="btn-retry-inbox">Coba Lagi</button>
      </div>
    `;
    return;
  }

  if (!state.messages.length) {
    const filterMsg =
      state.filter === 'bounce'
        ? 'Belum ada laporan bounce atau gagal kirim (DSN) di alamat ini.'
        : state.filter === 'otp'
        ? 'Belum ada pesan kode OTP atau verifikasi di alamat ini.'
        : state.searchQuery
        ? `Tidak ditemukan pesan yang cocok dengan kata kunci "${state.searchQuery}".`
        : 'Kotak masuk masih kosong. Kirim email atau bounce ke alamat di bawah ini agar pesan muncul otomatis.';

    els.inboxList.innerHTML = `
      <div class="state-panel">
        <h3>Menunggu Pesan Masuk</h3>
        <p>${escapeHtml(filterMsg)}</p>
        <div class="state-addr-box">${escapeHtml(address)}</div>
      </div>
    `;
    return;
  }

  els.inboxList.innerHTML = state.messages
    .map((m) => {
      const selected = m.id === state.selectedId;
      const senderLabel = m.fromName || m.fromAddress || (m.sender === '<>' ? 'MAILER-DAEMON (Null Sender)' : m.sender);
      const badges = [];

      if (m.isBounce) {
        const isSoft = m.bounceSummary?.severity === 'soft';
        const codeStr = [m.bounceSummary?.smtpCode, m.bounceSummary?.enhancedStatus].filter(Boolean).join(' ');
        badges.push(
          `<span class="badge ${isSoft ? 'badge-soft' : 'badge-hard'}">${isSoft ? 'SOFT BOUNCE' : 'HARD BOUNCE'}${codeStr ? `: ${escapeHtml(codeStr)}` : ''}</span>`
        );
      }

      if (m.otpCode) {
        badges.push(
          `<button type="button" class="badge badge-otp" data-copy-otp="${escapeHtml(m.otpCode)}" aria-label="Salin kode OTP ${escapeHtml(m.otpCode)}">Salin OTP <span class="mono">${escapeHtml(m.otpCode)}</span></button>`
        );
      }

      if (m.hasAttachments) {
        badges.push('<span class="badge badge-neutral">Lampiran</span>');
      }

      return `
        <article class="message-item ${selected ? 'is-selected' : ''} ${!m.isRead ? 'is-unread' : ''} ${m.isBounce ? 'is-bounce' : ''}">
          <button type="button" class="message-open-btn" data-open-email="${escapeHtml(m.id)}" aria-current="${selected ? 'true' : 'false'}">
            <div class="msg-row-top">
              <span class="msg-sender">
                ${!m.isRead ? '<span class="unread-label">Baru</span>' : ''}
                <span class="msg-sender-name">${escapeHtml(senderLabel)}</span>
              </span>
              <span class="msg-time">${escapeHtml(formatRelativeTime(m.receivedAt))}</span>
            </div>
            <div class="msg-subject">${escapeHtml(m.subject)}</div>
            <div class="msg-snippet">${escapeHtml(m.snippet || '(Tanpa pratinjau teks)')}</div>
          </button>
          ${badges.length ? `<div class="msg-badges-bar">${badges.join('')}</div>` : ''}
        </article>
      `;
    })
    .join('');
}

function renderReaderEmpty() {
  els.readerEmpty.classList.remove('hidden');
  els.readerContent.classList.add('hidden');
  els.readerContent.innerHTML = '';
}

async function openEmail(id) {
  const address = getActiveAddress();
  if (!address || !id) return;

  state.selectedId = id;
  state.readerLoading = true;
  state.readerError = null;
  renderInboxList();
  els.mailWorkspace.classList.add('is-reading');
  els.readerEmpty.classList.add('hidden');
  els.readerContent.classList.remove('hidden');
  els.readerContent.innerHTML = `
    <div class="state-panel" role="status">
      <h3>Membuka isi pesan</h3>
      <p>Mengambil detail header, lampiran, dan diagnostik SMTP.</p>
    </div>
  `;

  try {
    const data = await apiFetch(`/api/emails/${encodeURIComponent(id)}?address=${encodeURIComponent(address)}`);
    state.readerLoading = false;
    state.selectedDetail = data.email;
    state.allowExternalImages = false;
    state.readerTab = data.email.htmlBody ? 'html' : data.email.isBounce && data.email.bounceInfo?.rawDsn ? 'dsn' : 'text';

    const listItem = state.messages.find((m) => m.id === id);
    if (listItem && !listItem.isRead) {
      listItem.isRead = true;
      state.counts.unread = Math.max(0, state.counts.unread - 1);
      renderInboxList();
    }

    if (data.email.isBounce) threeController?.pulse('bounce');
    else if (data.email.otpCode) threeController?.pulse('otp');
    else threeController?.pulse('inbox');

    renderEmailIntoContainer(els.readerContent, state.selectedDetail, {
      activeTab: state.readerTab,
      allowImages: state.allowExternalImages,
      isAdminMode: false,
    });
  } catch (err) {
    state.readerLoading = false;
    state.readerError = err.message;
    els.readerContent.innerHTML = `
      <div class="state-panel" role="alert">
        <button type="button" class="btn btn-sm mobile-back-btn" id="btn-mobile-back">Kembali ke Inbox</button>
        <h3 class="state-error-title">Gagal membuka pesan</h3>
        <p>${escapeHtml(err.message)}</p>
        <button type="button" class="btn btn-sm" data-retry-email="${escapeHtml(id)}">Coba Lagi</button>
      </div>
    `;
  }
}

function buildSandboxedHtmlDoc(rawHtml, allowExternalImages) {
  const csp = allowExternalImages
    ? "default-src 'none'; style-src 'unsafe-inline'; img-src * data: blob:; font-src * data:;"
    : "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:;";
  const baseCss = `<style>body{margin:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;word-wrap:break-word;}img{max-width:100%;height:auto;}pre,code{white-space:pre-wrap;word-break:break-word;}a{color:#0369a1;}</style>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank">${baseCss}</head><body>${rawHtml}</body></html>`;
}

function renderBounceDiagnosticCard(bounceInfo) {
  if (!bounceInfo) return '';
  const isSoft = bounceInfo.severity === 'soft';
  const codeText = [bounceInfo.smtpCode, bounceInfo.enhancedStatus].filter(Boolean).join(' / ') || 'DSN';

  const metaPairs = [
    ['Alamat Tujuan Gagal', bounceInfo.finalRecipient],
    ['Aksi DSN', bounceInfo.action ? bounceInfo.action.toUpperCase() : null],
    ['Server Pelapor (Reporting MTA)', bounceInfo.reportingMta],
    ['Server Tujuan (Remote MTA)', bounceInfo.remoteMta],
    ['Subjek Email Asli', bounceInfo.originalSubject],
  ].filter(([, val]) => Boolean(val));

  return `
    <div class="bounce-card ${isSoft ? 'is-soft' : ''}">
      <div class="bounce-card-head">
        <div>
          <div class="bounce-card-title">${escapeHtml(bounceInfo.label || 'Laporan Bounce / DSN')}</div>
          <div class="bounce-card-desc">${escapeHtml(bounceInfo.explanation || '')}</div>
        </div>
        <span class="bounce-code-pill">${escapeHtml(codeText)}</span>
      </div>
      <div class="bounce-card-body">
        ${
          metaPairs.length
            ? `<div class="bounce-grid">
                ${metaPairs
                  .map(
                    ([lbl, val]) => `
                    <div class="meta-item">
                      <span class="meta-label">${escapeHtml(lbl)}</span>
                      <span class="meta-value mono" style="font-size:0.82rem;">${escapeHtml(val)}</span>
                    </div>`
                  )
                  .join('')}
              </div>`
            : ''
        }
        ${
          bounceInfo.diagnostic
            ? `<div class="meta-item">
                <span class="meta-label" style="margin-bottom:4px;">Pesan Diagnostik SMTP</span>
                <div class="bounce-diag-box">${escapeHtml(bounceInfo.diagnostic)}</div>
              </div>`
            : ''
        }
      </div>
    </div>
  `;
}

function renderEmailIntoContainer(container, email, { activeTab, allowImages, isAdminMode }) {
  const fromDisplay = email.fromName
    ? `${email.fromName} <${email.fromAddress || email.sender}>`
    : email.fromAddress || email.sender;

  const authBadges = [];
  if (email.authResults) {
    for (const key of ['spf', 'dkim', 'dmarc']) {
      const val = email.authResults[key];
      if (!val) continue;
      const cls = val === 'pass' ? 'badge-otp' : val === 'fail' ? 'badge-hard' : 'badge-neutral';
      authBadges.push(`<span class="badge ${cls} mono">${key.toUpperCase()}: ${escapeHtml(val)}</span>`);
    }
  }
  if (email.sender === '<>') {
    authBadges.unshift('<span class="badge badge-soft mono">MAIL FROM: &lt;&gt; (Bounce)</span>');
  }

  const tabs = [];
  if (email.htmlBody) tabs.push({ id: 'html', label: 'Tampilan HTML' });
  tabs.push({ id: 'text', label: 'Teks Polos' });
  if (email.isBounce && email.bounceInfo?.rawDsn) tabs.push({ id: 'dsn', label: 'Laporan DSN' });
  tabs.push({ id: 'headers', label: `Header (${(email.headers || []).length})` });
  tabs.push({ id: 'raw', label: 'Raw EML' });

  const resolvedTab = tabs.some((t) => t.id === activeTab) ? activeTab : tabs[0].id;
  const rawDownloadUrl = isAdminMode
    ? `/api/emails/${encodeURIComponent(email.id)}/raw`
    : `/api/emails/${encodeURIComponent(email.id)}/raw?address=${encodeURIComponent(email.recipient)}`;

  let bodyHtml = '';
  if (resolvedTab === 'html' && email.htmlBody) {
    bodyHtml = `
      <div class="privacy-bar">
        <span>${allowImages ? 'Gambar eksternal sedang ditampilkan.' : 'Gambar eksternal diblokir otomatis demi privasi.'}</span>
        <button type="button" class="btn btn-sm" data-toggle-images="${isAdminMode ? 'admin' : 'public'}">
          ${allowImages ? 'Blokir Gambar Eksternal' : 'Tampilkan Gambar Eksternal'}
        </button>
      </div>
      <iframe
        class="html-frame"
        width="800"
        height="420"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        referrerpolicy="no-referrer"
        title="Isi Email HTML"
      ></iframe>
    `;
  } else if (resolvedTab === 'text') {
    bodyHtml = `<pre class="plain-pre">${escapeHtml(email.textBody || '(Email ini tidak memiliki versi teks polos. Buka tab Tampilan HTML atau Raw EML.)')}</pre>`;
  } else if (resolvedTab === 'dsn') {
    bodyHtml = `<pre class="plain-pre">${escapeHtml(email.bounceInfo?.rawDsn || '(Tidak ada blok message/delivery-status terpisah.)')}</pre>`;
  } else if (resolvedTab === 'headers') {
    const rows = (email.headers || [])
      .map((h) => `<tr><th>${escapeHtml(h.key)}</th><td>${escapeHtml(h.value)}</td></tr>`)
      .join('');
    bodyHtml = `
      <div class="data-table-wrap">
        <table class="headers-table">
          <tbody>${rows || '<tr><td colspan="2">Tidak ada header.</td></tr>'}</tbody>
        </table>
      </div>
    `;
  } else if (resolvedTab === 'raw') {
    bodyHtml = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
        <button type="button" class="btn btn-sm" data-copy-raw="${isAdminMode ? 'admin' : 'public'}">Salin Raw EML</button>
      </div>
      <pre class="plain-pre">${escapeHtml(email.rawSource || '')}</pre>
    `;
  }

  const attachmentsHtml = (email.attachments || []).length
    ? `
      <div class="attachments-strip">
        <div class="attachments-title">Lampiran (${email.attachments.length})</div>
        <div class="attachments-list">
          ${email.attachments
            .map((att) => {
              const dlUrl = `/api/attachments/${encodeURIComponent(att.id)}?address=${encodeURIComponent(email.recipient)}`;
              return att.downloadable
                ? `<a class="attachment-pill" href="${dlUrl}" download="${escapeHtml(att.filename)}">
                    <span>${escapeHtml(att.filename)}</span>
                    <span class="attachment-size">${escapeHtml(formatBytes(att.sizeBytes))}</span>
                   </a>`
                : `<span class="attachment-pill">
                    <span>${escapeHtml(att.filename)} (melebihi batas inline)</span>
                    <span class="attachment-size">${escapeHtml(formatBytes(att.sizeBytes))}</span>
                   </span>`;
            })
            .join('')}
        </div>
      </div>
    `
    : '';

  container.innerHTML = `
    <div class="reader-header">
      ${
        !isAdminMode
          ? '<button type="button" class="btn btn-sm mobile-back-btn" id="btn-mobile-back">Kembali ke Inbox</button>'
          : ''
      }
      <div class="reader-top-bar">
        <h3 class="reader-subject">${escapeHtml(email.subject)}</h3>
        <div class="reader-actions">
          ${
            !isAdminMode
              ? `<a class="btn btn-sm" href="${rawDownloadUrl}" download>Unduh .eml</a>`
              : `<button type="button" class="btn btn-sm" data-download-raw-admin="${escapeHtml(email.id)}">Unduh .eml</button>`
          }
          <button type="button" class="btn btn-sm btn-danger-outline" data-delete-email="${escapeHtml(email.id)}" data-delete-mode="${isAdminMode ? 'admin' : 'public'}">Hapus</button>
        </div>
      </div>

      <div class="reader-meta-grid">
        <div class="meta-item">
          <span class="meta-label">Dari</span>
          <span class="meta-value">${escapeHtml(fromDisplay)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Kepada (Penerima)</span>
          <span class="meta-value mono" style="font-size:0.82rem;">${escapeHtml(email.recipient)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Diterima</span>
          <span class="meta-value">${escapeHtml(formatFullDateTime(email.receivedAt))} (${escapeHtml(formatBytes(email.sizeBytes))})</span>
        </div>
      </div>

      ${authBadges.length ? `<div class="auth-strip">${authBadges.join('')}</div>` : ''}
    </div>

    ${
      email.otpCode
        ? `
      <div class="otp-banner">
        <div>
          <div class="otp-label">Kode OTP / Verifikasi Terdeteksi</div>
          <div class="otp-value">${escapeHtml(email.otpCode)}</div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" data-copy-otp="${escapeHtml(email.otpCode)}">Salin Kode OTP</button>
      </div>
    `
        : ''
    }

    ${email.isBounce ? renderBounceDiagnosticCard(email.bounceInfo) : ''}

    <div class="reader-tabs">
      <div class="reader-tab-list" role="tablist">
        ${tabs
          .map(
            (t) => `
          <button
            type="button"
            class="reader-tab ${t.id === resolvedTab ? 'is-active' : ''}"
            data-reader-tab="${t.id}"
            data-reader-scope="${isAdminMode ? 'admin' : 'public'}"
            role="tab"
            aria-selected="${t.id === resolvedTab ? 'true' : 'false'}"
          >${escapeHtml(t.label)}</button>`
          )
          .join('')}
      </div>
    </div>

    <div class="reader-body-area">
      ${bodyHtml}
    </div>

    ${attachmentsHtml}
  `;

  if (resolvedTab === 'html' && email.htmlBody) {
    const iframe = container.querySelector('iframe.html-frame');
    if (iframe) {
      iframe.srcdoc = buildSandboxedHtmlDoc(email.htmlBody, allowImages);
    }
  }
}

function resetPollCountdown() {
  state.pollCountdown = POLL_INTERVAL_SEC;
  updatePollBadge();
}

function updatePollBadge() {
  els.btnToggleAutoPoll.classList.toggle('is-paused', !state.autoPoll);
  els.btnToggleAutoPoll.setAttribute('aria-pressed', String(state.autoPoll));
  els.pollStatusText.textContent = state.autoPoll ? `Otomatis ${state.pollCountdown}d` : 'Otomatis dijeda';
}

function startPollingLoop() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => {
    if (!state.autoPoll || document.visibilityState !== 'visible') return;
    state.pollCountdown -= 1;
    if (state.pollCountdown <= 0) {
      state.pollCountdown = POLL_INTERVAL_SEC;
      fetchInbox({ silent: true });
    }
    updatePollBadge();
  }, 1000);
}

async function triggerSimulation(scenario, customAddress = null, extra = {}) {
  const recipient = customAddress || getActiveAddress();
  if (!recipient) return;

  try {
    const res = await apiFetch('/api/simulate', {
      method: 'POST',
      admin: state.adminAuthenticated,
      body: JSON.stringify({
        scenario,
        recipient,
        ...extra,
      }),
    });

    if (res.isBounce) {
      threeController?.pulse('bounce');
      showToast(`Simulasi bounce (${res.bounceSummary?.smtpCode || 'DSN'}) terkirim ke ${recipient}`, 'success');
    } else if (res.otpCode) {
      threeController?.pulse('otp');
      showToast(`Simulasi OTP (${res.otpCode}) terkirim ke ${recipient}`, 'success');
    } else {
      threeController?.pulse('inbox');
      showToast(`Email simulasi terkirim ke ${recipient}`, 'success');
    }

    if (recipient === getActiveAddress()) {
      await fetchInbox({ silent: false });
      if (res.id) await openEmail(res.id);
    }
    if (state.adminAuthenticated) {
      loadAdminStatsAndMessages();
    }
  } catch (err) {
    showToast(`Simulasi gagal: ${err.message}`, 'error');
  }
}

function updateAdminIndicators() {
  els.adminActiveDot.classList.toggle('hidden', !state.adminAuthenticated);
  els.sidebarAdminDot.classList.toggle('hidden', !state.adminAuthenticated);
  const showSim = state.simulatorEnabled || state.adminAuthenticated;
  els.simMenuWrap.classList.toggle('hidden', !showSim);
}

async function openAdminModal() {
  state.lastFocusedBeforeModal = document.activeElement;
  els.adminModal.classList.remove('hidden');
  els.adminLoginError.classList.add('hidden');

  if (state.adminToken) {
    try {
      const sess = await apiFetch('/api/admin/session', { admin: true });
      state.adminAuthenticated = true;
      state.adminDefaultPin = Boolean(sess.isDefaultPin);
      showAdminWorkspace();
      return;
    } catch {
      state.adminToken = '';
      state.adminAuthenticated = false;
      try { sessionStorage.removeItem(STORAGE_KEYS.adminToken); } catch {}
    }
  }

  updateAdminIndicators();
  els.adminModalPanel.classList.add('is-compact');
  els.adminLoginForm.classList.remove('hidden');
  els.adminWorkspace.classList.add('hidden');
  els.btnAdminLogout.classList.add('hidden');
  els.inputAdminPin.focus();
}

function closeAdminModal() {
  els.adminModal.classList.add('hidden');
  if (state.lastFocusedBeforeModal && typeof state.lastFocusedBeforeModal.focus === 'function') {
    state.lastFocusedBeforeModal.focus();
  }
}

function showAdminWorkspace() {
  updateAdminIndicators();
  els.adminModalPanel.classList.remove('is-compact');
  els.adminLoginForm.classList.add('hidden');
  els.adminWorkspace.classList.remove('hidden');
  els.btnAdminLogout.classList.remove('hidden');
  els.adminDefaultPinWarning.classList.toggle('hidden', !state.adminDefaultPin);
  els.inputAdminSimTo.value = getActiveAddress();
  els.btnCloseAdmin.focus();
  loadAllAdminData();
}

function switchAdminTab(tabName) {
  state.adminActiveTab = tabName;
  document.querySelectorAll('.admin-tab').forEach((btn) => {
    const active = btn.dataset.adminTab === tabName;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  $('admin-tab-monitor').classList.toggle('hidden', tabName !== 'monitor');
  $('admin-tab-domains').classList.toggle('hidden', tabName !== 'domains');
  $('admin-tab-settings').classList.toggle('hidden', tabName !== 'settings');
}

async function loadAllAdminData() {
  await Promise.all([loadAdminStatsAndMessages(), loadAdminDomains()]);
}

async function loadAdminStatsAndMessages() {
  els.adminMessagesTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-secondary);">Memuat daftar pesan...</td></tr>';
  try {
    const [statsRes, msgsRes] = await Promise.all([
      apiFetch('/api/admin/stats', { admin: true }),
      fetchAdminMessagesData(),
    ]);

    const s = statsRes.stats;
    els.kpiTotalEmails.textContent = s.totalEmails;
    els.kpiEmails24h.textContent = s.emails24h;
    els.kpiTotalBounces.textContent = s.totalBounces;
    els.kpiBounces24h.textContent = s.bounces24h;
    els.kpiActiveDomains.textContent = s.activeDomains;
    els.kpiPendingDomains.textContent = s.pendingDomains;
    els.kpiUniqueMailboxes.textContent = s.uniqueMailboxes;
    els.kpiTotalOtps.textContent = s.totalOtps;

    const cfg = statsRes.settings;
    els.selectRetentionHours.value = String(cfg.retentionHours || 168);
    els.checkAutoRegister.checked = Boolean(cfg.autoRegisterDomains);
    els.inputBlockedUsers.value = cfg.blockedUsernamesRaw || '';

    state.adminMessages = msgsRes.messages;
    renderAdminMessages();
  } catch (err) {
    if (err.status === 401) {
      logoutAdmin();
      return;
    }
    els.adminMessagesTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--bounce-hard-text);">Gagal memuat data: ${escapeHtml(err.message)}</td></tr>`;
    showToast(`Gagal memuat data admin: ${err.message}`, 'error');
  }
}

async function fetchAdminMessagesData() {
  const params = new URLSearchParams({
    domain: els.adminFilterDomain.value || 'all',
    type: els.adminFilterType.value || 'all',
    q: els.adminFilterSearch.value || '',
    limit: '60',
  });
  return apiFetch(`/api/admin/messages?${params.toString()}`, { admin: true });
}

function renderAdminMessages() {
  if (!state.adminMessages.length) {
    els.adminMessagesTbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:28px;color:var(--text-secondary);">
          Belum ada pesan yang cocok dengan filter saat ini.
        </td>
      </tr>
    `;
    return;
  }

  els.adminMessagesTbody.innerHTML = state.adminMessages
    .map((m) => {
      let typeBadge = '<span class="badge badge-brand">Masuk</span>';
      if (m.isBounce) {
        const isSoft = m.bounceSummary?.severity === 'soft';
        const code = [m.bounceSummary?.smtpCode, m.bounceSummary?.enhancedStatus].filter(Boolean).join(' ');
        typeBadge = `<span class="badge ${isSoft ? 'badge-soft' : 'badge-hard'}">${isSoft ? 'SOFT' : 'HARD'} ${escapeHtml(code || 'BOUNCE')}</span>`;
      } else if (m.otpCode) {
        typeBadge = `<span class="badge badge-otp mono">OTP ${escapeHtml(m.otpCode)}</span>`;
      }

      const sender = m.fromAddress || m.sender;
      return `
        <tr>
          <td class="mono" style="font-size:0.8rem;font-weight:600;">${escapeHtml(m.recipient)}</td>
          <td>${typeBadge}</td>
          <td>
            <div style="font-weight:600;color:var(--text-primary);">${escapeHtml(m.subject)}</div>
            <div style="font-size:0.78rem;color:var(--text-secondary);">${escapeHtml(sender)} | ${escapeHtml(m.snippet.slice(0, 90))}</div>
          </td>
          <td style="white-space:nowrap;color:var(--text-secondary);font-size:0.8rem;">${escapeHtml(formatRelativeTime(m.receivedAt))}</td>
          <td style="text-align:right;white-space:nowrap;">
            <button type="button" class="btn btn-sm btn-soft" data-admin-inspect="${escapeHtml(m.id)}">Lihat</button>
            <button type="button" class="btn btn-sm btn-danger-outline" data-admin-del-msg="${escapeHtml(m.id)}">Hapus</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function loadAdminDomains() {
  els.adminDomainsTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-secondary);">Memuat daftar domain...</td></tr>';
  try {
    const res = await apiFetch('/api/admin/domains', { admin: true });
    state.adminDomains = res.domains;
    renderAdminDomains();

    const prevVal = els.adminFilterDomain.value;
    els.adminFilterDomain.innerHTML =
      '<option value="all">Semua Domain</option>' +
      state.adminDomains
        .map((d) => `<option value="${escapeHtml(d.domain)}">${escapeHtml(d.domain)} (${d.totalEmails})</option>`)
        .join('');
    if ([...els.adminFilterDomain.options].some((o) => o.value === prevVal)) {
      els.adminFilterDomain.value = prevVal;
    }
  } catch (err) {
    els.adminDomainsTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--bounce-hard-text);">Gagal memuat daftar domain: ${escapeHtml(err.message)}</td></tr>`;
    showToast(`Gagal memuat daftar domain: ${err.message}`, 'error');
  }
}

function renderAdminDomains() {
  els.adminDomainsTbody.innerHTML = state.adminDomains
    .map((d) => {
      const mxBadge = d.mxVerified
        ? '<span class="badge badge-otp">Terkoneksi</span>'
        : '<span class="badge badge-neutral">Menunggu MX</span>';
      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
              <span class="mono" style="font-weight:700;">${escapeHtml(d.domain)}</span>
              ${d.isDefault ? '<span class="badge badge-brand">Default</span>' : ''}
              ${mxBadge}
            </div>
          </td>
          <td>
            <select class="select-input" aria-label="Status domain ${escapeHtml(d.domain)}" style="width:auto;" data-domain-status-id="${d.id}">
              <option value="active" ${d.status === 'active' ? 'selected' : ''}>Aktif</option>
              <option value="pending" ${d.status === 'pending' ? 'selected' : ''}>Pending (Belum Akses)</option>
              <option value="disabled" ${d.status === 'disabled' ? 'selected' : ''}>Nonaktif</option>
            </select>
          </td>
          <td class="mono" style="font-size:0.8rem;white-space:nowrap;">
            ${d.totalEmails} pesan / <span style="color:${d.bounceEmails > 0 ? 'var(--bounce-hard)' : 'var(--text-secondary)'};">${d.bounceEmails} bounce</span>
          </td>
          <td>
            <input
              type="text"
              class="text-input"
              aria-label="Catatan domain ${escapeHtml(d.domain)}"
              style="min-width:170px;"
              value="${escapeHtml(d.notes)}"
              placeholder="Catatan..."
              data-domain-notes-id="${d.id}"
            >
          </td>
          <td style="text-align:right;white-space:nowrap;">
            ${
              !d.isDefault && d.status === 'active'
                ? `<button type="button" class="btn btn-sm" data-domain-default-id="${d.id}">Jadikan Default</button>`
                : ''
            }
            <button type="button" class="btn btn-sm btn-danger-outline" data-domain-delete-id="${d.id}" data-domain-name="${escapeHtml(d.domain)}">Hapus</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function inspectAdminMessage(emailId) {
  try {
    const data = await apiFetch(`/api/emails/${encodeURIComponent(emailId)}`, { admin: true });
    state.adminInspectorDetail = data.email;
    state.adminInspectorImages = false;
    state.adminInspectorTab = data.email.htmlBody
      ? 'html'
      : data.email.isBounce && data.email.bounceInfo?.rawDsn
      ? 'dsn'
      : 'text';

    els.inspectorModal.classList.remove('hidden');
    renderEmailIntoContainer(els.inspectorBody, state.adminInspectorDetail, {
      activeTab: state.adminInspectorTab,
      allowImages: state.adminInspectorImages,
      isAdminMode: true,
    });
    els.btnCloseInspector.focus();
  } catch (err) {
    showToast(`Gagal membuka pesan: ${err.message}`, 'error');
  }
}

async function refreshPublicDomains() {
  const domRes = await apiFetch('/api/domains');
  state.domains = domRes.domains;
  state.defaultDomain = domRes.defaultDomain;
  state.retentionHours = domRes.retentionHours;
  state.blockedUsernames = domRes.blockedUsernames || [];
  renderDomainControls();
}

function logoutAdmin() {
  state.adminToken = '';
  state.adminAuthenticated = false;
  try { sessionStorage.removeItem(STORAGE_KEYS.adminToken); } catch {}
  updateAdminIndicators();
  closeAdminModal();
  showToast('Anda keluar dari Panel Admin.');
}

async function copyActiveEmailAction() {
  const typed = els.inputUsername.value.trim().toLowerCase();
  if (typed && typed !== state.activeLocalPart) {
    const check = validateUsernameInput(typed);
    if (!check.valid) {
      els.builderError.textContent = check.error;
      els.builderError.classList.remove('hidden');
      return;
    }
    setActiveAddress(check.value, els.selectDomain.value || state.activeDomain);
  }
  const addr = getActiveAddress();
  const ok = await copyText(addr, `Disalin: ${addr}`);
  if (ok) {
    els.btnCopyLabel.textContent = 'Tersalin';
    setTimeout(() => {
      els.btnCopyLabel.textContent = 'Salin Email';
    }, 1600);
  }
}

function randomizeUsernameAction() {
  const newUser = generateRandomUsername();
  setActiveAddress(newUser, els.selectDomain.value || state.defaultDomain);
  showToast(`Username baru: ${newUser}@${state.activeDomain}`);
}

function bindEvents() {
  els.btnThemeToggle.addEventListener('click', toggleTheme);
  els.btnSidebarTheme.addEventListener('click', toggleTheme);
  els.btnSidebarCopy.addEventListener('click', copyActiveEmailAction);
  els.btnSidebarRandom.addEventListener('click', randomizeUsernameAction);
  els.btnSidebarAdmin.addEventListener('click', openAdminModal);

  els.btnToggle3d.addEventListener('click', () => {
    if (!threeController) return;
    const next = !threeController.isPaused();
    threeController.setPaused(next);
    els.btnToggle3d.textContent = next ? 'Lanjut 3D' : 'Jeda 3D';
    els.btnToggle3d.setAttribute('aria-pressed', String(next));
  });

  document.querySelectorAll('[data-nav-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setFilter(btn.dataset.navFilter, { scrollToInbox: true });
    });
  });

  els.mobNavInbox.addEventListener('click', () => setFilter('all', { scrollToInbox: true }));
  els.mobNavBounce.addEventListener('click', () => setFilter('bounce', { scrollToInbox: true }));
  els.mobNavRandom.addEventListener('click', () => {
    randomizeUsernameAction();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  els.mobNavAdmin.addEventListener('click', openAdminModal);

  els.btnToggleAutoPoll.addEventListener('click', () => {
    state.autoPoll = !state.autoPoll;
    if (state.autoPoll) resetPollCountdown();
    else updatePollBadge();
  });

  els.inputUsername.addEventListener('input', () => {
    const typed = els.inputUsername.value.trim().toLowerCase();
    const dirty = typed !== state.activeLocalPart;
    els.btnApplyCustom.classList.toggle('hidden', !dirty);
    els.builderError.classList.add('hidden');
  });

  els.addressForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const check = validateUsernameInput(els.inputUsername.value);
    if (!check.valid) {
      els.builderError.textContent = check.error;
      els.builderError.classList.remove('hidden');
      els.inputUsername.focus();
      return;
    }
    const domain = els.selectDomain.value || state.defaultDomain;
    setActiveAddress(check.value, domain);
    showToast(`Alamat aktif diganti ke ${check.value}@${domain}`, 'success');
  });

  els.selectDomain.addEventListener('change', () => {
    const check = validateUsernameInput(els.inputUsername.value || state.activeLocalPart);
    const localPart = check.valid ? check.value : state.activeLocalPart || generateRandomUsername();
    setActiveAddress(localPart, els.selectDomain.value);
    showToast(`Domain diganti ke @${els.selectDomain.value}`);
  });

  els.btnCopyEmail.addEventListener('click', copyActiveEmailAction);
  els.btnRandomUser.addEventListener('click', randomizeUsernameAction);

  els.btnRandomAll.addEventListener('click', () => {
    const newUser = generateRandomUsername();
    const list = state.domains;
    const otherDomains = list.filter((d) => d.domain !== state.activeDomain);
    const pool = otherDomains.length ? otherDomains : list;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setActiveAddress(newUser, picked ? picked.domain : state.defaultDomain);
    showToast(`Email baru dibuat: ${getActiveAddress()}`);
  });

  els.btnRefreshInbox.addEventListener('click', () => {
    fetchInbox({ silent: false });
    resetPollCountdown();
  });

  els.btnSimMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !els.simDropdown.classList.contains('hidden');
    els.simDropdown.classList.toggle('hidden', open);
    els.btnSimMenu.setAttribute('aria-expanded', String(!open));
  });

  els.simDropdown.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sim]');
    if (!btn) return;
    els.simDropdown.classList.add('hidden');
    els.btnSimMenu.setAttribute('aria-expanded', 'false');
    triggerSimulation(btn.dataset.sim);
  });

  document.addEventListener('click', (e) => {
    if (!els.simMenuWrap.contains(e.target)) {
      els.simDropdown.classList.add('hidden');
      els.btnSimMenu.setAttribute('aria-expanded', 'false');
    }
  });

  els.historyChips.addEventListener('click', (e) => {
    const switchBtn = e.target.closest('[data-switch-addr]');
    if (switchBtn) {
      const [u, d] = switchBtn.dataset.switchAddr.split('@');
      if (u && d) setActiveAddress(u, d);
      return;
    }
    const remBtn = e.target.closest('[data-remove-addr]');
    if (remBtn) {
      removeFromHistory(remBtn.dataset.removeAddr);
    }
  });

  els.domainPills.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick-domain]');
    if (!btn) return;
    setActiveAddress(state.activeLocalPart || generateRandomUsername(), btn.dataset.pickDomain);
    showToast(`Berpindah ke @${btn.dataset.pickDomain}`);
  });

  document.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => setFilter(tab.dataset.filter));
  });

  let searchDebounce = null;
  els.inputInboxSearch.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.searchQuery = els.inputInboxSearch.value.trim();
      fetchInbox({ silent: false });
    }, 220);
  });

  els.btnClearInbox.addEventListener('click', async () => {
    const addr = getActiveAddress();
    if (!state.counts.all) {
      showToast('Inbox sudah kosong.');
      return;
    }
    if (!confirm(`Hapus semua pesan di ${addr}?`)) return;
    try {
      await apiFetch(`/api/inbox?address=${encodeURIComponent(addr)}`, { method: 'DELETE' });
      state.selectedId = null;
      state.selectedDetail = null;
      renderReaderEmpty();
      await fetchInbox({ silent: false });
      showToast('Semua pesan di inbox ini dihapus.');
    } catch (err) {
      showToast(`Gagal mengosongkan inbox: ${err.message}`, 'error');
    }
  });

  els.inboxList.addEventListener('click', (e) => {
    if (e.target.closest('#btn-retry-inbox')) {
      fetchInbox({ silent: false });
      return;
    }
    const otpBtn = e.target.closest('[data-copy-otp]');
    if (otpBtn) {
      copyText(otpBtn.dataset.copyOtp, `Kode OTP ${otpBtn.dataset.copyOtp} disalin`);
      return;
    }
    const openBtn = e.target.closest('[data-open-email]');
    if (openBtn) {
      openEmail(openBtn.dataset.openEmail);
    }
  });

  const handleReaderClick = async (e) => {
    if (e.target.closest('#btn-mobile-back')) {
      els.mailWorkspace.classList.remove('is-reading');
      return;
    }

    const retryBtn = e.target.closest('[data-retry-email]');
    if (retryBtn) {
      openEmail(retryBtn.dataset.retryEmail);
      return;
    }

    const otpBtn = e.target.closest('[data-copy-otp]');
    if (otpBtn) {
      copyText(otpBtn.dataset.copyOtp, `Kode OTP ${otpBtn.dataset.copyOtp} disalin`);
      return;
    }

    const tabBtn = e.target.closest('[data-reader-tab]');
    if (tabBtn) {
      const scope = tabBtn.dataset.readerScope;
      if (scope === 'admin' && state.adminInspectorDetail) {
        state.adminInspectorTab = tabBtn.dataset.readerTab;
        renderEmailIntoContainer(els.inspectorBody, state.adminInspectorDetail, {
          activeTab: state.adminInspectorTab,
          allowImages: state.adminInspectorImages,
          isAdminMode: true,
        });
      } else if (state.selectedDetail) {
        state.readerTab = tabBtn.dataset.readerTab;
        renderEmailIntoContainer(els.readerContent, state.selectedDetail, {
          activeTab: state.readerTab,
          allowImages: state.allowExternalImages,
          isAdminMode: false,
        });
      }
      return;
    }

    const imgBtn = e.target.closest('[data-toggle-images]');
    if (imgBtn) {
      const scope = imgBtn.dataset.toggleImages;
      if (scope === 'admin' && state.adminInspectorDetail) {
        state.adminInspectorImages = !state.adminInspectorImages;
        renderEmailIntoContainer(els.inspectorBody, state.adminInspectorDetail, {
          activeTab: state.adminInspectorTab,
          allowImages: state.adminInspectorImages,
          isAdminMode: true,
        });
      } else if (state.selectedDetail) {
        state.allowExternalImages = !state.allowExternalImages;
        renderEmailIntoContainer(els.readerContent, state.selectedDetail, {
          activeTab: state.readerTab,
          allowImages: state.allowExternalImages,
          isAdminMode: false,
        });
      }
      return;
    }

    const copyRawBtn = e.target.closest('[data-copy-raw]');
    if (copyRawBtn) {
      const detail = copyRawBtn.dataset.copyRaw === 'admin' ? state.adminInspectorDetail : state.selectedDetail;
      if (detail) copyText(detail.rawSource || '', 'Sumber Raw EML disalin');
      return;
    }

    const dlAdminRaw = e.target.closest('[data-download-raw-admin]');
    if (dlAdminRaw && state.adminInspectorDetail) {
      const blob = new Blob([state.adminInspectorDetail.rawSource || ''], { type: 'message/rfc822' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `amc-mail-${state.adminInspectorDetail.id.slice(0, 8)}.eml`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const delBtn = e.target.closest('[data-delete-email]');
    if (delBtn) {
      const id = delBtn.dataset.deleteEmail;
      const mode = delBtn.dataset.deleteMode;
      try {
        if (mode === 'admin') {
          await apiFetch(`/api/admin/messages/${encodeURIComponent(id)}`, { method: 'DELETE', admin: true });
          els.inspectorModal.classList.add('hidden');
          await loadAdminStatsAndMessages();
          await fetchInbox({ silent: true });
        } else {
          await apiFetch(`/api/emails/${encodeURIComponent(id)}?address=${encodeURIComponent(getActiveAddress())}`, {
            method: 'DELETE',
          });
          state.selectedId = null;
          state.selectedDetail = null;
          els.mailWorkspace.classList.remove('is-reading');
          renderReaderEmpty();
          await fetchInbox({ silent: false });
        }
        showToast('Pesan dihapus.');
      } catch (err) {
        showToast(`Gagal menghapus pesan: ${err.message}`, 'error');
      }
    }
  };

  els.readerContent.addEventListener('click', handleReaderClick);
  els.inspectorBody.addEventListener('click', handleReaderClick);

  els.btnOpenAdmin.addEventListener('click', openAdminModal);
  els.btnCloseAdmin.addEventListener('click', closeAdminModal);
  els.btnAdminLogout.addEventListener('click', logoutAdmin);
  els.btnCloseInspector.addEventListener('click', () => els.inspectorModal.classList.add('hidden'));

  els.adminModal.addEventListener('click', (e) => {
    if (e.target === els.adminModal) closeAdminModal();
  });
  els.inspectorModal.addEventListener('click', (e) => {
    if (e.target === els.inspectorModal) els.inspectorModal.classList.add('hidden');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!els.simDropdown.classList.contains('hidden')) {
        els.simDropdown.classList.add('hidden');
        els.btnSimMenu.setAttribute('aria-expanded', 'false');
        els.btnSimMenu.focus();
      } else if (!els.inspectorModal.classList.contains('hidden')) {
        els.inspectorModal.classList.add('hidden');
      } else if (!els.adminModal.classList.contains('hidden')) {
        closeAdminModal();
      }
    }
  });

  els.adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    els.adminLoginError.classList.add('hidden');
    const pin = els.inputAdminPin.value.trim();
    if (!pin) return;

    try {
      const res = await apiFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      state.adminToken = res.token;
      state.adminAuthenticated = true;
      state.adminDefaultPin = Boolean(res.isDefaultPin);
      els.inputAdminPin.value = '';
      try { sessionStorage.setItem(STORAGE_KEYS.adminToken, res.token); } catch {}
      showToast('Login Admin berhasil', 'success');
      showAdminWorkspace();
    } catch (err) {
      els.adminLoginError.textContent = err.message;
      els.adminLoginError.classList.remove('hidden');
    }
  });

  document.querySelectorAll('.admin-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchAdminTab(btn.dataset.adminTab));
  });

  let adminSearchTimer = null;
  els.adminFilterDomain.addEventListener('change', loadAdminStatsAndMessages);
  els.adminFilterType.addEventListener('change', loadAdminStatsAndMessages);
  els.btnAdminRefreshMsgs.addEventListener('click', loadAdminStatsAndMessages);
  els.adminFilterSearch.addEventListener('input', () => {
    clearTimeout(adminSearchTimer);
    adminSearchTimer = setTimeout(loadAdminStatsAndMessages, 250);
  });

  els.adminMessagesTbody.addEventListener('click', async (e) => {
    const inspectBtn = e.target.closest('[data-admin-inspect]');
    if (inspectBtn) {
      inspectAdminMessage(inspectBtn.dataset.adminInspect);
      return;
    }
    const delBtn = e.target.closest('[data-admin-del-msg]');
    if (delBtn) {
      try {
        await apiFetch(`/api/admin/messages/${encodeURIComponent(delBtn.dataset.adminDelMsg)}`, {
          method: 'DELETE',
          admin: true,
        });
        await loadAdminStatsAndMessages();
        await fetchInbox({ silent: true });
        showToast('Pesan dihapus.');
      } catch (err) {
        showToast(`Gagal menghapus: ${err.message}`, 'error');
      }
    }
  });

  els.adminAddDomainForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = els.inputNewDomains.value.trim();
    if (!raw) {
      showToast('Masukkan minimal satu domain.', 'error');
      return;
    }

    try {
      const res = await apiFetch('/api/admin/domains', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({
          domains: raw,
          status: els.selectNewDomainStatus.value,
          notes: els.inputNewDomainNotes.value.trim(),
        }),
      });

      els.inputNewDomains.value = '';
      els.inputNewDomainNotes.value = '';
      state.adminDomains = res.domains;
      renderAdminDomains();
      await Promise.all([refreshPublicDomains(), loadAdminStatsAndMessages()]);

      const parts = [];
      if (res.added.length) parts.push(`${res.added.length} domain ditambahkan`);
      if (res.skipped.length) parts.push(`${res.skipped.length} sudah ada`);
      if (res.invalid.length) parts.push(`${res.invalid.length} tidak valid (${res.invalid.join(', ')})`);
      showToast(parts.join(', ') || 'Selesai', res.added.length ? 'success' : 'default');
    } catch (err) {
      showToast(`Gagal menambah domain: ${err.message}`, 'error');
    }
  });

  els.adminDomainsTbody.addEventListener('change', async (e) => {
    const statusSel = e.target.closest('[data-domain-status-id]');
    if (statusSel) {
      const id = statusSel.dataset.domainStatusId;
      try {
        const res = await apiFetch(`/api/admin/domains/${id}`, {
          method: 'PATCH',
          admin: true,
          body: JSON.stringify({ status: statusSel.value }),
        });
        state.adminDomains = res.domains;
        renderAdminDomains();
        await Promise.all([refreshPublicDomains(), loadAdminStatsAndMessages()]);
        showToast('Status domain diperbarui', 'success');
      } catch (err) {
        showToast(`Gagal memperbarui domain: ${err.message}`, 'error');
      }
      return;
    }

    const notesInput = e.target.closest('[data-domain-notes-id]');
    if (notesInput) {
      const id = notesInput.dataset.domainNotesId;
      try {
        await apiFetch(`/api/admin/domains/${id}`, {
          method: 'PATCH',
          admin: true,
          body: JSON.stringify({ notes: notesInput.value.trim() }),
        });
        showToast('Catatan domain disimpan', 'success');
      } catch (err) {
        showToast(`Gagal menyimpan catatan: ${err.message}`, 'error');
      }
    }
  });

  els.adminDomainsTbody.addEventListener('click', async (e) => {
    const defBtn = e.target.closest('[data-domain-default-id]');
    if (defBtn) {
      try {
        const res = await apiFetch(`/api/admin/domains/${defBtn.dataset.domainDefaultId}`, {
          method: 'PATCH',
          admin: true,
          body: JSON.stringify({ isDefault: true }),
        });
        state.adminDomains = res.domains;
        renderAdminDomains();
        await refreshPublicDomains();
        showToast('Domain default diperbarui', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    const delBtn = e.target.closest('[data-domain-delete-id]');
    if (delBtn) {
      const domName = delBtn.dataset.domainName;
      if (!confirm(`Hapus domain "${domName}" dari daftar AMC Mail?`)) return;
      try {
        const res = await apiFetch(`/api/admin/domains/${delBtn.dataset.domainDeleteId}`, {
          method: 'DELETE',
          admin: true,
        });
        state.adminDomains = res.domains;
        renderAdminDomains();
        await Promise.all([refreshPublicDomains(), loadAdminStatsAndMessages()]);
        showToast(`Domain ${domName} dihapus.`);
      } catch (err) {
        showToast(`Gagal menghapus domain: ${err.message}`, 'error');
      }
    }
  });

  els.adminSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        admin: true,
        body: JSON.stringify({
          retentionHours: Number(els.selectRetentionHours.value),
          autoRegisterDomains: els.checkAutoRegister.checked,
          blockedUsernames: els.inputBlockedUsers.value.trim(),
        }),
      });
      await refreshPublicDomains();
      showToast('Pengaturan disimpan', 'success');
    } catch (err) {
      showToast(`Gagal menyimpan pengaturan: ${err.message}`, 'error');
    }
  });

  els.btnAdminPurge.addEventListener('click', async () => {
    try {
      const res = await apiFetch('/api/admin/purge', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({}),
      });
      await loadAdminStatsAndMessages();
      showToast(`${res.purged} pesan kedaluwarsa dibersihkan.`, 'success');
    } catch (err) {
      showToast(`Gagal membersihkan: ${err.message}`, 'error');
    }
  });

  els.adminSimForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const to = els.inputAdminSimTo.value.trim();
    const scenario = els.selectAdminSimType.value;
    const failedTarget = els.inputAdminSimFailed.value.trim();
    await triggerSimulation(scenario, to, failedTarget ? { failedTarget } : {});
  });
}

async function init() {
  els.footerYear.textContent = String(new Date().getFullYear());
  syncThemeUI();
  loadHistory();

  try {
    state.adminToken = sessionStorage.getItem(STORAGE_KEYS.adminToken) || '';
  } catch {}

  bindEvents();

  // Initialize Three.js asynchronously so first paint and API fetch never wait on WebGL.
  initAmcThreeScene({
    heroCanvas: els.hero3dCanvas,
    ambientCanvas: els.ambient3dCanvas,
  }).then((ctrl) => {
    threeController = ctrl;
    if (ctrl && typeof ctrl.isPaused === 'function' && ctrl.isPaused()) {
      els.btnToggle3d.textContent = 'Lanjut 3D';
      els.btnToggle3d.setAttribute('aria-pressed', 'true');
    }
    if (state.domains.length) {
      threeController?.setDomainCount(state.domains.length);
    }
  });

  try {
    const [health, domRes] = await Promise.all([
      apiFetch('/api/health'),
      apiFetch('/api/domains'),
    ]);

    state.simulatorEnabled = Boolean(health.simulatorEnabled);
    state.domains = domRes.domains;
    state.defaultDomain = domRes.defaultDomain;
    state.retentionHours = domRes.retentionHours;
    state.blockedUsernames = domRes.blockedUsernames || [];

    if (state.adminToken) {
      try {
        const sess = await apiFetch('/api/admin/session', { admin: true });
        state.adminAuthenticated = true;
        state.adminDefaultPin = Boolean(sess.isDefaultPin);
      } catch {
        state.adminToken = '';
        state.adminAuthenticated = false;
      }
    }

    updateAdminIndicators();
    renderDomainControls();

    const urlEmail = new URLSearchParams(window.location.search).get('email') || '';
    let savedAddr = '';
    try { savedAddr = localStorage.getItem(STORAGE_KEYS.activeAddress) || ''; } catch {}
    const candidate = (urlEmail || savedAddr).trim().toLowerCase();

    let initUser = '';
    let initDomain = state.defaultDomain;

    if (candidate.includes('@')) {
      const [u, d] = candidate.split('@');
      if (LOCAL_PART_REGEX.test(u) && state.domains.some((dom) => dom.domain === d)) {
        initUser = u;
        initDomain = d;
      }
    }

    if (!initUser) {
      initUser = generateRandomUsername();
      initDomain = state.defaultDomain;
    }

    setActiveAddress(initUser, initDomain, { pushUrl: Boolean(urlEmail), animate3d: false });
    startPollingLoop();
  } catch (err) {
    state.inboxError = err.message;
    renderInboxList();
    showToast(`Gagal menginisialisasi AMC Mail: ${err.message}`, 'error');
  }
}

init();
