const POLL_INTERVAL_SEC = 10;
const STORAGE_KEYS = {
  theme: 'amc_mail_theme',
  activeAddress: 'amc_mail_active_address',
  adminToken: 'amc_mail_admin_token',
  saved2fa: 'amc_mail_saved_2fa',
  twoFaShares: 'amc_mail_2fa_shares',
  msSession: 'amc_mail_ms_session',
};

const LOCAL_PART_REGEX = /^[a-z0-9][a-z0-9._+-]{0,62}$/;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SAMPLE_2FA_KEY = 'JBSWY3DPEHPK3PXP';

const ADMIN_VIEW_META = {
  mailboxes: {
    title: 'Buat & Kelola Alamat Email',
    subtitle: 'Buat alamat email baru pada domain Al Muthi Creative, bagikan link kotak masuk baca-saja, atau kelola status aksesnya.',
  },
  catchall: {
    title: 'Semua Pesan (Catch-All)',
    subtitle: 'Baca langsung seluruh email masuk dan kode OTP dari semua domain AMC dalam satu kotak masuk terpadu.',
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
  publicTool: 'inbox',

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

  pollTimer: null,

  twoFaActive: null,
  twoFaCurrentCode: '',
  twoFaSaved: [],
  twoFaShares: [],
  twoFaSharedView: null,
  twoFaTimer: null,
  twoFaLastEpoch: -1,

  msConnected: false,
  msEmail: '',
  msDisplayName: '',
  msClientId: '',
  msAccessToken: '',
  msRefreshToken: '',
  msFolders: [],
  msFolder: 'all_incoming',
  msSearchQuery: '',
  msMessages: [],
  msLoading: false,
  msError: null,
  msSelectedId: null,
  msSelectedDetail: null,
  msReaderTab: 'html',
  msAllowImages: true,
  msMode: 'login',
  msTransport: 'graph',
  msPassword: '',
  msImapHost: '',
  msImapPort: 993,
  msDevice: null,
  msDevicePollTimer: null,

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

  btnSidebarQuickCreate: $('btn-sidebar-quick-create'),
  adminSideMailboxes: $('admin-side-mailboxes'),
  adminSideMessages: $('admin-side-messages'),
  adminSideDomains: $('admin-side-domains'),

  btnSidebarTheme: $('btn-sidebar-theme'),
  sidebarThemeLabel: $('sidebar-theme-label'),
  sidebarThemeSub: $('sidebar-theme-sub'),
  sidebarBlobVisual: $('sidebar-blob-visual'),
  btnSidebarLogout: $('btn-sidebar-logout'),

  publicToolNav: $('public-tool-nav'),
  publicNavBlob: $('public-nav-blob'),
  btnThemeToggle: $('btn-theme-toggle'),
  btnOpenAdmin: $('btn-open-admin'),
  btnMobileLogout: $('btn-mobile-logout'),

  mobNavAdminBar: $('mob-nav-admin-bar'),

  adminWorkspaceShell: $('admin-workspace-shell'),
  publicViewerShell: $('public-viewer-shell'),
  adminReaderBanner: $('admin-reader-banner'),

  toolPanelInbox: $('tool-panel-inbox'),
  toolPanel2fa: $('tool-panel-2fa'),
  toolPanelMsmail: $('tool-panel-msmail'),

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

  readerEmpty: $('reader-empty'),
  readerContent: $('reader-content'),

  domainPills: $('domain-pills'),
  retentionInfo: $('retention-info'),
  footerYear: $('footer-year'),

  twofaSharedCard: $('twofa-shared-card'),
  twofaSharedLabel: $('twofa-shared-label'),
  twofaSharedExp: $('twofa-shared-exp'),
  twofaSharedCode: $('twofa-shared-code'),
  btnExitShared2fa: $('btn-exit-shared-2fa'),
  btnCopyShared2fa: $('btn-copy-shared-2fa'),
  twofaForm: $('twofa-form'),
  input2faLabel: $('input-2fa-label'),
  input2faSecret: $('input-2fa-secret'),
  btn2faGenerate: $('btn-2fa-generate'),
  btn2faSave: $('btn-2fa-save'),
  btn2faSample: $('btn-2fa-sample'),
  btn2faClear: $('btn-2fa-clear'),
  twofaError: $('twofa-error'),
  twofaActiveTitle: $('twofa-active-title'),
  twofaStatusPill: $('twofa-status-pill'),
  twofaCurrentCode: $('twofa-current-code'),
  btnCopy2faCode: $('btn-copy-2fa-code'),
  select2faShareExp: $('select-2fa-share-exp'),
  btn2faCreateShare: $('btn-2fa-create-share'),
  twofaShareOutput: $('twofa-share-output'),
  input2faShareUrl: $('input-2fa-share-url'),
  btnCopy2faShareUrl: $('btn-copy-2fa-share-url'),
  twofaSavedCount: $('twofa-saved-count'),
  twofaSavedList: $('twofa-saved-list'),
  twofaSharesWrap: $('twofa-shares-wrap'),
  twofaSharesList: $('twofa-shares-list'),

  msmailConnectForm: $('msmail-connect-form'),
  inputMsCombo: $('input-ms-combo'),
  btnMsConnect: $('btn-ms-connect'),
  inputMsEmail: $('input-ms-email'),
  inputMsPassword: $('input-ms-password'),
  btnMsTogglePass: $('btn-ms-toggle-pass'),
  btnMsImapToggle: $('btn-ms-imap-toggle'),
  msImapAdvRow: $('ms-imap-adv-row'),
  inputMsImapHost: $('input-ms-imap-host'),
  inputMsImapPort: $('input-ms-imap-port'),
  btnMsConnectLabel: $('btn-ms-connect-label'),
  msPanelLogin: $('ms-panel-login'),
  msPanelDevice: $('ms-panel-device'),
  msPanelCombo: $('ms-panel-combo'),
  btnMsStartDevice: $('btn-ms-start-device'),
  btnMsStartDeviceLabel: $('btn-ms-start-device-label'),
  btnMsOpenDeviceLink: $('btn-ms-open-device-link'),
  btnMsCopyDeviceCode: $('btn-ms-copy-device-code'),
  msDeviceCode: $('ms-device-code'),
  msDeviceCodeWrap: $('ms-device-code-wrap'),
  msDeviceTitle: $('ms-device-title'),
  msDeviceDesc: $('ms-device-desc'),
  btnMsCopyAddr: $('btn-ms-copy-addr'),
  btnMsDisconnect: $('btn-ms-disconnect'),
  msDetectEmail: $('ms-detect-email'),
  msDetectClient: $('ms-detect-client'),
  msDetectToken: $('ms-detect-token'),
  msmailError: $('msmail-error'),
  msmailWorkspace: $('msmail-workspace'),
  msmailActiveLabel: $('msmail-active-label'),
  msmailCount: $('msmail-count'),
  btnMsRefresh: $('btn-ms-refresh'),
  selectMsFolder: $('select-ms-folder'),
  inputMsSearch: $('input-ms-search'),
  msmailList: $('msmail-list'),
  msmailEmpty: $('msmail-empty'),
  msmailReader: $('msmail-reader'),

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

const copyBtnStateMap = new WeakMap();
const refreshBtnBusySet = new WeakSet();
let lastClickedButton = null;
let navBlobGlideTimer = null;

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function triggerClassAnim(el, className, durationMs = 620) {
  if (!el || prefersReducedMotion()) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => {
    el.classList.remove(className);
  }, durationMs);
}

/* ---- AMC Confirm Dialog: pengganti confirm() bawaan browser, sesuai tema ---- */
function amcConfirm({
  title = 'Konfirmasi',
  message = '',
  confirmText = 'Ya, Hapus',
  cancelText = 'Batal',
  danger = true,
} = {}) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const root = document.createElement('div');
    root.className = 'amc-confirm-backdrop';
    root.setAttribute('role', 'alertdialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `
      <div class="amc-confirm-panel ${danger ? 'is-danger' : ''}">
        <div class="amc-confirm-icon">${danger ? TRASH_SVG : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path></svg>'}</div>
        <h3 class="amc-confirm-title">${escapeHtml(title)}</h3>
        <p class="amc-confirm-msg">${escapeHtml(message)}</p>
        <div class="amc-confirm-actions">
          <button type="button" class="btn btn-soft" data-confirm-cancel>${escapeHtml(cancelText)}</button>
          <button type="button" class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-confirm-ok>${escapeHtml(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    requestAnimationFrame(() => root.classList.add('is-open'));
    const okBtn = root.querySelector('[data-confirm-ok]');
    okBtn.focus();

    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', onKey, true);
      root.classList.remove('is-open');
      root.classList.add('is-closing');
      setTimeout(() => {
        root.remove();
        if (prevFocus && prevFocus.focus) prevFocus.focus();
      }, prefersReducedMotion() ? 0 : 220);
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
      if (e.key === 'Enter' && document.activeElement?.hasAttribute('data-confirm-cancel')) { e.preventDefault(); finish(false); }
    };
    document.addEventListener('keydown', onKey, true);
    root.addEventListener('click', (e) => {
      if (e.target === root || e.target.closest('[data-confirm-cancel]')) finish(false);
      else if (e.target.closest('[data-confirm-ok]')) finish(true);
    });
  });
}

/* ---- AMC Trash Motion: animasi buang/hapus (item menyusut, berputar, jatuh ke tong sampah) ---- */
const TRASH_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g class="amc-trash-lid"><path d="M3 6h18"></path><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path></g><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path></svg>';

function spawnTrashPuff(rect) {
  if (prefersReducedMotion() || !rect) return;
  const puff = document.createElement('div');
  puff.className = 'amc-trash-puff';
  const size = 46;
  const cx = Math.min(Math.max(rect.left + rect.width / 2, size), window.innerWidth - size);
  const cy = Math.min(Math.max(rect.top + rect.height / 2, size), window.innerHeight - size);
  puff.style.left = `${cx}px`;
  puff.style.top = `${cy}px`;
  let bits = '';
  for (let i = 0; i < 8; i += 1) {
    const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
    const dist = 26 + Math.random() * 26;
    bits += `<i style="--tx:${(Math.cos(ang) * dist).toFixed(1)}px;--ty:${(Math.sin(ang) * dist - 10).toFixed(1)}px;--d:${(i * 22) % 120}ms"></i>`;
  }
  puff.innerHTML = `<span class="amc-trash-bin">${TRASH_SVG}</span>${bits}`;
  document.body.appendChild(puff);
  setTimeout(() => puff.remove(), 1100);
}

/** Animasikan elemen yang dihapus lalu selesai saat animasi usai. */
async function animateRemove(el, { puff = true, delay = 0 } = {}) {
  if (!el || !el.isConnected) return;
  if (prefersReducedMotion()) return;
  if (delay) await waitMs(delay);
  const rect = el.getBoundingClientRect();
  const isRow = el.tagName === 'TR';
  if (!isRow) {
    el.style.setProperty('--amc-h', `${Math.round(rect.height)}px`);
  }
  el.classList.add(isRow ? 'amc-removing-row' : 'amc-removing');
  if (puff) spawnTrashPuff(rect);
  await waitMs(isRow ? 560 : 640);
}

/** Animasikan banyak elemen berurutan (stagger) - untuk hapus semua. */
async function animateRemoveMany(nodes, { max = 8 } = {}) {
  const list = Array.from(nodes || []).slice(0, max);
  if (!list.length || prefersReducedMotion()) return;
  await Promise.all(list.map((n, i) => animateRemove(n, { puff: i === 0, delay: i * 70 })));
}

function findMsgCardEls(id) {
  const safe = String(id).replace(/"/g, '\\"');
  return document.querySelectorAll(
    `[data-open-id="${safe}"], [data-admin-open-id="${safe}"], [data-ms-open-id="${safe}"]`
  );
}

function spawnSkySparkles(targetEl, count = 5, palette = 'sky') {
  if (!targetEl || prefersReducedMotion()) return;
  const rect = targetEl.getBoundingClientRect();
  if (!rect.width && !rect.height) return;

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const burst = document.createElement('div');
  burst.className = `amc-sparkle-burst is-${palette}`;
  burst.style.left = `${Math.round(cx)}px`;
  burst.style.top = `${Math.round(cy)}px`;

  const halfW = Math.min(rect.width * 0.42, 46);
  const halfH = Math.min(rect.height * 0.42, 22);

  for (let i = 0; i < count; i++) {
    const star = document.createElement('i');
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2 + (i % 2 === 0 ? 0.18 : -0.18);
    const dist = 14 + (i % 3) * 6;
    const ox = Math.cos(angle) * (halfW * 0.55);
    const oy = Math.sin(angle) * (halfH * 0.55);
    const tx = Math.cos(angle) * (halfW * 0.55 + dist);
    const ty = Math.sin(angle) * (halfH * 0.55 + dist) - 3;
    star.style.setProperty('--ox', `${ox.toFixed(1)}px`);
    star.style.setProperty('--oy', `${oy.toFixed(1)}px`);
    star.style.setProperty('--tx', `${tx.toFixed(1)}px`);
    star.style.setProperty('--ty', `${ty.toFixed(1)}px`);
    star.style.setProperty('--sdelay', `${i * 32}ms`);
    star.style.setProperty('--ssize', `${i % 2 === 0 ? 8 : 6}px`);
    burst.appendChild(star);
  }

  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 720);
}

function triggerCopyFeedback(btnEl) {
  if (!btnEl || !(btnEl instanceof HTMLElement)) return;

  let labelEl = btnEl.querySelector('span:not(.amc-jelly-ripple)');
  if (!labelEl) {
    const textNodes = Array.from(btnEl.childNodes).filter(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0
    );
    if (textNodes.length > 0) {
      const wrap = document.createElement('span');
      wrap.className = 'btn-copy-text';
      wrap.textContent = textNodes.map((n) => n.textContent).join('').trim();
      textNodes.forEach((n) => n.remove());
      btnEl.appendChild(wrap);
      labelEl = wrap;
    }
  }

  let checkSvg = btnEl.querySelector('.amc-copy-check-icon');
  if (!checkSvg) {
    checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    checkSvg.setAttribute('viewBox', '0 0 24 24');
    checkSvg.setAttribute('fill', 'none');
    checkSvg.setAttribute('stroke', 'currentColor');
    checkSvg.setAttribute('stroke-width', '2.6');
    checkSvg.setAttribute('stroke-linecap', 'round');
    checkSvg.setAttribute('stroke-linejoin', 'round');
    checkSvg.setAttribute('aria-hidden', 'true');
    checkSvg.classList.add('amc-copy-check-icon');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', '20 6 9 17 4 12');
    checkSvg.appendChild(poly);
    btnEl.insertBefore(checkSvg, btnEl.firstChild);
  }

  let saved = copyBtnStateMap.get(btnEl);
  if (!saved) {
    const rect = btnEl.getBoundingClientRect();
    saved = {
      origLabel: labelEl ? labelEl.textContent : '',
      origMinWidth: btnEl.style.minWidth || '',
      lockedWidth: rect.width > 0 ? `${Math.ceil(rect.width)}px` : '',
      timer: null,
    };
    copyBtnStateMap.set(btnEl, saved);
  } else if (saved.timer) {
    clearTimeout(saved.timer);
  }

  if (saved.lockedWidth) {
    btnEl.style.minWidth = saved.lockedWidth;
  }

  if (labelEl && saved.origLabel) {
    const isOtpPill = btnEl.hasAttribute('data-quick-otp') || btnEl.hasAttribute('data-copy-otp');
    labelEl.textContent = isOtpPill ? 'OTP Tersalin!' : 'Tersalin!';
  }

  btnEl.classList.remove('is-copied', 'is-copy-pop');
  void btnEl.offsetWidth;
  btnEl.classList.add('is-copied', 'is-copy-pop');
  spawnSkySparkles(btnEl, 6, 'mint');

  saved.timer = setTimeout(() => {
    btnEl.classList.remove('is-copied', 'is-copy-pop');
    if (labelEl && saved.origLabel) {
      labelEl.textContent = saved.origLabel;
    }
    btnEl.style.minWidth = saved.origMinWidth;
    copyBtnStateMap.delete(btnEl);
  }, 1600);
}

async function runRefreshWithAnim(btnEl, asyncAction) {
  if (!btnEl) {
    return typeof asyncAction === 'function' ? asyncAction() : undefined;
  }
  if (refreshBtnBusySet.has(btnEl)) return undefined;
  refreshBtnBusySet.add(btnEl);

  btnEl.classList.remove('is-refresh-done');
  btnEl.classList.add('is-refreshing');

  try {
    const minSpin = prefersReducedMotion() ? Promise.resolve() : waitMs(680);
    const [res] = await Promise.all([
      Promise.resolve().then(() => (typeof asyncAction === 'function' ? asyncAction() : undefined)),
      minSpin,
    ]);
    btnEl.classList.remove('is-refreshing');
    if (!prefersReducedMotion()) {
      btnEl.classList.add('is-refresh-done');
      spawnSkySparkles(btnEl, 4, 'sky');
      setTimeout(() => btnEl.classList.remove('is-refresh-done'), 560);
    }
    return res;
  } catch (err) {
    btnEl.classList.remove('is-refreshing');
    throw err;
  } finally {
    refreshBtnBusySet.delete(btnEl);
  }
}

function pulseCodeElement(el) {
  if (!el) return;
  triggerClassAnim(el, 'is-code-pop', 520);
}

function showToast(message, variant = 'default') {
  const div = document.createElement('div');
  const vClass = variant === 'error' ? 'is-error' : variant === 'success' ? 'is-success' : 'is-info';
  div.className = `toast ${vClass}`;

  const iconSvg =
    variant === 'success'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      : variant === 'error'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.2L19 10l-5.1 1.8L12 17l-1.9-5.2L5 10l5.1-1.8L12 3z"></path></svg>';

  const badge = document.createElement('span');
  badge.className = 'toast-blob-icon';
  badge.innerHTML = iconSvg;

  const textSpan = document.createElement('span');
  textSpan.className = 'toast-msg';
  textSpan.textContent = message;

  div.appendChild(badge);
  div.appendChild(textSpan);
  els.toastStack.appendChild(div);

  setTimeout(() => {
    div.classList.add('is-leaving');
    setTimeout(() => div.remove(), 280);
  }, 2900);
}

async function copyText(text, successMsg = 'Disalin ke clipboard', triggerEl = null) {
  const targetBtn = triggerEl || lastClickedButton;
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
    if (targetBtn && targetBtn.isConnected) {
      triggerCopyFeedback(targetBtn);
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
  if (els.btnThemeToggle) {
    els.btnThemeToggle.setAttribute('aria-checked', String(isDark));
    els.btnThemeToggle.setAttribute('aria-label', isDark ? 'Mode terang' : 'Mode gelap');
    els.btnThemeToggle.classList.toggle('is-asleep', isDark);
  }
  if (els.btnSidebarTheme) {
    els.btnSidebarTheme.setAttribute('aria-checked', String(isDark));
  }
  if (els.sidebarBlobVisual) {
    els.sidebarBlobVisual.classList.toggle('is-asleep', isDark);
  }
  if (els.sidebarThemeLabel) {
    els.sidebarThemeLabel.textContent = isDark ? 'Mode Gelap' : 'Mode Terang';
  }
  if (els.sidebarThemeSub) {
    els.sidebarThemeSub.textContent = isDark ? 'Blob tidur lelap' : 'Blob bangun cerah';
  }
}

let blobAnimTimer = null;

function toggleTheme(e) {
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

  const switches = [els.btnThemeToggle, els.sidebarBlobVisual].filter(Boolean);
  switches.forEach((sw) => {
    sw.classList.remove('is-rolling');
    void sw.offsetWidth;
    sw.classList.add('is-rolling');
  });
  clearTimeout(blobAnimTimer);
  blobAnimTimer = setTimeout(() => {
    switches.forEach((sw) => sw.classList.remove('is-rolling'));
  }, 700);

  const clickedEl = e?.currentTarget || els.btnThemeToggle;
  if (clickedEl) {
    spawnSkySparkles(clickedEl, 5, 'sky');
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

function resolveToolFromLocation() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/2fa') return '2fa';
  if (path === '/mail-reader') return 'msmail';
  return 'inbox';
}

function syncPublicNavBlob({ animate = false } = {}) {
  const nav = els.publicToolNav;
  const blob = els.publicNavBlob;
  if (!nav || !blob) return;

  const activeLink = nav.querySelector('.public-tool-link.is-active');
  if (!activeLink || nav.offsetParent === null) {
    nav.classList.remove('has-blob-ready');
    return;
  }

  const x = activeLink.offsetLeft;
  const y = activeLink.offsetTop;
  const w = activeLink.offsetWidth;
  const h = activeLink.offsetHeight;
  if (!w || !h) return;

  if (!animate) {
    blob.classList.add('is-instant');
  }
  blob.style.width = `${w}px`;
  blob.style.height = `${h}px`;
  blob.style.translate = `${x}px ${y}px`;
  nav.classList.add('has-blob-ready');

  if (!animate) {
    requestAnimationFrame(() => blob.classList.remove('is-instant'));
  } else if (!prefersReducedMotion()) {
    blob.classList.remove('is-gliding');
    void blob.offsetWidth;
    blob.classList.add('is-gliding');
    clearTimeout(navBlobGlideTimer);
    navBlobGlideTimer = setTimeout(() => blob.classList.remove('is-gliding'), 560);
    triggerClassAnim(activeLink, 'is-tab-pop', 480);
  }
}

function syncPublicToolPanels({ animateNav = false } = {}) {
  const tool = state.publicTool || 'inbox';
  if (els.toolPanelInbox) els.toolPanelInbox.classList.toggle('hidden', tool !== 'inbox');
  if (els.toolPanel2fa) els.toolPanel2fa.classList.toggle('hidden', tool !== '2fa');
  if (els.toolPanelMsmail) els.toolPanelMsmail.classList.toggle('hidden', tool !== 'msmail');

  document.querySelectorAll('.public-tool-link[data-public-nav]').forEach((link) => {
    const active = link.dataset.publicNav === tool;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  requestAnimationFrame(() => syncPublicNavBlob({ animate: animateNav }));
}

function setPublicTool(tool, { pushHistory = true } = {}) {
  const nextTool = ['inbox', '2fa', 'msmail'].includes(tool) ? tool : 'inbox';
  const changed = state.publicTool !== nextTool;
  closeActiveDropdown();
  state.publicTool = nextTool;

  if (state.adminAuthenticated) {
    if (nextTool === '2fa') state.adminView = 'tool-2fa';
    else if (nextTool === 'msmail') state.adminView = 'tool-msmail';
    else state.adminView = 'reader';
  }

  if (pushHistory && window.history?.pushState) {
    const url = new URL(window.location.href);
    if (nextTool === '2fa') {
      url.pathname = '/2fa';
      url.searchParams.delete('email');
    } else if (nextTool === 'msmail') {
      url.pathname = '/mail-reader';
      url.searchParams.delete('email');
      url.searchParams.delete('share');
    } else {
      url.pathname = '/';
      url.searchParams.delete('share');
      const addr = getActiveAddress();
      if (addr) url.searchParams.set('email', addr);
    }
    window.history.pushState({}, '', url.toString());
  }

  syncModeShell({ animateNav: changed });
  if (nextTool === '2fa') {
    refreshTwoFaCodes();
  }
}

function syncModeShell({ animateNav = false } = {}) {
  const isAdmin = state.adminAuthenticated;
  document.body.classList.toggle('is-admin-mode', isAdmin);

  els.sidebarBrandSub.textContent = isAdmin ? 'Workspace Admin' : 'Al Muthi Creative';
  els.mobileBrandSub.textContent = isAdmin ? 'Workspace Admin' : 'Al Muthi Creative';

  els.sidebarPublicBlock.classList.toggle('hidden', isAdmin);
  els.sidebarAdminBlock.classList.toggle('hidden', !isAdmin);
  els.btnSidebarLogout.classList.toggle('hidden', !isAdmin);

  els.btnOpenAdmin.classList.toggle('hidden', isAdmin);
  els.btnMobileLogout.classList.toggle('hidden', !isAdmin);

  if (els.mobNavAdminBar) els.mobNavAdminBar.classList.toggle('hidden', !isAdmin);

  els.adminDefaultPinWarning.classList.toggle('hidden', !(isAdmin && state.adminDefaultPin));
  els.btnClearInbox.classList.toggle('hidden', !isAdmin);
  els.adminReaderBanner.classList.toggle('hidden', !isAdmin);

  if (els.readonlyNotice) {
    els.readonlyNotice.classList.toggle('is-admin', isAdmin);
    els.readonlyNotice.textContent = isAdmin
      ? 'Mode Admin aktif: Anda dapat membuka semua alamat dan mengelola pesan.'
      : 'Masukkan alamat email dari Admin untuk membaca seluruh pesan masuk dan kode OTP dalam satu kotak masuk.';
  }

  if (isAdmin) {
    if (state.adminView === 'reader') state.publicTool = 'inbox';
    else if (state.adminView === 'tool-2fa') state.publicTool = '2fa';
    else if (state.adminView === 'tool-msmail') state.publicTool = 'msmail';

    const showUtilityShell = ['reader', 'tool-2fa', 'tool-msmail'].includes(state.adminView);
    els.adminWorkspaceShell.classList.toggle('hidden', showUtilityShell);
    els.publicViewerShell.classList.toggle('hidden', !showUtilityShell);

    if (!showUtilityShell) {
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

  syncPublicToolPanels({ animateNav });
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
  } else if (view === 'tool-2fa') {
    refreshTwoFaCodes();
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
    if (pushUrl && window.history?.replaceState && state.publicTool === 'inbox') {
      const url = new URL(window.location.href);
      url.pathname = '/';
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
  if (els.countAll) els.countAll.textContent = String(state.counts.all || 0);
}

function getMessageAvatarMarkup(msg, senderLabel) {
  if (msg.otpCode) {
    return `<span class="msg-avatar is-otp" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></span>`;
  }
  const clean = String(senderLabel || 'M').replace(/^[^a-zA-Z0-9]+/, '');
  const initial = (clean[0] || 'M').toUpperCase();
  return `<span class="msg-avatar" aria-hidden="true">${escapeHtml(initial)}</span>`;
}

function isDesktopSplitViewport() {
  return window.innerWidth > 820;
}

function renderMessageCard(msg, { selected, showRecipient = false, openAttr = 'data-open-id', variant = 'compact' }) {
  const badges = [];

  if (msg.otpCode) {
    badges.push(
      `<button type="button" class="badge badge-otp mono btn-copy-anim" data-quick-otp="${escapeHtml(msg.otpCode)}" title="Klik untuk menyalin kode OTP"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" style="width:12px;height:12px;"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Salin OTP ${escapeHtml(msg.otpCode)}</span></button>`
    );
  }

  if (msg.folderTag === 'Junk') {
    badges.push('<span class="badge badge-neutral">Junk / Spam</span>');
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
        ${!isNotRegistered && !isDisabled ? '<button type="button" class="btn btn-soft btn-sm btn-refresh-anim" id="btn-retry-inbox"><svg class="icon-refresh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" aria-hidden="true"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg><span>Coba Lagi</span></button>' : ''}
      </div>
    `;
    const retryBtn = $('btn-retry-inbox');
    if (retryBtn) retryBtn.addEventListener('click', () => runRefreshWithAnim(retryBtn, () => fetchInbox({ silent: false })));
    return;
  }

  if (state.messages.length === 0) {
    const emptyMsg = state.searchQuery
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

  let autoOpenId = null;

  try {
    const params = new URLSearchParams({
      address: addr,
      filter: 'all',
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

    if (state.selectedId && !incoming.some((m) => m.id === state.selectedId) && !state.searchQuery) {
      state.selectedId = null;
      state.selectedDetail = null;
      renderReaderEmpty();
    }

    if (!state.selectedId && incoming.length > 0 && isDesktopSplitViewport()) {
      autoOpenId = incoming[0].id;
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

  if (autoOpenId) {
    openMessage(autoOpenId);
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
  const isMsMail = mode === 'msmail';
  const auth = detail.authResults || {};
  const canDelete = !isMsMail && (mode === 'admin' || state.adminAuthenticated);
  const addrParam = mode === 'public' ? `?address=${encodeURIComponent(detail.recipient)}` : '';
  const isUnregisteredCatchall = mode === 'admin' && !state.adminMailboxAddressSet.has(detail.recipient);
  const hasRawSource = Boolean(detail.rawSource);

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
        <button type="button" class="btn btn-primary btn-sm btn-copy-anim" data-copy-otp="${escapeHtml(detail.otpCode)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>Salin Kode OTP</span>
        </button>
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
  if (hasRawSource) {
    availableTabs.push({ id: 'raw', label: 'Raw EML', icon: tabIcons.raw });
  }

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
        <button type="button" class="btn btn-soft btn-sm btn-copy-anim" data-copy-raw="${mode}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>Salin Raw EML</span>
        </button>
      </div>
      <pre class="plain-pre">${escapeHtml(detail.rawSource || '')}</pre>
    `;
  }

  let attachmentsMarkup = '';
  if (detail.attachments && detail.attachments.length > 0) {
    const items = detail.attachments
      .map((att) => {
        if (isMsMail) {
          if (att.dataUrl) {
            return `
              <a class="attachment-pill" href="${escapeHtml(att.dataUrl)}" download="${escapeHtml(att.filename)}">
                <span>${escapeHtml(att.filename)}</span>
                <span class="attachment-size">${escapeHtml(formatBytes(att.sizeBytes))}</span>
              </a>
            `;
          }
          return `
            <span class="attachment-pill">
              <span>${escapeHtml(att.filename)}</span>
              <span class="attachment-size">${escapeHtml(formatBytes(att.sizeBytes))}</span>
            </span>
          `;
        }
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

  const backLabel =
    mode === 'public'
      ? 'Kembali ke Kotak Masuk'
      : mode === 'msmail'
        ? 'Kembali ke Daftar Outlook'
        : 'Kembali ke Daftar';

  return `
    <div class="reader-header">
      <button type="button" class="btn btn-soft btn-sm mobile-back-btn" data-mobile-back="${mode}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" style="width:15px;height:15px;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        <span>${backLabel}</span>
      </button>
      <div class="reader-top-bar">
        <h2 class="reader-subject">${escapeHtml(detail.subject || '(Tanpa Subjek)')}</h2>
        <div class="reader-actions">
          ${
            isUnregisteredCatchall
              ? `<button type="button" class="btn btn-sm btn-soft" data-admin-register-addr="${escapeHtml(detail.recipient)}">Daftarkan Email</button>`
              : ''
          }
          ${
            !isMsMail && hasRawSource
              ? `<a class="btn btn-sm" href="/api/emails/${encodeURIComponent(detail.id)}/raw${addrParam}" download>Unduh .eml</a>`
              : ''
          }
          ${
            canDelete
              ? `<button type="button" class="btn btn-sm btn-danger-outline" data-delete-email="${escapeHtml(detail.id)}" data-delete-mode="${mode}">${TRASH_SVG}<span>Hapus</span></button>`
              : ''
          }
        </div>
      </div>

      <div class="reader-meta-grid">
        <div class="meta-item">
          <span class="meta-label">Dari</span>
          <span class="meta-value">${
            detail.fromName && (detail.fromAddress || detail.sender) && detail.fromName !== (detail.fromAddress || detail.sender)
              ? `<strong>${escapeHtml(detail.fromName)}</strong> <span class="mono" style="color:var(--text-secondary);overflow-wrap:anywhere;">${escapeHtml(detail.fromAddress || detail.sender)}</span>`
              : escapeHtml(detail.fromAddress || detail.fromName || detail.sender || '(Tanpa Pengirim)')
          }</span>
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

function startPollingLoop() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  let tick = 0;
  state.pollTimer = setInterval(() => {
    if (document.hidden) return;
    tick += 1;

    if (state.adminAuthenticated && state.adminView === 'catchall') {
      loadAdminStatsAndMessages({ silent: true });
      return;
    }

    if (state.publicTool === 'msmail' && state.msConnected && tick % 3 === 0) {
      fetchMsMessages({ silent: true });
      return;
    }

    if (state.publicTool === 'inbox' && getActiveAddress() && state.activeMailboxValid) {
      fetchInbox({ silent: true });
    }
  }, POLL_INTERVAL_SEC * 1000);
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

async function loadAdminStatsAndMessages({ silent = false } = {}) {
  try {
    const params = new URLSearchParams({
      domain: els.adminFilterDomain.value || 'all',
      type: 'all',
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

    if (state.adminSelectedId && !state.adminMessages.some((m) => m.id === state.adminSelectedId)) {
      state.adminSelectedId = null;
      state.adminSelectedDetail = null;
      renderAdminCatchallReader();
    }

    renderAdminCatchallList();

    if (state.adminView === 'catchall' && !state.adminSelectedId && state.adminMessages.length > 0 && isDesktopSplitViewport()) {
      openAdminCatchallMessage(state.adminMessages[0].id);
    }
  } catch (err) {
    if (err.status === 401) {
      handleAdminSessionExpired();
    } else if (!silent) {
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
        <p>Belum ada pesan yang cocok dengan filter pencarian saat ini.</p>
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

/* =========================================================
 * PUBLIC TOOL 2: 2FA TOTP AUTHENTICATOR (/2fa)
 * ========================================================= */
function cleanBase32Client(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[\s\-=]+/g, '');
}

function base32ToBytesClient(rawSecret) {
  const cleaned = cleanBase32Client(rawSecret);
  if (!cleaned) {
    throw new Error('Setup key 2FA masih kosong.');
  }
  if (cleaned.length < 8) {
    throw new Error('Setup key 2FA terlalu pendek. Masukkan minimal 8 karakter Base32.');
  }

  let bits = 0;
  let value = 0;
  const output = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) {
      throw new Error(`Karakter "${cleaned[i]}" tidak valid untuk format Base32 (gunakan A-Z dan 2-7).`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

function parseClientTotpInput(rawInput, fallbackLabel = '') {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Masukkan setup key Base32 atau tautan otpauth:// terlebih dahulu.' };
  }

  let secret = '';
  let label = String(fallbackLabel || '').trim();
  let digits = 6;
  let period = 30;
  let algorithm = 'SHA-1';

  if (/^otpauth:\/\//i.test(trimmed)) {
    try {
      const parsedUrl = new URL(trimmed);
      if (parsedUrl.protocol.toLowerCase() !== 'otpauth:') {
        return { valid: false, error: 'Skema tautan 2FA tidak dikenali.' };
      }
      const hostType = parsedUrl.hostname.toLowerCase();
      if (hostType && hostType !== 'totp') {
        return { valid: false, error: 'Hanya format TOTP (otpauth://totp/...) yang didukung.' };
      }
      secret = cleanBase32Client(parsedUrl.searchParams.get('secret') || '');
      const pathLabel = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, '')).trim();
      const issuer = (parsedUrl.searchParams.get('issuer') || '').trim();
      if (!label) {
        if (pathLabel) {
          label = issuer && !pathLabel.toLowerCase().startsWith(issuer.toLowerCase())
            ? `${issuer} (${pathLabel})`
            : pathLabel;
        } else if (issuer) {
          label = issuer;
        }
      }

      const rawDigits = Number(parsedUrl.searchParams.get('digits') || 6);
      if (rawDigits === 6 || rawDigits === 8) digits = rawDigits;

      const rawPeriod = Number(parsedUrl.searchParams.get('period') || 30);
      if (rawPeriod >= 10 && rawPeriod <= 120) period = Math.round(rawPeriod);

      const rawAlgo = String(parsedUrl.searchParams.get('algorithm') || 'SHA1').toUpperCase().replace('-', '');
      if (rawAlgo === 'SHA256') algorithm = 'SHA-256';
      else if (rawAlgo === 'SHA512') algorithm = 'SHA-512';
      else algorithm = 'SHA-1';
    } catch {
      return { valid: false, error: 'Format tautan otpauth:// tidak valid.' };
    }
  } else {
    secret = cleanBase32Client(trimmed);
  }

  try {
    base32ToBytesClient(secret);
  } catch (err) {
    return { valid: false, error: err.message };
  }

  return {
    valid: true,
    secret,
    label: label.slice(0, 120),
    digits,
    period,
    algorithm,
  };
}

async function computeClientTotpCode(secretBase32, { period = 30, digits = 6, algorithm = 'SHA-1' } = {}) {
  const keyBytes = base32ToBytesClient(secretBase32);
  const epochSeconds = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epochSeconds / period);

  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: algorithm } },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', cryptoKey, counterBytes);
  const hmac = new Uint8Array(sig);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const mod = 10 ** digits;
  return String(binary % mod).padStart(digits, '0');
}

function formatOtpDigits(code) {
  const clean = String(code || '').replace(/\s+/g, '');
  if (clean.length === 6) return `${clean.slice(0, 3)} ${clean.slice(3)}`;
  if (clean.length === 8) return `${clean.slice(0, 4)} ${clean.slice(4)}`;
  return clean || '--- ---';
}

function maskSecretHint(secret) {
  const clean = cleanBase32Client(secret);
  if (clean.length <= 6) return 'Base32 tersimpan';
  return `${clean.slice(0, 4)}****${clean.slice(-3)}`;
}

function loadTwoFaLocalState() {
  try {
    const rawSaved = JSON.parse(localStorage.getItem(STORAGE_KEYS.saved2fa) || '[]');
    if (Array.isArray(rawSaved)) {
      state.twoFaSaved = rawSaved.filter((item) => item && item.secret);
    }
  } catch {
    state.twoFaSaved = [];
  }

  try {
    const rawShares = JSON.parse(localStorage.getItem(STORAGE_KEYS.twoFaShares) || '[]');
    const now = Date.now();
    if (Array.isArray(rawShares)) {
      state.twoFaShares = rawShares.filter((s) => s && s.id && (!s.expiresAt || s.expiresAt > now));
      localStorage.setItem(STORAGE_KEYS.twoFaShares, JSON.stringify(state.twoFaShares));
    }
  } catch {
    state.twoFaShares = [];
  }
}

function persistSavedTwoFa() {
  try {
    localStorage.setItem(STORAGE_KEYS.saved2fa, JSON.stringify(state.twoFaSaved));
  } catch {}
}

function persistTwoFaShares() {
  try {
    localStorage.setItem(STORAGE_KEYS.twoFaShares, JSON.stringify(state.twoFaShares));
  } catch {}
}

async function activateTwoFaEntry(entry, { hideShareUrl = true } = {}) {
  state.twoFaActive = {
    label: entry.label || 'Akun 2FA Aktif',
    secret: entry.secret,
    digits: entry.digits || 6,
    period: entry.period || 30,
    algorithm: entry.algorithm || 'SHA-1',
  };
  els.twofaError.classList.add('hidden');
  if (hideShareUrl) {
    els.twofaShareOutput.classList.add('hidden');
  }

  const code = await computeClientTotpCode(state.twoFaActive.secret, state.twoFaActive);
  const changed = state.twoFaCurrentCode !== code;
  state.twoFaCurrentCode = code;
  els.twofaCurrentCode.textContent = formatOtpDigits(code);
  if (changed) pulseCodeElement(els.twofaCurrentCode);
  els.twofaActiveTitle.textContent = state.twoFaActive.label;
  els.twofaStatusPill.textContent = 'Kode Aktif';
  els.btnCopy2faCode.disabled = false;
  els.btn2faCreateShare.disabled = false;
  renderSavedTwoFaList();
}

function clearTwoFaActive() {
  state.twoFaActive = null;
  state.twoFaCurrentCode = '';
  els.input2faLabel.value = '';
  els.input2faSecret.value = '';
  els.twofaError.classList.add('hidden');
  els.twofaShareOutput.classList.add('hidden');
  els.twofaCurrentCode.textContent = '--- ---';
  els.twofaActiveTitle.textContent = 'Tempel setup key untuk menampilkan kode';
  els.twofaStatusPill.textContent = 'Siap digunakan';
  els.btnCopy2faCode.disabled = true;
  els.btn2faCreateShare.disabled = true;
  renderSavedTwoFaList();
}

async function renderSavedTwoFaList() {
  if (!els.twofaSavedList) return;
  els.twofaSavedCount.textContent = String(state.twoFaSaved.length);

  if (state.twoFaSaved.length === 0) {
    els.twofaSavedList.innerHTML = `
      <div class="state-panel" style="padding:24px 18px;">
        <h3>Belum Ada Kunci Tersimpan</h3>
        <p>Tempel setup key di sebelah kiri lalu klik <strong>Simpan ke Perangkat</strong> agar kode 6 digit selalu siap dipakai kapan saja.</p>
      </div>
    `;
    return;
  }

  const itemsWithCodes = await Promise.all(
    state.twoFaSaved.map(async (item) => {
      try {
        const code = await computeClientTotpCode(item.secret, item);
        return { ...item, liveCode: code };
      } catch {
        return { ...item, liveCode: '------' };
      }
    })
  );

  els.twofaSavedList.innerHTML = itemsWithCodes
    .map((item) => {
      const isActive = state.twoFaActive && state.twoFaActive.secret === item.secret;
      return `
        <div class="twofa-saved-item ${isActive ? 'is-active' : ''}" data-saved-id="${escapeHtml(item.id)}">
          <div class="twofa-saved-meta">
            <div class="twofa-saved-name">${escapeHtml(item.label || 'Akun 2FA')}</div>
            <div class="twofa-saved-hint mono">${escapeHtml(maskSecretHint(item.secret))}</div>
          </div>
          <div class="twofa-saved-right">
            <span class="twofa-saved-live mono">${escapeHtml(formatOtpDigits(item.liveCode))}</span>
            <button type="button" class="btn btn-primary btn-sm btn-copy-anim" data-2fa-copy="${escapeHtml(item.liveCode)}" data-2fa-name="${escapeHtml(item.label || 'Akun 2FA')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Salin</span></button>
            <button type="button" class="btn btn-soft btn-sm" data-2fa-use="${escapeHtml(item.id)}">Buka</button>
            <button type="button" class="btn btn-sm btn-danger-outline" data-2fa-delete="${escapeHtml(item.id)}">${TRASH_SVG}<span>Hapus</span></button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderTwoFaSharesList() {
  if (!els.twofaSharesWrap || !els.twofaSharesList) return;
  const now = Date.now();
  state.twoFaShares = state.twoFaShares.filter((s) => !s.expiresAt || s.expiresAt > now);
  persistTwoFaShares();

  if (state.twoFaShares.length === 0) {
    els.twofaSharesWrap.classList.add('hidden');
    els.twofaSharesList.innerHTML = '';
    return;
  }

  els.twofaSharesWrap.classList.remove('hidden');
  els.twofaSharesList.innerHTML = state.twoFaShares
    .map((s) => {
      const shareUrl = s.url || `${window.location.origin}/2fa?share=${encodeURIComponent(s.id)}`;
      return `
        <div class="twofa-share-row">
          <div style="min-width:0;flex:1;">
            <div style="font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(s.label || 'Link 2FA')}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);">Aktif s/d ${escapeHtml(formatFullDateTime(s.expiresAt))}</div>
          </div>
          <div class="toolbar-group">
            <button type="button" class="btn btn-soft btn-sm btn-copy-anim" data-share-copy="${escapeHtml(shareUrl)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Salin Link</span></button>
            <button type="button" class="btn btn-sm btn-danger-outline" data-share-revoke="${escapeHtml(s.id)}">Cabut</button>
          </div>
        </div>
      `;
    })
    .join('');
}

async function loadSharedTwoFaFromUrl(shareId, { silent = false } = {}) {
  const cleanId = String(shareId || '').trim();
  if (!cleanId) return;
  try {
    const res = await apiFetch(`/api/2fa/share/${encodeURIComponent(cleanId)}`);
    const prevCode = state.twoFaSharedView?.code || '';
    state.twoFaSharedView = res.share;
    els.twofaSharedCard.classList.remove('hidden');
    els.twofaSharedLabel.textContent = res.share.label || 'Akun 2FA Bersama';
    els.twofaSharedExp.textContent = `Berlaku hingga ${formatFullDateTime(res.share.expiresAt)} | Setup key rahasia disembunyikan`;
    els.twofaSharedCode.textContent = formatOtpDigits(res.share.code);
    if (res.share.code && res.share.code !== prevCode) {
      pulseCodeElement(els.twofaSharedCode);
    }
  } catch (err) {
    state.twoFaSharedView = null;
    els.twofaSharedCard.classList.add('hidden');
    if (!silent) {
      showToast(err.message || 'Link kode 2FA tidak valid atau sudah kedaluwarsa.', 'error');
    }
  }
}

async function handleCreateTwoFaShare() {
  if (!state.twoFaActive) return;
  els.btn2faCreateShare.disabled = true;
  try {
    const expiresInHours = Number(els.select2faShareExp.value || 24);
    const res = await apiFetch('/api/2fa/share', {
      method: 'POST',
      body: JSON.stringify({
        label: state.twoFaActive.label,
        secret: state.twoFaActive.secret,
        expiresInHours,
      }),
    });
    const share = res.share;
    const shareUrl = `${window.location.origin}/2fa?share=${encodeURIComponent(share.id)}`;
    els.input2faShareUrl.value = shareUrl;
    els.twofaShareOutput.classList.remove('hidden');

    state.twoFaShares.unshift({
      id: share.id,
      label: share.label,
      expiresAt: share.expiresAt,
      revokeKey: share.revokeKey,
      url: shareUrl,
    });
    persistTwoFaShares();
    renderTwoFaSharesList();
    showToast('Link privat 2FA berhasil dibuat (tanpa memperlihatkan setup key).', 'success');
  } catch (err) {
    showToast(`Gagal membuat link 2FA: ${err.message}`, 'error');
  } finally {
    els.btn2faCreateShare.disabled = !state.twoFaActive;
  }
}

async function handleRevokeTwoFaShare(shareId) {
  const found = state.twoFaShares.find((s) => s.id === shareId);
  try {
    const q = found?.revokeKey ? `?revokeKey=${encodeURIComponent(found.revokeKey)}` : '';
    await apiFetch(`/api/2fa/share/${encodeURIComponent(shareId)}${q}`, {
      method: 'DELETE',
      withOptionalAdmin: true,
    });
  } catch {}
  state.twoFaShares = state.twoFaShares.filter((s) => s.id !== shareId);
  persistTwoFaShares();
  renderTwoFaSharesList();
  if (els.input2faShareUrl.value.includes(shareId)) {
    els.twofaShareOutput.classList.add('hidden');
    els.input2faShareUrl.value = '';
  }
  showToast('Link privat 2FA telah dicabut.');
}

async function refreshTwoFaCodes() {
  if (state.twoFaActive) {
    try {
      const code = await computeClientTotpCode(state.twoFaActive.secret, state.twoFaActive);
      const changed = state.twoFaCurrentCode !== code;
      state.twoFaCurrentCode = code;
      els.twofaCurrentCode.textContent = formatOtpDigits(code);
      if (changed) pulseCodeElement(els.twofaCurrentCode);
    } catch {}
  }
  if (state.twoFaSaved.length > 0) {
    await renderSavedTwoFaList();
  }
  if (state.twoFaSharedView?.id) {
    await loadSharedTwoFaFromUrl(state.twoFaSharedView.id, { silent: true });
  }
  renderTwoFaSharesList();
}

function startTwoFaEpochLoop() {
  if (state.twoFaTimer) clearInterval(state.twoFaTimer);
  state.twoFaLastEpoch = Math.floor(Date.now() / 30000);
  state.twoFaTimer = setInterval(() => {
    if (document.hidden) return;
    const epoch = Math.floor(Date.now() / 30000);
    if (epoch !== state.twoFaLastEpoch) {
      state.twoFaLastEpoch = epoch;
      refreshTwoFaCodes();
    }
  }, 1000);
}

/* =========================================================
 * PUBLIC TOOL 3: MICROSOFT / OUTLOOK INBOX READER (/mail-reader)
 * ========================================================= */
const MS_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MS_UUID_ANY_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const MS_EMAIL_REGEX = /^[^\s@:|;]+@[^\s@:|;]+\.[^\s@:|;]+$/;
const MS_EMAIL_ANY_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function detectMsComboClient(rawCombo) {
  const line = String(rawCombo || '')
    .trim()
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find(Boolean) || '';

  if (!line) {
    return { email: '', password: '', clientId: '', refreshToken: '', ready: false };
  }

  let tokens;
  if (line.includes('|')) tokens = line.split('|');
  else if (line.includes('----')) tokens = line.split('----');
  else if (line.includes('\t')) tokens = line.split('\t');
  else if (line.includes(';')) tokens = line.split(';');
  else if (line.includes(':')) {
    const i = line.indexOf(':');
    tokens = MS_UUID_ANY_REGEX.test(line) ? line.split(':') : [line.slice(0, i), line.slice(i + 1)];
  } else tokens = line.split(/\s+/);

  tokens = tokens.map((t) => t.trim()).filter(Boolean);

  let email = '';
  let clientId = '';
  const rest = [];
  for (const tok of tokens) {
    if (!clientId && MS_UUID_REGEX.test(tok)) { clientId = tok.toLowerCase(); continue; }
    if (!email && MS_EMAIL_REGEX.test(tok)) { email = tok.toLowerCase(); continue; }
    rest.push(tok);
  }
  if (!email) {
    const m = line.match(MS_EMAIL_ANY_REGEX);
    if (m) email = m[0].toLowerCase();
  }

  const tokenIdx = rest.findIndex((t) => /^(?:M\.|0\.A|1\.A|OAQ|Ew)/i.test(t) && t.length >= 24);
  const refreshToken = tokenIdx >= 0 ? rest[tokenIdx] : '';
  const others = rest.filter((_, i) => i !== tokenIdx);
  const password = others[0] || '';

  return { email, password, clientId, refreshToken, ready: Boolean(email && (password || refreshToken)) };
}

function updateMsDetectStrip() {
  let email = '';
  let method = 'Email & Password';
  let ready = false;

  if (state.msMode === 'combo') {
    const det = detectMsComboClient(els.inputMsCombo.value);
    email = det.email;
    ready = det.ready;
    if (det.refreshToken) method = 'OAuth Token';
  } else if (state.msMode === 'device') {
    email = els.inputMsEmail.value.trim();
    method = 'Login Resmi Microsoft';
    ready = true;
  } else {
    email = els.inputMsEmail.value.trim();
    ready = Boolean(email && els.inputMsPassword.value);
  }

  els.msDetectEmail.textContent = email ? `Email: ${email}` : 'Email: Siap diisi';
  els.msDetectEmail.classList.toggle('is-ready', Boolean(email));
  els.msDetectClient.textContent = `Metode: ${method}`;
  els.msDetectClient.classList.toggle('is-ready', ready);
}
function persistMsSession() {
  if (!state.msConnected) return;
  try {
    sessionStorage.setItem(
      STORAGE_KEYS.msSession,
      JSON.stringify({
        transport: state.msTransport,
        email: state.msEmail,
        displayName: state.msDisplayName,
        clientId: state.msClientId,
        accessToken: state.msAccessToken,
        refreshToken: state.msRefreshToken,
        password: state.msPassword,
        imapHost: state.msImapHost,
        imapPort: state.msImapPort,
        folder: state.msFolder,
      })
    );
  } catch {}
}

function syncMsFolderOptions() {
  if (!els.selectMsFolder) return;
  const folders = state.msFolders && state.msFolders.length > 0
    ? state.msFolders
    : [
        { id: 'all_incoming', displayName: 'Semua Masuk (Inbox + Junk)' },
        { id: 'inbox', displayName: 'Inbox' },
        { id: 'junkemail', displayName: 'Junk Email (Spam)' },
        { id: 'sentitems', displayName: 'Sent Items' },
        { id: 'deleteditems', displayName: 'Deleted Items' },
      ];

  els.selectMsFolder.innerHTML = folders
    .map((f) => {
      const countSuffix = typeof f.totalItemCount === 'number' && f.totalItemCount > 0 ? ` (${f.totalItemCount})` : '';
      return `<option value="${escapeHtml(f.id)}">${escapeHtml(f.displayName)}${escapeHtml(countSuffix)}</option>`;
    })
    .join('');

  if (folders.some((f) => f.id === state.msFolder)) {
    els.selectMsFolder.value = state.msFolder;
  } else {
    state.msFolder = folders[0]?.id || 'all_incoming';
    els.selectMsFolder.value = state.msFolder;
  }
  els.selectMsFolder.disabled = !state.msConnected;
  syncCustomDropdown(els.selectMsFolder);
}

function getFilteredMsMessages() {
  const q = state.msSearchQuery.trim().toLowerCase();
  if (!q) return state.msMessages;
  return state.msMessages.filter((m) => {
    const hay = `${m.fromName || ''} ${m.fromAddress || ''} ${m.subject || ''} ${m.snippet || ''} ${m.otpCode || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderMsMessagesList() {
  const filtered = getFilteredMsMessages();
  els.msmailCount.textContent = String(filtered.length);

  if (!state.msConnected && !state.msLoading) {
    els.msmailList.innerHTML = `
      <div class="state-panel">
        <h3>Belum Ada Akun Terhubung</h3>
        <p>Tempel combo Microsoft di atas lalu klik <strong>Hubungkan &amp; Buka Inbox</strong> untuk memuat pesan.</p>
      </div>
    `;
    return;
  }

  if (state.msLoading && state.msMessages.length === 0) {
    els.msmailList.innerHTML = `
      <div class="state-panel">
        <h3>Menghubungkan ke Microsoft Graph</h3>
        <p>Menukar Refresh Token dan mengambil email terbaru dari Inbox serta Junk Email...</p>
      </div>
    `;
    return;
  }

  if (filtered.length === 0) {
    els.msmailList.innerHTML = `
      <div class="state-panel">
        <h3>Tidak Ada Pesan</h3>
        <div class="state-addr-box">${escapeHtml(state.msEmail || 'Outlook Mailbox')}</div>
        <p>${
          state.msSearchQuery
            ? `Tidak ada email yang cocok dengan "${escapeHtml(state.msSearchQuery)}".`
            : 'Folder ini masih kosong. Klik Segarkan untuk memeriksa email baru.'
        }</p>
      </div>
    `;
    return;
  }

  els.msmailList.innerHTML = filtered
    .map((msg) =>
      renderMessageCard(msg, {
        selected: msg.id === state.msSelectedId,
        showRecipient: false,
        openAttr: 'data-ms-open-id',
        variant: 'simple',
      })
    )
    .join('');
}

function renderMsReader() {
  if (!state.msSelectedDetail) {
    els.msmailEmpty.classList.remove('hidden');
    els.msmailReader.classList.add('hidden');
    els.msmailReader.innerHTML = '';
    return;
  }
  els.msmailEmpty.classList.add('hidden');
  els.msmailReader.classList.remove('hidden');
  els.msmailReader.innerHTML = buildMessageDetailMarkup(state.msSelectedDetail, {
    activeTab: state.msReaderTab,
    allowExternalImages: state.msAllowImages,
    mode: 'msmail',
  });
}

function applyMsConnection(res, fallback = {}) {
  state.msConnected = true;
  state.msTransport = res.transport || 'graph';
  state.msEmail = res.email || fallback.email || 'Outlook Mailbox';
  state.msDisplayName = res.displayName || state.msEmail;
  state.msClientId = res.clientId || fallback.clientId || '';
  state.msAccessToken = res.accessToken || '';
  state.msRefreshToken = res.refreshToken || fallback.refreshToken || '';
  state.msPassword = state.msTransport === 'imap-password' ? fallback.password || '' : '';
  state.msImapHost = res.imapHost || fallback.imapHost || '';
  state.msImapPort = Number(res.imapPort || fallback.imapPort || 993);
  state.msFolders = res.folders || [];
  state.msFolder = res.folder || fallback.folder || 'all_incoming';
  state.msMessages = res.messages || [];
  state.msSelectedId = null;
  state.msSelectedDetail = null;
  els.msmailWorkspace.classList.remove('is-reading');

  els.msmailActiveLabel.textContent = state.msEmail;
  els.btnMsRefresh.disabled = false;
  els.btnMsCopyAddr.classList.remove('hidden');
  els.btnMsDisconnect.classList.remove('hidden');

  persistMsSession();
  syncMsFolderOptions();
  renderMsReader();
}

async function connectMsMailbox({
  combo = '',
  email = '',
  password = '',
  refreshToken = '',
  clientId = '',
  imapHost = '',
  imapPort = 993,
  folder = 'all_incoming',
  silentRestore = false,
} = {}) {
  els.msmailError.classList.add('hidden');
  state.msLoading = true;
  els.btnMsConnect.disabled = true;
  els.btnMsConnectLabel.textContent = 'Menghubungkan...';
  renderMsMessagesList();

  let autoOpenId = null;

  try {
    const res = await apiFetch('/api/ms-mail/connect', {
      method: 'POST',
      body: JSON.stringify({ combo, email, password, refreshToken, clientId, imapHost, imapPort, folder }),
    });

    if (res.requiresDeviceAuth && res.deviceAuth) {
      setMsMode('device');
      showMsDeviceCode(res.deviceAuth, res.message);
      showToast('Selesaikan login resmi Microsoft dengan kode di bawah.');
      return;
    }

    applyMsConnection(res, {
      email: email || parseMsEmailFromCombo(combo),
      password: password || parseMsPasswordFromCombo(combo),
      refreshToken,
      clientId,
      imapHost,
      imapPort,
      folder,
    });

    if (state.msMessages.length > 0 && isDesktopSplitViewport()) {
      autoOpenId = state.msMessages[0].id;
    }

    if (!silentRestore) {
      showToast(`Terhubung ke ${state.msEmail}`, 'success');
    }
  } catch (err) {
    if (silentRestore) {
      try { sessionStorage.removeItem(STORAGE_KEYS.msSession); } catch {}
    } else {
      els.msmailError.textContent = err.message;
      els.msmailError.classList.remove('hidden');
    }
  } finally {
    state.msLoading = false;
    els.btnMsConnect.disabled = false;
    els.btnMsConnectLabel.textContent = 'Masuk & Buka Inbox';
    renderMsMessagesList();
  }

  if (autoOpenId) {
    openMsMessage(autoOpenId);
  }
}

function parseMsEmailFromCombo(combo) {
  return detectMsComboClient(combo).email || '';
}

function parseMsPasswordFromCombo(combo) {
  return detectMsComboClient(combo).password || '';
}

function msAuthPayload() {
  return {
    transport: state.msTransport,
    accessToken: state.msAccessToken,
    refreshToken: state.msRefreshToken,
    clientId: state.msClientId,
    email: state.msEmail,
    password: state.msPassword,
    imapHost: state.msImapHost,
    imapPort: state.msImapPort,
  };
}

function restoreMsSession(saved) {
  state.msTransport = saved.transport || 'graph';
  state.msEmail = saved.email || '';
  state.msAccessToken = saved.accessToken || '';
  state.msRefreshToken = saved.refreshToken || '';
  state.msClientId = saved.clientId || '';
  state.msPassword = saved.password || '';
  state.msImapHost = saved.imapHost || '';
  state.msImapPort = Number(saved.imapPort || 993);
  state.msConnected = true;
  state.msFolder = saved.folder || 'all_incoming';
  els.btnMsRefresh.disabled = false;
  els.btnMsDisconnect.classList.remove('hidden');
  els.btnMsCopyAddr.classList.remove('hidden');
  els.msmailActiveLabel.textContent = state.msEmail || 'Outlook Mailbox';
  fetchMsMessages({ silent: false }).then(() => {
    if (state.msMessages.length === 0 && state.msMessages !== null && !state.msLoading) {
      /* keep session; user may refresh manually */
    }
  });
}

/* ---- Microsoft official device-code login (works for personal Hotmail/Outlook & MFA) ---- */
function setMsMode(mode) {
  const next = ['login', 'device', 'combo'].includes(mode) ? mode : 'login';
  state.msMode = next;
  document.querySelectorAll('[data-ms-mode]').forEach((btn) => {
    const active = btn.getAttribute('data-ms-mode') === next;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
    if (active) btn.classList.add('is-jelly-pop');
    setTimeout(() => btn.classList.remove('is-jelly-pop'), 460);
  });
  els.msPanelLogin.classList.toggle('hidden', next !== 'login');
  els.msPanelDevice.classList.toggle('hidden', next !== 'device');
  els.msPanelCombo.classList.toggle('hidden', next !== 'combo');
  els.msmailError.classList.add('hidden');
  updateMsDetectStrip();
}

function stopMsDevicePolling() {
  if (state.msDevicePollTimer) clearTimeout(state.msDevicePollTimer);
  state.msDevicePollTimer = null;
  els.msPanelDevice?.querySelector('.ms-device-card')?.classList.remove('is-waiting');
}

function showMsDeviceCode(device, message = '') {
  state.msDevice = device;
  els.msDeviceCode.textContent = device.userCode;
  els.msDeviceCodeWrap.classList.remove('hidden');
  els.btnMsCopyDeviceCode.classList.remove('hidden');
  els.btnMsOpenDeviceLink.classList.remove('hidden');
  els.msDeviceTitle.textContent = 'Menunggu Anda login di Microsoft...';
  if (message) els.msDeviceDesc.textContent = message;
  els.msPanelDevice.querySelector('.ms-device-card').classList.add('is-waiting');
  els.btnMsStartDeviceLabel.textContent = 'Buat Kode Baru';
  spawnSkySparkles(els.msDeviceCodeWrap, 5, 'sky');
  scheduleMsDevicePoll(Number(device.interval || 5) * 1000);
}

function scheduleMsDevicePoll(delayMs) {
  if (state.msDevicePollTimer) clearTimeout(state.msDevicePollTimer);
  const device = state.msDevice;
  if (!device) return;
  const deadline = (device.startedAt || Date.now()) + Number(device.expiresIn || 900) * 1000;
  device.startedAt = device.startedAt || Date.now();

  state.msDevicePollTimer = setTimeout(async () => {
    if (Date.now() > deadline) {
      stopMsDevicePolling();
      els.msDeviceTitle.textContent = 'Kode kedaluwarsa. Buat kode baru.';
      return;
    }
    try {
      const res = await apiFetch('/api/ms-mail/device-poll', {
        method: 'POST',
        body: JSON.stringify({
          deviceCode: device.deviceCode,
          clientId: device.clientId,
          tenant: device.tenant,
          email: device.emailHint || '',
          folder: state.msFolder || 'all_incoming',
        }),
      });
      if (res.pending) {
        scheduleMsDevicePoll((Number(device.interval || 5) + (res.slowDown ? 5 : 0)) * 1000);
        return;
      }
      stopMsDevicePolling();
      state.msDevice = null;
      applyMsConnection(res, { email: device.emailHint || '', folder: state.msFolder });
      els.msDeviceTitle.textContent = 'Login Resmi Microsoft Tanpa Token';
      els.msDeviceCodeWrap.classList.add('hidden');
      els.btnMsCopyDeviceCode.classList.add('hidden');
      els.btnMsOpenDeviceLink.classList.add('hidden');
      els.btnMsStartDeviceLabel.textContent = 'Buat Kode Login Microsoft';
      showToast(`Terhubung ke ${state.msEmail}`, 'success');
      renderMsMessagesList();
      if (state.msMessages.length > 0 && isDesktopSplitViewport()) openMsMessage(state.msMessages[0].id);
    } catch (err) {
      stopMsDevicePolling();
      els.msmailError.textContent = err.message;
      els.msmailError.classList.remove('hidden');
      els.msDeviceTitle.textContent = 'Login gagal. Coba buat kode baru.';
    }
  }, delayMs);
}

async function startMsDeviceLogin() {
  els.msmailError.classList.add('hidden');
  stopMsDevicePolling();
  await runRefreshWithAnim(els.btnMsStartDevice, async () => {
    try {
      const res = await apiFetch('/api/ms-mail/device-start', {
        method: 'POST',
        body: JSON.stringify({ email: els.inputMsEmail.value.trim() }),
      });
      res.startedAt = Date.now();
      showMsDeviceCode(res);
    } catch (err) {
      els.msmailError.textContent = err.message;
      els.msmailError.classList.remove('hidden');
    }
  });
}

async function fetchMsMessages({ silent = false } = {}) {
  if (!state.msConnected) return;
  if (!silent) {
    state.msLoading = true;
    renderMsMessagesList();
  }

  let autoOpenId = null;

  try {
    const res = await apiFetch('/api/ms-mail/messages', {
      method: 'POST',
      body: JSON.stringify({
        ...msAuthPayload(),
        folder: state.msFolder,
        top: 40,
      }),
    });

    if (res.accessToken) state.msAccessToken = res.accessToken;
    if (res.refreshToken) state.msRefreshToken = res.refreshToken;
    state.msMessages = res.messages || [];
    persistMsSession();

    if (state.msSelectedId && !state.msMessages.some((m) => m.id === state.msSelectedId)) {
      state.msSelectedId = null;
      state.msSelectedDetail = null;
      renderMsReader();
    }

    const filtered = getFilteredMsMessages();
    if (!state.msSelectedId && filtered.length > 0 && isDesktopSplitViewport()) {
      autoOpenId = filtered[0].id;
    }
  } catch (err) {
    if (!silent) {
      showToast(`Gagal memuat ulang inbox Microsoft: ${err.message}`, 'error');
    }
  } finally {
    state.msLoading = false;
    renderMsMessagesList();
  }

  if (autoOpenId) {
    openMsMessage(autoOpenId);
  }
}

async function openMsMessage(messageId) {
  if (!state.msConnected || !messageId) return;

  state.msSelectedId = messageId;
  state.msAllowImages = true;
  els.msmailWorkspace.classList.add('is-reading');
  renderMsMessagesList();

  els.msmailEmpty.classList.add('hidden');
  els.msmailReader.classList.remove('hidden');
  els.msmailReader.innerHTML = '<div class="state-panel"><h3>Memuat Isi Pesan Outlook...</h3></div>';

  try {
    const res = await apiFetch('/api/ms-mail/message', {
      method: 'POST',
      body: JSON.stringify({
        ...msAuthPayload(),
        messageId,
      }),
    });
    if (state.msSelectedId !== messageId) return;
    if (res.accessToken) state.msAccessToken = res.accessToken;
    if (res.refreshToken) state.msRefreshToken = res.refreshToken;
    persistMsSession();

    state.msSelectedDetail = res.email;
    state.msReaderTab = res.email.htmlBody ? 'html' : 'text';

    const row = state.msMessages.find((m) => m.id === messageId);
    if (row) row.isRead = true;

    renderMsMessagesList();
    renderMsReader();
  } catch (err) {
    els.msmailReader.innerHTML = `
      <div class="state-panel">
        <h3 class="state-error-title">Gagal Membuka Pesan Outlook</h3>
        <p>${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

function disconnectMsMailbox() {
  stopMsDevicePolling();
  state.msConnected = false;
  state.msEmail = '';
  state.msDisplayName = '';
  state.msClientId = '';
  state.msAccessToken = '';
  state.msRefreshToken = '';
  state.msPassword = '';
  state.msTransport = 'graph';
  state.msImapHost = '';
  state.msImapPort = 993;
  state.msFolders = [];
  state.msFolder = 'all_incoming';
  state.msSearchQuery = '';
  state.msMessages = [];
  state.msSelectedId = null;
  state.msSelectedDetail = null;

  try { sessionStorage.removeItem(STORAGE_KEYS.msSession); } catch {}

  els.inputMsCombo.value = '';
  els.inputMsEmail.value = '';
  els.inputMsPassword.value = '';
  els.inputMsSearch.value = '';
  els.msmailError.classList.add('hidden');
  els.msmailActiveLabel.textContent = 'Belum terhubung';
  els.btnMsRefresh.disabled = true;
  els.btnMsCopyAddr.classList.add('hidden');
  els.btnMsDisconnect.classList.add('hidden');
  els.msmailWorkspace.classList.remove('is-reading');

  updateMsDetectStrip();
  syncMsFolderOptions();
  renderMsMessagesList();
  renderMsReader();
  showToast('Koneksi kotak masuk Microsoft diputuskan.');
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

function renderAdminSimRecipients() {
  const sel = els.inputAdminSimTo;
  if (!sel || sel.tagName !== 'SELECT') return;
  const prev = sel.value;
  const active = state.adminMailboxes.filter((m) => m.status === 'active');
  if (!active.length) {
    sel.innerHTML = '<option value="">Belum ada email aktif</option>';
  } else {
    sel.innerHTML = active
      .map((m) => `<option value="${escapeHtml(m.address)}">${escapeHtml(m.address)}</option>`)
      .join('');
    if (prev && active.some((m) => m.address === prev)) sel.value = prev;
  }
  sel.disabled = !active.length;
  syncCustomDropdowns(sel.parentElement);
}

function renderAdminMailboxesTable() {
  renderAdminSimRecipients();
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
              <button type="button" class="btn btn-sm btn-copy-anim" data-mailbox-copy-addr="${escapeHtml(mb.address)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Salin</span></button>
              <button type="button" class="btn btn-sm btn-soft btn-copy-anim" data-mailbox-copy-link="${escapeHtml(mb.address)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Salin Link</span></button>
              <button type="button" class="btn btn-sm btn-danger-outline" data-mailbox-delete="${mb.id}" data-mailbox-addr="${escapeHtml(mb.address)}">${TRASH_SVG}<span>Hapus</span></button>
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
              <button type="button" class="btn btn-sm btn-danger-outline" data-domain-delete="${d.id}" data-domain-name="${escapeHtml(d.domain)}">${TRASH_SVG}<span>Hapus</span></button>
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

async function copyActiveEmailAction(e) {
  const full = getActiveAddress();
  if (!full) return;
  const triggerBtn = e?.currentTarget || els.btnCopyEmail;
  await copyText(full, `Disalin: ${full}`, triggerBtn);
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
  els.btnOpenAdmin.addEventListener('click', openAdminLoginModal);
  els.btnSidebarLogout.addEventListener('click', logoutAdmin);
  els.btnMobileLogout.addEventListener('click', logoutAdmin);

  // Global Sleepy-Blob tactile jelly ripple & button pop delegation
  document.addEventListener(
    'pointerdown',
    (e) => {
      const btn = e.target.closest('button:not(:disabled), .btn:not([aria-disabled="true"]), .header-order-link, .public-tool-link');
      if (!btn) return;
      if (btn.tagName === 'BUTTON') {
        lastClickedButton = btn;
      }
      if (
        prefersReducedMotion() ||
        btn.classList.contains('blob-toggle') ||
        btn.classList.contains('sidebar-theme-row') ||
        btn.classList.contains('message-open-btn') ||
        btn.classList.contains('amc-dd-option')
      ) {
        return;
      }
      if (
        btn.classList.contains('btn') ||
        btn.classList.contains('owner-login-icon') ||
        btn.classList.contains('header-order-link') ||
        btn.classList.contains('domain-card-btn') ||
        btn.classList.contains('ms-format-chip')
      ) {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const ripple = document.createElement('span');
          ripple.className = 'amc-jelly-ripple';
          const size = Math.max(rect.width, rect.height) * 1.35;
          const rx = e.clientX ? e.clientX - rect.left : rect.width / 2;
          const ry = e.clientY ? e.clientY - rect.top : rect.height / 2;
          ripple.style.width = `${Math.round(size)}px`;
          ripple.style.height = `${Math.round(size)}px`;
          ripple.style.left = `${Math.round(rx - size / 2)}px`;
          ripple.style.top = `${Math.round(ry - size / 2)}px`;
          btn.appendChild(ripple);
          setTimeout(() => ripple.remove(), 560);
        }
      }
    },
    { passive: true }
  );

  document.addEventListener('click', (e) => {
    const btn = e.target.closest(
      '.btn:not(:disabled), .owner-login-icon, .domain-card-btn, .ms-format-chip, .reader-tab, .sidebar-link, .mobile-nav-item'
    );
    if (
      btn &&
      !btn.classList.contains('btn-copy-anim') &&
      !btn.classList.contains('btn-refresh-anim') &&
      !btn.classList.contains('is-copied') &&
      !btn.classList.contains('is-refreshing')
    ) {
      triggerClassAnim(btn, 'is-jelly-pop', 460);
    }
  });

  if (els.checkAutoRegister) {
    els.checkAutoRegister.addEventListener('change', () => {
      const miniSwitch = els.checkAutoRegister.parentElement?.querySelector('.blob-mini-switch');
      if (miniSwitch) {
        triggerClassAnim(miniSwitch, 'is-rolling', 620);
        if (els.checkAutoRegister.checked) {
          spawnSkySparkles(miniSwitch, 4, 'sky');
        }
      }
    });
  }

  window.addEventListener('resize', () => {
    syncPublicNavBlob({ animate: false });
  });

  els.btnSidebarQuickCreate.addEventListener('click', () => {
    switchAdminView('mailboxes', { focusQuickInput: true });
  });

  document.addEventListener('click', (e) => {
    const publicNav = e.target.closest('[data-public-nav]');
    if (publicNav && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      setPublicTool(publicNav.dataset.publicNav, { pushHistory: true });
      return;
    }

    const viewTrigger = e.target.closest('[data-admin-view]');
    if (viewTrigger && state.adminAuthenticated) {
      const targetView = viewTrigger.dataset.adminView;
      switchAdminView(targetView);
    }
  });

  window.addEventListener('popstate', () => {
    state.publicTool = resolveToolFromLocation();
    if (state.adminAuthenticated) {
      if (state.publicTool === '2fa') state.adminView = 'tool-2fa';
      else if (state.publicTool === 'msmail') state.adminView = 'tool-msmail';
    }
    syncModeShell({ animateNav: true });
    const shareParam = new URLSearchParams(window.location.search).get('share') || '';
    if (state.publicTool === '2fa' && shareParam) {
      loadSharedTwoFaFromUrl(shareParam);
    }
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
    triggerClassAnim(els.btnOpenInbox, 'is-jelly-pop', 500);
    setActiveAddress(parsed.localPart, parsed.domain);
  });

  els.selectDomain.addEventListener('change', () => {
    renderDomainPills();
    els.builderError.classList.add('hidden');
  });

  els.btnCopyEmail.addEventListener('click', copyActiveEmailAction);

  els.btnRefreshInbox.addEventListener('click', () => {
    runRefreshWithAnim(els.btnRefreshInbox, () => fetchInbox({ silent: false }));
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
    if (els.msmailWorkspace.classList.contains('is-reading')) {
      els.msmailWorkspace.classList.remove('is-reading');
    }
    if (els.adminCatchallWorkspace.classList.contains('is-reading')) {
      els.adminCatchallWorkspace.classList.remove('is-reading');
    }
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
    if (!(await amcConfirm({ title: 'Hapus semua pesan?', message: `Semua pesan di ${addr} akan dibuang permanen.`, confirmText: 'Ya, Buang Semua' }))) return;
    try {
      await apiFetch(`/api/inbox?address=${encodeURIComponent(addr)}`, { method: 'DELETE', admin: true });
      await animateRemoveMany(els.inboxList.querySelectorAll('[data-open-id]'));
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
      copyText(otpBtn.dataset.quickOtp, `Kode OTP ${otpBtn.dataset.quickOtp} disalin`, otpBtn);
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
      copyText(otpBtn.dataset.quickOtp, `Kode OTP ${otpBtn.dataset.quickOtp} disalin`, otpBtn);
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
      } else if (backBtn.dataset.mobileBack === 'msmail') {
        els.msmailWorkspace.classList.remove('is-reading');
      } else {
        els.mailWorkspace.classList.remove('is-reading');
      }
      return;
    }

    const otpBtn = e.target.closest('[data-copy-otp]');
    if (otpBtn) {
      copyText(otpBtn.dataset.copyOtp, `Kode OTP ${otpBtn.dataset.copyOtp} disalin`, otpBtn);
      return;
    }

    const tabBtn = e.target.closest('[data-reader-tab]');
    if (tabBtn) {
      const chosenId = tabBtn.dataset.readerTab;
      let container = els.readerContent;
      if (tabBtn.dataset.tabMode === 'admin') {
        state.adminReaderTab = chosenId;
        renderAdminCatchallReader();
        container = els.adminCatchallReader;
      } else if (tabBtn.dataset.tabMode === 'msmail') {
        state.msReaderTab = chosenId;
        renderMsReader();
        container = els.msmailReader;
      } else {
        state.readerTab = chosenId;
        renderPublicReader();
      }
      const newlyActive = container?.querySelector(`.reader-tab[data-reader-tab="${CSS.escape(chosenId)}"]`);
      if (newlyActive) triggerClassAnim(newlyActive, 'is-tab-pop', 460);
      return;
    }

    const imgBtn = e.target.closest('[data-toggle-images]');
    if (imgBtn) {
      if (imgBtn.dataset.toggleImages === 'admin') {
        state.adminAllowImages = !state.adminAllowImages;
        renderAdminCatchallReader();
      } else if (imgBtn.dataset.toggleImages === 'msmail') {
        state.msAllowImages = !state.msAllowImages;
        renderMsReader();
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
      copyText(src, 'Raw EML disalin ke clipboard', copyRawBtn);
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
          await Promise.all([...findMsgCardEls(id)].map((n) => animateRemove(n)));
          state.adminSelectedId = null;
          state.adminSelectedDetail = null;
          els.adminCatchallWorkspace.classList.remove('is-reading');
          renderAdminCatchallReader();
          await Promise.all([loadAdminStatsAndMessages(), loadAdminMailboxes()]);
        } else {
          await apiFetch(`/api/emails/${encodeURIComponent(id)}`, { method: 'DELETE', admin: true });
          await Promise.all([...findMsgCardEls(id)].map((n) => animateRemove(n)));
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
  els.msmailReader.addEventListener('click', handleReaderClick);

  /* 2FA TOTP Authenticator Events */
  els.twofaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const parsed = parseClientTotpInput(els.input2faSecret.value, els.input2faLabel.value);
    if (!parsed.valid) {
      els.twofaError.textContent = parsed.error;
      els.twofaError.classList.remove('hidden');
      els.input2faSecret.focus();
      return;
    }
    if (!els.input2faLabel.value.trim() && parsed.label) {
      els.input2faLabel.value = parsed.label;
    }
    spawnSkySparkles(els.btn2faGenerate, 5, 'sky');
    await activateTwoFaEntry(parsed);
  });

  els.input2faSecret.addEventListener('input', async () => {
    els.twofaError.classList.add('hidden');
    const raw = els.input2faSecret.value.trim();
    if (!raw) return;
    const parsed = parseClientTotpInput(raw, els.input2faLabel.value);
    if (parsed.valid && (parsed.secret.length >= 16 || /^otpauth:\/\//i.test(raw))) {
      if (!els.input2faLabel.value.trim() && parsed.label) {
        els.input2faLabel.value = parsed.label;
      }
      await activateTwoFaEntry(parsed);
    }
  });

  els.input2faLabel.addEventListener('input', () => {
    if (state.twoFaActive) {
      state.twoFaActive.label = els.input2faLabel.value.trim() || 'Akun 2FA Aktif';
      els.twofaActiveTitle.textContent = state.twoFaActive.label;
    }
  });

  els.btn2faSample.addEventListener('click', async () => {
    els.input2faLabel.value = 'Contoh Akun AMC';
    els.input2faSecret.value = SAMPLE_2FA_KEY;
    const parsed = parseClientTotpInput(SAMPLE_2FA_KEY, 'Contoh Akun AMC');
    if (parsed.valid) {
      spawnSkySparkles(els.btn2faSample, 4, 'sky');
      await activateTwoFaEntry(parsed);
    }
  });

  els.btn2faClear.addEventListener('click', clearTwoFaActive);

  els.btn2faSave.addEventListener('click', async () => {
    const parsed = parseClientTotpInput(els.input2faSecret.value, els.input2faLabel.value);
    if (!parsed.valid) {
      els.twofaError.textContent = parsed.error;
      els.twofaError.classList.remove('hidden');
      els.input2faSecret.focus();
      return;
    }
    const label = parsed.label || els.input2faLabel.value.trim() || `Akun ${state.twoFaSaved.length + 1}`;
    const existingIdx = state.twoFaSaved.findIndex((item) => item.secret === parsed.secret);
    if (existingIdx >= 0) {
      state.twoFaSaved[existingIdx].label = label;
    } else {
      state.twoFaSaved.unshift({
        id: `2fa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        label,
        secret: parsed.secret,
        digits: parsed.digits,
        period: parsed.period,
        algorithm: parsed.algorithm,
        createdAt: Date.now(),
      });
    }
    persistSavedTwoFa();
    spawnSkySparkles(els.btn2faSave, 5, 'sky');
    await activateTwoFaEntry({ ...parsed, label });
    showToast(`Kunci 2FA "${label}" disimpan di perangkat ini.`, 'success');
  });

  els.btnCopy2faCode.addEventListener('click', () => {
    if (!state.twoFaCurrentCode) return;
    copyText(state.twoFaCurrentCode, `Kode 2FA ${state.twoFaCurrentCode} disalin`, els.btnCopy2faCode);
  });

  els.btn2faCreateShare.addEventListener('click', handleCreateTwoFaShare);

  els.btnCopy2faShareUrl.addEventListener('click', () => {
    if (!els.input2faShareUrl.value) return;
    copyText(els.input2faShareUrl.value, 'Link privat 2FA disalin ke clipboard', els.btnCopy2faShareUrl);
  });

  els.btnCopyShared2fa.addEventListener('click', () => {
    if (!state.twoFaSharedView?.code) return;
    copyText(state.twoFaSharedView.code, `Kode 2FA ${state.twoFaSharedView.code} disalin`, els.btnCopyShared2fa);
  });

  els.btnExitShared2fa.addEventListener('click', () => {
    state.twoFaSharedView = null;
    els.twofaSharedCard.classList.add('hidden');
    if (window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete('share');
      window.history.replaceState({}, '', url.toString());
    }
  });

  els.twofaSavedList.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('[data-2fa-copy]');
    if (copyBtn) {
      const code = copyBtn.getAttribute('data-2fa-copy') || '';
      copyText(code, `Kode 2FA ${code} disalin`, copyBtn);
      return;
    }

    const useBtn = e.target.closest('[data-2fa-use]');
    if (useBtn) {
      const id = useBtn.getAttribute('data-2fa-use');
      const found = state.twoFaSaved.find((item) => item.id === id);
      if (found) {
        els.input2faLabel.value = found.label || '';
        els.input2faSecret.value = found.secret || '';
        await activateTwoFaEntry(found);
      }
      return;
    }

    const delBtn = e.target.closest('[data-2fa-delete]');
    if (delBtn) {
      const id = delBtn.getAttribute('data-2fa-delete');
      await animateRemove(delBtn.closest('.twofa-saved-item'));
      state.twoFaSaved = state.twoFaSaved.filter((item) => item.id !== id);
      persistSavedTwoFa();
      await renderSavedTwoFaList();
      showToast('Kunci 2FA dihapus dari perangkat ini.');
    }
  });

  els.twofaSharesList.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('[data-share-copy]');
    if (copyBtn) {
      copyText(copyBtn.getAttribute('data-share-copy'), 'Link privat 2FA disalin', copyBtn);
      return;
    }
    const revBtn = e.target.closest('[data-share-revoke]');
    if (revBtn) {
      handleRevokeTwoFaShare(revBtn.getAttribute('data-share-revoke'));
    }
  });

  /* Microsoft / Outlook Mail Reader Events (Email + Password) */
  document.querySelectorAll('[data-ms-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setMsMode(btn.getAttribute('data-ms-mode')));
  });

  els.btnMsTogglePass.addEventListener('click', () => {
    const show = els.inputMsPassword.type === 'password';
    els.inputMsPassword.type = show ? 'text' : 'password';
    els.btnMsTogglePass.classList.toggle('is-awake', show);
    els.btnMsTogglePass.setAttribute('aria-pressed', String(show));
  });

  els.btnMsImapToggle.addEventListener('click', () => {
    const hiddenNow = els.msImapAdvRow.classList.toggle('hidden');
    els.btnMsImapToggle.setAttribute('aria-expanded', String(!hiddenNow));
  });

  els.inputMsEmail.addEventListener('input', () => {
    els.msmailError.classList.add('hidden');
    const v = els.inputMsEmail.value;
    if (/[|;\t]|----/.test(v) || (v.includes(':') && v.includes('@'))) {
      const det = detectMsComboClient(v);
      if (det.email && det.password) {
        els.inputMsEmail.value = det.email;
        els.inputMsPassword.value = det.password;
        showToast('Email & password terisi otomatis.');
      }
    }
    updateMsDetectStrip();
  });
  els.inputMsPassword.addEventListener('input', () => {
    els.msmailError.classList.add('hidden');
    updateMsDetectStrip();
  });
  els.inputMsCombo.addEventListener('input', () => {
    els.msmailError.classList.add('hidden');
    updateMsDetectStrip();
  });

  els.msmailConnectForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.msMode === 'device') {
      startMsDeviceLogin();
      return;
    }
    if (state.msMode === 'combo') {
      const raw = els.inputMsCombo.value.trim();
      if (!raw) {
        els.msmailError.textContent = 'Tempel email:password terlebih dahulu.';
        els.msmailError.classList.remove('hidden');
        els.inputMsCombo.focus();
        return;
      }
      connectMsMailbox({ combo: raw, folder: state.msFolder || 'all_incoming' });
      return;
    }
    const email = els.inputMsEmail.value.trim();
    const password = els.inputMsPassword.value;
    if (!email || !password) {
      els.msmailError.textContent = 'Isi Email dan Password terlebih dahulu.';
      els.msmailError.classList.remove('hidden');
      (email ? els.inputMsPassword : els.inputMsEmail).focus();
      return;
    }
    connectMsMailbox({
      email,
      password,
      imapHost: els.inputMsImapHost.value.trim(),
      imapPort: Number(els.inputMsImapPort.value || 993),
      folder: state.msFolder || 'all_incoming',
    });
  });

  els.btnMsStartDevice.addEventListener('click', () => startMsDeviceLogin());
  els.btnMsOpenDeviceLink.addEventListener('click', () => {
    if (state.msDevice?.verificationUri) window.open(state.msDevice.verificationUri, '_blank', 'noopener');
  });
  els.btnMsCopyDeviceCode.addEventListener('click', () => {
    if (state.msDevice?.userCode) copyText(state.msDevice.userCode, 'Kode login Microsoft disalin', els.btnMsCopyDeviceCode);
  });
  els.btnMsCopyAddr.addEventListener('click', () => {
    if (state.msEmail) copyText(state.msEmail, `Disalin: ${state.msEmail}`, els.btnMsCopyAddr);
  });

  els.btnMsDisconnect.addEventListener('click', disconnectMsMailbox);

  els.btnMsRefresh.addEventListener('click', () => {
    runRefreshWithAnim(els.btnMsRefresh, () => fetchMsMessages({ silent: false }));
  });

  els.selectMsFolder.addEventListener('change', () => {
    state.msFolder = els.selectMsFolder.value || 'all_incoming';
    state.msSelectedId = null;
    state.msSelectedDetail = null;
    els.msmailWorkspace.classList.remove('is-reading');
    renderMsReader();
    fetchMsMessages({ silent: false });
  });

  let msSearchTimer = null;
  els.inputMsSearch.addEventListener('input', () => {
    clearTimeout(msSearchTimer);
    msSearchTimer = setTimeout(() => {
      state.msSearchQuery = els.inputMsSearch.value.trim();
      renderMsMessagesList();
    }, 150);
  });

  els.msmailList.addEventListener('click', (e) => {
    const otpBtn = e.target.closest('[data-quick-otp]');
    if (otpBtn) {
      e.stopPropagation();
      copyText(otpBtn.dataset.quickOtp, `Kode OTP ${otpBtn.dataset.quickOtp} disalin`, otpBtn);
      return;
    }
    const openBtn = e.target.closest('[data-ms-open-id]');
    if (openBtn) {
      openMsMessage(openBtn.getAttribute('data-ms-open-id'));
    }
  });

  /* Admin Login & Workspace Events */
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

  els.adminQuickMailboxForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = els.inputQuickUsername.value.trim();
    if (!raw) return;
    try {
      const res = await handleCreateMailboxes(raw, els.selectQuickDomain.value || state.defaultDomain, els.inputQuickLabel.value.trim());
      if (res.added?.length) {
        els.inputQuickUsername.value = '';
        els.inputQuickLabel.value = '';
        spawnSkySparkles($('btn-quick-create-submit'), 5, 'sky');
      }
    } catch (err) {
      showToast(`Gagal membuat alamat email: ${err.message}`, 'error');
    }
  });

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
  els.btnAdminRefreshMailboxes.addEventListener('click', () => {
    runRefreshWithAnim(els.btnAdminRefreshMailboxes, () => loadAdminMailboxes());
  });

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
        state.publicTool = 'inbox';
        syncModeShell();
        setActiveAddress(u, d);
      }
      return;
    }

    const copyAddrBtn = e.target.closest('[data-mailbox-copy-addr]');
    if (copyAddrBtn) {
      copyText(copyAddrBtn.dataset.mailboxCopyAddr, `Disalin: ${copyAddrBtn.dataset.mailboxCopyAddr}`, copyAddrBtn);
      return;
    }

    const copyLinkBtn = e.target.closest('[data-mailbox-copy-link]');
    if (copyLinkBtn) {
      const addr = copyLinkBtn.dataset.mailboxCopyLink;
      const link = `${window.location.origin}/?email=${encodeURIComponent(addr)}`;
      copyText(link, `Link inbox ${addr} disalin`, copyLinkBtn);
      return;
    }

    const delBtn = e.target.closest('[data-mailbox-delete]');
    if (delBtn) {
      const id = delBtn.dataset.mailboxDelete;
      const addr = delBtn.dataset.mailboxAddr;
      if (!(await amcConfirm({ title: 'Hapus alamat email?', message: `Alamat ${addr} akan dihapus dari daftar email terdaftar.` }))) return;
      try {
        const res = await apiFetch(`/api/admin/mailboxes/${id}`, { method: 'DELETE', admin: true });
        await animateRemove(delBtn.closest('tr'));
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

  // Catch-All Unified Filters
  els.adminFilterDomain.addEventListener('change', () => loadAdminStatsAndMessages());
  let adminSearchTimer = null;
  els.adminFilterSearch.addEventListener('input', () => {
    clearTimeout(adminSearchTimer);
    adminSearchTimer = setTimeout(() => loadAdminStatsAndMessages(), 250);
  });
  els.btnAdminRefreshMsgs.addEventListener('click', () => {
    runRefreshWithAnim(els.btnAdminRefreshMsgs, () => loadAdminStatsAndMessages());
  });

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
      if (!(await amcConfirm({ title: 'Hapus domain?', message: `Domain ${name} akan dihapus dari daftar. Email lama tetap aman di arsip.` }))) return;
      try {
        const res = await apiFetch(`/api/admin/domains/${id}`, { method: 'DELETE', admin: true });
        await animateRemove(delBtn.closest('tr'));
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
      const saveBtn = els.adminSettingsForm.querySelector('button[type="submit"]');
      if (saveBtn) spawnSkySparkles(saveBtn, 5, 'sky');
      showToast('Pengaturan berhasil disimpan.', 'success');
    } catch (err) {
      showToast(`Gagal menyimpan pengaturan: ${err.message}`, 'error');
    }
  });

  els.btnAdminPurge.addEventListener('click', async () => {
    await runRefreshWithAnim(els.btnAdminPurge, async () => {
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
  });

  els.adminSimForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const to = els.inputAdminSimTo.value.trim().toLowerCase();
    const scenario = els.selectAdminSimType.value;
    if (!to) {
      showToast('Belum ada email aktif untuk dikirimi uji coba.', 'error');
      return;
    }
    const simBtn = els.adminSimForm.querySelector('button[type="submit"]');
    try {
      await apiFetch('/api/simulate', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({ recipient: to, scenario }),
      });
      if (simBtn) spawnSkySparkles(simBtn, 5, 'sky');
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
  const searchParams = new URLSearchParams(window.location.search);
  const shareParam = (searchParams.get('share') || '').trim();
  const urlEmail = (searchParams.get('email') || '').trim();

  state.publicTool = shareParam ? '2fa' : resolveToolFromLocation();

  syncThemeUI();
  loadTwoFaLocalState();
  initCustomDropdownEngine();
  syncCustomDropdowns();
  syncPublicToolPanels();
  renderSavedTwoFaList();
  renderTwoFaSharesList();
  startTwoFaEpochLoop();

  try {
    state.adminToken = sessionStorage.getItem(STORAGE_KEYS.adminToken) || '';
  } catch {}

  bindEvents();

  if (shareParam) {
    loadSharedTwoFaFromUrl(shareParam);
  }

  let savedMs = null;
  try {
    savedMs = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.msSession) || 'null');
  } catch {}
  if (savedMs && (savedMs.refreshToken || savedMs.accessToken || savedMs.password)) {
    restoreMsSession(savedMs);
  }

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
        if (state.publicTool === '2fa') state.adminView = 'tool-2fa';
        else if (state.publicTool === 'msmail') state.adminView = 'tool-msmail';
        else if (urlEmail) state.adminView = 'reader';
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

    let savedAddr = '';
    try { savedAddr = localStorage.getItem(STORAGE_KEYS.activeAddress) || ''; } catch {}
    const candidate = (urlEmail || savedAddr).trim().toLowerCase();

    if (candidate.includes('@')) {
      const [u, d] = candidate.split('@');
      if (LOCAL_PART_REGEX.test(u) && state.domains.some((dom) => dom.domain === d)) {
        setActiveAddress(u, d, { pushUrl: Boolean(urlEmail) && state.publicTool === 'inbox' });
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
