// lib/backup.js — Import/export JSON + photos, Web Share API fallback

import { getState } from './state.js';
import { getAllBlobKeys, getBlob, putBlob } from './storage.js';
import { bus } from './events.js';

export async function exportBackup() {
  const state = getState();
  const stateClone = JSON.parse(JSON.stringify(state));

  // Gather photo blobs as base64
  const photos = {};
  const keys = await getAllBlobKeys();
  for (const key of keys) {
    const blob = await getBlob(key);
    if (blob) {
      photos[key] = await blobToBase64(blob);
    }
  }

  const backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    state: stateClone,
    photos
  };

  const jsonStr = JSON.stringify(backup);
  const file = new File([jsonStr], 'japan-catches.json', { type: 'application/json' });

  // Try Web Share API first (iOS share sheet)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Japan Pokédex Backup' });
      state.lastBackupDate = new Date().toISOString();
      return;
    } catch { /* user cancelled or not supported */ }
  }

  // Fallback: download link
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'japan-catches.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  state.lastBackupDate = new Date().toISOString();
}

export async function importBackup() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) { reject(new Error('No file selected')); return; }

      try {
        const text = await file.text();
        const backup = JSON.parse(text);

        if (!backup.state || !backup.version) {
          throw new Error('Invalid backup file');
        }

        const state = getState();

        // Restore state fields
        Object.assign(state, backup.state);

        // Restore photos
        if (backup.photos) {
          for (const [key, b64] of Object.entries(backup.photos)) {
            const blob = base64ToBlob(b64);
            await putBlob(key, blob);
          }
        }

        resolve();
      } catch (err) {
        reject(err);
      }
    });

    input.click();
  });
}

export function checkBackupReminder() {
  const state = getState();
  const spots = state.caughtSpots?.length || 0;
  if (spots < 5) return;

  const lastBackup = state.lastBackupDate ? new Date(state.lastBackupDate) : null;
  const daysSinceBackup = lastBackup ? (Date.now() - lastBackup.getTime()) / (1000 * 60 * 60 * 24) : Infinity;

  if (daysSinceBackup >= 3) {
    bus.emit('show-dialogue', {
      text: `You have ${spots} spots! Consider backing up your data. Open Trainer Card → Export 📤`,
      autoHide: 6000
    });
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(b64) {
  const [header, data] = b64.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
