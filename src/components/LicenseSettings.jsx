/**
 * ═══════════════════════════════════════════════════════════
 * SysAI — Componente License Settings
 * ═══════════════════════════════════════════════════════════
 * 
 * Inseriscilo nella pagina Settings dell'app.
 * 
 * Uso in App.jsx:
 *   import LicenseSettings from './components/LicenseSettings';
 *   ...
 *   <LicenseSettings license={license} t={t} />
 * 
 * Dove `license` viene da useLicense() e `t` è l'oggetto traduzioni.
 */

import { useState } from 'react';

// Colori (stessi dell'app)
const COLORS = {
  bg: '#0B0E14',
  surface: '#131720',
  surface2: '#1A1F2E',
  border: '#1E2535',
  text1: '#E8ECF4',
  text2: '#8B95A8',
  accent: '#00D4AA',
  accentDim: '#00D4AA22',
  danger: '#FF4D6A',
  warning: '#FFAA2C',
  success: '#00D4AA',
};

// Traduzioni integrate (aggiungi al tuo i18n se preferisci)
const STRINGS = {
  en: {
    title: 'License',
    free: 'Free Plan',
    freeDesc: '3 tools available. Upgrade to Pro to unlock all 7 tools.',
    pro: 'Pro License',
    proActive: 'All features unlocked',
    beta: 'Beta License',
    betaActive: 'Beta access — all features unlocked',
    daysLeft: 'days remaining',
    expired: 'License Expired',
    expiredDesc: 'Your license has expired. Please renew or purchase a Pro license.',
    inputLabel: 'License Key',
    inputPlaceholder: 'SYSAI-xxxxx.xxxxx',
    activate: 'Activate',
    activating: 'Verifying...',
    deactivate: 'Remove License',
    deactivateConfirm: 'Are you sure? You will lose Pro access.',
    success: 'License activated successfully!',
    invalid: 'Invalid license key',
    getKey: 'Get a license key',
    permanent: 'Permanent',
  },
  it: {
    title: 'Licenza',
    free: 'Piano Gratuito',
    freeDesc: '3 strumenti disponibili. Passa a Pro per sbloccare tutti e 7.',
    pro: 'Licenza Pro',
    proActive: 'Tutte le funzionalità sbloccate',
    beta: 'Licenza Beta',
    betaActive: 'Accesso beta — tutte le funzionalità sbloccate',
    daysLeft: 'giorni rimanenti',
    expired: 'Licenza Scaduta',
    expiredDesc: 'La tua licenza è scaduta. Rinnova o acquista una licenza Pro.',
    inputLabel: 'Chiave di Licenza',
    inputPlaceholder: 'SYSAI-xxxxx.xxxxx',
    activate: 'Attiva',
    activating: 'Verifica...',
    deactivate: 'Rimuovi Licenza',
    deactivateConfirm: 'Sei sicuro? Perderai l\'accesso Pro.',
    success: 'Licenza attivata con successo!',
    invalid: 'Chiave di licenza non valida',
    getKey: 'Ottieni una chiave di licenza',
    permanent: 'Permanente',
  },
  fr: {
    title: 'Licence',
    free: 'Plan Gratuit',
    freeDesc: '3 outils disponibles. Passez à Pro pour débloquer les 7 outils.',
    pro: 'Licence Pro',
    proActive: 'Toutes les fonctionnalités débloquées',
    beta: 'Licence Bêta',
    betaActive: 'Accès bêta — toutes les fonctionnalités débloquées',
    daysLeft: 'jours restants',
    expired: 'Licence Expirée',
    expiredDesc: 'Votre licence a expiré. Renouvelez ou achetez une licence Pro.',
    inputLabel: 'Clé de Licence',
    inputPlaceholder: 'SYSAI-xxxxx.xxxxx',
    activate: 'Activer',
    activating: 'Vérification...',
    deactivate: 'Supprimer la Licence',
    deactivateConfirm: 'Êtes-vous sûr ? Vous perdrez l\'accès Pro.',
    success: 'Licence activée avec succès !',
    invalid: 'Clé de licence invalide',
    getKey: 'Obtenir une clé de licence',
    permanent: 'Permanente',
  },
  de: {
    title: 'Lizenz',
    free: 'Kostenloser Plan',
    freeDesc: '3 Tools verfügbar. Upgrade auf Pro für alle 7 Tools.',
    pro: 'Pro-Lizenz',
    proActive: 'Alle Funktionen freigeschaltet',
    beta: 'Beta-Lizenz',
    betaActive: 'Beta-Zugang — alle Funktionen freigeschaltet',
    daysLeft: 'Tage verbleibend',
    expired: 'Lizenz Abgelaufen',
    expiredDesc: 'Ihre Lizenz ist abgelaufen. Erneuern oder kaufen Sie eine Pro-Lizenz.',
    inputLabel: 'Lizenzschlüssel',
    inputPlaceholder: 'SYSAI-xxxxx.xxxxx',
    activate: 'Aktivieren',
    activating: 'Überprüfung...',
    deactivate: 'Lizenz Entfernen',
    deactivateConfirm: 'Sind Sie sicher? Sie verlieren den Pro-Zugang.',
    success: 'Lizenz erfolgreich aktiviert!',
    invalid: 'Ungültiger Lizenzschlüssel',
    getKey: 'Lizenzschlüssel erhalten',
    permanent: 'Permanent',
  },
  es: {
    title: 'Licencia',
    free: 'Plan Gratuito',
    freeDesc: '3 herramientas disponibles. Actualiza a Pro para desbloquear las 7.',
    pro: 'Licencia Pro',
    proActive: 'Todas las funciones desbloqueadas',
    beta: 'Licencia Beta',
    betaActive: 'Acceso beta — todas las funciones desbloqueadas',
    daysLeft: 'días restantes',
    expired: 'Licencia Expirada',
    expiredDesc: 'Tu licencia ha expirado. Renueva o compra una licencia Pro.',
    inputLabel: 'Clave de Licencia',
    inputPlaceholder: 'SYSAI-xxxxx.xxxxx',
    activate: 'Activar',
    activating: 'Verificando...',
    deactivate: 'Eliminar Licencia',
    deactivateConfirm: '¿Estás seguro? Perderás el acceso Pro.',
    success: '¡Licencia activada con éxito!',
    invalid: 'Clave de licencia no válida',
    getKey: 'Obtener una clave de licencia',
    permanent: 'Permanente',
  },
};

export default function LicenseSettings({ license, lang = 'en' }) {
  const [keyInput, setKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text }
  const [showConfirm, setShowConfirm] = useState(false);

  const s = STRINGS[lang] || STRINGS.en;

  const handleActivate = async () => {
    if (!keyInput.trim()) return;

    setActivating(true);
    setMessage(null);

    const result = await license.activate(keyInput.trim());

    setActivating(false);

    if (result.valid) {
      setMessage({ type: 'success', text: s.success });
      setKeyInput('');
    } else {
      setMessage({ type: 'error', text: result.error || s.invalid });
    }
  };

  const handleDeactivate = async () => {
    await license.deactivate();
    setShowConfirm(false);
    setMessage(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleActivate();
  };

  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 16,
      padding: 24,
      marginBottom: 16,
    }}>
      {/* Header */}
      <h3 style={{
        fontSize: 14,
        fontWeight: 600,
        color: COLORS.text2,
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        🔑 {s.title}
      </h3>

      {/* Status Card */}
      <div style={{
        background: license.isPro ? `${COLORS.accent}11` : COLORS.surface2,
        border: `1px solid ${license.isPro ? `${COLORS.accent}33` : COLORS.border}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        {/* Status Icon */}
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          background: license.isPro ? COLORS.accentDim : `${COLORS.text2}15`,
          flexShrink: 0,
        }}>
          {license.expired ? '⏰' : license.isPro ? '⚡' : '🔓'}
        </div>

        {/* Status Text */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            color: license.expired ? COLORS.danger : license.isPro ? COLORS.accent : COLORS.text1,
            marginBottom: 4,
          }}>
            {license.expired
              ? s.expired
              : license.isBeta
                ? s.beta
                : license.isPro
                  ? s.pro
                  : s.free
            }
          </div>
          <div style={{ fontSize: 13, color: COLORS.text2 }}>
            {license.expired
              ? s.expiredDesc
              : license.isPro
                ? (license.isBeta ? s.betaActive : s.proActive)
                : s.freeDesc
            }
          </div>
          {/* Days left for beta */}
          {license.isPro && license.daysLeft !== null && !license.expired && (
            <div style={{
              marginTop: 8,
              fontSize: 12,
              fontWeight: 600,
              color: license.daysLeft < 14 ? COLORS.warning : COLORS.accent,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: license.daysLeft < 14 ? COLORS.warning : COLORS.accent,
                display: 'inline-block',
              }} />
              {license.daysLeft} {s.daysLeft}
              {license.expires && ` (→ ${license.expires})`}
            </div>
          )}
          {/* Permanent badge */}
          {license.isPro && license.daysLeft === null && !license.expired && (
            <div style={{
              marginTop: 8,
              fontSize: 12,
              fontWeight: 600,
              color: COLORS.accent,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: COLORS.accent,
                display: 'inline-block',
              }} />
              ∞ {s.permanent}
            </div>
          )}
        </div>

        {/* Pro badge */}
        {license.isPro && !license.expired && (
          <div style={{
            padding: '4px 12px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 700,
            background: COLORS.accentDim,
            color: COLORS.accent,
            letterSpacing: '0.06em',
            flexShrink: 0,
          }}>
            {license.isBeta ? 'BETA' : 'PRO'}
          </div>
        )}
      </div>

      {/* Input area — mostra se non ha Pro, o se è scaduta */}
      {(!license.isPro || license.expired) && (
        <div>
          <label style={{
            fontSize: 12,
            fontWeight: 600,
            color: COLORS.text2,
            marginBottom: 8,
            display: 'block',
          }}>
            {s.inputLabel}
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={s.inputPlaceholder}
              style={{
                flex: 1,
                padding: '12px 14px',
                borderRadius: 10,
                background: COLORS.bg,
                border: `1px solid ${COLORS.border}`,
                color: COLORS.text1,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                transition: 'border-color 0.2s',
              }}
            />
            <button
              onClick={handleActivate}
              disabled={activating || !keyInput.trim()}
              style={{
                padding: '12px 24px',
                borderRadius: 10,
                background: keyInput.trim() ? COLORS.accent : COLORS.surface2,
                color: keyInput.trim() ? COLORS.bg : COLORS.text2,
                border: 'none',
                fontWeight: 600,
                fontSize: 13,
                cursor: keyInput.trim() ? 'pointer' : 'default',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                fontFamily: "'Outfit', sans-serif",
                opacity: activating ? 0.7 : 1,
              }}
            >
              {activating ? s.activating : s.activate}
            </button>
          </div>

          {/* Message */}
          {message && (
            <div style={{
              marginTop: 10,
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              background: message.type === 'success' ? `${COLORS.success}15` : `${COLORS.danger}15`,
              color: message.type === 'success' ? COLORS.success : COLORS.danger,
              border: `1px solid ${message.type === 'success' ? `${COLORS.success}33` : `${COLORS.danger}33`}`,
            }}>
              {message.type === 'success' ? '✓' : '✗'} {message.text}
            </div>
          )}
        </div>
      )}

      {/* Deactivate button — mostra se ha Pro attivo */}
      {license.isPro && !license.expired && (
        <div>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              style={{
                background: 'none',
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                color: COLORS.text2,
                padding: '8px 16px',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: "'Outfit', sans-serif",
                transition: 'all 0.15s',
              }}
            >
              {s.deactivate}
            </button>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 8,
              background: `${COLORS.danger}11`,
              border: `1px solid ${COLORS.danger}33`,
            }}>
              <span style={{ fontSize: 13, color: COLORS.danger, flex: 1 }}>
                {s.deactivateConfirm}
              </span>
              <button
                onClick={handleDeactivate}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  background: COLORS.danger,
                  color: '#fff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                ✓
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  background: COLORS.surface2,
                  color: COLORS.text2,
                  border: `1px solid ${COLORS.border}`,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                ✗
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
