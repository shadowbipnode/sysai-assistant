const textEncoder = new TextEncoder();

const OIDS = {
  commonName: "2.5.4.3",
  organizationName: "2.5.4.10",
  organizationalUnitName: "2.5.4.11",
  localityName: "2.5.4.7",
  stateOrProvinceName: "2.5.4.8",
  countryName: "2.5.4.6",
  emailAddress: "1.2.840.113549.1.9.1",
  extensionRequest: "1.2.840.113549.1.9.14",
  subjectAltName: "2.5.29.17",
  sha256WithRSAEncryption: "1.2.840.113549.1.1.11",
  ecdsaWithSHA256: "1.2.840.10045.4.3.2",
  ecdsaWithSHA384: "1.2.840.10045.4.3.3",
};

function bytes(...arrays) {
  const length = arrays.reduce((sum, item) => sum + item.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  arrays.forEach((item) => {
    result.set(item, offset);
    offset += item.length;
  });
  return result;
}

function len(value) {
  if (value.length < 128) return new Uint8Array([value.length]);
  const parts = [];
  let n = value.length;
  while (n > 0) {
    parts.unshift(n & 0xff);
    n >>= 8;
  }
  return new Uint8Array([0x80 | parts.length, ...parts]);
}

function der(tag, value) {
  return bytes(new Uint8Array([tag]), len(value), value);
}

function seq(...items) {
  return der(0x30, bytes(...items));
}

function set(...items) {
  return der(0x31, bytes(...items));
}

function explicit(tagNumber, value) {
  return der(0xa0 + tagNumber, value);
}

function oid(value) {
  const parts = value.split(".").map(Number);
  const encoded = [parts[0] * 40 + parts[1]];
  parts.slice(2).forEach((part) => {
    const stack = [part & 0x7f];
    part >>= 7;
    while (part > 0) {
      stack.unshift((part & 0x7f) | 0x80);
      part >>= 7;
    }
    encoded.push(...stack);
  });
  return der(0x06, new Uint8Array(encoded));
}

function int(value) {
  if (typeof value === "number") return der(0x02, new Uint8Array([value]));
  const needsPad = value[0] & 0x80;
  return der(0x02, needsPad ? bytes(new Uint8Array([0]), value) : value);
}

function bitString(value) {
  return der(0x03, bytes(new Uint8Array([0]), value));
}

function octetString(value) {
  return der(0x04, value);
}

function utf8(value) {
  return der(0x0c, textEncoder.encode(value));
}

function printable(value) {
  return der(0x13, textEncoder.encode(value));
}

function ia5(value) {
  return der(0x16, textEncoder.encode(value));
}

function attr(typeOid, value, asIa5 = false) {
  const stringValue = asIa5 ? ia5(value) : typeOid === OIDS.countryName ? printable(value) : utf8(value);
  return set(seq(oid(typeOid), set(stringValue)));
}

function pem(label, buffer) {
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  const base64 = btoa(binary).replace(/(.{64})/g, "$1\n").trim();
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`;
}

function derToPem(label, derBytes) {
  const binary = String.fromCharCode(...derBytes);
  const base64 = btoa(binary).replace(/(.{64})/g, "$1\n").trim();
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`;
}

function ipToBytes(value) {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    const parts = value.split(".").map(Number);
    if (parts.every((part) => part >= 0 && part <= 255)) return new Uint8Array(parts);
  }

  if (/^[0-9a-f:]+$/i.test(value) && value.includes(":")) {
    const [head, tail = ""] = value.split("::");
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const missing = 8 - headParts.length - tailParts.length;
    if (missing >= 0) {
      const groups = [...headParts, ...Array(missing).fill("0"), ...tailParts];
      if (groups.length === 8 && groups.every((part) => /^[0-9a-f]{1,4}$/i.test(part))) {
        const output = new Uint8Array(16);
        groups.forEach((part, index) => {
          const n = Number.parseInt(part, 16);
          output[index * 2] = n >> 8;
          output[index * 2 + 1] = n & 0xff;
        });
        return output;
      }
    }
  }

  return null;
}

function generalNameDns(value) {
  return der(0x82, textEncoder.encode(value));
}

function generalNameIp(value) {
  const ipBytes = ipToBytes(value);
  if (!ipBytes) throw new Error(`Invalid IP SAN: ${value}`);
  return der(0x87, ipBytes);
}

function buildSubjectAltName(dnsEntries, ipEntries) {
  const names = [
    ...dnsEntries.map(generalNameDns),
    ...ipEntries.map(generalNameIp),
  ];
  if (!names.length) return null;
  return seq(oid(OIDS.subjectAltName), octetString(seq(...names)));
}

function buildSubject(form) {
  const entries = [
    form.country ? attr(OIDS.countryName, form.country.toUpperCase()) : null,
    form.state ? attr(OIDS.stateOrProvinceName, form.state) : null,
    form.city ? attr(OIDS.localityName, form.city) : null,
    form.organization ? attr(OIDS.organizationName, form.organization) : null,
    form.organizationalUnit ? attr(OIDS.organizationalUnitName, form.organizationalUnit) : null,
    form.commonName ? attr(OIDS.commonName, form.commonName) : null,
    form.email ? attr(OIDS.emailAddress, form.email, true) : null,
  ].filter(Boolean);
  return seq(...entries);
}

function buildAttributes(dnsEntries, ipEntries) {
  const san = buildSubjectAltName(dnsEntries, ipEntries);
  if (!san) return explicit(0, new Uint8Array());
  const extensions = seq(san);
  const extensionRequest = seq(oid(OIDS.extensionRequest), set(extensions));
  return explicit(0, set(extensionRequest));
}

function trimInteger(bytesValue) {
  let offset = 0;
  while (offset < bytesValue.length - 1 && bytesValue[offset] === 0) offset += 1;
  return bytesValue.slice(offset);
}

function encodeEcdsaSignature(rawSignature) {
  const raw = new Uint8Array(rawSignature);
  const half = raw.length / 2;
  return seq(int(trimInteger(raw.slice(0, half))), int(trimInteger(raw.slice(half))));
}

function algorithmFor(type) {
  if (type === "rsa-2048") {
    return {
      key: {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      sign: { name: "RSASSA-PKCS1-v1_5" },
      csrOid: OIDS.sha256WithRSAEncryption,
      hashName: "SHA-256",
    };
  }
  if (type === "rsa-4096") {
    return {
      key: {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      sign: { name: "RSASSA-PKCS1-v1_5" },
      csrOid: OIDS.sha256WithRSAEncryption,
      hashName: "SHA-256",
    };
  }
  if (type === "ecdsa-p384") {
    return {
      key: { name: "ECDSA", namedCurve: "P-384" },
      sign: { name: "ECDSA", hash: "SHA-384" },
      csrOid: OIDS.ecdsaWithSHA384,
      hashName: "SHA-384",
    };
  }
  return {
    key: { name: "ECDSA", namedCurve: "P-256" },
    sign: { name: "ECDSA", hash: "SHA-256" },
    csrOid: OIDS.ecdsaWithSHA256,
    hashName: "SHA-256",
  };
}

export function parseSanEntries(value) {
  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateCsrForm(form) {
  const errors = {};
  const dnsEntries = parseSanEntries(form.sanDns);
  const ipEntries = parseSanEntries(form.sanIps);

  if (!form.commonName.trim()) errors.commonName = "commonName";
  if (form.country && !/^[A-Za-z]{2}$/.test(form.country.trim())) errors.country = "country";
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "email";
  const invalidDns = dnsEntries.filter((entry) => !/^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(entry));
  if (invalidDns.length) errors.sanDns = invalidDns.join(", ");
  const invalidIps = ipEntries.filter((entry) => !ipToBytes(entry));
  if (invalidIps.length) errors.sanIps = invalidIps.join(", ");

  return { errors, dnsEntries, ipEntries };
}

export async function generateCsrBundle(form) {
  const { errors, dnsEntries, ipEntries } = validateCsrForm(form);
  if (Object.keys(errors).length) {
    const error = new Error("Invalid CSR input");
    error.validation = errors;
    throw error;
  }

  const algorithm = algorithmFor(form.keyType);
  const keyPair = await crypto.subtle.generateKey(algorithm.key, true, ["sign", "verify"]);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("spki", keyPair.publicKey));
  const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  const info = seq(
    int(0),
    buildSubject({
      ...form,
      country: form.country.trim(),
      commonName: form.commonName.trim(),
      organization: form.organization.trim(),
      organizationalUnit: form.organizationalUnit.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      email: form.email.trim(),
    }),
    publicKey,
    buildAttributes(dnsEntries, ipEntries)
  );

  let signature = await crypto.subtle.sign(algorithm.sign, keyPair.privateKey, info);
  if (form.keyType.startsWith("ecdsa")) {
    signature = encodeEcdsaSignature(signature);
  } else {
    signature = new Uint8Array(signature);
  }

  const csr = seq(
    info,
    seq(oid(algorithm.csrOid), form.keyType.startsWith("rsa") ? der(0x05, new Uint8Array()) : new Uint8Array()),
    bitString(signature)
  );

  return {
    privateKeyPem: pem("PRIVATE KEY", privateKey),
    csrPem: derToPem("CERTIFICATE REQUEST", csr),
    opensslCommand: buildOpenSslCommand(form, dnsEntries, ipEntries),
  };
}

export function buildOpenSslCommand(form, dnsEntries = parseSanEntries(form.sanDns), ipEntries = parseSanEntries(form.sanIps)) {
  const keyPart = form.keyType === "rsa-4096"
    ? "-newkey rsa:4096"
    : form.keyType === "ecdsa-p256"
      ? "-newkey ec -pkeyopt ec_paramgen_curve:P-256"
      : form.keyType === "ecdsa-p384"
        ? "-newkey ec -pkeyopt ec_paramgen_curve:P-384"
        : "-newkey rsa:2048";

  const subject = [
    form.country && `/C=${form.country.toUpperCase()}`,
    form.state && `/ST=${form.state}`,
    form.city && `/L=${form.city}`,
    form.organization && `/O=${form.organization}`,
    form.organizationalUnit && `/OU=${form.organizationalUnit}`,
    form.commonName && `/CN=${form.commonName}`,
    form.email && `/emailAddress=${form.email}`,
  ].filter(Boolean).join("");

  const altNames = [
    ...dnsEntries.map((entry) => `DNS:${entry}`),
    ...ipEntries.map((entry) => `IP:${entry}`),
  ].join(",");

  const addext = altNames ? ` -addext "subjectAltName=${altNames}"` : "";
  return `openssl req -new ${keyPart} -nodes -keyout private.key -out request.csr -subj "${subject}"${addext}`;
}
