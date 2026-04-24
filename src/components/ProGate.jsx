/**
 * ═══════════════════════════════════════════════════════════
 * SysAI — ProGate Component
 * ═══════════════════════════════════════════════════════════
 * 
 * Modal che appare quando l'utente clicca su un tool Pro
 * senza avere la licenza attiva.
 * 
 * Uso in App.jsx:
 *   <ProGate
 *     show={showProGate}
 *     onClose={() => setShowProGate(false)}
 *     onGoToSettings={() => { setShowProGate(false); setPage('settings'); }}
 *     lang={lang}
 *   />
 */

const COLORS = {
  bg: '#0B0E14',
  surface: '#131720',
  surface2: '#1A1F2E',
  border: '#1E2535',
  text1: '#E8ECF4',
  text2: '#8B95A8',
  accent: '#00D4AA',
  accentDim: '#00D4AA22',
};

const STRINGS = {
  en: {
    title: 'Pro Feature',
    desc: 'This tool requires a Pro license. Unlock all 7 tools, all AI providers, and all languages.',
    features: [
      '⚙️ Config Generator — production-ready configs',
      '🔧 Troubleshooter — guided diagnosis',
      '📜 Script Builder — complete automation scripts',
      '🛡️ Security Auditor — audits + built-in scanners',
    ],
    activate: 'Activate License',
    later: 'Maybe later',
    free: 'Free with Gemini API key — no credit card needed to try the free tools!',
  },
  it: {
    title: 'Funzionalità Pro',
    desc: 'Questo strumento richiede una licenza Pro. Sblocca tutti i 7 strumenti, tutti i provider AI e tutte le lingue.',
    features: [
      '⚙️ Genera Config — config pronte per produzione',
      '🔧 Troubleshooter — diagnosi guidata',
      '📜 Script Builder — script di automazione completi',
      '🛡️ Audit Sicurezza — audit + scanner integrati',
    ],
    activate: 'Attiva Licenza',
    later: 'Non ora',
    free: 'Gratuito con API key Gemini — nessuna carta di credito per provare i tool gratuiti!',
  },
  fr: {
    title: 'Fonctionnalité Pro',
    desc: 'Cet outil nécessite une licence Pro. Débloquez les 7 outils, tous les fournisseurs AI et toutes les langues.',
    features: [
      '⚙️ Générateur de Config — configs prêtes pour la production',
      '🔧 Dépanneur — diagnostic guidé',
      '📜 Constructeur de Scripts — scripts d\'automatisation complets',
      '🛡️ Audit Sécurité — audits + scanners intégrés',
    ],
    activate: 'Activer la Licence',
    later: 'Plus tard',
    free: 'Gratuit avec clé API Gemini — pas de carte bancaire pour essayer les outils gratuits !',
  },
  de: {
    title: 'Pro-Funktion',
    desc: 'Dieses Tool erfordert eine Pro-Lizenz. Alle 7 Tools, alle AI-Anbieter und alle Sprachen freischalten.',
    features: [
      '⚙️ Config Generator — produktionsreife Konfigurationen',
      '🔧 Troubleshooter — geführte Diagnose',
      '📜 Script Builder — vollständige Automatisierungsskripte',
      '🛡️ Sicherheits-Audit — Audits + integrierte Scanner',
    ],
    activate: 'Lizenz Aktivieren',
    later: 'Vielleicht später',
    free: 'Kostenlos mit Gemini API-Schlüssel — keine Kreditkarte für die kostenlosen Tools!',
  },
  es: {
    title: 'Función Pro',
    desc: 'Esta herramienta requiere una licencia Pro. Desbloquea las 7 herramientas, todos los proveedores de IA y todos los idiomas.',
    features: [
      '⚙️ Generador de Config — configs listas para producción',
      '🔧 Solucionador — diagnóstico guiado',
      '📜 Constructor de Scripts — scripts de automatización completos',
      '🛡️ Auditor de Seguridad — auditorías + escáneres integrados',
    ],
    activate: 'Activar Licencia',
    later: 'Quizás después',
    free: '¡Gratis con clave API de Gemini — no se necesita tarjeta de crédito para probar las herramientas gratuitas!',
  },
};

export default function ProGate({ show, onClose, onGoToSettings, lang = 'en' }) {
  if (!show) return null;

  const s = STRINGS[lang] || STRINGS.en;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.accent}33`,
          borderRadius: 20,
          padding: 32,
          maxWidth: 440,
          width: '90%',
          boxShadow: `0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px ${COLORS.accent}11`,
          animation: 'fadeIn 0.3s ease',
        }}
      >
        {/* Icon */}
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: COLORS.accentDim,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          marginBottom: 20,
        }}>
          ⚡
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: 22,
          fontWeight: 700,
          color: COLORS.text1,
          marginBottom: 8,
          fontFamily: "'Outfit', sans-serif",
        }}>
          {s.title}
        </h2>

        {/* Description */}
        <p style={{
          fontSize: 14,
          color: COLORS.text2,
          lineHeight: 1.6,
          marginBottom: 20,
        }}>
          {s.desc}
        </p>

        {/* Feature list */}
        <div style={{
          background: COLORS.surface2,
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}>
          {s.features.map((feature, i) => (
            <div
              key={i}
              style={{
                fontSize: 13,
                color: COLORS.text1,
                padding: '6px 0',
                borderBottom: i < s.features.length - 1 ? `1px solid ${COLORS.border}` : 'none',
              }}
            >
              {feature}
            </div>
          ))}
        </div>

        {/* Buttons */}
        <button
          onClick={onGoToSettings}
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 12,
            background: COLORS.accent,
            color: COLORS.bg,
            border: 'none',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: "'Outfit', sans-serif",
            marginBottom: 10,
            transition: 'all 0.15s',
          }}
        >
          {s.activate}
        </button>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '11px 0',
            borderRadius: 12,
            background: 'transparent',
            color: COLORS.text2,
            border: `1px solid ${COLORS.border}`,
            fontWeight: 500,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: "'Outfit', sans-serif",
            transition: 'all 0.15s',
          }}
        >
          {s.later}
        </button>

        {/* Free hint */}
        <p style={{
          marginTop: 16,
          fontSize: 11,
          color: COLORS.text2,
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          {s.free}
        </p>
      </div>
    </div>
  );
}
