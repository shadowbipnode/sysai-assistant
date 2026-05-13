const DEVICE_ID_KEY = 'sysai_device_id';

function randomSegment() {
  return Math.random().toString(36).slice(2, 10);
}

function generateDeviceId() {
  return `sysai_${randomSegment()}${randomSegment()}`;
}

export async function getDeviceId() {
  try {
    if (window.electron?.secureStore?.get) {
      let existing = await window.electron.secureStore.get(DEVICE_ID_KEY);

      if (existing) return existing;

      const created = generateDeviceId();

      await window.electron.secureStore.set(
        DEVICE_ID_KEY,
        created
      );

      return created;
    }

    // fallback browser/dev mode
    let existing = localStorage.getItem(DEVICE_ID_KEY);

    if (existing) return existing;

    const created = generateDeviceId();

    localStorage.setItem(DEVICE_ID_KEY, created);

    return created;
  } catch (err) {
    console.error('[DeviceIdentity]', err);

    return generateDeviceId();
  }
}
