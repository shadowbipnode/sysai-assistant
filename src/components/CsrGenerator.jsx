import { useMemo, useState } from "react";
import { generateCsrBundle, validateCsrForm } from "../utils/csrGenerator";

const initialForm = {
  keyType: "rsa-2048",
  commonName: "",
  organization: "",
  organizationalUnit: "",
  city: "",
  state: "",
  country: "",
  email: "",
  sanDns: "",
  sanIps: "",
};

const fieldStyle = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 10,
  background: "#131720",
  border: "1px solid #1E2535",
  color: "#E8ECF4",
  fontSize: 13,
};

const labelStyle = {
  display: "block",
  marginBottom: 7,
  color: "#8B95A8",
  fontSize: 12,
  fontWeight: 800,
};

const panelStyle = {
  background: "#131720",
  border: "1px solid #1E2535",
  borderRadius: 14,
  padding: 16,
  marginTop: 18,
};

const CsrGenerator = ({ t, onBack }) => {
  const labels = t.csrGeneratorPage;
  const [form, setForm] = useState(initialForm);
  const [bundle, setBundle] = useState(null);
  const [errors, setErrors] = useState({});
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState("");

  const opensslPreview = useMemo(() => {
    try {
      return bundle?.opensslCommand || "";
    } catch {
      return "";
    }
  }, [bundle]);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setBundle(null);
    setErrors({});
  };

  const copy = async (key, value) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(""), 1600);
  };

  const download = (filename, content) => {
    const blob = new Blob([content], { type: "application/x-pem-file" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    const validation = validateCsrForm(form);
    if (Object.keys(validation.errors).length) {
      setErrors(validation.errors);
      return;
    }

    setGenerating(true);
    setErrors({});
    try {
      setBundle(await generateCsrBundle(form));
    } catch (error) {
      setErrors(error.validation || { general: error.message });
    } finally {
      setGenerating(false);
    }
  };

  const renderError = (key) => {
    if (!errors[key]) return null;
    return <div style={{ marginTop: 5, color: "#FF4D6A", fontSize: 11 }}>{labels.errors[key] || labels.errors.general}</div>;
  };

  return (
    <div>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: "#8B95A8", cursor: "pointer",
        fontSize: 13, marginBottom: 16,
      }}>← {t.home}</button>

      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
        🔐 {labels.title}
      </h2>
      <p style={{ color: "#8B95A8", fontSize: 14, marginBottom: 18 }}>{labels.subtitle}</p>

      <div style={{
        padding: 14,
        borderRadius: 12,
        border: "1px solid #FBBF2444",
        background: "#1A1710",
        color: "#FDE68A",
        fontSize: 13,
        marginBottom: 18,
      }}>
        {labels.privateKeyWarning}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        <div>
          <label style={labelStyle}>{labels.keyType}</label>
          <select value={form.keyType} onChange={(e) => update("keyType", e.target.value)} style={fieldStyle}>
            {labels.keyTypes.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>{labels.commonName}</label>
          <input value={form.commonName} onChange={(e) => update("commonName", e.target.value)} placeholder="example.com" style={fieldStyle} />
          {renderError("commonName")}
        </div>
        <div>
          <label style={labelStyle}>{labels.organization}</label>
          <input value={form.organization} onChange={(e) => update("organization", e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>{labels.organizationalUnit}</label>
          <input value={form.organizationalUnit} onChange={(e) => update("organizationalUnit", e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>{labels.city}</label>
          <input value={form.city} onChange={(e) => update("city", e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>{labels.state}</label>
          <input value={form.state} onChange={(e) => update("state", e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>{labels.country}</label>
          <input value={form.country} onChange={(e) => update("country", e.target.value.toUpperCase().slice(0, 2))} placeholder="US" style={fieldStyle} />
          {renderError("country")}
        </div>
        <div>
          <label style={labelStyle}>{labels.email}</label>
          <input value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="admin@example.com" style={fieldStyle} />
          {renderError("email")}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 14 }}>
        <div>
          <label style={labelStyle}>{labels.sanDns}</label>
          <textarea value={form.sanDns} onChange={(e) => update("sanDns", e.target.value)} placeholder={"example.com\nwww.example.com"} style={{ ...fieldStyle, height: 95, resize: "vertical", fontFamily: "'JetBrains Mono', monospace" }} />
          {renderError("sanDns")}
        </div>
        <div>
          <label style={labelStyle}>{labels.sanIps}</label>
          <textarea value={form.sanIps} onChange={(e) => update("sanIps", e.target.value)} placeholder={"192.0.2.10\n2001:db8::10"} style={{ ...fieldStyle, height: 95, resize: "vertical", fontFamily: "'JetBrains Mono', monospace" }} />
          {renderError("sanIps")}
        </div>
      </div>

      {errors.general && <div style={{ marginTop: 10, color: "#FF4D6A", fontSize: 13 }}>{errors.general}</div>}

      <button onClick={submit} disabled={generating} style={{
        marginTop: 16,
        padding: "12px 22px",
        borderRadius: 10,
        border: "none",
        background: "#00D4AA",
        color: "#0B0E14",
        fontWeight: 900,
        cursor: generating ? "not-allowed" : "pointer",
      }}>
        {generating ? labels.generating : labels.generate}
      </button>

      {bundle && (
        <div style={panelStyle}>
          <h3 style={{ marginTop: 0, marginBottom: 10 }}>{labels.generated}</h3>
          {[
            ["csr", labels.csr, bundle.csrPem, "request.csr"],
            ["key", labels.privateKey, bundle.privateKeyPem, "private.key"],
            ["openssl", labels.opensslCommand, opensslPreview, "openssl-command.txt"],
          ].map(([key, title, content, filename]) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <strong>{title}</strong>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => copy(key, content)} style={{ background: "#0F131C", border: "1px solid #00D4AA55", color: "#00D4AA", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 800 }}>
                    {copied === key ? labels.copied : labels.copy}
                  </button>
                  <button onClick={() => download(filename, content)} style={{ background: "#0F131C", border: "1px solid #38BDF855", color: "#38BDF8", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 800 }}>
                    {labels.export}
                  </button>
                </div>
              </div>
              <pre style={{
                background: "#0B0E14",
                border: "1px solid #1E2535",
                borderRadius: 10,
                padding: 12,
                color: "#E8ECF4",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: key === "key" ? 260 : 220,
                overflow: "auto",
                fontSize: 12,
              }}>{content}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CsrGenerator;
