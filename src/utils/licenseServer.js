const LICENSE_SERVER_URL_KEY = 'sysai_license_server_url';

export function getLicenseServerUrl() {
  try {
    return localStorage.getItem(LICENSE_SERVER_URL_KEY) || null;
  } catch {
    return null;
  }
}

export function setLicenseServerUrl(url) {
  try {
    if (!url) {
      localStorage.removeItem(LICENSE_SERVER_URL_KEY);
      return true;
    }

    localStorage.setItem(LICENSE_SERVER_URL_KEY, String(url).trim());
    return true;
  } catch {
    return false;
  }
}

async function postLicenseServer(path, payload) {
  const baseUrl = getLicenseServerUrl();

  if (!baseUrl) {
    return {
      ok: false,
      skipped: true,
      error: 'License server URL not configured',
    };
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: data.error || `License server error ${response.status}`,
      data,
    };
  }

  return {
    ok: true,
    status: response.status,
    data,
  };
}

export async function activateOnlineLicense(payload) {
  return postLicenseServer('/activate', payload);
}

export async function validateOnlineLicense(payload) {
  return postLicenseServer('/validate', payload);
}

export async function deactivateOnlineLicense(payload) {
  return postLicenseServer('/deactivate', payload);
}
