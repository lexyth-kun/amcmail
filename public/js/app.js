const POLL_INTERVAL_SEC = 10;
const STORAGE_KEYS = {
  theme: 'amc_mail_theme',
  activeAddress: 'amc_mail_active_address',
  adminToken: 'amc_mail_admin_token',
};

const LOCAL_PART_REGEX = /^[a-z0-9][a-z0-9._+-]{0,62}$/;

const ADMIN_VIEW_META = {
  mailboxes: {
    title: 'Buat & Kelola Alamat Email',
    subtitle: 'Buat alamat email baru pada domain Al Muthi Creative, bagikan link kotak masuk baca-saja, atau kelola status aksesnya.',
  },
  catchall: {
    title: 'Semua Pesan (Catch-All)',
    subtitle: 'Baca langsung seluruh email masuk dan kode OTP dari semua domain AMC dalam satu layar penuh.',
  },
  domains: {
    title: 'Kelola Domain AMC',
    subtitle: 'Tambahkan domain baru, atur status aktif atau pending, dan hubungkan Cloudflare Email Routing Catch-All.',
  },
  settings: {
    title: 'Pengaturan & Uji Kirim',
    subtitle: 'Atur masa retensi email, pendaftaran otomatis domain baru, dan kirim email uji coba.',
  },
};

const state = {
  domains: [],
  defaultDomain: 'amc.web.id',
  blockedUsernames: [],
  retentionHours: 168,

  activeLocalPart: '',
  activeDomain: '',
  activeMailboxValid: false,
  activeMailboxLabel: '',

  filter: 'all',
  searchQuery: '',
  messages: [],
  counts: { all: 0, inbox: 0, otp: 0, unread: 0 },
  inboxLoading: false,
  inboxError: null,
  inboxErrorCode: null,
  knownMessageIds: new Set(),
  hasLoadedInitialInbox: false,

  selectedId: null,
  selectedDetail: null,
  readerTab: 'html',
  allowExternalImages: true,

  autoPoll: true,
  pollCountdown: POLL_INTERVAL_SEC,
  pollTimer: null,

  adminToken: '',
  adminAuthenticated: false,
  adminDefaultPin: false,
  adminView: 'mailboxes',
  adminMailboxes: [],
  adminMailboxAddressSet: new Set(),
  adminDomains: [],
  adminMessages: [],
  adminSelectedId: null,
  adminSelectedDetail: null,
  adminReaderTab: 'html',
  adminAllowImages: true,
  lastFocusedBeforeModal: null,
};

const $ = (id) => document.getElementById(id);

const els = {
  sidebarBrandSub: $('sidebar-brand-sub'),
  mobileBrandSub: $('mobile-brand-sub'),
  sidebarPublicBlock: $('sidebar-public-block'),
  sidebarAdminBlock: $('sidebar-admin-block'),

  sidebarActiveAddr: $('sidebar-active-addr'),
  btnSidebarCopy: $('btn-sidebar-copy'),
  sideCountAll: $('side-count-all'),
  sideCountInbox: $('side-count-inbox'),
  sideCountOtp: $('side-count-otp'),
  sideDomainCount: $('side-domain-count'),
  btnSidebarAdmin: $('btn-sidebar-admin'),

  btnSidebarQuickCreate: $('btn-sidebar-quick-create'),
  adminSideMailboxes: $('admin-side-mailboxes'),
  adminSideMessages: $('admin-side-messages'),
  adminSideDomains: $('admin-side-domains'),

  btnSidebarTheme: $('btn-sidebar-theme'),
  sidebarThemeLabel: $('sidebar-theme-label'),
  btnSidebarLogout: $('btn-sidebar-logout'),

  btnThemeToggle: $('btn-theme-toggle'),
  iconMoon: $('icon-moon'),
  iconSun: $('icon-sun'),
  btnOpenAdmin: $('btn-open-admin'),
  btnMobileLogout: $('btn-mobile-logout'),

  mobNavPublic: $('mob-nav-public'),
  mobNavAdminBar: $('mob-nav-admin-bar'),
  mobNavInbox: $('mob-nav-inbox'),
  mobNavAdmin: $('mob-nav-admin'),

  adminWorkspaceShell: $('admin-workspace-shell'),
  publicViewerShell: $('public-viewer-shell'),
  adminReaderBanner: $('admin-reader-banner'),

  adminViewTitle: $('admin-view-title'),
  adminViewSubtitle: $('admin-view-subtitle'),
  adminDefaultPinWarning: $('admin-default-pin-warning'),

  kpiTotalMailboxes: $('kpi-total-mailboxes'),
  kpiActiveMailboxes: $('kpi-active-mailboxes'),
  kpiTotalEmails: $('kpi-total-emails'),
  kpiEmails24h: $('kpi-emails-24h'),
  kpiActiveDomains: $('kpi-active-domains'),
  kpiPendingDomains: $('kpi-pending-domains'),

  adminViewMailboxes: $('admin-view-mailboxes'),
  adminViewCatchall: $('admin-view-catchall'),
  adminViewDomains: $('admin-view-domains'),
  adminViewSettings: $('admin-view-settings'),

  adminQuickMailboxForm: $('admin-quick-mailbox-form'),
  inputQuickUsername: $('input-quick-username'),
  selectQuickDomain: $('select-quick-domain'),
  inputQuickLabel: $('input-quick-label'),
  adminCreateMailboxForm: $('admin-create-mailbox-form'),
  inputNewMailboxes: $('input-new-mailboxes'),
  selectNewMailboxDomain: $('select-new-mailbox-domain'),
  inputNewMailboxLabel: $('input-new-mailbox-label'),
  adminMailboxFilterDomain: $('admin-mailbox-filter-domain'),
  adminMailboxFilterSearch: $('admin-mailbox-filter-search'),
  btnAdminRefreshMailboxes: $('btn-admin-refresh-mailboxes'),
  adminMailboxesTbody: $('admin-mailboxes-tbody'),

  adminFilterDomain: $('admin-filter-domain'),
  adminFilterType: $('admin-filter-type'),
  adminFilterSearch: $('admin-filter-search'),
  btnAdminRefreshMsgs: $('btn-admin-refresh-msgs'),
  adminCatchallWorkspace: $('admin-catchall-workspace'),
  adminCatchallCountLabel: $('admin-catchall-count-label'),
  adminCatchallList: $('admin-catchall-list'),
  adminCatchallEmpty: $('admin-catchall-empty'),
  adminCatchallReader: $('admin-catchall-reader'),

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

  heroDomainCount: $('hero-domain-count'),
  heroInboxCount: $('hero-inbox-count'),
  btnToggleAutoPoll: $('btn-toggle-autopoll'),
  pollStatusText: $('poll-status-text'),

  addressForm: $('address-form'),
  inputUsername: $('input-username'),
  selectDomain: $('select-domain'),
  btnOpenInbox: $('btn-open-inbox'),
  btnCopyEmail: $('btn-copy-email'),
  btnCopyLabel: $('btn-copy-label'),
  builderError: $('builder-error'),
  readonlyNotice: $('readonly-notice'),
  btnRefreshInbox: $('btn-refresh-inbox'),

  mailWorkspace: $('mail-workspace'),
  inboxActiveLabel: $('inbox-active-label'),
  btnClearInbox: $('btn-clear-inbox'),
  inputInboxSearch: $('input-inbox-search'),
  inboxList: $('inbox-list'),
  countAll: $('count-all'),
  countInbox: $('count-inbox'),
  countOtp: $('count-otp'),

  readerEmpty: $('reader-empty'),
  readerContent: $('reader-content'),

  domainPills: $('domain-pills'),
  retentionInfo: $('retention-info'),
  footerYear: $('footer-year'),

  adminModal: $('admin-modal'),
  btnCloseAdmin: $('btn-close-admin'),
  adminLoginForm: $('admin-login-form'),
  inputAdminPin: $('input-admin-pin'),
  adminLoginError: $('admin-login-error'),
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
    if (successMsg) showToast(successMsg, 'success');
    return true;
  } catch {
    showToast('Gagal menyalin otomatis. Salin secara manual.', 'error');
    return false;
  }
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if ((options.admin || options.withOptionalAdmin) && state.adminToken) {
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

function parseAddressInput(rawInput, selectedDomain) {
  const raw = String(rawInput || '').trim().toLowerCase();
  if (!raw) {
    return { valid: false, error: 'Masukkan username atau alamat email terlebih dahulu.' };
  }

  let localPart = raw;
  let domain = selectedDomain || state.defaultDomain;

  if (raw.includes('@')) {
    const parts = raw.split('@');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return { valid: false, error: 'Format alamat email tidak valid.' };
    }
    localPart = parts[0].trim();
    domain = parts[1].trim();
  }

  if (!LOCAL_PART_REGEX.test(localPart)) {
    return { valid: false, error: 'Username hanya boleh huruf kecil, angka, titik, strip, plus, atau garis bawah.' };
  }
  if (localPart.includes('..') || localPart.endsWith('.')) {
    return { valid: false, error: 'Username tidak boleh mengandung dua titik berurutan atau diakhiri titik.' };
  }
  if (state.domains.length > 0 && !state.domains.some((d) => d.domain === domain)) {
    return { valid: false, error: `Domain @${domain} belum aktif di AMC Mail.` };
  }
  return { valid: true, localPart, domain };
}

function syncModeShell() {
  const isAdmin = state.adminAuthenticated;
  document.body.classList.toggle('is-admin-mode', isAdmin);

  els.sidebarBrandSub.textContent = isAdmin ? 'Workspace Admin' : 'Al Muthi Creative';
  els.mobileBrandSub.textContent = isAdmin ? 'Workspace Admin' : 'Al Muthi Creative';

  els.sidebarPublicBlock.classList.toggle('hidden', isAdmin);
  els.sidebarAdminBlock.classList.toggle('hidden', !isAdmin);
  els.btnSidebarLogout.classList.toggle('hidden', !isAdmin);

  els.btnOpenAdmin.classList.toggle('hidden', isAdmin);
  els.btnMobileLogout.classList.toggle('hidden', !isAdmin);

  els.mobNavPublic.classList.toggle('hidden', isAdmin);
  els.mobNavAdminBar.classList.toggle('hidden', !isAdmin);

  els.adminDefaultPinWarning.classList.toggle('hidden', !(isAdmin && state.adminDefaultPin));
  els.btnClearInbox.classList.toggle('hidden', !isAdmin);
  els.adminReaderBanner.classList.toggle('hidden', !isAdmin);

  if (els.readonlyNotice) {
    els.readonlyNotice.classList.toggle('is-admin', isAdmin);
    els.readonlyNotice.textContent = isAdmin
      ? 'Mode Admin aktif: Anda dapat membuka semua alamat dan mengelola pesan.'
      : 'Masukkan alamat email dari Admin untuk membaca pesan masuk dan kode OTP.';
  }

  if (isAdmin) {
    const showPerAddrReader = state.adminView === 'reader';
    els.adminWorkspaceShell.classList.toggle('hidden', showPerAddrReader);
    els.publicViewerShell.classList.toggle('hidden', !showPerAddrReader);

    if (!showPerAddrReader) {
      const meta = ADMIN_VIEW_META[state.adminView] || ADMIN_VIEW_META.mailboxes;
      els.adminViewTitle.textContent = meta.title;
      els.adminViewSubtitle.textContent = meta.subtitle;

      els.adminViewMailboxes.classList.toggle('hidden', state.adminView !== 'mailboxes');
      els.adminViewCatchall.classList.toggle('hidden', state.adminView !== 'catchall');
      els.adminViewDomains.classList.toggle('hidden', state.adminView !== 'domains');
      els.adminViewSettings.classList.toggle('hidden', state.adminView !== 'settings');
    }

    document.querySelectorAll('[data-admin-view]').forEach((el) => {
      if (el.classList.contains('sidebar-link') || el.classList.contains('mobile-nav-item')) {
        el.classList.toggle('is-active', el.dataset.adminView === state.adminView);
      }
    });
  } else {
    els.adminWorkspaceShell.classList.add('hidden');
    els.publicViewerShell.classList.remove('hidden');
  }

  updateAddressActionButtons();
  if (state.selectedDetail) {
    renderPublicReader();
  }
}

function switchAdminView(view, { focusQuickInput = false } = {}) {
  if (!state.adminAuthenticated) return;
  closeActiveDropdown();
  state.adminView = view;
  syncModeShell();
  window.scrollTo({ top: 0, behavior: 'auto' });

  if (view === 'mailboxes') {
    loadAdminMailboxes();
    if (focusQuickInput) setTimeout(() => els.inputQuickUsername.focus(), 40);
  } else if (view === 'catchall') {
    loadAdminStatsAndMessages();
  } else if (view === 'domains') {
    loadAdminDomains();
  } else if (view === 'settings') {
    loadAdminStatsAndMessages();
  }
}

function updateAddressActionButtons() {
  const addr = getActiveAddress();
  const hasUsable = Boolean(addr) && (state.activeMailboxValid || state.adminAuthenticated);
  els.btnCopyEmail.disabled = !hasUsable;
  els.btnSidebarCopy.disabled = !hasUsable;
  els.btnRefreshInbox.disabled = !addr;

  if (addr) {
    els.sidebarActiveAddr.textContent = addr;
    els.inboxActiveLabel.textContent = addr;
  } else {
    els.sidebarActiveAddr.textContent = 'Belum dipilih';
    els.inboxActiveLabel.textContent = 'Belum dipilih';
  }
}

function setActiveAddress(localPart, domain, { pushUrl = true } = {}) {
  const cleanUser = String(localPart || '').trim().toLowerCase();
  const cleanDomain = String(domain || state.defaultDomain).trim().toLowerCase();

  state.activeLocalPart = cleanUser;
  state.activeDomain = cleanDomain;
  state.activeMailboxValid = false;
  state.activeMailboxLabel = '';
  state.selectedId = null;
  state.selectedDetail = null;
  state.knownMessageIds = new Set();
  state.hasLoadedInitialInbox = false;
  state.inboxError = null;
  state.inboxErrorCode = null;
  state.messages = [];
  state.counts = { all: 0, inbox: 0, otp: 0, unread: 0 };

  els.inputUsername.value = cleanUser;
  if (els.selectDomain.querySelector(`option[value="${CSS.escape(cleanDomain)}"]`)) {
    els.selectDomain.value = cleanDomain;
    syncCustomDropdown(els.selectDomain);
  }
  els.builderError.classList.add('hidden');
  els.mailWorkspace.classList.remove('is-reading');

  const full = getActiveAddress();
  if (full) {
    try { localStorage.setItem(STORAGE_KEYS.activeAddress, full); } catch {}
    if (pushUrl && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('email', full);
      window.history.replaceState({}, '', url.toString());
    }
  }

  updateAddressActionButtons();
  renderDomainPills();
  renderReaderEmpty();
  renderFilterCounts();
  if (full) {
    fetchInbox({ silent: false });
    resetPollCountdown();
  } else {
    renderInboxList();
  }
}

function renderDomainControls() {
  const list = state.domains;
  els.selectDomain.innerHTML = '';
  for (const d of list) {
    const opt = document.createElement('option');
    opt.value = d.domain;
    opt.textContent = d.domain;
    els.selectDomain.appendChild(opt);
  }
  if (state.activeDomain && list.some((d) => d.domain === state.activeDomain)) {
    els.selectDomain.value = state.activeDomain;
  } else if (state.defaultDomain && list.some((d) => d.domain === state.defaultDomain)) {
    els.selectDomain.value = state.defaultDomain;
  }
  syncCustomDropdown(els.selectDomain);

  if (els.retentionInfo) {
    els.retentionInfo.textContent = `Retensi otomatis: ${formatRetentionLabel(state.retentionHours)}`;
  }
  if (els.heroDomainCount) els.heroDomainCount.textContent = String(list.length);
  if (els.sideDomainCount) els.sideDomainCount.textContent = String(list.length);
  renderDomainPills();
}

function renderDomainPills() {
  if (!els.domainPills) return;
  const selectedDom = state.activeDomain || els.selectDomain.value || state.defaultDomain;
  els.domainPills.innerHTML = state.domains
    .map((d) => {
      const current = d.domain === selectedDom;
      return `
        <button type="button" class="domain-card-btn ${current ? 'is-current' : ''}" data-pick-domain="${escapeHtml(d.domain)}">
          <span class="domain-card-name">@${escapeHtml(d.domain)}</span>
          <span class="domain-card-tag">${current ? 'Dipilih' : 'Pilih'}</span>
        </button>
      `;
    })
    .join('');
}

function renderFilterCounts() {
  els.countAll.textContent = String(state.counts.all || 0);
  els.countInbox.textContent = String(state.counts.inbox || 0);
  els.countOtp.textContent = String(state.counts.otp || 0);

  if (els.sideCountAll) els.sideCountAll.textContent = String(state.counts.all || 0);
  if (els.sideCountInbox) els.sideCountInbox.textContent = String(state.counts.inbox || 0);
  if (els.sideCountOtp) els.sideCountOtp.textContent = String(state.counts.otp || 0);

  if (els.heroInboxCount) els.heroInboxCount.textContent = String(state.counts.all || 0);
}

function syncNavActiveStates() {
  document.querySelectorAll('.filter-tab').forEach((btn) => {
    const active = btn.dataset.filter === state.filter;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-nav-filter]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.navFilter === state.filter);
  });
  if (els.mobNavInbox) els.mobNavInbox.classList.add('is-active');
}

function setFilter(nextFilter, { scrollToInbox = false } = {}) {
  state.filter = nextFilter;
  syncNavActiveStates();
  if (getActiveAddress()) {
    fetchInbox({ silent: false });
  } else {
    renderInboxList();
  }
  if (scrollToInbox) {
    els.mailWorkspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function getMessageAvatarMarkup(msg, senderLabel) {
  if (msg.otpCode) {
    return `<span class="msg-avatar is-otp" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></span>`;
  }
  const clean = String(senderLabel || 'M').replace(/^[^a-zA-Z0-9]+/, '');
  const initial = (clean[0] || 'M').toUpperCase();
  return `<span class="msg-avatar" aria-hidden="true">${escapeHtml(initial)}</span>`;
}

function renderMessageCard(msg, { selected, showRecipient = false, openAttr = 'data-open-id', variant = 'compact' }) {
  const badges = [];

  if (msg.otpCode) {
    badges.push(
      `<button type="button" class="badge badge-otp mono" data-quick-otp="${escapeHtml(msg.otpCode)}" title="Klik untuk menyalin kode OTP">Salin OTP ${escapeHtml(msg.otpCode)}</button>`
    );
  }

  if (msg.hasAttachments) {
    badges.push('<span class="badge badge-neutral">Lampiran</span>');
  }

  const senderLabel = msg.fromName || msg.fromAddress || msg.sender || '(Tanpa Pengirim)';

  if (variant === 'simple') {
    return `
      <article class="message-item is-simple-row ${selected ? 'is-selected' : ''} ${msg.isRead ? '' : 'is-unread'}" data-msg-id="${escapeHtml(msg.id)}">
        <button type="button" class="message-open-btn is-simple-open" ${openAttr}="${escapeHtml(msg.id)}" aria-current="${selected ? 'true' : 'false'}">
          ${getMessageAvatarMarkup(msg, senderLabel)}
          <span class="msg-simple-body">
            <span class="msg-row-top">
              <span class="msg-sender">
                ${msg.isRead ? '' : '<span class="unread-label">Baru</span>'}
                <span class="msg-sender-name">${escapeHtml(senderLabel)}</span>
              </span>
              <span class="msg-time">${escapeHtml(formatRelativeTime(msg.receivedAt))}</span>
            </span>
            <span class="msg-subject">${escapeHtml(msg.subject || '(Tanpa Subjek)')}</span>
            <span class="msg-snippet">${escapeHtml(msg.snippet || '')}</span>
          </span>
          <span class="msg-row-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </span>
        </button>
        ${badges.length ? `<div class="msg-badges-bar is-simple-badges">${badges.join('')}</div>` : ''}
      </article>
    `;
  }

  return `
    <article class="message-item ${selected ? 'is-selected' : ''} ${msg.isRead ? '' : 'is-unread'}" data-msg-id="${escapeHtml(msg.id)}">
      <button type="button" class="message-open-btn" ${openAttr}="${escapeHtml(msg.id)}" aria-current="${selected ? 'true' : 'false'}">
        ${showRecipient ? `<span class="catchall-rcpt-tag">Ke: ${escapeHtml(msg.recipient)}</span>` : ''}
        <div class="msg-row-top">
          <div class="msg-sender">
            ${msg.isRead ? '' : '<span class="unread-label">Baru</span>'}
            <span class="msg-sender-name">${escapeHtml(senderLabel)}</span>
          </div>
          <span class="msg-time">${escapeHtml(formatRelativeTime(msg.receivedAt))}</span>
        </div>
        <div class="msg-subject">${escapeHtml(msg.subject || '(Tanpa Subjek)')}</div>
        <div class="msg-snippet">${escapeHtml(msg.snippet || '')}</div>
      </button>
      ${badges.length ? `<div class="msg-badges-bar">${badges.join('')}</div>` : ''}
    </article>
  `;
}

function renderInboxList() {
  renderFilterCounts();
  const addr = getActiveAddress();

  if (!addr) {
    els.inboxList.innerHTML = `
      <div class="state-panel">
        <h3>Masukkan Alamat Email</h3>
        <p>Ketik alamat email yang diberikan Admin di kotak atas lalu klik <strong>Buka Inbox</strong> untuk melihat pesan masuk.</p>
      </div>
    `;
    return;
  }

  if (state.inboxLoading && state.messages.length === 0) {
    els.inboxList.innerHTML = `
      <div class="state-panel">
        <h3>Memuat Kotak Masuk</h3>
        <p>Mengambil pesan untuk <strong>${escapeHtml(addr)}</strong>...</p>
      </div>
    `;
    return;
  }

  if (state.inboxError) {
    const isNotRegistered = state.inboxErrorCode === 'MAILBOX_NOT_FOUND';
    const isDisabled = state.inboxErrorCode === 'MAILBOX_DISABLED';
    const title = isNotRegistered
      ? 'Alamat Email Belum Terdaftar'
      : isDisabled
        ? 'Alamat Email Dinonaktifkan'
        : 'Gagal Memuat Kotak Masuk';

    els.inboxList.innerHTML = `
      <div class="state-panel">
        <h3 class="state-error-title">${title}</h3>
        <div class="state-addr-box">${escapeHtml(addr)}</div>
        <p>${escapeHtml(state.inboxError)}</p>
        ${!isNotRegistered && !isDisabled ? '<button type="button" class="btn btn-sm" id="btn-retry-inbox">Coba Lagi</button>' : ''}
      </div>
    `;
    const retryBtn = $('btn-retry-inbox');
    if (retryBtn) retryBtn.addEventListener('click', () => fetchInbox({ silent: false }));
    return;
  }

  if (state.messages.length === 0) {
    const emptyMsg =
      state.filter === 'otp'
        ? 'Belum ada email kode OTP untuk alamat ini.'
        : state.searchQuery
          ? `Tidak ada pesan yang cocok dengan kata kunci "${escapeHtml(state.searchQuery)}".`
          : 'Belum ada pesan masuk di alamat ini. Halaman akan memperbarui secara otomatis saat email tiba.';

    els.inboxList.innerHTML = `
      <div class="state-panel">
        <h3>Kotak Masuk Masih Kosong</h3>
        <div class="state-addr-box">${escapeHtml(addr)}</div>
        <p>${emptyMsg}</p>
      </div>
    `;
    return;
  }

  els.inboxList.innerHTML = state.messages
    .map((msg) =>
      renderMessageCard(msg, {
        selected: msg.id === state.selectedId,
        showRecipient: false,
        openAttr: 'data-open-id',
        variant: 'simple',
      })
    )
    .join('');
}

async function fetchInbox({ silent = false } = {}) {
  const addr = getActiveAddress();
  if (!addr) {
    renderInboxList();
    return;
  }

  if (!silent) {
    state.inboxLoading = true;
    state.inboxError = null;
    state.inboxErrorCode = null;
    renderInboxList();
  }

  try {
    const params = new URLSearchParams({
      address: addr,
      filter: state.filter,
      limit: '60',
    });
    if (state.searchQuery.trim()) params.set('q', state.searchQuery.trim());

    const res = await apiFetch(`/api/inbox?${params.toString()}`, { withOptionalAdmin: true });
    if (getActiveAddress() !== addr) return;

    state.activeMailboxValid = true;
    state.activeMailboxLabel = res.mailbox?.label || '';
    state.inboxError = null;
    state.inboxErrorCode = null;
    els.builderError.classList.add('hidden');
    updateAddressActionButtons();

    const prevIds = state.knownMessageIds;
    const incoming = res.messages || [];

    if (state.hasLoadedInitialInbox) {
      const newlyArrived = incoming.filter((m) => !prevIds.has(m.id));
      if (newlyArrived.length > 0) {
        const firstNew = newlyArrived[0];
        if (firstNew.otpCode) {
          showToast(`Kode OTP baru masuk: ${firstNew.otpCode}`, 'success');
        } else {
          showToast(`${newlyArrived.length} pesan baru masuk di ${addr}`);
        }
      }
    }

    for (const m of incoming) state.knownMessageIds.add(m.id);
    state.hasLoadedInitialInbox = true;
    state.messages = incoming;
    state.counts = res.counts || { all: 0, inbox: 0, otp: 0, unread: 0 };

    if (state.selectedId && !incoming.some((m) => m.id === state.selectedId) && !state.searchQuery && state.filter === 'all') {
      state.selectedId = null;
      state.selectedDetail = null;
      renderReaderEmpty();
    }
  } catch (err) {
    if (getActiveAddress() !== addr) return;
    state.inboxError = err.message;
    state.inboxErrorCode = err.code || null;
    if (err.code === 'MAILBOX_NOT_FOUND' || err.code === 'MAILBOX_DISABLED') {
      state.activeMailboxValid = false;
      state.messages = [];
      state.counts = { all: 0, inbox: 0, otp: 0, unread: 0 };
      state.selectedId = null;
      state.selectedDetail = null;
      renderReaderEmpty();
      els.builderError.textContent = err.message;
      els.builderError.classList.remove('hidden');
      updateAddressActionButtons();
    }
  } finally {
    state.inboxLoading = false;
    renderInboxList();
  }
}

function renderReaderEmpty() {
  els.readerEmpty.classList.remove('hidden');
  els.readerContent.classList.add('hidden');
  els.readerContent.innerHTML = '';
}

function normalizeImageUrl(rawUrl) {
  const val = String(rawUrl || '').trim();
  if (!val) return '';
  if (/^\/\//.test(val)) return `https:${val}`;
  return val;
}

function normalizeSrcset(rawSrcset) {
  return String(rawSrcset || '')
    .split(',')
    .map((entry) => {
      const trimmed = entry.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('//')) return `https:${trimmed}`;
      return trimmed;
    })
    .filter(Boolean)
    .join(', ');
}

function sanitizeEmailCss(cssText) {
  return String(cssText || '')
    .replace(/<\/style/gi, '')
    .replace(/@import\b[^;]*;?/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/url\s*\(\s*(['"]?)\s*javascript:[^)]*\)/gi, 'none')
    .replace(/url\s*\(\s*(['"]?)\s*\/\//gi, 'url($1https://');
}

function sanitizeEmailHtml(html, { allowExternalImages = true } = {}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');

  doc.querySelectorAll('script, iframe, object, embed, form, meta[http-equiv="refresh"], base, link[rel="import"]').forEach((el) => el.remove());

  const safeHeadStyles = [];
  if (doc.head) {
    doc.head.querySelectorAll('style').forEach((styleEl) => {
      const cleaned = sanitizeEmailCss(styleEl.textContent || '');
      if (cleaned.trim()) safeHeadStyles.push(cleaned);
    });
  }

  let blockedImageCount = 0;
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const val = attr.value.trim();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === 'href' || name === 'src' || name === 'action' || name === 'background') && /^\s*(javascript|vbscript|data:text\/html)/i.test(val)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === 'style' && val) {
        const cleanedStyle = sanitizeEmailCss(val);
        if (cleanedStyle !== val) el.setAttribute('style', cleanedStyle);
      }
      if (name === 'background' && /^\/\//.test(val)) {
        el.setAttribute('background', `https:${val}`);
      }
    }

    if (el.tagName === 'STYLE') {
      el.textContent = sanitizeEmailCss(el.textContent || '');
    }

    if (el.tagName === 'A' && el.hasAttribute('href')) {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }

    if (el.tagName === 'SOURCE' && el.hasAttribute('srcset')) {
      el.setAttribute('srcset', normalizeSrcset(el.getAttribute('srcset')));
    }

    if (el.tagName === 'IMG') {
      let src = normalizeImageUrl(el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-original') || '');
      if (src) {
        el.setAttribute('src', src);
      }
      if (el.hasAttribute('srcset')) {
        el.setAttribute('srcset', normalizeSrcset(el.getAttribute('srcset')));
      }
      el.setAttribute('referrerpolicy', 'no-referrer');
      el.setAttribute('loading', 'eager');

      if (/^https?:\/\//i.test(src) && !allowExternalImages) {
        blockedImageCount++;
        el.removeAttribute('src');
        el.removeAttribute('srcset');
        el.setAttribute('alt', `[Gambar eksternal disembunyikan: ${el.getAttribute('alt') || 'gambar'}]`);
        el.style.border = '1px dashed #94a3b8';
        el.style.padding = '8px 10px';
        el.style.display = 'inline-block';
        el.style.fontSize = '12px';
        el.style.color = '#475569';
      }
    }
  });

  const cleanBody = doc.body ? doc.body.innerHTML : '';
  const emailStylesMarkup = safeHeadStyles.length ? `<style>${safeHeadStyles.join('\n')}</style>` : '';
  const srcdoc = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="referrer" content="no-referrer">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  body {
    margin: 0;
    padding: 16px;
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #0f172a;
    background: #ffffff;
    word-wrap: break-word;
  }
  code, pre {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  img { max-width: 100%; height: auto; }
  a { color: #075985; }
  pre { overflow-x: auto; background: #f0f9ff; border: 1px solid #bae6fd; padding: 10px; border-radius: 12px; }
  table { max-width: 100%; }
</style>
${emailStylesMarkup}
</head>
<body>${cleanBody}</body>
</html>`;

  return { srcdoc, blockedImageCount };
}

function buildMessageDetailMarkup(detail, { activeTab, allowExternalImages, mode = 'public' }) {
  const auth = detail.authResults || {};
  const canDelete = mode === 'admin' || state.adminAuthenticated;
  const addrParam = mode === 'public' ? `?address=${encodeURIComponent(detail.recipient)}` : '';
  const isUnregisteredCatchall = mode === 'admin' && !state.adminMailboxAddressSet.has(detail.recipient);

  const authBadges = [];
  for (const key of ['spf', 'dkim', 'dmarc']) {
    if (auth[key]) {
      const val = String(auth[key]).toLowerCase();
      const cls = val === 'pass' ? 'badge-otp' : val === 'fail' || val === 'softfail' ? 'badge-hard' : 'badge-neutral';
      authBadges.push(`<span class="badge ${cls} mono">${key.toUpperCase()}: ${escapeHtml(val)}</span>`);
    }
  }

  let otpMarkup = '';
  if (detail.otpCode) {
    otpMarkup = `
      <div class="otp-banner">
        <div>
          <div class="otp-label">Kode OTP / Verifikasi Terdeteksi</div>
          <div class="otp-value">${escapeHtml(detail.otpCode)}</div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" data-copy-otp="${escapeHtml(detail.otpCode)}">Salin Kode OTP</button>
      </div>
    `;
  }

  const tabIcons = {
    html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>',
    headers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
    raw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>',
  };

  const availableTabs = [];
  if (detail.htmlBody) availableTabs.push({ id: 'html', label: 'Tampilan HTML', icon: tabIcons.html });
  availableTabs.push({ id: 'text', label: 'Teks Polos', icon: tabIcons.text });
  availableTabs.push({ id: 'headers', label: 'Header', count: (detail.headers || []).length, icon: tabIcons.headers });
  availableTabs.push({ id: 'raw', label: 'Raw EML', icon: tabIcons.raw });

  const chosenTab = availableTabs.some((t) => t.id === activeTab) ? activeTab : availableTabs[0].id;
  let bodyMarkup = '';

  if (chosenTab === 'html') {
    const { srcdoc, blockedImageCount } = sanitizeEmailHtml(detail.htmlBody, { allowExternalImages });
    const showPrivacyBar = blockedImageCount > 0;
    bodyMarkup = `
      ${
        showPrivacyBar
          ? `<div class="privacy-bar">
               <span>${blockedImageCount} gambar eksternal sedang disembunyikan.</span>
               <button type="button" class="btn btn-sm" data-toggle-images="${mode}">Tampilkan Gambar</button>
             </div>`
          : ''
      }
      <iframe
        class="html-frame"
        width="800"
        height="460"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        referrerpolicy="no-referrer"
        title="Isi HTML email"
        srcdoc="${escapeHtml(srcdoc)}"
      ></iframe>
    `;
  } else if (chosenTab === 'text') {
    bodyMarkup = `<pre class="plain-pre">${escapeHtml(detail.textBody || '(Tidak ada isi teks polos)')}</pre>`;
  } else if (chosenTab === 'headers') {
    const rows = (detail.headers || [])
      .map((h) => `<tr><th>${escapeHtml(h.key || h.name || '')}</th><td>${escapeHtml(h.value)}</td></tr>`)
      .join('');
    bodyMarkup = `
      <div class="data-table-wrap">
        <table class="headers-table">
          <tbody>${rows || '<tr><td colspan="2">Tidak ada header tercatat.</td></tr>'}</tbody>
        </table>
      </div>
    `;
  } else if (chosenTab === 'raw') {
    bodyMarkup = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:10px;">
        <button type="button" class="btn btn-sm" data-copy-raw="${mode}">Salin Raw EML</button>
      </div>
      <pre class="plain-pre">${escapeHtml(detail.rawSource || '')}</pre>
    `;
  }

  let attachmentsMarkup = '';
  if (detail.attachments && detail.attachments.length > 0) {
    const items = detail.attachments
      .map((att) => {
        const href = `/api/attachments/${encodeURIComponent(att.id)}${addrParam}`;
        return `
          <a class="attachment-pill" href="${href}" download="${escapeHtml(att.filename)}">
            <span>${escapeHtml(att.filename)}</span>
            <span class="attachment-size">${escapeHtml(formatBytes(att.sizeBytes))}</span>
          </a>
        `;
      })
      .join('');
    attachmentsMarkup = `
      <div class="attachments-strip">
        <div class="attachments-title">Lampiran (${detail.attachments.length})</div>
        <div class="attachments-list">${items}</div>
      </div>
    `;
  }

  return `
    <div class="reader-header">
      <button type="button" class="btn btn-soft btn-sm mobile-back-btn" data-mobile-back="${mode}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" style="width:15px;height:15px;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        <span>${mode === 'public' ? 'Kembali ke Kotak Masuk' : 'Kembali ke Daftar'}</span>
      </button>
      <div class="reader-top-bar">
        <h2 class="reader-subject">${escapeHtml(detail.subject || '(Tanpa Subjek)')}</h2>
        <div class="reader-actions">
          ${
            isUnregisteredCatchall
              ? `<button type="button" class="btn btn-sm btn-soft" data-admin-register-addr="${escapeHtml(detail.recipient)}">Daftarkan Email</button>`
              : ''
          }
          <a class="btn btn-sm" href="/api/emails/${encodeURIComponent(detail.id)}/raw${addrParam}" download>Unduh .eml</a>
          ${
            canDelete
              ? `<button type="button" class="btn btn-sm btn-danger-outline" data-delete-email="${escapeHtml(detail.id)}" data-delete-mode="${mode}">Hapus</button>`
              : ''
          }
        </div>
      </div>

      <div class="reader-meta-grid">
        <div class="meta-item">
          <span class="meta-label">Dari</span>
          <span class="meta-value">${escapeHtml(detail.fromName ? `${detail.fromName} <${detail.fromAddress || detail.sender}>` : detail.fromAddress || detail.sender || '(Tanpa Pengirim)')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Kepada (Penerima)</span>
          <span class="meta-value mono">${escapeHtml(detail.recipient)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Diterima</span>
          <span class="meta-value">${escapeHtml(formatFullDateTime(detail.receivedAt))} (${escapeHtml(formatBytes(detail.sizeBytes))})</span>
        </div>
      </div>

      ${authBadges.length ? `<div class="auth-strip">${authBadges.join('')}</div>` : ''}
    </div>

    ${otpMarkup}

    <div class="reader-tabs">
      <div class="reader-tab-list" role="tablist">
        ${availableTabs
          .map(
            (t) =>
              `<button type="button" class="reader-tab ${t.id === chosenTab ? 'is-active' : ''}" data-reader-tab="${t.id}" data-tab-mode="${mode}" role="tab" aria-selected="${t.id === chosenTab ? 'true' : 'false'}">${t.icon}<span>${escapeHtml(t.label)}</span>${
                typeof t.count === 'number' ? `<span class="tab-count-chip">${t.count}</span>` : ''
              }</button>`
          )
          .join('')}
      </div>
    </div>

    <div class="reader-body-area">${bodyMarkup}</div>
    ${attachmentsMarkup}
  `;
}

function renderPublicReader() {
  if (!state.selectedDetail) {
    renderReaderEmpty();
    return;
  }
  els.readerEmpty.classList.add('hidden');
  els.readerContent.classList.remove('hidden');
  els.readerContent.innerHTML = buildMessageDetailMarkup(state.selectedDetail, {
    activeTab: state.readerTab,
    allowExternalImages: state.allowExternalImages,
    mode: 'public',
  });
}

async function openMessage(emailId) {
  const addr = getActiveAddress();
  if (!addr || !emailId) return;

  state.selectedId = emailId;
  state.allowExternalImages = true;
  els.mailWorkspace.classList.add('is-reading');
  renderInboxList();

  els.readerEmpty.classList.add('hidden');
  els.readerContent.classList.remove('hidden');
  els.readerContent.innerHTML = '<div class="state-panel"><h3>Memuat Pesan...</h3></div>';

  try {
    const res = await apiFetch(
      `/api/emails/${encodeURIComponent(emailId)}?address=${encodeURIComponent(addr)}`,
      { withOptionalAdmin: true }
    );
    if (state.selectedId !== emailId) return;
    state.selectedDetail = res.email;
    state.readerTab = res.email.htmlBody ? 'html' : 'text';

    const listItem = state.messages.find((m) => m.id === emailId);
    if (listItem) listItem.isRead = true;

    renderInboxList();
    renderPublicReader();
  } catch (err) {
    els.readerContent.innerHTML = `
      <div class="state-panel">
        <h3 class="state-error-title">Gagal Membuka Pesan</h3>
        <p>${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

function updatePollBadge() {
  if (!state.autoPoll) {
    els.btnToggleAutoPoll.classList.add('is-paused');
    els.btnToggleAutoPoll.setAttribute('aria-pressed', 'false');
    els.pollStatusText.textContent = 'Otomatis dijeda';
  } else {
    els.btnToggleAutoPoll.classList.remove('is-paused');
    els.btnToggleAutoPoll.setAttribute('aria-pressed', 'true');
    els.pollStatusText.textContent = `Otomatis ${state.pollCountdown}d`;
  }
}

function resetPollCountdown() {
  state.pollCountdown = POLL_INTERVAL_SEC;
  updatePollBadge();
}

function startPollingLoop() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => {
    if (!state.autoPoll || document.hidden) return;
    if (state.adminAuthenticated && state.adminView === 'catchall') {
      state.pollCountdown -= 1;
      if (state.pollCountdown <= 0) {
        state.pollCountdown = POLL_INTERVAL_SEC;
        loadAdminStatsAndMessages();
      }
      return;
    }
    if (!getActiveAddress() || !state.activeMailboxValid) return;
    state.pollCountdown -= 1;
    if (state.pollCountdown <= 0) {
      state.pollCountdown = POLL_INTERVAL_SEC;
      fetchInbox({ silent: true });
    }
    updatePollBadge();
  }, 1000);
  updatePollBadge();
}

function openAdminLoginModal() {
  if (state.adminAuthenticated) {
    switchAdminView('mailboxes');
    return;
  }
  state.lastFocusedBeforeModal = document.activeElement;
  els.adminModal.classList.remove('hidden');
  els.adminLoginError.classList.add('hidden');
  setTimeout(() => els.inputAdminPin.focus(), 40);
}

function closeAdminLoginModal() {
  els.adminModal.classList.add('hidden');
  if (state.lastFocusedBeforeModal && typeof state.lastFocusedBeforeModal.focus === 'function') {
    state.lastFocusedBeforeModal.focus();
  }
}

async function loadAdminAll() {
  await Promise.all([
    loadAdminDomains(),
    loadAdminMailboxes(),
    loadAdminStatsAndMessages(),
  ]);
  const activeAddr = getActiveAddress();
  if (activeAddr && !els.inputAdminSimTo.value) {
    els.inputAdminSimTo.value = activeAddr;
  }
}

async function loadAdminStatsAndMessages() {
  try {
    const params = new URLSearchParams({
      domain: els.adminFilterDomain.value || 'all',
      type: els.adminFilterType.value || 'all',
      limit: '80',
    });
    if (els.adminFilterSearch.value.trim()) {
      params.set('q', els.adminFilterSearch.value.trim());
    }

    const [statsRes, msgRes] = await Promise.all([
      apiFetch('/api/admin/stats', { admin: true }),
      apiFetch(`/api/admin/messages?${params.toString()}`, { admin: true }),
    ]);

    const st = statsRes.stats || {};
    els.kpiTotalMailboxes.textContent = String(st.totalMailboxes || 0);
    els.kpiActiveMailboxes.textContent = String(st.activeMailboxes || 0);
    els.kpiTotalEmails.textContent = String(st.totalEmails || 0);
    els.kpiEmails24h.textContent = String(st.emails24h || 0);
    els.kpiActiveDomains.textContent = String(st.activeDomains || 0);
    els.kpiPendingDomains.textContent = String(st.pendingDomains || 0);

    els.adminSideMailboxes.textContent = String(st.totalMailboxes || 0);
    els.adminSideMessages.textContent = String(st.totalEmails || 0);
    els.adminSideDomains.textContent = String(st.activeDomains || 0);

    if (statsRes.settings) {
      els.selectRetentionHours.value = String(statsRes.settings.retentionHours || 168);
      syncCustomDropdown(els.selectRetentionHours);
      els.checkAutoRegister.checked = Boolean(statsRes.settings.autoRegisterDomains);
      els.inputBlockedUsers.value = statsRes.settings.blockedUsernamesRaw || '';
    }

    state.adminMessages = msgRes.messages || [];
    renderAdminCatchallList();
  } catch (err) {
    if (err.status === 401) {
      handleAdminSessionExpired();
    } else {
      showToast(`Gagal memuat pesan Admin: ${err.message}`, 'error');
    }
  }
}

function renderAdminCatchallList() {
  els.adminCatchallCountLabel.textContent = `${state.adminMessages.length} pesan`;
  if (state.adminMessages.length === 0) {
    els.adminCatchallList.innerHTML = `
      <div class="state-panel">
        <h3>Belum Ada Pesan</h3>
        <p>Belum ada pesan yang cocok dengan filter domain atau tipe saat ini.</p>
      </div>
    `;
    return;
  }

  els.adminCatchallList.innerHTML = state.adminMessages
    .map((msg) =>
      renderMessageCard(msg, {
        selected: msg.id === state.adminSelectedId,
        showRecipient: true,
        openAttr: 'data-admin-open-id',
      })
    )
    .join('');
}

function renderAdminCatchallReader() {
  if (!state.adminSelectedDetail) {
    els.adminCatchallEmpty.classList.remove('hidden');
    els.adminCatchallReader.classList.add('hidden');
    els.adminCatchallReader.innerHTML = '';
    return;
  }
  els.adminCatchallEmpty.classList.add('hidden');
  els.adminCatchallReader.classList.remove('hidden');
  els.adminCatchallReader.innerHTML = buildMessageDetailMarkup(state.adminSelectedDetail, {
    activeTab: state.adminReaderTab,
    allowExternalImages: state.adminAllowImages,
    mode: 'admin',
  });
}

async function openAdminCatchallMessage(emailId) {
  if (!emailId) return;
  state.adminSelectedId = emailId;
  state.adminAllowImages = true;
  els.adminCatchallWorkspace.classList.add('is-reading');
  renderAdminCatchallList();

  els.adminCatchallEmpty.classList.add('hidden');
  els.adminCatchallReader.classList.remove('hidden');
  els.adminCatchallReader.innerHTML = '<div class="state-panel"><h3>Memuat Pesan...</h3></div>';

  try {
    const res = await apiFetch(`/api/emails/${encodeURIComponent(emailId)}`, { admin: true });
    if (state.adminSelectedId !== emailId) return;
    state.adminSelectedDetail = res.email;
    state.adminReaderTab = res.email.htmlBody ? 'html' : 'text';
    renderAdminCatchallReader();
  } catch (err) {
    els.adminCatchallReader.innerHTML = `
      <div class="state-panel">
        <h3 class="state-error-title">Gagal Membuka Pesan</h3>
        <p>${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

async function loadAdminMailboxes() {
  try {
    const params = new URLSearchParams({
      domain: els.adminMailboxFilterDomain.value || 'all',
    });
    if (els.adminMailboxFilterSearch.value.trim()) {
      params.set('q', els.adminMailboxFilterSearch.value.trim());
    }
    const res = await apiFetch(`/api/admin/mailboxes?${params.toString()}`, { admin: true });
    state.adminMailboxes = res.mailboxes || [];
    state.adminMailboxAddressSet = new Set(state.adminMailboxes.map((m) => m.address));
    renderAdminMailboxesTable();
    if (state.adminSelectedDetail) {
      renderAdminCatchallReader();
    }
  } catch (err) {
    if (err.status === 401) handleAdminSessionExpired();
    else showToast(`Gagal memuat daftar email: ${err.message}`, 'error');
  }
}

function renderAdminMailboxesTable() {
  if (state.adminMailboxes.length === 0) {
    els.adminMailboxesTbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">Belum ada alamat email terdaftar. Buat alamat email baru di formulir atas.</td></tr>';
    return;
  }

  els.adminMailboxesTbody.innerHTML = state.adminMailboxes
    .map((mb) => {
      return `
        <tr>
          <td style="min-width:168px;">
            <div class="mono" style="font-weight:700;white-space:nowrap;">${escapeHtml(mb.address)}</div>
            <div style="font-size:0.74rem;color:var(--text-muted);white-space:nowrap;">Dibuat ${escapeHtml(formatRelativeTime(mb.createdAt))}</div>
          </td>
          <td>
            <select class="select-input table-control" style="min-width:96px;" data-dd-kind="status" data-dd-title="Status Email" data-mailbox-status-id="${mb.id}">
              <option value="active" ${mb.status === 'active' ? 'selected' : ''}>Aktif</option>
              <option value="disabled" ${mb.status === 'disabled' ? 'selected' : ''}>Nonaktif</option>
            </select>
          </td>
          <td class="mono" style="white-space:nowrap;">
            ${mb.totalEmails} pesan
          </td>
          <td>
            <input type="text" class="text-input table-control" style="min-width:136px;max-width:210px;" value="${escapeHtml(mb.label)}" placeholder="Keterangan..." data-mailbox-label-id="${mb.id}">
          </td>
          <td style="text-align:right;white-space:nowrap;">
            <div class="table-actions">
              <button type="button" class="btn btn-sm btn-primary" data-mailbox-open="${escapeHtml(mb.address)}">Buka Inbox</button>
              <button type="button" class="btn btn-sm" data-mailbox-copy-addr="${escapeHtml(mb.address)}">Salin</button>
              <button type="button" class="btn btn-sm btn-soft" data-mailbox-copy-link="${escapeHtml(mb.address)}">Salin Link</button>
              <button type="button" class="btn btn-sm btn-danger-outline" data-mailbox-delete="${mb.id}" data-mailbox-addr="${escapeHtml(mb.address)}">Hapus</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  syncCustomDropdowns(els.adminMailboxesTbody);
}

async function loadAdminDomains() {
  try {
    const res = await apiFetch('/api/admin/domains', { admin: true });
    state.adminDomains = res.domains || [];
    renderAdminDomainsTable();
    syncAdminDomainDropdowns();
  } catch (err) {
    if (err.status === 401) handleAdminSessionExpired();
    else showToast(`Gagal memuat domain Admin: ${err.message}`, 'error');
  }
}

function syncAdminDomainDropdowns() {
  const prevMonitor = els.adminFilterDomain.value;
  const prevMbFilter = els.adminMailboxFilterDomain.value;
  const prevQuick = els.selectQuickDomain.value;
  const prevBulk = els.selectNewMailboxDomain.value;

  const optsHtml =
    '<option value="all">Semua Domain</option>' +
    state.adminDomains.map((d) => `<option value="${escapeHtml(d.domain)}">${escapeHtml(d.domain)} (${escapeHtml(d.status)})</option>`).join('');

  els.adminFilterDomain.innerHTML = optsHtml;
  els.adminMailboxFilterDomain.innerHTML = optsHtml;

  if (prevMonitor && els.adminFilterDomain.querySelector(`option[value="${CSS.escape(prevMonitor)}"]`)) {
    els.adminFilterDomain.value = prevMonitor;
  }
  if (prevMbFilter && els.adminMailboxFilterDomain.querySelector(`option[value="${CSS.escape(prevMbFilter)}"]`)) {
    els.adminMailboxFilterDomain.value = prevMbFilter;
  }

  const usableDomains = state.adminDomains.filter((d) => d.status !== 'disabled');
  const creatorOpts = usableDomains
    .map((d) => `<option value="${escapeHtml(d.domain)}">${escapeHtml(d.domain)}${d.isDefault ? ' (Default)' : ''}</option>`)
    .join('');

  els.selectQuickDomain.innerHTML = creatorOpts;
  els.selectNewMailboxDomain.innerHTML = creatorOpts;

  if (prevQuick && usableDomains.some((d) => d.domain === prevQuick)) {
    els.selectQuickDomain.value = prevQuick;
  }
  if (prevBulk && usableDomains.some((d) => d.domain === prevBulk)) {
    els.selectNewMailboxDomain.value = prevBulk;
  }

  syncCustomDropdown(els.adminFilterDomain);
  syncCustomDropdown(els.adminMailboxFilterDomain);
  syncCustomDropdown(els.selectQuickDomain);
  syncCustomDropdown(els.selectNewMailboxDomain);
}

function renderAdminDomainsTable() {
  els.adminDomainsTbody.innerHTML = state.adminDomains
    .map((d) => {
      const mxBadge = d.mxVerified
        ? '<span class="badge badge-otp">Terkoneksi</span>'
        : '<span class="badge badge-neutral">Menunggu MX</span>';
      const defaultBadge = d.isDefault ? '<span class="badge badge-brand">Default</span>' : '';

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <strong class="mono">${escapeHtml(d.domain)}</strong>
              ${defaultBadge}
              ${mxBadge}
            </div>
          </td>
          <td>
            <select class="select-input table-control" style="min-width:120px;" data-dd-kind="status" data-dd-title="Status Domain" data-domain-status-id="${d.id}">
              <option value="active" ${d.status === 'active' ? 'selected' : ''}>Aktif</option>
              <option value="pending" ${d.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="disabled" ${d.status === 'disabled' ? 'selected' : ''}>Nonaktif</option>
            </select>
          </td>
          <td class="mono" style="white-space:nowrap;">
            ${d.totalEmails} pesan
          </td>
          <td style="min-width:210px;">
            <input type="text" class="text-input table-control" style="width:100%;min-width:170px;" value="${escapeHtml(d.notes)}" placeholder="Catatan..." data-domain-notes-id="${d.id}">
          </td>
          <td style="text-align:right;white-space:nowrap;">
            <div class="table-actions">
              ${
                d.isDefault || d.status !== 'active'
                  ? ''
                  : `<button type="button" class="btn btn-sm btn-soft" data-domain-default="${d.id}">Jadikan Default</button>`
              }
              <button type="button" class="btn btn-sm btn-danger-outline" data-domain-delete="${d.id}" data-domain-name="${escapeHtml(d.domain)}">Hapus</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  syncCustomDropdowns(els.adminDomainsTbody);
}

async function refreshPublicDomains() {
  const domRes = await apiFetch('/api/domains');
  state.domains = domRes.domains;
  state.defaultDomain = domRes.defaultDomain;
  state.retentionHours = domRes.retentionHours;
  state.blockedUsernames = domRes.blockedUsernames || [];
  renderDomainControls();
}

function handleAdminSessionExpired() {
  state.adminToken = '';
  state.adminAuthenticated = false;
  try { sessionStorage.removeItem(STORAGE_KEYS.adminToken); } catch {}
  syncModeShell();
  openAdminLoginModal();
  showToast('Sesi Admin berakhir. Silakan masuk kembali.', 'error');
}

function logoutAdmin() {
  state.adminToken = '';
  state.adminAuthenticated = false;
  state.adminSelectedId = null;
  state.adminSelectedDetail = null;
  try { sessionStorage.removeItem(STORAGE_KEYS.adminToken); } catch {}
  syncModeShell();
  if (getActiveAddress()) fetchInbox({ silent: false });
  showToast('Anda keluar dari Workspace Admin.');
}

async function copyActiveEmailAction() {
  const full = getActiveAddress();
  if (!full) return;
  const ok = await copyText(full, `Disalin: ${full}`);
  if (ok) {
    els.btnCopyLabel.textContent = 'Tersalin';
    setTimeout(() => {
      els.btnCopyLabel.textContent = 'Salin';
    }, 1500);
  }
}

async function handleCreateMailboxes(rawEntries, defaultDomain, label) {
  const res = await apiFetch('/api/admin/mailboxes', {
    method: 'POST',
    admin: true,
    body: JSON.stringify({
      addresses: rawEntries,
      defaultDomain,
      label,
    }),
  });
  state.adminMailboxes = res.mailboxes || [];
  state.adminMailboxAddressSet = new Set(state.adminMailboxes.map((m) => m.address));
  renderAdminMailboxesTable();
  await loadAdminStatsAndMessages();

  const parts = [];
  if (res.added?.length) parts.push(`${res.added.length} email dibuat`);
  if (res.skipped?.length) parts.push(`${res.skipped.length} sudah terdaftar`);
  if (res.invalid?.length) parts.push(`${res.invalid.length} tidak valid`);
  showToast(parts.join(', ') || 'Selesai memproses email.', res.added?.length ? 'success' : 'default');
  return res;
}

function bindEvents() {
  els.btnThemeToggle.addEventListener('click', toggleTheme);
  els.btnSidebarTheme.addEventListener('click', toggleTheme);
  els.btnSidebarCopy.addEventListener('click', copyActiveEmailAction);
  els.btnSidebarAdmin.addEventListener('click', openAdminLoginModal);
  els.btnOpenAdmin.addEventListener('click', openAdminLoginModal);
  els.btnSidebarLogout.addEventListener('click', logoutAdmin);
  els.btnMobileLogout.addEventListener('click', logoutAdmin);

  els.btnSidebarQuickCreate.addEventListener('click', () => {
    switchAdminView('mailboxes', { focusQuickInput: true });
  });

  document.addEventListener('click', (e) => {
    const viewTrigger = e.target.closest('[data-admin-view]');
    if (viewTrigger && state.adminAuthenticated) {
      const targetView = viewTrigger.dataset.adminView;
      switchAdminView(targetView);
    }
  });

  document.querySelectorAll('[data-nav-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setFilter(btn.dataset.navFilter, { scrollToInbox: true });
    });
  });

  if (els.mobNavInbox) els.mobNavInbox.addEventListener('click', () => setFilter('all', { scrollToInbox: true }));
  if (els.mobNavAdmin) els.mobNavAdmin.addEventListener('click', openAdminLoginModal);

  els.btnToggleAutoPoll.addEventListener('click', () => {
    state.autoPoll = !state.autoPoll;
    if (state.autoPoll) resetPollCountdown();
    else updatePollBadge();
  });

  els.inputUsername.addEventListener('input', () => {
    els.builderError.classList.add('hidden');
  });

  els.addressForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const parsed = parseAddressInput(els.inputUsername.value, els.selectDomain.value);
    if (!parsed.valid) {
      els.builderError.textContent = parsed.error;
      els.builderError.classList.remove('hidden');
      els.inputUsername.focus();
      return;
    }
    setActiveAddress(parsed.localPart, parsed.domain);
  });

  els.selectDomain.addEventListener('change', () => {
    renderDomainPills();
    els.builderError.classList.add('hidden');
  });

  els.btnCopyEmail.addEventListener('click', copyActiveEmailAction);

  els.btnRefreshInbox.addEventListener('click', () => {
    fetchInbox({ silent: false });
    resetPollCountdown();
  });

  if (els.domainPills) {
    els.domainPills.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pick-domain]');
      if (!btn) return;
      const dom = btn.dataset.pickDomain;
      if (els.selectDomain.querySelector(`option[value="${CSS.escape(dom)}"]`)) {
        els.selectDomain.value = dom;
        syncCustomDropdown(els.selectDomain);
      }
      renderDomainPills();
      els.inputUsername.focus();
      showToast(`Domain @${dom} dipilih. Ketik username lalu klik Buka Inbox.`);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (activeDropdown) return;
    if (!els.adminModal.classList.contains('hidden')) return;
    if (els.mailWorkspace.classList.contains('is-reading')) {
      els.mailWorkspace.classList.remove('is-reading');
    }
  });

  document.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => setFilter(tab.dataset.filter));
  });

  let searchDebounce = null;
  els.inputInboxSearch.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.searchQuery = els.inputInboxSearch.value.trim();
      if (getActiveAddress()) fetchInbox({ silent: false });
    }, 220);
  });

  els.btnClearInbox.addEventListener('click', async () => {
    if (!state.adminAuthenticated) return;
    const addr = getActiveAddress();
    if (!addr || !state.counts.all) {
      showToast('Inbox sudah kosong.');
      return;
    }
    if (!confirm(`Hapus semua pesan di ${addr}?`)) return;
    try {
      await apiFetch(`/api/inbox?address=${encodeURIComponent(addr)}`, { method: 'DELETE', admin: true });
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
    const otpBtn = e.target.closest('[data-quick-otp]');
    if (otpBtn) {
      e.stopPropagation();
      copyText(otpBtn.dataset.quickOtp, `Kode OTP ${otpBtn.dataset.quickOtp} disalin`);
      return;
    }
    const openBtn = e.target.closest('[data-open-id]');
    if (openBtn) {
      openMessage(openBtn.dataset.openId);
    }
  });

  els.adminCatchallList.addEventListener('click', (e) => {
    const otpBtn = e.target.closest('[data-quick-otp]');
    if (otpBtn) {
      e.stopPropagation();
      copyText(otpBtn.dataset.quickOtp, `Kode OTP ${otpBtn.dataset.quickOtp} disalin`);
      return;
    }
    const openBtn = e.target.closest('[data-admin-open-id]');
    if (openBtn) {
      openAdminCatchallMessage(openBtn.dataset.adminOpenId);
    }
  });

  const handleReaderClick = async (e) => {
    const backBtn = e.target.closest('[data-mobile-back]');
    if (backBtn) {
      if (backBtn.dataset.mobileBack === 'admin') {
        els.adminCatchallWorkspace.classList.remove('is-reading');
      } else {
        els.mailWorkspace.classList.remove('is-reading');
      }
      return;
    }

    const otpBtn = e.target.closest('[data-copy-otp]');
    if (otpBtn) {
      copyText(otpBtn.dataset.copyOtp, `Kode OTP ${otpBtn.dataset.copyOtp} disalin`);
      return;
    }

    const tabBtn = e.target.closest('[data-reader-tab]');
    if (tabBtn) {
      if (tabBtn.dataset.tabMode === 'admin') {
        state.adminReaderTab = tabBtn.dataset.readerTab;
        renderAdminCatchallReader();
      } else {
        state.readerTab = tabBtn.dataset.readerTab;
        renderPublicReader();
      }
      return;
    }

    const imgBtn = e.target.closest('[data-toggle-images]');
    if (imgBtn) {
      if (imgBtn.dataset.toggleImages === 'admin') {
        state.adminAllowImages = !state.adminAllowImages;
        renderAdminCatchallReader();
      } else {
        state.allowExternalImages = !state.allowExternalImages;
        renderPublicReader();
      }
      return;
    }

    const copyRawBtn = e.target.closest('[data-copy-raw]');
    if (copyRawBtn) {
      const src =
        copyRawBtn.dataset.copyRaw === 'admin'
          ? state.adminSelectedDetail?.rawSource || ''
          : state.selectedDetail?.rawSource || '';
      copyText(src, 'Raw EML disalin ke clipboard');
      return;
    }

    const regBtn = e.target.closest('[data-admin-register-addr]');
    if (regBtn && state.adminAuthenticated) {
      const addr = regBtn.dataset.adminRegisterAddr;
      try {
        await handleCreateMailboxes(addr, state.defaultDomain, 'Didaftarkan dari Catch-All');
        renderAdminCatchallReader();
      } catch (err) {
        showToast(`Gagal mendaftarkan alamat: ${err.message}`, 'error');
      }
      return;
    }

    const delBtn = e.target.closest('[data-delete-email]');
    if (delBtn && state.adminAuthenticated) {
      const id = delBtn.dataset.deleteEmail;
      const mode = delBtn.dataset.deleteMode;
      try {
        if (mode === 'admin') {
          await apiFetch(`/api/admin/messages/${encodeURIComponent(id)}`, { method: 'DELETE', admin: true });
          state.adminSelectedId = null;
          state.adminSelectedDetail = null;
          els.adminCatchallWorkspace.classList.remove('is-reading');
          renderAdminCatchallReader();
          await Promise.all([loadAdminStatsAndMessages(), loadAdminMailboxes()]);
        } else {
          await apiFetch(`/api/emails/${encodeURIComponent(id)}`, { method: 'DELETE', admin: true });
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
  els.adminCatchallReader.addEventListener('click', handleReaderClick);

  els.btnCloseAdmin.addEventListener('click', closeAdminLoginModal);
  els.adminModal.addEventListener('click', (e) => {
    if (e.target === els.adminModal) closeAdminLoginModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.adminModal.classList.contains('hidden')) {
      closeAdminLoginModal();
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
      state.adminView = 'mailboxes';
      els.inputAdminPin.value = '';
      try { sessionStorage.setItem(STORAGE_KEYS.adminToken, res.token); } catch {}
      closeAdminLoginModal();
      syncModeShell();
      showToast('Selamat datang di Workspace Admin AMC Mail', 'success');
      await loadAdminAll();
    } catch (err) {
      els.adminLoginError.textContent = err.message;
      els.adminLoginError.classList.remove('hidden');
    }
  });

  // Admin Quick Single Email Creator
  els.adminQuickMailboxForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = els.inputQuickUsername.value.trim();
    if (!raw) return;
    try {
      const res = await handleCreateMailboxes(raw, els.selectQuickDomain.value || state.defaultDomain, els.inputQuickLabel.value.trim());
      if (res.added?.length) {
        els.inputQuickUsername.value = '';
        els.inputQuickLabel.value = '';
      }
    } catch (err) {
      showToast(`Gagal membuat alamat email: ${err.message}`, 'error');
    }
  });

  // Admin Bulk Email Creator
  els.adminCreateMailboxForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = els.inputNewMailboxes.value.trim();
    if (!raw) {
      showToast('Masukkan minimal satu username atau alamat email.', 'error');
      return;
    }
    try {
      await handleCreateMailboxes(raw, els.selectNewMailboxDomain.value || state.defaultDomain, els.inputNewMailboxLabel.value.trim());
      els.inputNewMailboxes.value = '';
      els.inputNewMailboxLabel.value = '';
    } catch (err) {
      showToast(`Gagal membuat alamat email: ${err.message}`, 'error');
    }
  });

  els.adminMailboxFilterDomain.addEventListener('change', loadAdminMailboxes);
  let mbSearchTimer = null;
  els.adminMailboxFilterSearch.addEventListener('input', () => {
    clearTimeout(mbSearchTimer);
    mbSearchTimer = setTimeout(loadAdminMailboxes, 220);
  });
  els.btnAdminRefreshMailboxes.addEventListener('click', loadAdminMailboxes);

  els.adminMailboxesTbody.addEventListener('change', async (e) => {
    const statusSel = e.target.closest('[data-mailbox-status-id]');
    if (statusSel) {
      try {
        const res = await apiFetch(`/api/admin/mailboxes/${statusSel.dataset.mailboxStatusId}`, {
          method: 'PATCH',
          admin: true,
          body: JSON.stringify({ status: statusSel.value }),
        });
        state.adminMailboxes = res.mailboxes || [];
        renderAdminMailboxesTable();
        await loadAdminStatsAndMessages();
        showToast('Status alamat email diperbarui.', 'success');
      } catch (err) {
        showToast(`Gagal mengubah status: ${err.message}`, 'error');
      }
      return;
    }

    const labelInput = e.target.closest('[data-mailbox-label-id]');
    if (labelInput) {
      try {
        await apiFetch(`/api/admin/mailboxes/${labelInput.dataset.mailboxLabelId}`, {
          method: 'PATCH',
          admin: true,
          body: JSON.stringify({ label: labelInput.value }),
        });
        showToast('Keterangan email disimpan.');
      } catch (err) {
        showToast(`Gagal menyimpan keterangan: ${err.message}`, 'error');
      }
    }
  });

  els.adminMailboxesTbody.addEventListener('click', async (e) => {
    const openBtn = e.target.closest('[data-mailbox-open]');
    if (openBtn) {
      const addr = openBtn.dataset.mailboxOpen;
      const [u, d] = addr.split('@');
      if (u && d) {
        state.adminView = 'reader';
        syncModeShell();
        setActiveAddress(u, d);
      }
      return;
    }

    const copyAddrBtn = e.target.closest('[data-mailbox-copy-addr]');
    if (copyAddrBtn) {
      copyText(copyAddrBtn.dataset.mailboxCopyAddr, `Disalin: ${copyAddrBtn.dataset.mailboxCopyAddr}`);
      return;
    }

    const copyLinkBtn = e.target.closest('[data-mailbox-copy-link]');
    if (copyLinkBtn) {
      const addr = copyLinkBtn.dataset.mailboxCopyLink;
      const link = `${window.location.origin}${window.location.pathname}?email=${encodeURIComponent(addr)}`;
      copyText(link, `Link inbox ${addr} disalin`);
      return;
    }

    const delBtn = e.target.closest('[data-mailbox-delete]');
    if (delBtn) {
      const id = delBtn.dataset.mailboxDelete;
      const addr = delBtn.dataset.mailboxAddr;
      if (!confirm(`Hapus akses alamat ${addr} dari daftar email terdaftar?`)) return;
      try {
        const res = await apiFetch(`/api/admin/mailboxes/${id}`, { method: 'DELETE', admin: true });
        state.adminMailboxes = res.mailboxes || [];
        state.adminMailboxAddressSet = new Set(state.adminMailboxes.map((m) => m.address));
        renderAdminMailboxesTable();
        await loadAdminStatsAndMessages();
        showToast(`Alamat ${addr} dihapus dari daftar email.`);
      } catch (err) {
        showToast(`Gagal menghapus email: ${err.message}`, 'error');
      }
    }
  });

  // Catch-All Filters
  els.adminFilterDomain.addEventListener('change', loadAdminStatsAndMessages);
  els.adminFilterType.addEventListener('change', loadAdminStatsAndMessages);
  let adminSearchTimer = null;
  els.adminFilterSearch.addEventListener('input', () => {
    clearTimeout(adminSearchTimer);
    adminSearchTimer = setTimeout(loadAdminStatsAndMessages, 250);
  });
  els.btnAdminRefreshMsgs.addEventListener('click', loadAdminStatsAndMessages);

  // Admin Domains
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
      state.adminDomains = res.domains || [];
      renderAdminDomainsTable();
      syncAdminDomainDropdowns();
      await Promise.all([refreshPublicDomains(), loadAdminStatsAndMessages()]);

      const summary = [];
      if (res.added?.length) summary.push(`${res.added.length} ditambahkan`);
      if (res.skipped?.length) summary.push(`${res.skipped.length} sudah ada`);
      if (res.invalid?.length) summary.push(`${res.invalid.length} tidak valid`);
      showToast(`Domain diproses: ${summary.join(', ')}`, 'success');
    } catch (err) {
      showToast(`Gagal menambahkan domain: ${err.message}`, 'error');
    }
  });

  els.adminDomainsTbody.addEventListener('change', async (e) => {
    const statusSel = e.target.closest('[data-domain-status-id]');
    if (statusSel) {
      try {
        const res = await apiFetch(`/api/admin/domains/${statusSel.dataset.domainStatusId}`, {
          method: 'PATCH',
          admin: true,
          body: JSON.stringify({ status: statusSel.value }),
        });
        state.adminDomains = res.domains || [];
        renderAdminDomainsTable();
        syncAdminDomainDropdowns();
        await Promise.all([refreshPublicDomains(), loadAdminStatsAndMessages()]);
        showToast('Status domain diperbarui.', 'success');
      } catch (err) {
        showToast(`Gagal mengubah status: ${err.message}`, 'error');
      }
      return;
    }

    const notesInput = e.target.closest('[data-domain-notes-id]');
    if (notesInput) {
      try {
        await apiFetch(`/api/admin/domains/${notesInput.dataset.domainNotesId}`, {
          method: 'PATCH',
          admin: true,
          body: JSON.stringify({ notes: notesInput.value }),
        });
        showToast('Catatan domain disimpan.');
      } catch (err) {
        showToast(`Gagal menyimpan catatan: ${err.message}`, 'error');
      }
    }
  });

  els.adminDomainsTbody.addEventListener('click', async (e) => {
    const defBtn = e.target.closest('[data-domain-default]');
    if (defBtn) {
      try {
        const res = await apiFetch(`/api/admin/domains/${defBtn.dataset.domainDefault}`, {
          method: 'PATCH',
          admin: true,
          body: JSON.stringify({ isDefault: true }),
        });
        state.adminDomains = res.domains || [];
        renderAdminDomainsTable();
        syncAdminDomainDropdowns();
        await refreshPublicDomains();
        showToast('Domain default diperbarui.', 'success');
      } catch (err) {
        showToast(`Gagal mengubah domain default: ${err.message}`, 'error');
      }
      return;
    }

    const delBtn = e.target.closest('[data-domain-delete]');
    if (delBtn) {
      const id = delBtn.dataset.domainDelete;
      const name = delBtn.dataset.domainName;
      if (!confirm(`Hapus domain ${name} dari daftar? Email lama tetap aman di arsip.`)) return;
      try {
        const res = await apiFetch(`/api/admin/domains/${id}`, { method: 'DELETE', admin: true });
        state.adminDomains = res.domains || [];
        renderAdminDomainsTable();
        syncAdminDomainDropdowns();
        await Promise.all([refreshPublicDomains(), loadAdminStatsAndMessages()]);
        showToast(`Domain ${name} dihapus.`);
      } catch (err) {
        showToast(`Gagal menghapus domain: ${err.message}`, 'error');
      }
    }
  });

  // Admin Settings & Simulator
  els.adminSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        admin: true,
        body: JSON.stringify({
          retentionHours: Number(els.selectRetentionHours.value),
          autoRegisterDomains: els.checkAutoRegister.checked,
          blockedUsernames: els.inputBlockedUsers.value,
        }),
      });
      await refreshPublicDomains();
      showToast('Pengaturan berhasil disimpan.', 'success');
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
      showToast(`${res.purged || 0} pesan kedaluwarsa dibersihkan.`);
      await Promise.all([loadAdminStatsAndMessages(), loadAdminMailboxes()]);
    } catch (err) {
      showToast(`Gagal membersihkan pesan: ${err.message}`, 'error');
    }
  });

  els.adminSimForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const to = els.inputAdminSimTo.value.trim().toLowerCase();
    const scenario = els.selectAdminSimType.value;
    if (!to) return;
    try {
      await apiFetch('/api/simulate', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({ recipient: to, scenario }),
      });
      showToast(`Uji coba ${scenario} terkirim ke ${to}`, 'success');
      await Promise.all([loadAdminStatsAndMessages(), loadAdminMailboxes()]);
    } catch (err) {
      showToast(`Gagal mengirim uji coba: ${err.message}`, 'error');
    }
  });
}

/* Custom AMC Dropdown Engine (order.amc.web.id sky blue design) */
const dropdownRegistry = new WeakMap();
let activeDropdown = null;
let dropdownEngineInitialized = false;

const DROPDOWN_ICONS = {
  domain:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
  type:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>',
  retention:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
  sim:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>',
  chevron:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"></polyline></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><polyline points="20 6 9 17 4 12"></polyline></svg>',
};

function getDropdownPortal() {
  let portal = document.getElementById('amc-dd-portal');
  if (!portal) {
    portal = document.createElement('div');
    portal.id = 'amc-dd-portal';
    portal.className = 'amc-dd-portal';
    document.body.appendChild(portal);
  }
  return portal;
}

function parseDropdownOption(rawText, kind) {
  const txt = String(rawText || '').trim();
  if (txt.endsWith(' (Default)')) {
    return { label: txt.slice(0, -10).trim(), tag: 'Default', dot: '' };
  }
  if (kind === 'domain') {
    if (txt.endsWith(' (active)')) return { label: txt.slice(0, -9).trim(), tag: 'Aktif', dot: 'active' };
    if (txt.endsWith(' (pending)')) return { label: txt.slice(0, -10).trim(), tag: 'Pending', dot: 'pending' };
    if (txt.endsWith(' (disabled)')) return { label: txt.slice(0, -11).trim(), tag: 'Nonaktif', dot: 'disabled' };
  }
  return { label: txt, tag: '', dot: '' };
}

function getStatusKey(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'active' || v === 'pending' || v === 'disabled') return v;
  return '';
}

function renderDropdownLeading(kind, value, isTable) {
  if (kind === 'status') {
    const sk = getStatusKey(value) || 'active';
    return `<span class="amc-dd-dot is-${sk}" aria-hidden="true"></span>`;
  }
  if (isTable) return '';
  const svg = DROPDOWN_ICONS[kind] || DROPDOWN_ICONS.domain;
  return `<span class="amc-dd-leading" aria-hidden="true">${svg}</span>`;
}

function closeActiveDropdown({ returnFocus = false } = {}) {
  if (!activeDropdown) return;
  const { wrapper, trigger, menu } = activeDropdown;
  wrapper.classList.remove('is-open');
  trigger.setAttribute('aria-expanded', 'false');
  if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
  activeDropdown = null;
  if (returnFocus && document.body.contains(trigger)) {
    trigger.focus();
  }
}

function positionDropdownMenu(trigger, menu, kind = 'type') {
  const rect = trigger.getBoundingClientRect();
  const preferredMin = kind === 'domain' || kind === 'sim' ? 276 : 228;
  const minW = Math.max(rect.width, preferredMin);
  const maxW = Math.min(368, window.innerWidth - 24);
  menu.style.width = `${Math.min(Math.max(minW, rect.width), maxW)}px`;

  const mRect = menu.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - 12;
  const spaceAbove = rect.top - 12;

  let top = rect.bottom + 8;
  menu.classList.remove('is-up');
  if (spaceBelow < mRect.height && spaceAbove > spaceBelow) {
    top = Math.max(12, rect.top - mRect.height - 8);
    menu.classList.add('is-up');
  } else if (top + mRect.height > window.innerHeight - 10) {
    top = Math.max(12, window.innerHeight - mRect.height - 10);
  }

  const maxLeft = Math.max(12, window.innerWidth - mRect.width - 12);
  const left = Math.min(Math.max(12, rect.left), maxLeft);

  menu.style.top = `${Math.round(top)}px`;
  menu.style.left = `${Math.round(left)}px`;
}

function enhanceSelect(selectEl) {
  if (!selectEl || selectEl.tagName !== 'SELECT') return null;
  if (dropdownRegistry.has(selectEl)) return dropdownRegistry.get(selectEl);

  const isTable = selectEl.classList.contains('table-control');
  const isHeroDomain = selectEl.classList.contains('domain-select');

  const wrapper = document.createElement('div');
  wrapper.className = 'amc-dropdown';
  if (isTable) wrapper.classList.add('is-table');
  if (isHeroDomain) wrapper.classList.add('is-domain-hero');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'amc-dd-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  if (selectEl.id) {
    trigger.dataset.ddFor = selectEl.id;
  }

  selectEl.parentNode.insertBefore(wrapper, selectEl);
  wrapper.appendChild(selectEl);
  wrapper.appendChild(trigger);

  selectEl.classList.add('amc-native-select');
  selectEl.setAttribute('tabindex', '-1');
  selectEl.setAttribute('aria-hidden', 'true');

  const entry = { selectEl, wrapper, trigger, isTable };
  dropdownRegistry.set(selectEl, entry);

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectEl.disabled) return;
    if (activeDropdown && activeDropdown.selectEl === selectEl) {
      closeActiveDropdown({ returnFocus: true });
    } else {
      openDropdown(selectEl);
    }
  });

  trigger.addEventListener('keydown', (e) => {
    if (selectEl.disabled) return;
    if (activeDropdown && activeDropdown.selectEl === selectEl) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDropdown(selectEl);
    }
  });

  selectEl.addEventListener('change', () => {
    syncCustomDropdown(selectEl);
  });

  syncCustomDropdown(selectEl);
  return entry;
}

function syncCustomDropdown(selectEl) {
  if (!selectEl || selectEl.tagName !== 'SELECT') return;
  const entry = dropdownRegistry.get(selectEl) || enhanceSelect(selectEl);
  if (!entry) return;

  const { trigger, isTable } = entry;
  const kind = selectEl.dataset.ddKind || (selectEl.classList.contains('domain-select') ? 'domain' : 'type');
  const title = selectEl.dataset.ddTitle || 'Pilih Opsi';
  const selectedOpt = selectEl.options[selectEl.selectedIndex] || selectEl.options[0];
  const rawLabel = selectedOpt ? selectedOpt.textContent : 'Memuat...';
  const selectedVal = selectedOpt ? selectedOpt.value : '';
  const parsed = parseDropdownOption(rawLabel, kind);

  trigger.disabled = Boolean(selectEl.disabled);
  trigger.setAttribute('aria-label', `${title}: ${parsed.label}`);
  trigger.classList.remove('is-status-active', 'is-status-pending', 'is-status-disabled');
  if (kind === 'status') {
    const sk = getStatusKey(selectedVal);
    if (sk) trigger.classList.add(`is-status-${sk}`);
  }

  const leadingHtml = renderDropdownLeading(kind, selectedVal, isTable);
  const tagHtml = !isTable && parsed.tag ? `<span class="amc-dd-tag">${escapeHtml(parsed.tag)}</span>` : '';

  trigger.innerHTML = `
    <span class="amc-dd-trigger-main">
      ${leadingHtml}
      <span class="amc-dd-value">${escapeHtml(parsed.label)}</span>
      ${tagHtml}
    </span>
    <span class="amc-dd-caret" aria-hidden="true">${DROPDOWN_ICONS.chevron}</span>
  `;
}

function openDropdown(selectEl) {
  const entry = dropdownRegistry.get(selectEl) || enhanceSelect(selectEl);
  if (!entry) return;

  closeActiveDropdown();

  const { wrapper, trigger } = entry;
  const kind = selectEl.dataset.ddKind || 'type';
  const title = selectEl.dataset.ddTitle || 'Pilih Opsi';
  const options = Array.from(selectEl.options);
  if (options.length === 0) return;

  const menu = document.createElement('div');
  menu.className = 'amc-dd-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', title);

  const head = document.createElement('div');
  head.className = 'amc-dd-head';
  head.innerHTML = `<span>${escapeHtml(title)}</span><span class="amc-dd-count">${options.length} opsi</span>`;
  menu.appendChild(head);

  const list = document.createElement('div');
  list.className = 'amc-dd-list';

  let selectedIdx = Math.max(0, selectEl.selectedIndex);

  options.forEach((opt, idx) => {
    const isSelected = idx === selectedIdx;
    const parsed = parseDropdownOption(opt.textContent, kind);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `amc-dd-option ${isSelected ? 'is-selected is-focused' : ''}`;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    btn.dataset.ddValue = opt.value;
    btn.dataset.ddIndex = String(idx);
    btn.disabled = Boolean(opt.disabled);

    let leftIndicator = '';
    if (kind === 'status') {
      const sk = getStatusKey(opt.value) || 'active';
      leftIndicator = `<span class="amc-dd-dot is-${sk}" aria-hidden="true"></span>`;
    } else if (parsed.dot) {
      leftIndicator = `<span class="amc-dd-dot is-${parsed.dot}" aria-hidden="true"></span>`;
    }

    const tagHtml = parsed.tag ? `<span class="amc-dd-tag">${escapeHtml(parsed.tag)}</span>` : '';

    btn.innerHTML = `
      <span class="amc-dd-option-main">
        ${leftIndicator}
        <span class="amc-dd-option-label">${escapeHtml(parsed.label)}</span>
        ${tagHtml}
      </span>
      <span class="amc-dd-check" aria-hidden="true">${DROPDOWN_ICONS.check}</span>
    `;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectDropdownValue(selectEl, opt.value);
    });

    btn.addEventListener('mouseenter', () => {
      setDropdownFocusIndex(idx);
    });

    list.appendChild(btn);
  });

  menu.appendChild(list);
  getDropdownPortal().appendChild(menu);

  wrapper.classList.add('is-open');
  trigger.setAttribute('aria-expanded', 'true');
  activeDropdown = { selectEl, wrapper, trigger, menu, list, focusedIndex: selectedIdx, openedAt: Date.now() };

  positionDropdownMenu(trigger, menu, kind);
  const activeBtn = list.children[selectedIdx];
  if (activeBtn) {
    const top = activeBtn.offsetTop;
    const bottom = top + activeBtn.offsetHeight;
    if (bottom > list.clientHeight) {
      list.scrollTop = Math.max(0, top - 40);
    }
  }
}

function setDropdownFocusIndex(nextIdx) {
  if (!activeDropdown) return;
  const items = Array.from(activeDropdown.list.querySelectorAll('.amc-dd-option:not(:disabled)'));
  if (items.length === 0) return;
  const clamped = ((nextIdx % items.length) + items.length) % items.length;
  activeDropdown.focusedIndex = clamped;
  items.forEach((el, idx) => {
    el.classList.toggle('is-focused', idx === clamped);
  });
  const el = items[clamped];
  const list = activeDropdown.list;
  if (el.offsetTop < list.scrollTop) {
    list.scrollTop = el.offsetTop - 6;
  } else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) {
    list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight + 6;
  }
}

function selectDropdownValue(selectEl, value) {
  const prev = selectEl.value;
  selectEl.value = value;
  syncCustomDropdown(selectEl);
  closeActiveDropdown({ returnFocus: true });
  if (prev !== value) {
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function syncCustomDropdowns(root = document) {
  const selects = root.querySelectorAll('select');
  selects.forEach((sel) => syncCustomDropdown(sel));
}

function initCustomDropdownEngine() {
  if (dropdownEngineInitialized) return;
  dropdownEngineInitialized = true;

  document.addEventListener('click', (e) => {
    const lbl = e.target.closest('label[for]');
    if (lbl) {
      const target = document.getElementById(lbl.getAttribute('for'));
      if (target && target.tagName === 'SELECT' && dropdownRegistry.has(target)) {
        e.preventDefault();
        const entry = dropdownRegistry.get(target);
        entry.trigger.focus();
        openDropdown(target);
        return;
      }
    }

    if (!activeDropdown) return;
    if (activeDropdown.menu.contains(e.target) || activeDropdown.wrapper.contains(e.target)) {
      return;
    }
    closeActiveDropdown();
  });

  document.addEventListener('keydown', (e) => {
    if (!activeDropdown) return;
    const items = Array.from(activeDropdown.list.querySelectorAll('.amc-dd-option:not(:disabled)'));
    if (e.key === 'Escape') {
      e.preventDefault();
      closeActiveDropdown({ returnFocus: true });
    } else if (e.key === 'Tab') {
      closeActiveDropdown();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDropdownFocusIndex(activeDropdown.focusedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDropdownFocusIndex(activeDropdown.focusedIndex - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setDropdownFocusIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setDropdownFocusIndex(items.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const chosen = items[activeDropdown.focusedIndex];
      if (chosen) selectDropdownValue(activeDropdown.selectEl, chosen.dataset.ddValue);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const ch = e.key.toLowerCase();
      const matchIdx = items.findIndex((el) => el.textContent.trim().toLowerCase().startsWith(ch));
      if (matchIdx >= 0) setDropdownFocusIndex(matchIdx);
    }
  });

  window.addEventListener('resize', () => closeActiveDropdown());
  window.addEventListener(
    'scroll',
    (e) => {
      if (!activeDropdown) return;
      if (Date.now() - activeDropdown.openedAt < 180) return;
      if (activeDropdown.menu.contains(e.target)) return;
      closeActiveDropdown();
    },
    true
  );
}

async function init() {
  els.footerYear.textContent = String(new Date().getFullYear());
  syncThemeUI();
  syncNavActiveStates();
  initCustomDropdownEngine();
  syncCustomDropdowns();

  try {
    state.adminToken = sessionStorage.getItem(STORAGE_KEYS.adminToken) || '';
  } catch {}

  bindEvents();

  try {
    const [, domRes] = await Promise.all([
      apiFetch('/api/health'),
      apiFetch('/api/domains'),
    ]);

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

    renderDomainControls();
    syncModeShell();

    if (state.adminAuthenticated) {
      await loadAdminAll();
    }

    const urlEmail = new URLSearchParams(window.location.search).get('email') || '';
    let savedAddr = '';
    try { savedAddr = localStorage.getItem(STORAGE_KEYS.activeAddress) || ''; } catch {}
    const candidate = (urlEmail || savedAddr).trim().toLowerCase();

    if (candidate.includes('@')) {
      const [u, d] = candidate.split('@');
      if (LOCAL_PART_REGEX.test(u) && state.domains.some((dom) => dom.domain === d)) {
        if (urlEmail && state.adminAuthenticated) {
          state.adminView = 'reader';
          syncModeShell();
        }
        setActiveAddress(u, d, { pushUrl: Boolean(urlEmail) });
      } else {
        updateAddressActionButtons();
        renderInboxList();
      }
    } else {
      updateAddressActionButtons();
      renderInboxList();
    }

    startPollingLoop();
  } catch (err) {
    state.inboxError = err.message;
    renderInboxList();
    showToast(`Gagal menginisialisasi AMC Mail: ${err.message}`, 'error');
  }
}

init();
