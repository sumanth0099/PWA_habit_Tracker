/**
 * notifications.js — Push notification subscription management
 */

import { sendSubscriptionToServer, getVapidPublicKey } from './api.js';

let swRegistration = null;
let enableBtn = null;

export function initNotifications(registration) {
  swRegistration = registration;
  enableBtn = document.querySelector('[data-testid="enable-notifications"]');
  if (!enableBtn) return;

  enableBtn.addEventListener('click', handleEnableNotifications);
  updateButtonState();
}

async function handleEnableNotifications() {
  if (!('Notification' in window)) {
    showToast('Push notifications are not supported in this browser.', 'error');
    return;
  }

  enableBtn.disabled = true;
  enableBtn.textContent = '⏳ Requesting permission...';

  try {
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      showToast('Notification permission was denied.', 'warning');
      updateButtonState();
      return;
    }

    // Get VAPID public key from backend
    let vapidPublicKey;
    try {
      vapidPublicKey = await getVapidPublicKey();
    } catch (err) {
      console.warn('[Notifications] Could not fetch VAPID key from backend, using fallback.', err);
      // Try to use the key stored in meta tag (injected at build time)
      const meta = document.querySelector('meta[name="vapid-public-key"]');
      if (meta) vapidPublicKey = meta.content;
    }

    if (!vapidPublicKey || vapidPublicKey === 'your_vapid_public_key_here') {
      showToast('Push notifications require a valid VAPID key. Please set up the backend.', 'warning');
      updateButtonState();
      return;
    }

    // Subscribe via the push manager
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    // Send subscription to backend
    await sendSubscriptionToServer(subscription.toJSON());
    showToast('🔔 Push notifications enabled!', 'success');
    enableBtn.textContent = '🔔 Notifications Enabled';
    enableBtn.classList.add('enabled');
    enableBtn.disabled = true;

    // Store locally
    localStorage.setItem('pushSubscribed', 'true');
  } catch (err) {
    console.error('[Notifications] Subscription failed:', err);
    showToast('Failed to enable notifications: ' + err.message, 'error');
    updateButtonState();
  }
}

function updateButtonState() {
  if (!enableBtn) return;
  const alreadySubscribed = localStorage.getItem('pushSubscribed') === 'true';
  const permissionDenied = Notification.permission === 'denied';

  if (alreadySubscribed && Notification.permission === 'granted') {
    enableBtn.textContent = '🔔 Notifications Enabled';
    enableBtn.classList.add('enabled');
    enableBtn.disabled = true;
  } else if (permissionDenied) {
    enableBtn.textContent = '🚫 Notifications Blocked';
    enableBtn.classList.add('blocked');
    enableBtn.disabled = true;
  } else {
    enableBtn.textContent = '🔔 Enable Notifications';
    enableBtn.disabled = false;
  }
}

/**
 * Convert a base64url encoded VAPID public key to Uint8Array.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function showToast(message, type = 'info') {
  // Dispatch a custom event that app.js can listen to
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
}
