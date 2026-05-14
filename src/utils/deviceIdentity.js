const DEVICE_ID_KEY = 'sysai_device_id';

function randomSegment() {
  return Math.random().toString(36).slice(2, 10);
}

function generateDeviceId() {
  return `sysai_${randomSegment()}${randomSegment()}`;
}

function unwrapSecureStoreValue(result) {
  if (!result) return null;

  if (typeof result === 'string') return result;

  if (typeof result === 'object' && result.success && typeof result.value === 'string') {
    return result.value;
  }

  return null;
}

export async function getDeviceId() {
  try {
    if (window.electron?.secureStore?.get) {
      const existingResult = await window.electron.secureStore.get(DEVICE_ID_KEY);
      const existing = unwrapSecureStoreValue(existingResult);

      if (existing) return existing;

      const created = generateDeviceId();

      await window.electron.secureStore.set(
        DEVICE_ID_KEY,
        created
      );

      return created;
    }

    let existing = localStorage.getItem(DEVICE_ID_KEY);

    if (existing) return existing;

    const created = generateDeviceId();

    localStorage.setItem(DEVICE_ID_KEY, created);

    return created;
  } catch (err) {
    console.error('[DeviceIdentity]', err);

    const fallback = generateDeviceId();

    try {
      localStorage.setItem(DEVICE_ID_KEY, fallback);
    } catch {}

    return fallback;
  }
}
