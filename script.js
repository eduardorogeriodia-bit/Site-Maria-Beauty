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

const catalogPrices = [
  ['Alongamento molde F1', 75], ['Soft gel', 75], ['Blindagem', 50], ['Blindagem nos pés', 40],
  ['Esmaltação em gel', 35], ['Remoção de gel', 20], ['Reposição cada unha', 10],
  ['Troca de formato', 10], ['Manicure tradicional', 35], ['Pedicure', 35], ['Manicure e pedicure', 60],
];
const testAccount = { username: 'admin', password: 'teste123' };
const storageKeys = { prices: 'maria-beauty-demo-prices', sales: 'maria-beauty-demo-sales', account: 'maria-beauty-demo-account' };
const readStorage = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
};
const formatMoney = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
let prices = { ...Object.fromEntries(catalogPrices), ...readStorage(storageKeys.prices, {}) };
let sales = readStorage(storageKeys.sales, []);
let account = readStorage(storageKeys.account, testAccount);
const saveStorage = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const normalizeService = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const syncPublicPrices = () => {
  const normalized = new Map(Object.entries(prices).map(([service, price]) => [normalizeService(service), Number(price)]));
  document.querySelectorAll('.price-table tbody tr').forEach((row) => {
    const price = normalized.get(normalizeService(row.cells[0].textContent));
    if (price !== undefined) row.cells[1].textContent = formatMoney(price);
  });
};
syncPublicPrices();

const adminPanel = document.querySelector('#admin-panel');
const adminAuth = document.querySelector('#admin-auth');
const authForm = document.querySelector('#admin-auth-form');
const authError = document.querySelector('#auth-error');
const priceFields = document.querySelector('.admin-price-fields');
const saleForm = document.querySelector('#sale-form');
const saleService = document.querySelector('#sale-service');
const saleValue = document.querySelector('#sale-value');
const saleDate = document.querySelector('#sale-date');
let authMode = 'login';
let previousFocus;

const renderPriceEditor = () => {
  priceFields.replaceChildren();
  catalogPrices.forEach(([service]) => {
    const label = document.createElement('label');
    label.className = 'admin-price-row';
    const name = document.createElement('span');
    name.textContent = service;
    const currency = document.createElement('span');
    currency.className = 'admin-currency-field';
    currency.append('R$ ');
    const input = document.createElement('input');
    Object.assign(input, { type: 'number', min: '0', step: '0.01', required: true, value: Number(prices[service] || 0).toFixed(2) });
    input.dataset.service = service;
    input.setAttribute('aria-label', `Preço para ${service}`);
    currency.append(input);
    label.append(name, currency);
    priceFields.append(label);
  });
};

const renderServiceOptions = () => {
  saleService.replaceChildren();
  catalogPrices.forEach(([service]) => {
    const option = document.createElement('option');
    option.value = service;
    option.textContent = service;
    saleService.append(option);
  });
  saleValue.value = Number(prices[saleService.value] || 0).toFixed(2);
};

const setSaleDateNow = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  saleDate.value = now.toISOString().slice(0, 16);
};

const openAdmin = () => {
  renderPriceEditor();
  renderServiceOptions();
  renderSales();
  setSaleDateNow();
  adminPanel.hidden = false;
  document.body.classList.add('admin-open');
  document.querySelector('#admin-close').focus();
};

const renderSales = () => {
  const total = sales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  document.querySelector('#sales-total').textContent = formatMoney(total);
  document.querySelector('#sales-count').textContent = String(sales.length);
  document.querySelector('#sales-average').textContent = formatMoney(sales.length ? total / sales.length : 0);
  const byService = new Map();
  sales.forEach((sale) => byService.set(sale.service, (byService.get(sale.service) || 0) + Number(sale.amount || 0)));
  const breakdown = document.querySelector('#service-breakdown');
  breakdown.replaceChildren();
  if (!byService.size) {
    const empty = document.createElement('p');
    empty.className = 'admin-empty';
    empty.textContent = 'As vendas registradas aparecerão aqui.';
    breakdown.append(empty);
  } else {
    [...byService.entries()].sort((a, b) => b[1] - a[1]).forEach(([service, amount]) => {
      const row = document.createElement('div');
      row.className = 'breakdown-row';
      const name = document.createElement('span');
      name.textContent = service;
      const value = document.createElement('strong');
      value.textContent = formatMoney(amount);
      row.append(name, value);
      breakdown.append(row);
    });
  }
  const list = document.querySelector('#sales-list');
  list.replaceChildren();
  [...sales].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach((sale) => {
    const row = document.createElement('tr');
    const date = document.createElement('td');
    date.textContent = new Date(sale.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const service = document.createElement('td');
    service.textContent = sale.service;
    const amount = document.createElement('td');
    amount.textContent = formatMoney(sale.amount);
    const action = document.createElement('td');
    const remove = document.createElement('button');
    remove.className = 'sale-remove';
    remove.type = 'button';
    remove.textContent = 'Excluir';
    remove.setAttribute('aria-label', `Excluir venda de ${sale.service}`);
    remove.addEventListener('click', () => {
      sales = sales.filter((item) => item.id !== sale.id);
      saveStorage(storageKeys.sales, sales);
      renderSales();
    });
    action.append(remove);
    row.append(date, service, amount, action);
    list.append(row);
  });
};

const showAuth = (mode) => {
  authMode = mode;
  authError.textContent = '';
  authForm.reset();
  const changing = mode === 'change';
  document.querySelector('#auth-username-label').hidden = changing;
  document.querySelector('#auth-new-label').hidden = !changing;
  document.querySelector('#auth-confirm-label').hidden = !changing;
  document.querySelector('#admin-auth-title').textContent = changing ? 'Alterar senha' : 'Acesso de demonstração';
  document.querySelector('.admin-auth-description').textContent = changing ? 'Confirme a senha atual para cadastrar uma nova.' : 'Use as credenciais de teste para abrir o painel demonstrativo.';
  document.querySelector('#auth-submit').textContent = changing ? 'Salvar nova senha' : 'Entrar';
  adminAuth.hidden = false;
  document.querySelector(changing ? '#auth-current-password' : '#auth-username').focus();
};

const closeAuth = () => { adminAuth.hidden = true; authForm.reset(); authError.textContent = ''; };
const closeAdmin = () => {
  closeAuth();
  adminPanel.hidden = true;
  document.body.classList.remove('admin-open');
  previousFocus?.focus();
};

document.querySelector('#admin-open').addEventListener('click', (event) => {
  previousFocus = event.currentTarget;
  showAuth('login');
});
document.querySelector('#admin-auth-close').addEventListener('click', closeAuth);
document.querySelector('#auth-cancel').addEventListener('click', closeAuth);
document.querySelector('#admin-close').addEventListener('click', closeAdmin);
document.querySelector('#admin-password-change').addEventListener('click', () => showAuth('change'));
adminAuth.addEventListener('click', (event) => { if (event.target === adminAuth) closeAuth(); });
adminPanel.addEventListener('click', (event) => { if (event.target === adminPanel) closeAdmin(); });
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!adminAuth.hidden) closeAuth();
  else if (!adminPanel.hidden) closeAdmin();
});

authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const currentPassword = document.querySelector('#auth-current-password').value;
  if (authMode === 'login') {
    const username = document.querySelector('#auth-username').value.trim();
    if (username !== account.username || currentPassword !== account.password) {
      authError.textContent = 'Usuário ou senha incorretos.';
      return;
    }
    closeAuth();
    openAdmin();
    return;
  }
  const newPassword = document.querySelector('#auth-new-password').value;
  const confirmPassword = document.querySelector('#auth-confirm-password').value;
  if (currentPassword !== account.password) { authError.textContent = 'A senha atual está incorreta.'; return; }
  if (newPassword.length < 6) { authError.textContent = 'A nova senha deve ter pelo menos 6 caracteres.'; return; }
  if (newPassword !== confirmPassword) { authError.textContent = 'As novas senhas não coincidem.'; return; }
  account = { ...account, password: newPassword };
  saveStorage(storageKeys.account, account);
  closeAuth();
  document.querySelector('#admin-password-change').focus();
});

document.querySelector('#admin-price-form').addEventListener('submit', (event) => {
  event.preventDefault();
  priceFields.querySelectorAll('input[data-service]').forEach((input) => { prices[input.dataset.service] = Number(input.value); });
  saveStorage(storageKeys.prices, prices);
  syncPublicPrices();
  renderServiceOptions();
  document.querySelector('#price-feedback').textContent = 'Preços salvos neste navegador.';
  window.setTimeout(() => { document.querySelector('#price-feedback').textContent = ''; }, 3500);
});
saleService.addEventListener('change', () => { saleValue.value = Number(prices[saleService.value] || 0).toFixed(2); });
saleForm.addEventListener('submit', (event) => {
  event.preventDefault();
  sales.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, service: saleService.value, amount: Number(saleValue.value), createdAt: new Date(saleDate.value).toISOString() });
  saveStorage(storageKeys.sales, sales);
  renderSales();
  setSaleDateNow();
});
