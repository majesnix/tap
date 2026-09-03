/* @ds-bundle: {"format":3,"namespace":"MajesNixDesignSystem_019dcb","components":[],"sourceHashes":{"ui_kits/majesnix/Components.jsx":"65e0b83caf05","ui_kits/majesnix/Dashboard.jsx":"247fd1c4a876","ui_kits/majesnix/Shell.jsx":"a2b354944528"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.MajesNixDesignSystem_019dcb = window.MajesNixDesignSystem_019dcb || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/majesnix/Components.jsx
try { (() => {
// MajesNix — Shared UI Components
// Exports: Btn, Badge, StatCard, Input, Modal, Avatar, Tag

const DS = {
  bg: '#0C0D12',
  surface: '#13151E',
  surface2: '#1C1F2C',
  surface3: '#252840',
  border: 'rgba(255,255,255,0.08)',
  text1: '#EEF0F8',
  text2: '#9499B8',
  text3: '#5C6182',
  accent: '#7B6CF6',
  accentDim: '#5B4FD4',
  accentBright: '#A497FF',
  accentBg: 'rgba(123,108,246,0.10)',
  teal: '#2DD4BF',
  tealBg: 'rgba(45,212,191,0.10)',
  success: '#34D399',
  successBg: 'rgba(52,211,153,0.10)',
  warning: '#FBBF24',
  warningBg: 'rgba(251,191,36,0.10)',
  danger: '#F87171',
  dangerBg: 'rgba(248,113,113,0.10)'
};

// ── Button ────────────────────────────────────────────────
function Btn({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  onClick,
  style
}) {
  const [pressed, setPressed] = React.useState(false);
  const base = {
    fontFamily: 'Geist, sans-serif',
    fontWeight: 500,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 6,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 150ms ease',
    opacity: disabled ? 0.45 : 1,
    transform: pressed ? 'scale(0.97)' : 'scale(1)',
    ...style
  };
  const sizes = {
    sm: {
      fontSize: 13,
      padding: '6px 12px'
    },
    md: {
      fontSize: 14,
      padding: '9px 18px'
    },
    lg: {
      fontSize: 15,
      padding: '12px 24px'
    }
  };
  const variants = {
    primary: {
      background: DS.accent,
      color: DS.text1
    },
    secondary: {
      background: DS.surface2,
      color: DS.text1,
      border: `1px solid ${DS.border}`
    },
    ghost: {
      background: 'transparent',
      color: DS.text2,
      border: `1px solid ${DS.border}`
    },
    danger: {
      background: DS.dangerBg,
      color: DS.danger,
      border: `1px solid rgba(248,113,113,0.2)`
    },
    teal: {
      background: DS.tealBg,
      color: DS.teal,
      border: `1px solid rgba(45,212,191,0.2)`
    }
  };
  return /*#__PURE__*/React.createElement("button", {
    style: {
      ...base,
      ...sizes[size],
      ...variants[variant]
    },
    disabled: disabled,
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onMouseLeave: () => setPressed(false),
    onClick: onClick
  }, children);
}

// ── Badge ─────────────────────────────────────────────────
function Badge({
  children,
  variant = 'neutral',
  dot
}) {
  const variants = {
    success: {
      bg: DS.successBg,
      color: DS.success
    },
    warning: {
      bg: DS.warningBg,
      color: DS.warning
    },
    danger: {
      bg: DS.dangerBg,
      color: DS.danger
    },
    accent: {
      bg: DS.accentBg,
      color: DS.accentBright
    },
    teal: {
      bg: DS.tealBg,
      color: DS.teal
    },
    neutral: {
      bg: 'rgba(255,255,255,0.07)',
      color: DS.text2
    },
    info: {
      bg: 'rgba(96,165,250,0.12)',
      color: '#60A5FA'
    }
  };
  const v = variants[variant] || variants.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 11,
      fontWeight: 600,
      padding: '3px 9px',
      borderRadius: 9999,
      background: v.bg,
      color: v.color,
      whiteSpace: 'nowrap',
      letterSpacing: '0.02em'
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: v.color,
      flexShrink: 0
    }
  }), children);
}

// ── StatCard ──────────────────────────────────────────────
function StatCard({
  label,
  value,
  delta,
  deltaPositive = true,
  icon
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: DS.surface,
      border: `1px solid ${DS.border}`,
      borderRadius: 10,
      padding: '18px 20px',
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: DS.text3,
      textTransform: 'uppercase',
      letterSpacing: '0.08em'
    }
  }, label), icon && /*#__PURE__*/React.createElement("div", {
    style: {
      color: DS.text3
    }
  }, icon)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 28,
      fontWeight: 700,
      fontFamily: 'Geist, sans-serif',
      color: DS.text1,
      lineHeight: 1,
      marginBottom: 6
    }
  }, value), delta && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: deltaPositive ? DS.success : DS.danger
    }
  }, deltaPositive ? '↑' : '↓', " ", delta));
}

// ── Input ─────────────────────────────────────────────────
function Input({
  label,
  placeholder,
  value,
  onChange,
  error,
  type = 'text',
  helper
}) {
  const [focused, setFocused] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: DS.text2
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    type: type,
    placeholder: placeholder,
    value: value,
    onChange: onChange,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      fontFamily: 'Geist, sans-serif',
      fontSize: 14,
      color: DS.text1,
      background: DS.surface,
      border: `1px solid ${error ? 'rgba(248,113,113,0.5)' : focused ? 'rgba(123,108,246,0.6)' : DS.border}`,
      borderRadius: 6,
      padding: '9px 12px',
      outline: 'none',
      width: '100%',
      boxShadow: focused ? '0 0 0 3px rgba(123,108,246,0.15)' : 'none',
      transition: 'all 150ms ease'
    }
  }), error && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: DS.danger
    }
  }, error), helper && !error && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: DS.text3
    }
  }, helper));
}

// ── Avatar ────────────────────────────────────────────────
function Avatar({
  name,
  size = 32
}) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#7B6CF6', '#2DD4BF', '#F87171', '#FBBF24', '#34D399', '#60A5FA'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: color + '22',
      border: `1.5px solid ${color}55`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.35,
      fontWeight: 600,
      color,
      flexShrink: 0,
      fontFamily: 'Geist, sans-serif'
    }
  }, initials);
}

// ── Tag ───────────────────────────────────────────────────
function Tag({
  children,
  onRemove
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 11,
      fontWeight: 600,
      padding: '3px 8px',
      borderRadius: 4,
      background: 'rgba(255,255,255,0.07)',
      color: DS.text2
    }
  }, children, onRemove && /*#__PURE__*/React.createElement("span", {
    onClick: onRemove,
    style: {
      cursor: 'pointer',
      opacity: 0.6,
      fontSize: 13,
      lineHeight: 1
    }
  }, "\xD7"));
}

// ── Divider ───────────────────────────────────────────────
function Divider({
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: `1px solid ${DS.border}`,
      margin: '4px 0',
      ...style
    }
  });
}
Object.assign(window, {
  Btn,
  Badge,
  StatCard,
  Input,
  Avatar,
  Tag,
  Divider,
  DS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/majesnix/Components.jsx", error: String((e && e.message) || e) }); }

// ui_kits/majesnix/Dashboard.jsx
try { (() => {
// MajesNix — Screen components: Dashboard, Deployments, Environments, Logs, Settings, Team

// ── Dashboard Screen ──────────────────────────────────────
const DEPLOYMENTS = [{
  id: 'd1',
  name: 'api-gateway',
  env: 'production',
  status: 'success',
  branch: 'main',
  time: '2m ago',
  commit: 'a3f8c12'
}, {
  id: 'd2',
  name: 'web-frontend',
  env: 'production',
  status: 'success',
  branch: 'main',
  time: '14m ago',
  commit: '9d1e445'
}, {
  id: 'd3',
  name: 'worker-service',
  env: 'staging',
  status: 'building',
  branch: 'feat/v2',
  time: '21m ago',
  commit: 'c8b0223'
}, {
  id: 'd4',
  name: 'db-migrations',
  env: 'staging',
  status: 'failed',
  branch: 'fix/sql',
  time: '1h ago',
  commit: '5a7f991'
}, {
  id: 'd5',
  name: 'auth-service',
  env: 'production',
  status: 'success',
  branch: 'main',
  time: '3h ago',
  commit: '2e4d887'
}, {
  id: 'd6',
  name: 'cron-jobs',
  env: 'production',
  status: 'idle',
  branch: 'main',
  time: '6h ago',
  commit: 'f1c3340'
}];
const STATUS_VARIANT = {
  success: 'success',
  failed: 'danger',
  building: 'warning',
  idle: 'neutral'
};
const STATUS_LABEL = {
  success: 'Deployed',
  failed: 'Failed',
  building: 'Building',
  idle: 'Idle'
};
function DeployRow({
  d,
  onClick
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: () => onClick(d),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '12px 16px',
      borderBottom: `1px solid ${DS.border}`,
      cursor: 'pointer',
      transition: 'background 150ms'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: DS.text1,
      marginBottom: 2
    }
  }, d.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: DS.text3,
      fontFamily: 'Geist Mono, monospace'
    }
  }, d.branch, " \xB7 ", d.commit)), /*#__PURE__*/React.createElement(Badge, {
    variant: d.env === 'production' ? 'accent' : 'neutral'
  }, d.env), /*#__PURE__*/React.createElement(Badge, {
    variant: STATUS_VARIANT[d.status],
    dot: true
  }, STATUS_LABEL[d.status]), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: DS.text3,
      minWidth: 60,
      textAlign: 'right'
    }
  }, d.time));
}
function DashboardScreen({
  onNavigate
}) {
  const [selected, setSelected] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      maxWidth: 960,
      margin: '0 auto',
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Deployments today",
    value: "24",
    delta: "8 from yesterday",
    deltaPositive: true
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Active services",
    value: "12",
    delta: "2 new this week",
    deltaPositive: true
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Avg deploy time",
    value: "38s",
    delta: "4s faster",
    deltaPositive: true
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Failed builds",
    value: "1",
    delta: "3 fewer",
    deltaPositive: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: DS.surface,
      border: `1px solid ${DS.border}`,
      borderRadius: 10,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 16px',
      borderBottom: `1px solid ${DS.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: DS.text1
    }
  }, "Recent deployments"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm",
    onClick: () => onNavigate('deployments')
  }, "View all")), DEPLOYMENTS.map(d => /*#__PURE__*/React.createElement(DeployRow, {
    key: d.id,
    d: d,
    onClick: setSelected
  }))), selected && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      right: 0,
      top: 0,
      bottom: 0,
      width: 420,
      background: DS.surface,
      borderLeft: `1px solid ${DS.border}`,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      padding: '16px 20px',
      borderBottom: `1px solid ${DS.border}`,
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: DS.text1,
      marginBottom: 2
    }
  }, selected.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: STATUS_VARIANT[selected.status],
    dot: true
  }, STATUS_LABEL[selected.status]), /*#__PURE__*/React.createElement(Badge, {
    variant: "neutral"
  }, selected.env))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSelected(null),
    style: {
      background: 'none',
      border: 'none',
      color: DS.text3,
      cursor: 'pointer',
      fontSize: 20,
      lineHeight: 1
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Geist Mono, monospace',
      fontSize: 12,
      color: DS.text2,
      lineHeight: 1.8
    }
  }, ['Cloning repository…', `Checking out ${selected.branch}`, 'Installing dependencies…', 'Running build…', selected.status === 'failed' ? '✗ Build failed: exit code 1' : '✓ Build complete (38s)', selected.status !== 'failed' ? '✓ Deploying to ' + selected.env : '  See error log above', selected.status === 'success' ? '✓ Live at https://' + selected.name + '.majesnix.app' : ''].filter(Boolean).map((line, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      color: line.startsWith('✗') ? DS.danger : line.startsWith('✓') ? DS.success : DS.text2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: DS.text3,
      marginRight: 10
    }
  }, String(i + 1).padStart(2, '0')), line)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      borderTop: `1px solid ${DS.border}`,
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "secondary",
    size: "sm"
  }, "Re-deploy"), selected.status !== 'failed' && /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm"
  }, "Rollback"), selected.status === 'failed' && /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    size: "sm"
  }, "View full error"))));
}

// ── Deployments Screen ─────────────────────────────────────
function DeploymentsScreen() {
  const [filter, setFilter] = React.useState('all');
  const filters = ['all', 'success', 'building', 'failed'];
  const filtered = filter === 'all' ? DEPLOYMENTS : DEPLOYMENTS.filter(d => d.status === filter);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 960,
      margin: '0 auto',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      background: DS.surface2,
      padding: 4,
      borderRadius: 8,
      width: 'fit-content'
    }
  }, filters.map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    onClick: () => setFilter(f),
    style: {
      fontFamily: 'Geist, sans-serif',
      fontSize: 13,
      fontWeight: 500,
      border: 'none',
      cursor: 'pointer',
      padding: '6px 14px',
      borderRadius: 6,
      transition: 'all 150ms',
      background: filter === f ? DS.surface3 : 'transparent',
      color: filter === f ? DS.text1 : DS.text3
    }
  }, f.charAt(0).toUpperCase() + f.slice(1)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: DS.surface,
      border: `1px solid ${DS.border}`,
      borderRadius: 10,
      overflow: 'hidden'
    }
  }, filtered.length ? filtered.map(d => /*#__PURE__*/React.createElement(DeployRow, {
    key: d.id,
    d: d,
    onClick: () => {}
  })) : /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: DS.text3,
      fontSize: 14
    }
  }, "No deployments match this filter.")));
}

// ── Environments Screen ────────────────────────────────────
const ENVS = [{
  name: 'production',
  status: 'healthy',
  services: 8,
  domain: 'app.majesnix.app',
  updated: '2m ago'
}, {
  name: 'staging',
  status: 'warning',
  services: 6,
  domain: 'staging.majesnix.app',
  updated: '21m ago'
}, {
  name: 'development',
  status: 'healthy',
  services: 4,
  domain: 'dev.majesnix.app',
  updated: '2h ago'
}];
function EnvironmentsScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 960,
      margin: '0 auto',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, ENVS.map(env => /*#__PURE__*/React.createElement("div", {
    key: env.name,
    style: {
      background: DS.surface,
      border: `1px solid ${DS.border}`,
      borderRadius: 10,
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 10,
      background: env.status === 'healthy' ? DS.successBg : DS.warningBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: env.status === 'healthy' ? DS.success : DS.warning,
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: DS.text1,
      marginBottom: 3,
      textTransform: 'capitalize'
    }
  }, env.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: DS.text3,
      fontFamily: 'Geist Mono, monospace'
    }
  }, env.domain)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      fontFamily: 'Geist, sans-serif',
      color: DS.text1
    }
  }, env.services), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: DS.text3
    }
  }, "services")), /*#__PURE__*/React.createElement(Badge, {
    variant: env.status === 'healthy' ? 'success' : 'warning',
    dot: true
  }, env.status), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: DS.text3,
      minWidth: 70,
      textAlign: 'right'
    }
  }, env.updated), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm"
  }, "Manage"))), /*#__PURE__*/React.createElement(Btn, {
    variant: "secondary",
    size: "sm",
    style: {
      alignSelf: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12"
  })), "Add environment"));
}

// ── Settings Screen ────────────────────────────────────────
function SettingsScreen() {
  const [wsName, setWsName] = React.useState('my-workspace');
  const [region, setRegion] = React.useState('us-east-1');
  const [notify, setNotify] = React.useState(true);
  const [saved, setSaved] = React.useState(false);
  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 640,
      margin: '0 auto',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: DS.surface,
      border: `1px solid ${DS.border}`,
      borderRadius: 10,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 20px',
      borderBottom: `1px solid ${DS.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: DS.text1
    }
  }, "Workspace")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Workspace name",
    value: wsName,
    onChange: e => setWsName(e.target.value),
    helper: "Used in URLs and display."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: DS.text2
    }
  }, "Default region"), /*#__PURE__*/React.createElement("select", {
    value: region,
    onChange: e => setRegion(e.target.value),
    style: {
      fontFamily: 'Geist, sans-serif',
      fontSize: 14,
      color: DS.text1,
      background: DS.surface,
      border: `1px solid ${DS.border}`,
      borderRadius: 6,
      padding: '9px 12px',
      outline: 'none',
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "us-east-1"
  }, "US East (N. Virginia)"), /*#__PURE__*/React.createElement("option", {
    value: "eu-west-1"
  }, "EU West (Ireland)"), /*#__PURE__*/React.createElement("option", {
    value: "ap-southeast-1"
  }, "Asia Pacific (Singapore)"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: DS.surface,
      border: `1px solid ${DS.border}`,
      borderRadius: 10,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 20px',
      borderBottom: `1px solid ${DS.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: DS.text1
    }
  }, "Notifications")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: DS.text1,
      marginBottom: 2
    }
  }, "Deployment alerts"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: DS.text3
    }
  }, "Get notified on failed builds and deploys.")), /*#__PURE__*/React.createElement("div", {
    onClick: () => setNotify(!notify),
    style: {
      width: 40,
      height: 22,
      borderRadius: 11,
      background: notify ? DS.accent : DS.surface3,
      position: 'relative',
      cursor: 'pointer',
      transition: 'background 200ms'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 16,
      height: 16,
      borderRadius: '50%',
      background: '#fff',
      position: 'absolute',
      top: 3,
      left: notify ? 21 : 3,
      transition: 'left 200ms ease'
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: DS.surface,
      border: `1px solid rgba(248,113,113,0.2)`,
      borderRadius: 10,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 20px',
      borderBottom: `1px solid rgba(248,113,113,0.12)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: DS.danger
    }
  }, "Danger zone")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: DS.text1,
      marginBottom: 2
    }
  }, "Delete workspace"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: DS.text3
    }
  }, "Permanently delete this workspace and all its data.")), /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    size: "sm"
  }, "Delete workspace"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost"
  }, "Discard"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: save
  }, saved ? '✓ Saved' : 'Save changes')));
}

// ── Team Screen ────────────────────────────────────────────
const MEMBERS = [{
  name: 'Alex Chen',
  role: 'Owner',
  email: 'alex@majesnix.app',
  joined: 'Jan 2024'
}, {
  name: 'Sam Rivera',
  role: 'Admin',
  email: 'sam@majesnix.app',
  joined: 'Mar 2024'
}, {
  name: 'Jordan Kim',
  role: 'Developer',
  email: 'jordan@company.io',
  joined: 'Jun 2024'
}, {
  name: 'Taylor Osei',
  role: 'Developer',
  email: 'taylor@company.io',
  joined: 'Sep 2024'
}, {
  name: 'Morgan Liu',
  role: 'Viewer',
  email: 'morgan@partner.com',
  joined: 'Dec 2024'
}];
const ROLE_VARIANT = {
  Owner: 'accent',
  Admin: 'teal',
  Developer: 'neutral',
  Viewer: 'neutral'
};
function TeamScreen() {
  const [invite, setInvite] = React.useState('');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720,
      margin: '0 auto',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "colleague@example.com",
    value: invite,
    onChange: e => setInvite(e.target.value)
  })), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: () => setInvite('')
  }, "Send invite")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: DS.surface,
      border: `1px solid ${DS.border}`,
      borderRadius: 10,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 20px',
      borderBottom: `1px solid ${DS.border}`,
      fontSize: 14,
      fontWeight: 600,
      color: DS.text1
    }
  }, "Members \xB7 ", MEMBERS.length), MEMBERS.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '12px 20px',
      borderBottom: i < MEMBERS.length - 1 ? `1px solid ${DS.border}` : 'none'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: m.name,
    size: 36
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: DS.text1
    }
  }, m.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: DS.text3
    }
  }, m.email)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: DS.text3
    }
  }, "Joined ", m.joined), /*#__PURE__*/React.createElement(Badge, {
    variant: ROLE_VARIANT[m.role]
  }, m.role), m.role !== 'Owner' && /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    size: "sm"
  }, "Remove")))));
}

// ── Logs Screen ────────────────────────────────────────────
const LOG_LINES = [{
  t: '14:31:02',
  level: 'info',
  msg: 'api-gateway: request POST /v1/deploy 200 OK (42ms)'
}, {
  t: '14:31:03',
  level: 'info',
  msg: 'worker-service: job queue flushed — 12 items processed'
}, {
  t: '14:31:05',
  level: 'warn',
  msg: 'db-primary: connection pool at 87% capacity'
}, {
  t: '14:31:07',
  level: 'error',
  msg: 'db-migrations: ERROR: relation "schema_v3" already exists'
}, {
  t: '14:31:08',
  level: 'info',
  msg: 'auth-service: token refresh for user:9a3f… success'
}, {
  t: '14:31:10',
  level: 'info',
  msg: 'api-gateway: request GET /v1/status 200 OK (6ms)'
}, {
  t: '14:31:11',
  level: 'warn',
  msg: 'cron-jobs: scheduled task "cleanup" delayed by 4s'
}, {
  t: '14:31:14',
  level: 'info',
  msg: 'web-frontend: CDN cache invalidated — 24 assets purged'
}];
const LEVEL_COLOR = {
  info: DS.text2,
  warn: DS.warning,
  error: DS.danger
};
const LEVEL_BG = {
  info: 'transparent',
  warn: 'rgba(251,191,36,0.04)',
  error: 'rgba(248,113,113,0.06)'
};
function LogsScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 960,
      margin: '0 auto',
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: DS.surface,
      border: `1px solid ${DS.border}`,
      borderRadius: 10,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      borderBottom: `1px solid ${DS.border}`,
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: "success",
    dot: true
  }, "Live"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: DS.text3
    }
  }, "Streaming from all services")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'Geist Mono, monospace',
      fontSize: 12,
      lineHeight: 1.8
    }
  }, LOG_LINES.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 16,
      padding: '5px 16px',
      background: LEVEL_BG[l.level]
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: DS.text3,
      flexShrink: 0
    }
  }, l.t), /*#__PURE__*/React.createElement("span", {
    style: {
      color: LEVEL_COLOR[l.level],
      textTransform: 'uppercase',
      flexShrink: 0,
      minWidth: 40
    }
  }, l.level), /*#__PURE__*/React.createElement("span", {
    style: {
      color: DS.text2
    }
  }, l.msg))))));
}
Object.assign(window, {
  DashboardScreen,
  DeploymentsScreen,
  EnvironmentsScreen,
  SettingsScreen,
  TeamScreen,
  LogsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/majesnix/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/majesnix/Shell.jsx
try { (() => {
// MajesNix — App Shell: Sidebar + Topbar layout

function NavIcon({
  d,
  viewBox = "0 0 24 24"
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: viewBox,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, Array.isArray(d) ? d.map((path, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: path
  })) : /*#__PURE__*/React.createElement("path", {
    d: d
  }));
}
const NAV_ITEMS = [{
  id: 'dashboard',
  label: 'Dashboard',
  section: 'Workspace',
  icon: /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "7",
    height: "7",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "3",
    width: "7",
    height: "7",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "14",
    width: "7",
    height: "7",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "14",
    width: "7",
    height: "7",
    rx: "1"
  }))
}, {
  id: 'deployments',
  label: 'Deployments',
  icon: /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 2L2 7l10 5 10-5-10-5z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2 17l10 5 10-5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2 12l10 5 10-5"
  }))
}, {
  id: 'environments',
  label: 'Environments',
  icon: /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"
  }))
}, {
  id: 'logs',
  label: 'Logs',
  icon: /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "14,2 14,8 20,8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "13",
    x2: "8",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "17",
    x2: "8",
    y2: "17"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "10,9 9,9 8,9"
  }))
}, {
  id: 'settings',
  label: 'Settings',
  section: 'Account',
  icon: /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"
  }))
}, {
  id: 'team',
  label: 'Team',
  icon: /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "7",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
  }))
}];
function Sidebar({
  activeScreen,
  onNavigate
}) {
  const sections = [];
  let currentSection = null;
  NAV_ITEMS.forEach(item => {
    if (item.section) {
      currentSection = item.section;
      sections.push({
        type: 'section',
        label: item.section
      });
    }
    sections.push({
      type: 'item',
      ...item
    });
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 220,
      flexShrink: 0,
      background: DS.surface,
      borderRight: `1px solid ${DS.border}`,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '0 10px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 8px 14px',
      borderBottom: `1px solid ${DS.border}`,
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 7,
      background: DS.accentBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 56 48",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 36V12L16 28L28 12V36",
    stroke: "#7B6CF6",
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M36 36V12L52 36V12",
    stroke: "#2DD4BF",
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'Geist, sans-serif',
      fontWeight: 700,
      fontSize: 16,
      color: DS.text1
    }
  }, "Majes", /*#__PURE__*/React.createElement("span", {
    style: {
      color: DS.accent
    }
  }, "Nix"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 1
    }
  }, sections.map((s, i) => s.type === 'section' ? /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      color: DS.text3,
      padding: '10px 10px 4px'
    }
  }, s.label) : /*#__PURE__*/React.createElement("div", {
    key: s.id,
    onClick: () => onNavigate(s.id),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '8px 10px',
      borderRadius: 7,
      fontSize: 13,
      fontWeight: 500,
      cursor: 'pointer',
      color: activeScreen === s.id ? DS.accentBright : DS.text2,
      background: activeScreen === s.id ? DS.accentBg : 'transparent',
      transition: 'all 150ms ease'
    },
    onMouseEnter: e => {
      if (activeScreen !== s.id) {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        e.currentTarget.style.color = DS.text1;
      }
    },
    onMouseLeave: e => {
      if (activeScreen !== s.id) {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = DS.text2;
      }
    }
  }, s.icon, s.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '10px 8px 0',
      borderTop: `1px solid ${DS.border}`,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Alex Chen",
    size: 28
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: DS.text1
    }
  }, "Alex Chen"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: DS.text3
    }
  }, "Pro plan")), /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: DS.text3,
    strokeWidth: "1.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "12",
    r: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "5",
    cy: "12",
    r: "1"
  }))));
}
function Topbar({
  title,
  onNavigate
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 52,
      borderBottom: `1px solid ${DS.border}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 12,
      background: DS.surface,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 15,
      fontWeight: 600,
      fontFamily: 'Geist, sans-serif',
      color: DS.text1
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: DS.surface2,
      border: `1px solid ${DS.border}`,
      borderRadius: 6,
      padding: '6px 12px',
      cursor: 'text'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: DS.text3,
    strokeWidth: "1.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    y1: "21",
    x2: "16.65",
    y2: "16.65"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: DS.text3
    }
  }, "Search\u2026"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: DS.text3,
      background: DS.surface3,
      padding: '1px 5px',
      borderRadius: 3,
      fontFamily: 'Geist Mono, monospace'
    }
  }, "\u2318K")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 6,
      background: DS.surface2,
      border: `1px solid ${DS.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: DS.text2,
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M13.73 21a2 2 0 01-3.46 0"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: DS.accent,
      position: 'absolute',
      top: 6,
      right: 6,
      border: `1.5px solid ${DS.surface}`
    }
  })), /*#__PURE__*/React.createElement(Avatar, {
    name: "Alex Chen",
    size: 32
  }));
}
function Shell({
  activeScreen,
  onNavigate,
  title,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: '100vh',
      background: DS.bg,
      fontFamily: 'Geist, sans-serif',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    activeScreen: activeScreen,
    onNavigate: onNavigate
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(Topbar, {
    title: title,
    onNavigate: onNavigate
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: 24
    }
  }, children)));
}
Object.assign(window, {
  Shell,
  Sidebar,
  Topbar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/majesnix/Shell.jsx", error: String((e && e.message) || e) }); }

})();
