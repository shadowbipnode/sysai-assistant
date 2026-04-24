#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════
 * SysAI License Key Generator
 * ═══════════════════════════════════════════════════════════
 * 
 * QUESTO FILE RESTA SUL TUO PC — MAI nel repo, MAI nel pacchetto!
 * 
 * Uso:
 *   node generate-key.js --init                              # genera coppia chiavi (prima volta)
 *   node generate-key.js --type pro                          # key Pro permanente
 *   node generate-key.js --type pro --email user@example.com # key Pro con email
 *   node generate-key.js --type beta --days 90               # key Beta 90 giorni
 *   node generate-key.js --type beta --days 90 --email user@example.com
 *   node generate-key.js --revoke KEY_ID                     # aggiungi a lista revoca
 *   node generate-key.js --list                              # mostra tutte le key generate
 *   node generate-key.js --export-public                     # mostra la chiave pubblica da mettere nell'app
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ============================================================
// PATHS
// ============================================================
const KEYS_DIR = path.join(__dirname, '.keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.key');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.key');
const LEDGER_PATH = path.join(KEYS_DIR, 'licenses-ledger.json');
const REVOKED_PATH = path.join(KEYS_DIR, 'revoked.json');

// ============================================================
// PARSE CLI ARGS
// ============================================================
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return null;
  if (idx + 1 < args.length && !args[idx + 1].startsWith('--')) {
    return args[idx + 1];
  }
  return true;
};

const command = {
  init: args.includes('--init'),
  type: getArg('type'),
  email: getArg('email'),
  days: getArg('days') ? parseInt(getArg('days')) : null,
  revoke: getArg('revoke'),
  list: args.includes('--list'),
  exportPublic: args.includes('--export-public'),
};

// ============================================================
// INIT — genera coppia chiavi Ed25519
// ============================================================
function initKeys() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  if (fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error('⚠️  Le chiavi esistono già in .keys/');
    console.error('   Se vuoi rigenerarle, cancella la cartella .keys/ prima.');
    console.error('   ATTENZIONE: tutte le license key generate con le vecchie chiavi');
    console.error('   smetteranno di funzionare!');
    process.exit(1);
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });
  fs.writeFileSync(LEDGER_PATH, '[]', { mode: 0o600 });
  fs.writeFileSync(REVOKED_PATH, '[]', { mode: 0o600 });

  console.log('✅ Chiavi Ed25519 generate con successo!');
  console.log('');
  console.log(`   Chiave privata: ${PRIVATE_KEY_PATH}`);
  console.log(`   Chiave pubblica: ${PUBLIC_KEY_PATH}`);
  console.log('');
  console.log('⚠️  PROTEGGI la chiave privata! Non condividerla MAI.');
  console.log('   Fai un backup sicuro di .keys/private.key');
  console.log('');
  console.log('📋 Per ottenere la chiave pubblica da includere nell\'app:');
  console.log('   node generate-key.js --export-public');
}

// ============================================================
// LOAD KEYS
// ============================================================
function loadPrivateKey() {
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error('❌ Chiave privata non trovata. Esegui prima:');
    console.error('   node generate-key.js --init');
    process.exit(1);
  }
  return fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
}

function loadPublicKey() {
  if (!fs.existsSync(PUBLIC_KEY_PATH)) {
    console.error('❌ Chiave pubblica non trovata. Esegui prima:');
    console.error('   node generate-key.js --init');
    process.exit(1);
  }
  return fs.readFileSync(PUBLIC_KEY_PATH, 'utf-8');
}

// ============================================================
// GENERA LICENSE KEY
// ============================================================
function generateLicense(type, email, days) {
  const privateKeyPem = loadPrivateKey();
  const privateKey = crypto.createPrivateKey(privateKeyPem);

  // Genera ID unico
  const id = crypto.randomBytes(8).toString('hex');

  // Calcola scadenza
  let expires = null;
  if (days) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + days);
    expires = expDate.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  // Payload
  const payload = {
    v: 1,                                    // versione formato
    t: type,                                 // "pro" | "beta"
    id: id,                                  // ID unico
    e: email || null,                        // email (opzionale)
    c: new Date().toISOString().split('T')[0], // data creazione
    x: expires,                              // scadenza (null = permanente)
  };

  // Codifica payload in base64url
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString('base64url');

  // Firma con Ed25519
  const signature = crypto.sign(null, Buffer.from(payloadB64), privateKey);
  const signatureB64 = signature.toString('base64url');

  // Componi la key finale
  const licenseKey = `SYSAI-${payloadB64}.${signatureB64}`;

  // Salva nel ledger
  const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8'));
  ledger.push({
    id,
    type,
    email: email || 'N/A',
    created: payload.c,
    expires: expires || 'permanent',
    key: licenseKey,
  });
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));

  return { licenseKey, payload };
}

// ============================================================
// REVOCA
// ============================================================
function revokeKey(keyId) {
  const revoked = JSON.parse(fs.readFileSync(REVOKED_PATH, 'utf-8'));
  if (revoked.includes(keyId)) {
    console.log(`⚠️  Key ${keyId} è già revocata.`);
    return;
  }
  revoked.push(keyId);
  fs.writeFileSync(REVOKED_PATH, JSON.stringify(revoked, null, 2));
  console.log(`✅ Key ${keyId} revocata. Se implementi un check online,`);
  console.log(`   questa key verrà rifiutata al prossimo controllo.`);
}

// ============================================================
// LISTA
// ============================================================
function listKeys() {
  if (!fs.existsSync(LEDGER_PATH)) {
    console.log('Nessuna key generata.');
    return;
  }

  const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8'));
  const revoked = fs.existsSync(REVOKED_PATH)
    ? JSON.parse(fs.readFileSync(REVOKED_PATH, 'utf-8'))
    : [];

  if (ledger.length === 0) {
    console.log('Nessuna key generata.');
    return;
  }

  console.log('');
  console.log(`╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  SysAI License Ledger — ${ledger.length} key generate              ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);

  ledger.forEach((entry, i) => {
    const isRevoked = revoked.includes(entry.id);
    const isExpired = entry.expires !== 'permanent' && new Date(entry.expires) < new Date();
    const status = isRevoked ? '🔴 REVOKED' : isExpired ? '🟡 EXPIRED' : '🟢 ACTIVE';

    console.log(`║ #${(i + 1).toString().padStart(3, '0')}  ${status}`);
    console.log(`║   ID:      ${entry.id}`);
    console.log(`║   Type:    ${entry.type}`);
    console.log(`║   Email:   ${entry.email}`);
    console.log(`║   Created: ${entry.created}`);
    console.log(`║   Expires: ${entry.expires}`);
    console.log(`║   Key:     ${entry.key.substring(0, 40)}...`);
    if (i < ledger.length - 1) {
      console.log(`╟──────────────────────────────────────────────────────────╢`);
    }
  });

  console.log(`╚══════════════════════════════════════════════════════════╝`);
}

// ============================================================
// EXPORT PUBLIC KEY
// ============================================================
function exportPublicKey() {
  const pubKey = loadPublicKey();

  // Estrai la parte raw della chiave pubblica (32 bytes per Ed25519)
  const pubKeyObj = crypto.createPublicKey(pubKey);
  const pubKeyDer = pubKeyObj.export({ type: 'spki', format: 'der' });
  const pubKeyB64 = pubKeyDer.toString('base64');

  console.log('');
  console.log('📋 Copia questa stringa nel file src/utils/license.js');
  console.log('   nella costante PUBLIC_KEY_B64:');
  console.log('');
  console.log(`   const PUBLIC_KEY_B64 = '${pubKeyB64}';`);
  console.log('');
  console.log('   (È la chiave pubblica in formato SPKI/DER/Base64)');
  console.log('');
}

// ============================================================
// MAIN
// ============================================================
function main() {
  console.log('');
  console.log('⚡ SysAI License Generator');
  console.log('');

  if (command.init) {
    initKeys();
    return;
  }

  if (command.exportPublic) {
    exportPublicKey();
    return;
  }

  if (command.list) {
    listKeys();
    return;
  }

  if (command.revoke) {
    revokeKey(command.revoke);
    return;
  }

  if (command.type) {
    if (!['pro', 'beta'].includes(command.type)) {
      console.error('❌ Tipo non valido. Usa: --type pro | --type beta');
      process.exit(1);
    }

    if (command.type === 'beta' && !command.days) {
      console.error('❌ Per le key beta serve --days N');
      console.error('   Esempio: node generate-key.js --type beta --days 90');
      process.exit(1);
    }

    const { licenseKey, payload } = generateLicense(
      command.type,
      command.email,
      command.days
    );

    console.log('✅ License key generata!');
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log(`║  Type:    ${payload.t.toUpperCase().padEnd(45)}║`);
    console.log(`║  ID:      ${payload.id.padEnd(45)}║`);
    console.log(`║  Email:   ${(payload.e || 'N/A').padEnd(45)}║`);
    console.log(`║  Created: ${payload.c.padEnd(45)}║`);
    console.log(`║  Expires: ${(payload.x || 'PERMANENT').padEnd(45)}║`);
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log('║  LICENSE KEY (copia e invia al tester):             ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');
    console.log(licenseKey);
    console.log('');
    return;
  }

  // Nessun comando — mostra help
  console.log('Uso:');
  console.log('  node generate-key.js --init                 Genera coppia chiavi (prima volta)');
  console.log('  node generate-key.js --type pro             Key Pro permanente');
  console.log('  node generate-key.js --type beta --days 90  Key Beta con scadenza');
  console.log('  node generate-key.js --type pro --email x   Key Pro con email tracciamento');
  console.log('  node generate-key.js --list                 Mostra tutte le key generate');
  console.log('  node generate-key.js --revoke KEY_ID        Revoca una key');
  console.log('  node generate-key.js --export-public        Mostra chiave pubblica per l\'app');
  console.log('');
}

main();
