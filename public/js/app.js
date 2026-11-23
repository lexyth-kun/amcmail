const POLL_INTERVAL_SEC = 10;
const STORAGE_KEYS = {
  theme: 'amc_mail_theme',
  activeAddress: 'amc_mail_active_address',
  adminToken: 'amc_mail_admin_token',
};

const LOCAL_PART_REGEX = /^[a-z0-9][a-z0-9._+-]{0,62}$/;

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
  counts: { all: 0, inbox: 0, bounce: 0, otp: 0, unread: 0 },
  inboxLoading: false,
  inboxError: null,
  inboxErrorCode: null,
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
  adminActiveTab: 'mailboxes',
  adminMailboxes: [],
  adminMailboxAddressSet: new Set(),
  adminDomains: [],
  adminMessages: [],
  adminInspectorDetail: null,
  adminInspectorTab: 'html',
  adminInspectorImages: false,
  lastFocusedBeforeModal: null,
};

const $ = (id) => document.getElementById(id);

const els = {
  sidebarActiveAddr: $('sidebar-active-addr'),
  btnSidebarCopy: $('btn-sidebar-copy'),
  btnSidebarCreate: $('btn-sidebar-create'),
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
  mobNavAdmin: $('mob-nav-admin'),

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
  btnHeroCreateEmail: $('btn-hero-create-email'),

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

  kpiTotalMailboxes: $('kpi-total-mailboxes'),
  kpiActiveMailboxes: $('kpi-active-mailboxes'),
  kpiTotalEmails: $('kpi-total-emails'),
  kpiEmails24h: $('kpi-emails-24h'),
  kpiTotalBounces: $('kpi-total-bounces'),
  kpiBounces24h: $('kpi-bounces-24h'),
  kpiActiveDomains: $('kpi-active-domains'),
  kpiPendingDomains: $('kpi-pending-domains'),

  adminTabMailboxes: $('admin-tab-mailboxes'),
  adminTabMonitor: $('admin-tab-monitor'),
  adminTabDomains: $('admin-tab-domains'),
  adminTabSettings: $('admin-tab-settings'),

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
  btnCloseInspector: $('btn-close-inspector'),
  inspectorBody: $('inspector-body'),
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
  state.counts = { all: 0, inbox: 0, bounce: 0, otp: 0, unread: 0 };

  els.inputUsername.value = cleanUser;
  if (els.selectDomain.querySelector(`option[value="${CSS.escape(cleanDomain)}"]`)) {
    els.selectDomain.value = cleanDomain;
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

  els.retentionInfo.textContent = `Retensi otomatis: ${formatRetentionLabel(state.retentionHours)}`;
  els.heroDomainCount.textContent = String(list.length);
  els.sideDomainCount.textContent = String(list.length);
  renderDomainPills();
}

function renderDomainPills() {
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
  els.countBounce.textContent = String(state.counts.bounce || 0);
  els.countOtp.textContent = String(state.counts.otp || 0);

  els.sideCountAll.textContent = String(state.counts.all || 0);
  els.sideCountInbox.textContent = String(state.counts.inbox || 0);
  els.sideCountBounce.textContent = String(state.counts.bounce || 0);
  els.sideCountOtp.textContent = String(state.counts.otp || 0);

  els.heroInboxCount.textContent = String(state.counts.all || 0);
  els.heroBounceCount.textContent = String(state.counts.bounce || 0);

  els.tabFilterBounce.classList.toggle('has-items', (state.counts.bounce || 0) > 0);
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
  els.mobNavInbox.classList.toggle('is-active', state.filter !== 'bounce');
  els.mobNavBounce.classList.toggle('is-active', state.filter === 'bounce');
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
      state.filter === 'bounce'
        ? 'Belum ada laporan bounce SMTP atau DSN untuk alamat ini.'
        : state.filter === 'otp'
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
    .map((msg) => {
      const selected = msg.id === state.selectedId;
      const bounce = msg.bounceSummary || msg.bounceInfo;
      const badges = [];

      if (msg.isBounce) {
        const isHard = bounce?.severity !== 'soft';
        const codeText = [bounce?.smtpCode, bounce?.enhancedStatus].filter(Boolean).join(' ');
        badges.push(
          `<span class="badge ${isHard ? 'badge-hard' : 'badge-soft'}">${isHard ? 'HARD BOUNCE' : 'SOFT BOUNCE'}${codeText ? `: ${escapeHtml(codeText)}` : ''}</span>`
        );
      }

      if (msg.otpCode) {
        badges.push(
          `<button type="button" class="badge badge-otp mono" data-quick-otp="${escapeHtml(msg.otpCode)}" title="Klik untuk menyalin kode OTP">Salin OTP ${escapeHtml(msg.otpCode)}</button>`
        );
      }

      if (msg.hasAttachments) {
        badges.push('<span class="badge badge-neutral">Lampiran</span>');
      }

      const senderLabel = msg.fromName || msg.fromAddress || msg.sender || '(Tanpa Pengirim)';

      return `
        <article class="message-item ${selected ? 'is-selected' : ''} ${msg.isRead ? '' : 'is-unread'} ${msg.isBounce ? 'is-bounce' : ''}" data-msg-id="${escapeHtml(msg.id)}">
          <button type="button" class="message-open-btn" data-open-id="${escapeHtml(msg.id)}" aria-current="${selected ? 'true' : 'false'}">
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
    })
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
        if (firstNew.isBounce) {
          const bSum = firstNew.bounceSummary || firstNew.bounceInfo;
          showToast(`Bounce baru diterima: ${bSum?.smtpCode || 'DSN'}`, 'error');
        } else if (firstNew.otpCode) {
          showToast(`Kode OTP baru masuk: ${firstNew.otpCode}`, 'success');
        } else {
          showToast(`${newlyArrived.length} pesan baru masuk di ${addr}`);
        }
      }
    }

    for (const m of incoming) state.knownMessageIds.add(m.id);
    state.hasLoadedInitialInbox = true;
    state.messages = incoming;
    state.counts = res.counts || { all: 0, inbox: 0, bounce: 0, otp: 0, unread: 0 };

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
      state.counts = { all: 0, inbox: 0, bounce: 0, otp: 0, unread: 0 };
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

function sanitizeEmailHtml(html, { allowExternalImages = false } = {}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');

  doc.querySelectorAll('script, iframe, object, embed, form, meta[http-equiv="refresh"], base, link[rel="import"]').forEach((el) => el.remove());

  let blockedImageCount = 0;
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const val = attr.value.trim();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === 'href' || name === 'src' || name === 'action') && /^\s*(javascript|vbscript):/i.test(val)) {
        el.removeAttribute(attr.name);
        continue;
      }
    }

    if (el.tagName === 'A' && el.hasAttribute('href')) {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }

    if (el.tagName === 'IMG') {
      const src = el.getAttribute('src') || '';
      if (/^https?:\/\//i.test(src) && !allowExternalImages) {
        blockedImageCount++;
        el.removeAttribute('src');
        el.setAttribute('alt', `[Gambar eksternal diblokir: ${el.getAttribute('alt') || 'gambar'}]`);
        el.style.border = '1px dashed #94a3b8';
        el.style.padding = '8px 10px';
        el.style.display = 'inline-block';
        el.style.fontSize = '12px';
        el.style.color = '#475569';
      }
    }
  });

  const cleanBody = doc.body ? doc.body.innerHTML : '';
  const srcdoc = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  body {
    margin: 0;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #0f172a;
    background: #ffffff;
    word-wrap: break-word;
  }
  img { max-width: 100%; height: auto; }
  a { color: #0369a1; }
  pre { overflow-x: auto; background: #f8fafc; padding: 10px; border-radius: 8px; }
  table { max-width: 100%; }
</style>
</head>
<body>${cleanBody}</body>
</html>`;

  return { srcdoc, blockedImageCount };
}

function buildMessageDetailMarkup(detail, { activeTab, allowExternalImages, mode = 'public' }) {
  const b = detail.bounceInfo;
  const auth = detail.authResults || {};
  const canDelete = mode === 'admin' || state.adminAuthenticated;
  const addrParam = mode === 'public' ? `?address=${encodeURIComponent(detail.recipient)}` : '';

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

  let bounceMarkup = '';
  if (detail.isBounce && b) {
    const isSoft = b.severity === 'soft';
    const codeLabel = [b.smtpCode, b.enhancedStatus].filter(Boolean).join(' / ') || 'DSN';
    const titleText = b.label || b.title || 'Laporan Bounce SMTP';
    const descText = b.explanation || b.description || '';
    const failedTarget = b.finalRecipient || b.failedRecipient || '-';
    const diagText = b.diagnostic || b.diagnosticCode || '';
    bounceMarkup = `
      <section class="bounce-card ${isSoft ? 'is-soft' : ''}" aria-label="Diagnostik Bounce SMTP">
        <div class="bounce-card-head">
          <div>
            <div class="bounce-card-title">${escapeHtml(titleText)}</div>
            <div class="bounce-card-desc">${escapeHtml(descText)}</div>
          </div>
          <span class="bounce-code-pill">${escapeHtml(codeLabel)}</span>
        </div>
        <div class="bounce-card-body">
          <div class="bounce-grid">
            <div class="meta-item">
              <span class="meta-label">Alamat Tujuan Gagal</span>
              <span class="meta-value mono">${escapeHtml(failedTarget)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Aksi DSN</span>
              <span class="meta-value mono">${escapeHtml((b.action || 'failed').toUpperCase())}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Server Pelapor (Reporting MTA)</span>
              <span class="meta-value mono">${escapeHtml(b.reportingMta || '-')}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Server Tujuan (Remote MTA)</span>
              <span class="meta-value mono">${escapeHtml(b.remoteMta || '-')}</span>
            </div>
            ${
              b.originalSubject
                ? `<div class="meta-item">
                     <span class="meta-label">Subjek Email Asli</span>
                     <span class="meta-value">${escapeHtml(b.originalSubject)}</span>
                   </div>`
                : ''
            }
          </div>
          ${
            diagText
              ? `<div class="meta-item">
                   <span class="meta-label">Pesan Diagnostik SMTP</span>
                   <div class="bounce-diag-box">${escapeHtml(diagText)}</div>
                 </div>`
              : ''
          }
        </div>
      </section>
    `;
  }

  const availableTabs = [];
  if (detail.htmlBody) availableTabs.push({ id: 'html', label: 'Tampilan HTML' });
  availableTabs.push({ id: 'text', label: 'Teks Polos' });
  if (b?.rawDsn) availableTabs.push({ id: 'dsn', label: 'Laporan DSN' });
  availableTabs.push({ id: 'headers', label: `Header (${(detail.headers || []).length})` });
  availableTabs.push({ id: 'raw', label: 'Raw EML' });

  const chosenTab = availableTabs.some((t) => t.id === activeTab) ? activeTab : availableTabs[0].id;
  let bodyMarkup = '';

  if (chosenTab === 'html') {
    const { srcdoc, blockedImageCount } = sanitizeEmailHtml(detail.htmlBody, { allowExternalImages });
    const showPrivacyBar = blockedImageCount > 0 || allowExternalImages;
    bodyMarkup = `
      ${
        showPrivacyBar
          ? `<div class="privacy-bar">
               <span>${
                 allowExternalImages
                   ? 'Gambar eksternal sedang ditampilkan.'
                   : `${blockedImageCount} gambar eksternal diblokir otomatis demi privasi.`
               }</span>
               <button type="button" class="btn btn-sm" data-toggle-images="${mode}">
                 ${allowExternalImages ? 'Blokir Gambar Eksternal' : 'Tampilkan Gambar Eksternal'}
               </button>
             </div>`
          : ''
      }
      <iframe
        class="html-frame"
        width="800"
        height="410"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        referrerpolicy="no-referrer"
        title="Isi HTML email"
        srcdoc="${escapeHtml(srcdoc)}"
      ></iframe>
    `;
  } else if (chosenTab === 'text') {
    bodyMarkup = `<pre class="plain-pre">${escapeHtml(detail.textBody || '(Tidak ada isi teks polos)')}</pre>`;
  } else if (chosenTab === 'dsn') {
    bodyMarkup = `<pre class="plain-pre">${escapeHtml(b?.rawDsn || '(Tidak ada bagian message/delivery-status)')}</pre>`;
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
      ${mode === 'public' ? '<button type="button" class="btn btn-sm mobile-back-btn" data-mobile-back>Kembali ke Inbox</button>' : ''}
      <div class="reader-top-bar">
        <h2 class="reader-subject">${escapeHtml(detail.subject || '(Tanpa Subjek)')}</h2>
        <div class="reader-actions">
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
          <span class="meta-value">${escapeHtml(detail.fromName ? `${detail.fromName} <${detail.fromAddress || detail.sender}>` : detail.fromAddress || detail.sender || '(Null Sender <>)')}</span>
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
    ${bounceMarkup}

    <div class="reader-tabs">
      <div class="reader-tab-list" role="tablist">
        ${availableTabs
          .map(
            (t) =>
              `<button type="button" class="reader-tab ${t.id === chosenTab ? 'is-active' : ''}" data-reader-tab="${t.id}" data-tab-mode="${mode}" role="tab" aria-selected="${t.id === chosenTab ? 'true' : 'false'}">${escapeHtml(t.label)}</button>`
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
  state.allowExternalImages = false;
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
    state.readerTab = res.email.isBounce && res.email.bounceInfo?.rawDsn ? 'dsn' : res.email.htmlBody ? 'html' : 'text';

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
    if (!state.autoPoll || document.hidden || !getActiveAddress() || !state.activeMailboxValid) return;
    state.pollCountdown -= 1;
    if (state.pollCountdown <= 0) {
      state.pollCountdown = POLL_INTERVAL_SEC;
      fetchInbox({ silent: true });
    }
    updatePollBadge();
  }, 1000);
  updatePollBadge();
}

function updateAdminIndicators() {
  const isAuth = state.adminAuthenticated;
  els.adminActiveDot.classList.toggle('hidden', !isAuth);
  els.sidebarAdminDot.classList.toggle('hidden', !isAuth);
  els.btnAdminLogout.classList.toggle('hidden', !isAuth);
  els.adminDefaultPinWarning.classList.toggle('hidden', !(isAuth && state.adminDefaultPin));

  els.btnHeroCreateEmail.classList.toggle('hidden', !isAuth);
  els.btnSidebarCreate.classList.toggle('hidden', !isAuth);
  els.btnClearInbox.classList.toggle('hidden', !isAuth);

  els.readonlyNotice.classList.toggle('is-admin', isAuth);
  els.readonlyNotice.textContent = isAuth
    ? 'Mode Admin aktif: Anda dapat membuat alamat email baru dan mengelola pesan.'
    : 'Mode baca saja: hanya Admin yang dapat membuat alamat email baru.';

  updateAddressActionButtons();
  if (state.selectedDetail) {
    renderPublicReader();
  }
}

function openAdminModal(initialTab = null) {
  state.lastFocusedBeforeModal = document.activeElement;
  els.adminModal.classList.remove('hidden');
  els.adminLoginError.classList.add('hidden');
  if (state.adminAuthenticated) {
    els.adminModalPanel.classList.remove('is-compact');
    els.adminLoginForm.classList.add('hidden');
    els.adminWorkspace.classList.remove('hidden');
    if (initialTab) switchAdminTab(initialTab);
    loadAdminAll();
  } else {
    els.adminModalPanel.classList.add('is-compact');
    els.adminLoginForm.classList.remove('hidden');
    els.adminWorkspace.classList.add('hidden');
    setTimeout(() => els.inputAdminPin.focus(), 40);
  }
}

function closeAdminModal() {
  els.adminModal.classList.add('hidden');
  if (state.lastFocusedBeforeModal && typeof state.lastFocusedBeforeModal.focus === 'function') {
    state.lastFocusedBeforeModal.focus();
  }
}

function switchAdminTab(tab) {
  state.adminActiveTab = tab;
  document.querySelectorAll('.admin-tab').forEach((btn) => {
    const active = btn.dataset.adminTab === tab;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  els.adminTabMailboxes.classList.toggle('hidden', tab !== 'mailboxes');
  els.adminTabMonitor.classList.toggle('hidden', tab !== 'monitor');
  els.adminTabDomains.classList.toggle('hidden', tab !== 'domains');
  els.adminTabSettings.classList.toggle('hidden', tab !== 'settings');
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
    els.kpiTotalBounces.textContent = String(st.totalBounces || 0);
    els.kpiBounces24h.textContent = String(st.bounces24h || 0);
    els.kpiActiveDomains.textContent = String(st.activeDomains || 0);
    els.kpiPendingDomains.textContent = String(st.pendingDomains || 0);

    if (statsRes.settings) {
      els.selectRetentionHours.value = String(statsRes.settings.retentionHours || 168);
      els.checkAutoRegister.checked = Boolean(statsRes.settings.autoRegisterDomains);
      els.inputBlockedUsers.value = statsRes.settings.blockedUsernamesRaw || '';
    }

    state.adminMessages = msgRes.messages || [];
    renderAdminMessagesTable();
  } catch (err) {
    if (err.status === 401) {
      handleAdminSessionExpired();
    } else {
      showToast(`Gagal memuat monitor Admin: ${err.message}`, 'error');
    }
  }
}

function renderAdminMessagesTable() {
  if (state.adminMessages.length === 0) {
    els.adminMessagesTbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">Belum ada pesan yang cocok dengan filter saat ini.</td></tr>';
    return;
  }

  els.adminMessagesTbody.innerHTML = state.adminMessages
    .map((m) => {
      let statusBadge = '<span class="badge badge-brand">Masuk</span>';
      if (m.isBounce) {
        const bSum = m.bounceSummary || m.bounceInfo;
        const isHard = bSum?.severity !== 'soft';
        const code = [bSum?.smtpCode, bSum?.enhancedStatus].filter(Boolean).join(' ');
        statusBadge = `<span class="badge ${isHard ? 'badge-hard' : 'badge-soft'} mono">${isHard ? 'HARD' : 'SOFT'} ${escapeHtml(code || 'DSN')}</span>`;
      } else if (m.otpCode) {
        statusBadge = `<span class="badge badge-otp mono">OTP ${escapeHtml(m.otpCode)}</span>`;
      }

      const isRegistered = state.adminMailboxAddressSet.has(m.recipient);

      return `
        <tr>
          <td class="mono" style="font-weight:700;word-break:break-all;">${escapeHtml(m.recipient)}</td>
          <td>${statusBadge}</td>
          <td style="max-width:340px;">
            <div style="font-weight:700;color:var(--text-primary);">${escapeHtml(m.subject || '(Tanpa Subjek)')}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);">${escapeHtml(m.fromAddress || m.sender || '<>')} | ${escapeHtml((m.snippet || '').slice(0, 80))}</div>
          </td>
          <td style="white-space:nowrap;color:var(--text-muted);">${escapeHtml(formatRelativeTime(m.receivedAt))}</td>
          <td style="text-align:right;white-space:nowrap;">
            <button type="button" class="btn btn-sm btn-soft" data-admin-inspect="${escapeHtml(m.id)}">Lihat</button>
            ${
              isRegistered
                ? ''
                : `<button type="button" class="btn btn-sm" data-admin-register-addr="${escapeHtml(m.recipient)}">Daftarkan</button>`
            }
            <button type="button" class="btn btn-sm btn-danger-outline" data-admin-delete-msg="${escapeHtml(m.id)}">Hapus</button>
          </td>
        </tr>
      `;
    })
    .join('');
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
    renderAdminMessagesTable();
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
          <td>
            <div class="mono" style="font-weight:700;word-break:break-all;">${escapeHtml(mb.address)}</div>
            <div style="font-size:0.74rem;color:var(--text-muted);">Dibuat ${escapeHtml(formatRelativeTime(mb.createdAt))}</div>
          </td>
          <td>
            <select class="select-input" style="min-height:34px;padding:4px 8px;font-size:0.8rem;min-width:112px;" data-mailbox-status-id="${mb.id}">
              <option value="active" ${mb.status === 'active' ? 'selected' : ''}>Aktif</option>
              <option value="disabled" ${mb.status === 'disabled' ? 'selected' : ''}>Nonaktif</option>
            </select>
          </td>
          <td class="mono" style="white-space:nowrap;">
            ${mb.totalEmails} pesan / <span style="color:var(--bounce-hard);">${mb.bounceEmails} bounce</span>
          </td>
          <td>
            <input type="text" class="text-input" style="min-height:34px;padding:4px 9px;font-size:0.8rem;min-width:140px;" value="${escapeHtml(mb.label)}" placeholder="Keterangan..." data-mailbox-label-id="${mb.id}">
          </td>
          <td style="text-align:right;white-space:nowrap;">
            <button type="button" class="btn btn-sm btn-soft" data-mailbox-open="${escapeHtml(mb.address)}">Buka</button>
            <button type="button" class="btn btn-sm" data-mailbox-copy-link="${escapeHtml(mb.address)}">Salin Link</button>
            <button type="button" class="btn btn-sm btn-danger-outline" data-mailbox-delete="${mb.id}" data-mailbox-addr="${escapeHtml(mb.address)}">Hapus</button>
          </td>
        </tr>
      `;
    })
    .join('');
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
  const prevNewMb = els.selectNewMailboxDomain.value;

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
  els.selectNewMailboxDomain.innerHTML = usableDomains
    .map((d) => `<option value="${escapeHtml(d.domain)}">@${escapeHtml(d.domain)}${d.isDefault ? ' (Default)' : ''}</option>`)
    .join('');
  if (prevNewMb && usableDomains.some((d) => d.domain === prevNewMb)) {
    els.selectNewMailboxDomain.value = prevNewMb;
  }
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
            <select class="select-input" style="min-height:34px;padding:4px 8px;font-size:0.8rem;min-width:120px;" data-domain-status-id="${d.id}">
              <option value="active" ${d.status === 'active' ? 'selected' : ''}>Aktif</option>
              <option value="pending" ${d.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="disabled" ${d.status === 'disabled' ? 'selected' : ''}>Nonaktif</option>
            </select>
          </td>
          <td class="mono" style="white-space:nowrap;">
            ${d.totalEmails} pesan / <span style="color:var(--bounce-hard);">${d.bounceEmails} bounce</span>
          </td>
          <td>
            <input type="text" class="text-input" style="min-height:34px;padding:4px 9px;font-size:0.8rem;min-width:150px;" value="${escapeHtml(d.notes)}" placeholder="Catatan..." data-domain-notes-id="${d.id}">
          </td>
          <td style="text-align:right;white-space:nowrap;">
            ${
              d.isDefault || d.status !== 'active'
                ? ''
                : `<button type="button" class="btn btn-sm" data-domain-default="${d.id}">Jadikan Default</button>`
            }
            <button type="button" class="btn btn-sm btn-danger-outline" data-domain-delete="${d.id}" data-domain-name="${escapeHtml(d.domain)}">Hapus</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function openAdminInspector(emailId) {
  els.inspectorModal.classList.remove('hidden');
  els.inspectorBody.innerHTML = '<div class="state-panel"><h3>Memuat Detail Pesan...</h3></div>';
  try {
    const res = await apiFetch(`/api/emails/${encodeURIComponent(emailId)}`, { admin: true });
    state.adminInspectorDetail = res.email;
    state.adminInspectorImages = false;
    state.adminInspectorTab = res.email.isBounce && res.email.bounceInfo?.rawDsn ? 'dsn' : res.email.htmlBody ? 'html' : 'text';
    renderAdminInspector();
  } catch (err) {
    els.inspectorBody.innerHTML = `<div class="state-panel"><h3 class="state-error-title">Gagal Memuat</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderAdminInspector() {
  if (!state.adminInspectorDetail) return;
  els.inspectorBody.innerHTML = buildMessageDetailMarkup(state.adminInspectorDetail, {
    activeTab: state.adminInspectorTab,
    allowExternalImages: state.adminInspectorImages,
    mode: 'admin',
  });
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
  updateAdminIndicators();
  els.adminModalPanel.classList.add('is-compact');
  els.adminWorkspace.classList.add('hidden');
  els.adminLoginForm.classList.remove('hidden');
  showToast('Sesi Admin berakhir. Silakan masuk kembali.', 'error');
}

function logoutAdmin() {
  state.adminToken = '';
  state.adminAuthenticated = false;
  try { sessionStorage.removeItem(STORAGE_KEYS.adminToken); } catch {}
  updateAdminIndicators();
  closeAdminModal();
  if (getActiveAddress()) fetchInbox({ silent: false });
  showToast('Anda keluar dari Panel Admin.');
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

function bindEvents() {
  els.btnThemeToggle.addEventListener('click', toggleTheme);
  els.btnSidebarTheme.addEventListener('click', toggleTheme);
  els.btnSidebarCopy.addEventListener('click', copyActiveEmailAction);
  els.btnSidebarCreate.addEventListener('click', () => openAdminModal('mailboxes'));
  els.btnHeroCreateEmail.addEventListener('click', () => openAdminModal('mailboxes'));
  els.btnSidebarAdmin.addEventListener('click', () => openAdminModal());

  document.querySelectorAll('[data-nav-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setFilter(btn.dataset.navFilter, { scrollToInbox: true });
    });
  });

  els.mobNavInbox.addEventListener('click', () => setFilter('all', { scrollToInbox: true }));
  els.mobNavBounce.addEventListener('click', () => setFilter('bounce', { scrollToInbox: true }));
  els.mobNavAdmin.addEventListener('click', () => openAdminModal());

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

  els.domainPills.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick-domain]');
    if (!btn) return;
    const dom = btn.dataset.pickDomain;
    if (els.selectDomain.querySelector(`option[value="${CSS.escape(dom)}"]`)) {
      els.selectDomain.value = dom;
    }
    renderDomainPills();
    els.inputUsername.focus();
    showToast(`Domain @${dom} dipilih. Ketik username lalu klik Buka Inbox.`);
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

  const handleReaderClick = async (e) => {
    const backBtn = e.target.closest('[data-mobile-back]');
    if (backBtn) {
      els.mailWorkspace.classList.remove('is-reading');
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
        state.adminInspectorTab = tabBtn.dataset.readerTab;
        renderAdminInspector();
      } else {
        state.readerTab = tabBtn.dataset.readerTab;
        renderPublicReader();
      }
      return;
    }

    const imgBtn = e.target.closest('[data-toggle-images]');
    if (imgBtn) {
      if (imgBtn.dataset.toggleImages === 'admin') {
        state.adminInspectorImages = !state.adminInspectorImages;
        renderAdminInspector();
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
          ? state.adminInspectorDetail?.rawSource || ''
          : state.selectedDetail?.rawSource || '';
      copyText(src, 'Raw EML disalin ke clipboard');
      return;
    }

    const delBtn = e.target.closest('[data-delete-email]');
    if (delBtn) {
      if (!state.adminAuthenticated) return;
      const id = delBtn.dataset.deleteEmail;
      const mode = delBtn.dataset.deleteMode;
      try {
        if (mode === 'admin') {
          await apiFetch(`/api/admin/messages/${encodeURIComponent(id)}`, { method: 'DELETE', admin: true });
          els.inspectorModal.classList.add('hidden');
          await Promise.all([loadAdminStatsAndMessages(), loadAdminMailboxes()]);
          if (getActiveAddress()) await fetchInbox({ silent: true });
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
  els.inspectorBody.addEventListener('click', handleReaderClick);

  els.btnOpenAdmin.addEventListener('click', () => openAdminModal());
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
      if (!els.inspectorModal.classList.contains('hidden')) {
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
      updateAdminIndicators();
      els.adminModalPanel.classList.remove('is-compact');
      els.adminLoginForm.classList.add('hidden');
      els.adminWorkspace.classList.remove('hidden');
      switchAdminTab(state.adminActiveTab || 'mailboxes');
      showToast('Login Admin berhasil', 'success');
      await loadAdminAll();
      if (getActiveAddress()) await fetchInbox({ silent: true });
    } catch (err) {
      els.adminLoginError.textContent = err.message;
      els.adminLoginError.classList.remove('hidden');
    }
  });

  document.querySelectorAll('.admin-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchAdminTab(btn.dataset.adminTab));
  });

  // Admin Tab 1: Kelola Email (Admin-only mailbox creation)
  els.adminCreateMailboxForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = els.inputNewMailboxes.value.trim();
    if (!raw) {
      showToast('Masukkan minimal satu username atau alamat email.', 'error');
      return;
    }
    try {
      const res = await apiFetch('/api/admin/mailboxes', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({
          addresses: raw,
          defaultDomain: els.selectNewMailboxDomain.value || state.defaultDomain,
          label: els.inputNewMailboxLabel.value.trim(),
        }),
      });
      els.inputNewMailboxes.value = '';
      els.inputNewMailboxLabel.value = '';
      state.adminMailboxes = res.mailboxes || [];
      state.adminMailboxAddressSet = new Set(state.adminMailboxes.map((m) => m.address));
      renderAdminMailboxesTable();
      await loadAdminStatsAndMessages();

      const parts = [];
      if (res.added?.length) parts.push(`${res.added.length} email dibuat`);
      if (res.skipped?.length) parts.push(`${res.skipped.length} sudah terdaftar`);
      if (res.invalid?.length) parts.push(`${res.invalid.length} tidak valid`);
      showToast(parts.join(', ') || 'Selesai memproses email.', res.added?.length ? 'success' : 'default');
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
      closeAdminModal();
      if (u && d) setActiveAddress(u, d);
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

  // Admin Tab 2: Monitor
  els.adminFilterDomain.addEventListener('change', loadAdminStatsAndMessages);
  els.adminFilterType.addEventListener('change', loadAdminStatsAndMessages);
  let adminSearchTimer = null;
  els.adminFilterSearch.addEventListener('input', () => {
    clearTimeout(adminSearchTimer);
    adminSearchTimer = setTimeout(loadAdminStatsAndMessages, 250);
  });
  els.btnAdminRefreshMsgs.addEventListener('click', loadAdminStatsAndMessages);

  els.adminMessagesTbody.addEventListener('click', async (e) => {
    const inspectBtn = e.target.closest('[data-admin-inspect]');
    if (inspectBtn) {
      openAdminInspector(inspectBtn.dataset.adminInspect);
      return;
    }

    const regBtn = e.target.closest('[data-admin-register-addr]');
    if (regBtn) {
      const addr = regBtn.dataset.adminRegisterAddr;
      try {
        const res = await apiFetch('/api/admin/mailboxes', {
          method: 'POST',
          admin: true,
          body: JSON.stringify({ address: addr, label: 'Didaftarkan dari Monitor' }),
        });
        state.adminMailboxes = res.mailboxes || [];
        state.adminMailboxAddressSet = new Set(state.adminMailboxes.map((m) => m.address));
        renderAdminMailboxesTable();
        renderAdminMessagesTable();
        await loadAdminStatsAndMessages();
        showToast(`Alamat ${addr} sekarang terdaftar untuk dilihat pengunjung.`, 'success');
      } catch (err) {
        showToast(`Gagal mendaftarkan alamat: ${err.message}`, 'error');
      }
      return;
    }

    const delBtn = e.target.closest('[data-admin-delete-msg]');
    if (delBtn) {
      if (!confirm('Hapus pesan ini dari database?')) return;
      try {
        await apiFetch(`/api/admin/messages/${encodeURIComponent(delBtn.dataset.adminDeleteMsg)}`, {
          method: 'DELETE',
          admin: true,
        });
        await Promise.all([loadAdminStatsAndMessages(), loadAdminMailboxes()]);
        if (getActiveAddress()) await fetchInbox({ silent: true });
        showToast('Pesan dihapus.');
      } catch (err) {
        showToast(`Gagal menghapus pesan: ${err.message}`, 'error');
      }
    }
  });

  // Admin Tab 3: Domains
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

  // Admin Tab 4: Settings & Admin Simulator
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
      if (getActiveAddress()) await fetchInbox({ silent: true });
    } catch (err) {
      showToast(`Gagal membersihkan pesan: ${err.message}`, 'error');
    }
  });

  els.adminSimForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const to = els.inputAdminSimTo.value.trim().toLowerCase();
    const scenario = els.selectAdminSimType.value;
    const failedTarget = els.inputAdminSimFailed.value.trim();
    if (!to) return;
    try {
      await apiFetch('/api/simulate', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({ recipient: to, scenario, failedTarget: failedTarget || undefined }),
      });
      showToast(`Uji coba ${scenario} terkirim ke ${to}`, 'success');
      await Promise.all([loadAdminStatsAndMessages(), loadAdminMailboxes()]);
      if (to === getActiveAddress()) {
        await fetchInbox({ silent: false });
      }
    } catch (err) {
      showToast(`Gagal mengirim uji coba: ${err.message}`, 'error');
    }
  });
}

async function init() {
  els.footerYear.textContent = String(new Date().getFullYear());
  syncThemeUI();
  syncNavActiveStates();

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

    updateAdminIndicators();
    renderDomainControls();

    const urlEmail = new URLSearchParams(window.location.search).get('email') || '';
    let savedAddr = '';
    try { savedAddr = localStorage.getItem(STORAGE_KEYS.activeAddress) || ''; } catch {}
    const candidate = (urlEmail || savedAddr).trim().toLowerCase();

    if (candidate.includes('@')) {
      const [u, d] = candidate.split('@');
      if (LOCAL_PART_REGEX.test(u) && state.domains.some((dom) => dom.domain === d)) {
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
