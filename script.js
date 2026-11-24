const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
const themeToggle = document.querySelector('.theme-toggle');
const savedTheme = localStorage.getItem('maria-beauty-theme');

const applyTheme = (theme) => {
  const darkMode = theme === 'dark';
  document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
  themeToggle.setAttribute('aria-pressed', String(darkMode));
  themeToggle.setAttribute('aria-label', darkMode ? 'Ativar modo claro' : 'Ativar modo escuro');
  themeToggle.querySelector('.theme-icon').innerHTML = darkMode
    ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>'
    : '<path d="M20.2 15.2A8.4 8.4 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z"/>';
};
applyTheme(savedTheme || 'light');
themeToggle.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('maria-beauty-theme', nextTheme);
  applyTheme(nextTheme);
});
menuToggle.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});
document.querySelectorAll('.main-nav a').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
});
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('is-visible'); });
}, { threshold: 0.12 });
document.querySelectorAll('.service-card, .gallery-item, .values div').forEach((element) => {
  element.classList.add('reveal');
  observer.observe(element);
});

const catalogServices = [
  'Alongamento molde F1', 'Soft gel', 'Blindagem', 'Blindagem nos pés', 'Esmaltação em gel',
  'Remoção de gel', 'Reposição cada unha', 'Troca de formato', 'Manicure tradicional', 'Pedicure', 'Manicure e pedicure',
];
const formatMoney = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const api = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Falha na requisição (${response.status}).`);
  return data;
};

let prices = {};
let sales = [];
const syncPublicPrices = () => {
  document.querySelectorAll('.price-table tbody tr').forEach((row) => {
    const service = row.cells[0].textContent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const entry = Object.entries(prices).find(([name]) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === service);
    if (entry) row.cells[1].textContent = formatMoney(entry[1]);
  });
};
const loadPublicPrices = async () => {
  try {
    const data = await api('/api/prices');
    prices = Object.fromEntries(data.prices.map(({ service, price }) => [service, price]));
    syncPublicPrices();
  } catch (error) {
    console.error('Não foi possível carregar os preços do servidor:', error);
  }
};
loadPublicPrices();

const adminPanel = document.querySelector('#admin-panel');
const adminOpenButton = document.querySelector('#admin-open');
const adminCloseButton = document.querySelector('#admin-close');
const priceFields = document.querySelector('.admin-price-fields');
const priceForm = document.querySelector('#admin-price-form');
const priceFeedback = document.querySelector('#price-feedback');
const saleForm = document.querySelector('#sale-form');
const saleService = document.querySelector('#sale-service');
const saleValue = document.querySelector('#sale-value');
const saleDate = document.querySelector('#sale-date');
const adminAuth = document.querySelector('#admin-auth');
const authForm = document.querySelector('#admin-auth-form');
const authError = document.querySelector('#auth-error');
let authMode = 'login';
let previousFocus;

const renderPriceEditor = () => {
  priceFields.replaceChildren();
  catalogServices.forEach((service) => {
    const label = document.createElement('label');
    label.className = 'admin-price-row';
    const name = document.createElement('span');
    name.textContent = service;
    const currency = document.createElement('span');
    currency.className = 'admin-currency-field';
    currency.append('R$ ');
    const input = document.createElement('input');
    Object.assign(input, { type: 'number', min: '0', step: '0.01', required: true, value: Number(prices[service] ?? 0).toFixed(2) });
    input.dataset.service = service;
    input.setAttribute('aria-label', `Preço para ${service}`);
    currency.append(input);
    label.append(name, currency);
    priceFields.append(label);
  });
};

const setSaleDateNow = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  saleDate.value = now.toISOString().slice(0, 16);
};

const renderServiceOptions = () => {
  saleService.replaceChildren();
  catalogServices.forEach((service) => {
    const option = document.createElement('option');
    option.value = service;
    option.textContent = service;
    saleService.append(option);
  });
  saleValue.value = Number(prices[saleService.value] || 0).toFixed(2);
};

const renderSales = (dashboard) => {
  sales = dashboard.sales;
  const { revenue, count, average, byService } = dashboard.summary;
  document.querySelector('#sales-total').textContent = formatMoney(revenue);
  document.querySelector('#sales-count').textContent = String(count);
  document.querySelector('#sales-average').textContent = formatMoney(average);
  const breakdown = document.querySelector('#service-breakdown');
  breakdown.replaceChildren();
  if (!byService.length) {
    const empty = document.createElement('p');
    empty.className = 'admin-empty';
    empty.textContent = 'Nenhuma venda registrada.';
    breakdown.append(empty);
  }
  byService.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'breakdown-row';
    const label = document.createElement('span');
    label.textContent = `${item.service} · ${item.count} ${item.count === 1 ? 'venda' : 'vendas'}`;
    const value = document.createElement('strong');
    value.textContent = formatMoney(item.total);
    row.append(label, value);
    breakdown.append(row);
  });

  const list = document.querySelector('#sales-list');
  list.replaceChildren();
  if (!sales.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.className = 'admin-empty';
    cell.textContent = 'Nenhuma venda registrada.';
    row.append(cell);
    list.append(row);
  }
  sales.forEach((sale) => {
    const row = document.createElement('tr');
    const date = document.createElement('td');
    date.textContent = new Date(sale.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const service = document.createElement('td');
    service.textContent = sale.service;
    const amount = document.createElement('td');
    amount.textContent = formatMoney(sale.amount);
    const action = document.createElement('td');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'sale-remove';
    remove.textContent = 'Excluir';
    remove.setAttribute('aria-label', `Excluir venda de ${sale.service}`);
    remove.addEventListener('click', async () => {
      if (!window.confirm(`Excluir o lançamento de ${sale.service}?`)) return;
      try {
        await api(`/api/admin/sales/${sale.id}`, { method: 'DELETE' });
        await loadAdminData();
      } catch (error) { window.alert(error.message); }
    });
    action.append(remove);
    row.append(date, service, amount, action);
    list.append(row);
  });
};

const loadAdminData = async () => {
  const [priceData, dashboard] = await Promise.all([api('/api/prices'), api('/api/admin/dashboard')]);
  prices = Object.fromEntries(priceData.prices.map(({ service, price }) => [service, price]));
  syncPublicPrices();
  renderPriceEditor();
  renderServiceOptions();
  renderSales(dashboard);
};

const openAdmin = async () => {
  try {
    await loadAdminData();
    setSaleDateNow();
    adminPanel.hidden = false;
    document.body.classList.add('admin-open');
    adminCloseButton.focus();
  } catch (error) {
    adminAuth.hidden = false;
    authError.textContent = error.message;
  }
};

const showAuth = (mode) => {
  authMode = mode;
  authError.textContent = '';
  authForm.reset();
  const login = mode === 'login';
  document.querySelector('#admin-auth-title').textContent = login ? 'Acesso administrativo' : 'Alterar senha';
  document.querySelector('#admin-auth-description').textContent = login
    ? 'Entre com seu usuário e senha para acessar o painel.'
    : 'Informe sua senha atual para definir uma nova senha.';
  document.querySelector('#auth-username-label').hidden = !login;
  document.querySelector('#auth-current-label').firstChild.textContent = login ? 'Senha' : 'Senha atual';
  document.querySelector('#auth-new-label').hidden = login;
  document.querySelector('#auth-confirm-label').hidden = login;
  document.querySelector('#auth-submit').textContent = login ? 'Entrar' : 'Alterar senha';
  authForm.querySelector('#auth-username').required = login;
  authForm.querySelector('#auth-current-password').autocomplete = login ? 'current-password' : 'current-password';
  document.querySelector('#auth-new-password').required = !login;
  document.querySelector('#auth-confirm-password').required = !login;
  adminAuth.hidden = false;
  (login ? authForm.querySelector('#auth-username') : authForm.querySelector('#auth-current-password')).focus();
};

const closeAuth = () => {
  adminAuth.hidden = true;
  authForm.reset();
  previousFocus?.focus();
};
const closeAdmin = async () => {
  adminPanel.hidden = true;
  document.body.classList.remove('admin-open');
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  previousFocus?.focus();
};

adminOpenButton.addEventListener('click', () => {
  previousFocus = document.activeElement;
  showAuth('login');
});
adminCloseButton.addEventListener('click', closeAdmin);
document.querySelector('#admin-password-change').addEventListener('click', () => {
  previousFocus = document.querySelector('#admin-password-change');
  showAuth('change');
});
document.querySelector('#admin-auth-close').addEventListener('click', closeAuth);
document.querySelector('#auth-cancel').addEventListener('click', closeAuth);
adminAuth.addEventListener('click', (event) => { if (event.target === adminAuth) closeAuth(); });
adminPanel.addEventListener('click', (event) => { if (event.target === adminPanel) closeAdmin(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !adminAuth.hidden) closeAuth();
  else if (event.key === 'Escape' && !adminPanel.hidden) closeAdmin();
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  authError.textContent = '';
  const currentPassword = authForm.querySelector('#auth-current-password').value;
  try {
    if (authMode === 'login') {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: authForm.querySelector('#auth-username').value, password: currentPassword }) });
      adminAuth.hidden = true;
      await openAdmin();
      return;
    }
    const newPassword = authForm.querySelector('#auth-new-password').value;
    const confirmation = authForm.querySelector('#auth-confirm-password').value;
    if (newPassword.length < 12) throw new Error('A nova senha deve ter pelo menos 12 caracteres.');
    if (newPassword !== confirmation) throw new Error('As novas senhas não coincidem.');
    await api('/api/admin/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
    authError.textContent = 'Senha alterada com sucesso.';
    window.setTimeout(closeAuth, 800);
  } catch (error) {
    authError.textContent = error.message;
    authForm.querySelector('#auth-current-password').select();
  }
});

priceForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = Object.fromEntries([...priceFields.querySelectorAll('input[data-service]')].map((input) => [input.dataset.service, Number(input.value)]));
  try {
    await api('/api/admin/prices', { method: 'PUT', body: JSON.stringify({ prices: values }) });
    prices = values;
    syncPublicPrices();
    renderServiceOptions();
    priceFeedback.textContent = 'Preços atualizados.';
    window.setTimeout(() => { priceFeedback.textContent = ''; }, 3500);
  } catch (error) {
    priceFeedback.textContent = error.message;
  }
});

saleService.addEventListener('change', () => {
  saleValue.value = Number(prices[saleService.value] || 0).toFixed(2);
});
saleForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const service = saleService.value;
  const amount = Number(saleValue.value);
  try {
    await api('/api/admin/sales', {
      method: 'POST',
      body: JSON.stringify({ service, amount, createdAt: new Date(saleDate.value).toISOString() }),
    });
    await loadAdminData();
    setSaleDateNow();
  } catch (error) {
    window.alert(error.message);
  }
});
