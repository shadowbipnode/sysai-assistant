import { useState } from "react";

const Troubleshooter = ({ t, onDiagnose, onBack }) => {
  const [problem, setProblem] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [solution, setSolution] = useState(null);

  const handleStart = async () => {
    if (!problem.trim()) return;
    setAnalyzing(true);
    const response = await onDiagnose(problem, "start");
    if (response && response.questions) {
      setQuestions(response.questions);
      setAnswers(new Array(response.questions.length).fill(""));
      setStep(1);
    }
    setAnalyzing(false);
  };

  const handleAnswer = async (questionIndex, answer) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = answer;
    setAnswers(newAnswers);

    if (questionIndex === questions.length - 1) {
      // Ultima domanda, ottieni soluzione
      setAnalyzing(true);
      const response = await onDiagnose(problem, "solve", newAnswers, questions);
      if (response) {
        setSolution(response);
        setStep(3);
      }
      setAnalyzing(false);
    } else {
      setStep(step + 1);
    }
  };

  const restart = () => {
    setProblem("");
    setQuestions([]);
    setAnswers([]);
    setSolution(null);
    setStep(0);
  };

  return (
    <div>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: "#8B95A8", cursor: "pointer",
        fontSize: 13, marginBottom: 16,
      }}>← {t.home}</button>

      {step === 0 && (
        <>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>🔧 {t.troubleshootPage.title}</h2>
          <p style={{ color: "#8B95A8", fontSize: 14, marginBottom: 20 }}>{t.troubleshootPage.subtitle}</p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#8B95A8", marginBottom: 8, display: "block" }}>
              {t.troubleshootPage.startLabel}
            </label>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder={t.troubleshootPage.placeholder}
              style={{
                width: "100%", height: 100, padding: 16, borderRadius: 12,
                background: "#131720", border: "1px solid #1E2535",
                color: "#E8ECF4", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                resize: "vertical",
              }}
            />
          </div>

          <button onClick={handleStart} style={{
            padding: "12px 28px", background: "#00D4AA", color: "#0B0E14",
            border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>
            {analyzing ? t.troubleshootPage.diagnosing : t.troubleshootPage.start}
          </button>
        </>
      )}

      {step >= 1 && step <= 2 && questions.length > 0 && !solution && (
        <div style={{ animation: "slideInRight 0.3s ease" }}>
          <div style={{
            background: "#00D4AA22", borderLeft: `4px solid #00D4AA`,
            padding: "16px 20px", borderRadius: 12, marginBottom: 24,
          }}>
            <div style={{ fontSize: 13, color: "#00D4AA", fontWeight: 600, marginBottom: 8 }}>
              {t.troubleshootPage.question} {step}/{questions.length}
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              {questions[step - 1]?.text}
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {questions[step - 1]?.options?.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(step - 1, opt)}
                  style={{
                    textAlign: "left", padding: "12px 16px", borderRadius: 8,
                    background: "#131720", border: "1px solid #1E2535",
                    color: "#E8ECF4", cursor: "pointer", fontSize: 14,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#00D4AA"; e.currentTarget.style.background = "#1A1F2E"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1E2535"; e.currentTarget.style.background = "#131720"; }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {solution && (
        <div style={{ animation: "slideInRight 0.3s ease" }}>
          <div style={{
            background: "#00D4AA22", border: `1px solid #00D4AA33`,
            borderRadius: 12, padding: 20, marginBottom: 16,
          }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#00D4AA" }}>
              🎯 {t.troubleshootPage.solution}
            </h3>
            <div style={{
              background: "#131720", borderRadius: 8, padding: 16, marginBottom: 16,
            }}>
              <p style={{ fontSize: 14, color: "#E8ECF4", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {solution.explanation}
              </p>
            </div>
            {solution.fix && (
              <div style={{
                background: "#0B0E14", border: `1px solid #00D4AA33`, borderRadius: 8,
                overflow: "hidden",
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 16px", background: "#00D4AA22",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#00D4AA" }}>🛠️ FIX</span>
                  <button onClick={() => navigator.clipboard.writeText(solution.fix)} style={{
                    background: "none", border: "1px solid #00D4AA44", borderRadius: 6,
                    color: "#00D4AA", padding: "4px 12px", fontSize: 11, cursor: "pointer",
                  }}>📋 Copy</button>
                </div>
                <pre style={{
                  padding: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                  color: "#E8ECF4", whiteSpace: "pre-wrap", overflowX: "auto",
                }}>{solution.fix}</pre>
              </div>
            )}
          </div>
          
          <button onClick={restart} style={{
            padding: "10px 20px", background: "#1A1F2E", border: `1px solid #1E2535`,
            borderRadius: 8, color: "#8B95A8", cursor: "pointer", fontSize: 13,
          }}>
            🔄 Start New Diagnosis
          </button>
        </div>
      )}
    </div>
  );
};

export default Troubleshooter;
