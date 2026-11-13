import './style.css'
import './arg/home.css'
import { setupDiscovery } from './arg/home'

// Keep the public footer year current.
const yearEl = document.getElementById('footer-year')
if (yearEl) yearEl.textContent = String(new Date().getFullYear())
setupDiscovery()
