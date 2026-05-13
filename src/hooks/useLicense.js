/**
 * ═══════════════════════════════════════════════════════════
 * SysAI — React Hook per la gestione licenza
 * ═══════════════════════════════════════════════════════════
 * 
 * Uso:
 *   const { isPro, licenseType, daysLeft, activate, deactivate, status } = useLicense();
 */

import { useState, useEffect, useCallback } from 'react';
import {
  checkLicenseStatus,
  activateLicense,
  deactivateLicense,
  refreshLicenseCache,
} from '../utils/license';

export function useLicense() {
  const [status, setStatus] = useState({
    valid: false,
    type: 'free',
    isPro: false,
    loading: true,
  });

  // Check licenza all'avvio
  useEffect(() => {
    refreshLicenseCache().then((result) => {
      setStatus({ ...result, loading: false });
    });
  }, []);

  // Attiva una nuova licenza
  const activate = useCallback(async (key) => {
    const result = await activateLicense(key);
    if (result.valid) {
      const newStatus = await checkLicenseStatus();
      setStatus({ ...newStatus, loading: false });
    }
    return result;
  }, []);

  // Disattiva (torna a Free)
  const deactivate = useCallback(async () => {
    await deactivateLicense();
    setStatus({ valid: false, type: 'free', isPro: false, loading: false });
  }, []);

  return {
    isPro: status.isPro,
    isBeta: status.type === 'beta',
    licenseType: status.type,
    plan: status.plan,
    features: status.features || [],
    maxActivations: status.maxActivations,
    activationRequired: status.activationRequired,
    graceDays: status.graceDays,
    daysLeft: status.daysLeft,
    expires: status.expires,
    licenseId: status.id,
    error: status.error,
    expired: status.expired,
    loading: status.loading,
    activate,
    deactivate,
    status,
  };
}
