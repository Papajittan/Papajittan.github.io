import './style.css'

// ponytail: only JS on the page — inject current year
const yearEl = document.getElementById('footer-year')
if (yearEl) yearEl.textContent = String(new Date().getFullYear())
