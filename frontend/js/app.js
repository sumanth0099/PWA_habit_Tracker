/**
 * app.js — Main application logic for PWA Habit Tracker
 */

import { initAPI, getHabits, addHabit, completeHabit, deleteHabit, refreshSyncStatus } from './api.js';
import { initNotifications } from './notifications.js';

// ─── State ────────────────────────────────────────────────────────────────────
let habits = [];
let swRegistration = null;
let selectedColor = '#6C63FF';

const COLORS = ['#6C63FF', '#FF6584', '#43BCCD', '#F9C74F', '#06D6A0', '#EF476F', '#FFB703', '#8338EC'];

// ─── DOM References ───────────────────────────────────────────────────────────
const habitListEl = document.getElementById('habit-list');
const addHabitForm = document.getElementById('add-habit-form');
const habitNameInput = document.getElementById('habit-name-input');
const swStateEl = document.querySelector('[data-testid="sw-state"]');
const cacheVersionEl = document.querySelector('[data-testid="cache-version"]');
const syncStatusEl = document.querySelector('[data-testid="sync-status"]');
const toastContainer = document.getElementById('toast-container');
const calendarEl = document.getElementById('calendar-view');
const colorPickerEl = document.getElementById('color-picker');

// ─── Service Worker Registration ──────────────────────────────────────────────
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[App] Service Workers not supported.');
    updateSWState('unsupported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[App] SW registered:', registration.scope);

    // Track service worker state
    trackSWState(registration);

    // Listen for messages from the service worker
    navigator.serviceWorker.addEventListener('message', handleSWMessage);

    // Request cache version from active SW
    if (registration.active) {
      registration.active.postMessage({ type: 'GET_CACHE_VERSION' });
    }

    swRegistration = registration;
    return registration;
  } catch (err) {
    console.error('[App] SW registration failed:', err);
    updateSWState('failed');
    return null;
  }
}

function trackSWState(registration) {
  const getState = () => {
    if (registration.installing) return 'installing';
    if (registration.waiting) return 'waiting';
    if (registration.active) return registration.active.state;
    return 'unknown';
  };

  const update = () => {
    const state = getState();
    updateSWState(state);
    // After activation, request cache version
    if (state === 'activated' && registration.active) {
      registration.active.postMessage({ type: 'GET_CACHE_VERSION' });
    }
  };

  update();

  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    newWorker?.addEventListener('statechange', update);
    update();
  });

  // Poll SW state periodically for the debug panel
  setInterval(update, 2000);
}

function updateSWState(state) {
  if (swStateEl) swStateEl.textContent = state;
}

function handleSWMessage(event) {
  const { type, version } = event.data || {};
  if (type === 'CACHE_VERSION' && cacheVersionEl) {
    cacheVersionEl.textContent = version || 'unknown';
  }
  if (type === 'SYNC_COMPLETE') {
    syncStatusEl.textContent = 'Synced';
    syncStatusEl.className = 'sync-status synced';
    showToast('✅ Background sync completed!', 'success');
    loadHabits(); // Refresh the habit list after sync
  }
}

// ─── Habits ───────────────────────────────────────────────────────────────────
async function loadHabits() {
  try {
    habits = await getHabits();
    renderHabits();
    renderCalendar();
  } catch (err) {
    console.warn('[App] Could not fetch habits (possibly offline):', err);
    showToast('Running in offline mode — showing cached data.', 'info');
  }
}

function renderHabits() {
  if (!habitListEl) return;

  if (habits.length === 0) {
    habitListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌱</div>
        <p>No habits yet. Add your first habit below!</p>
      </div>`;
    return;
  }

  const today = getTodayString();
  habitListEl.innerHTML = habits.map(habit => {
    const isDone = habit.completions?.includes(today);
    const streak = calculateStreak(habit.completions || []);
    return `
      <div class="habit-card ${isDone ? 'done' : ''}" data-id="${habit.id}" style="--habit-color: ${habit.color}">
        <div class="habit-color-bar" style="background: ${habit.color}"></div>
        <div class="habit-content">
          <div class="habit-header">
            <h3 class="habit-name">${escapeHtml(habit.name)}</h3>
            <span class="streak-badge" title="Current streak">🔥 ${streak}</span>
          </div>
          <div class="habit-actions">
            <button class="btn-complete ${isDone ? 'completed' : ''}"
                    data-id="${habit.id}"
                    data-testid="complete-habit-${habit.id}"
                    onclick="window.app.toggleComplete('${habit.id}')">
              ${isDone ? '✅ Done Today' : '⬜ Mark Done'}
            </button>
            <button class="btn-delete"
                    data-id="${habit.id}"
                    onclick="window.app.removeHabit('${habit.id}')"
                    title="Delete habit">
              🗑️
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

async function handleAddHabit(e) {
  e.preventDefault();
  const name = habitNameInput.value.trim();
  if (!name) return;

  try {
    const newHabit = await addHabit(name, selectedColor);
    habitNameInput.value = '';

    if (newHabit.offline) {
      // Optimistic UI update
      habits.push({ ...newHabit, name, color: selectedColor, completions: [] });
      showToast('Habit queued — will sync when online.', 'info');
    } else {
      habits.push(newHabit);
      showToast('✨ Habit added!', 'success');
    }

    renderHabits();
    renderCalendar();
  } catch (err) {
    showToast('Failed to add habit: ' + err.message, 'error');
  }
}

async function toggleComplete(id) {
  const today = getTodayString();
  try {
    const updated = await completeHabit(id, today);
    if (updated.offline) {
      // Optimistic update
      const habit = habits.find(h => h.id === id);
      if (habit && !habit.completions.includes(today)) {
        habit.completions.push(today);
      }
      showToast('Completion queued — will sync when online.', 'info');
    } else {
      const index = habits.findIndex(h => h.id === id);
      if (index !== -1) habits[index] = updated;
    }
    renderHabits();
    renderCalendar();
  } catch (err) {
    showToast('Failed to mark habit: ' + err.message, 'error');
  }
}

async function removeHabit(id) {
  if (!confirm('Are you sure you want to delete this habit?')) return;
  try {
    await deleteHabit(id);
    habits = habits.filter(h => h.id !== id);
    renderHabits();
    renderCalendar();
    showToast('Habit deleted.', 'info');
  } catch (err) {
    showToast('Failed to delete habit: ' + err.message, 'error');
  }
}

// ─── Calendar View ────────────────────────────────────────────────────────────
function renderCalendar() {
  if (!calendarEl) return;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = today.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Collect all completions this month
  const completionsThisMonth = {};
  habits.forEach(habit => {
    (habit.completions || []).forEach(dateStr => {
      if (dateStr.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
        const day = parseInt(dateStr.split('-')[2]);
        completionsThisMonth[day] = (completionsThisMonth[day] || 0) + 1;
      }
    });
  });

  const total = habits.length || 1;

  calendarEl.innerHTML = `
    <h3 class="calendar-title">📅 ${monthName}</h3>
    <div class="calendar-grid">
      ${Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const count = completionsThisMonth[day] || 0;
        const ratio = count / total;
        const isToday = day === today.getDate();
        const isFuture = day > today.getDate();
        const intensity = isFuture ? 'future' : ratio === 0 ? 'empty' : ratio < 0.5 ? 'low' : ratio < 1 ? 'medium' : 'full';
        return `<div class="calendar-day ${intensity} ${isToday ? 'today' : ''}" title="${day} ${monthName}: ${count}/${total} habits">
                  <span>${day}</span>
                </div>`;
      }).join('')}
    </div>
  `;
}

// ─── Color Picker ─────────────────────────────────────────────────────────────
function initColorPicker() {
  if (!colorPickerEl) return;
  colorPickerEl.innerHTML = COLORS.map(color => `
    <button type="button"
            class="color-swatch ${color === selectedColor ? 'selected' : ''}"
            style="background: ${color}"
            data-color="${color}"
            onclick="window.app.selectColor('${color}')"
            aria-label="Select color ${color}">
    </button>
  `).join('');
}

function selectColor(color) {
  selectedColor = color;
  document.querySelectorAll('.color-swatch').forEach(el => {
    el.classList.toggle('selected', el.dataset.color === color);
  });
}

// ─── Toast Notifications ──────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ─── Utility Functions ────────────────────────────────────────────────────────
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function calculateStreak(completions) {
  if (!completions || completions.length === 0) return 0;
  const sorted = [...completions].sort().reverse();
  let streak = 0;
  let current = new Date();

  for (const dateStr of sorted) {
    const date = new Date(dateStr + 'T00:00:00');
    const diff = Math.floor((current - date) / 86400000);
    if (diff <= 1) {
      streak++;
      current = date;
    } else {
      break;
    }
  }
  return streak;
}

// ─── Online/Offline Events ────────────────────────────────────────────────────
function initNetworkStatus() {
  const updateIndicator = () => {
    const indicator = document.getElementById('network-indicator');
    if (!indicator) return;
    indicator.textContent = navigator.onLine ? '🟢 Online' : '🔴 Offline';
    indicator.className = navigator.onLine ? 'online' : 'offline';
    if (navigator.onLine) refreshSyncStatus();
  };

  window.addEventListener('online', () => {
    updateIndicator();
    showToast('🟢 Back online! Syncing...', 'success');
  });
  window.addEventListener('offline', () => {
    updateIndicator();
    showToast('🔴 You are offline. Changes will sync later.', 'warning');
  });
  updateIndicator();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function init() {
  initAPI();
  initNetworkStatus();
  initColorPicker();

  // Register service worker
  const registration = await registerServiceWorker();
  if (registration) {
    initNotifications(registration);
  }

  // Load habits
  await loadHabits();

  // Add habit form handler
  if (addHabitForm) {
    addHabitForm.addEventListener('submit', handleAddHabit);
  }

  // Listen for toast events from notifications module
  window.addEventListener('show-toast', e => showToast(e.detail.message, e.detail.type));

  console.log('[App] PWA Habit Tracker initialized.');
}

// Expose functions for inline event handlers
window.app = { toggleComplete, removeHabit, selectColor };

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
