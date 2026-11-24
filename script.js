const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
const themeToggle = document.querySelector('.theme-toggle');
const savedTheme = localStorage.getItem('maria-beauty-theme');

const applyTheme = (theme) => {
  const darkMode = theme === 'dark';
  document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
  themeToggle.setAttribute('aria-pressed', String(darkMode));
  themeToggle.setAttribute('aria-label', darkMode ? 'Ativar modo claro' : 'Ativar modo escuro');
  themeToggle.querySelector('.theme-icon').textContent = darkMode ? '☀' : '☾';
  themeToggle.querySelector('.theme-label').textContent = darkMode ? 'Modo claro' : 'Modo escuro';
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
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('is-visible');
  });
}, { threshold: 0.12 });

document.querySelectorAll('.service-card, .gallery-item, .values div').forEach((element) => {
  element.classList.add('reveal');
  observer.observe(element);
});
