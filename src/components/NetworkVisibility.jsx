import { useEffect, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { networkStats, networkConnections } from "../utils/scanners";

const box = {
  background: "#131720",
  border: "1px solid #1E2535",
  borderRadius: 18,
  padding: 18,
};

const trafficOption = {
  backgroundColor: "transparent",
  tooltip: {
    trigger: "axis"
  },
  grid: {
    left: 40,
    right: 20,
    top: 40,
    bottom: 40
  },
  xAxis: {
    type: "category",
    boundaryGap: false,
    data: ["10:00", "10:05", "10:10", "10:15", "10:20", "10:25"],
    axisLine: {
      lineStyle: {
        color: "#3A455B"
      }
    }
  },
  yAxis: {
    type: "value",
    axisLine: {
      lineStyle: {
        color: "#3A455B"
      }
    },
    splitLine: {
      lineStyle: {
        color: "#1E2535"
      }
    }
  },
  series: [
    {
      name: "Traffic",
      type: "line",
      smooth: true,
      data: [12, 18, 9, 22, 31, 16],
      areaStyle: {},
      lineStyle: {
        width: 4
      },
      symbol: "none"
    }
  ]
};

const protocolOption = {
  backgroundColor: "transparent",
  tooltip: {
    trigger: "item"
  },
  series: [
    {
      type: "pie",
      radius: ["55%", "78%"],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 8,
        borderColor: "#0B0E14",
        borderWidth: 4
      },
      label: {
        color: "#E8ECF4"
      },
      data: [
        { value: 420, name: "HTTPS" },
        { value: 180, name: "DNS" },
        { value: 44, name: "SSH" },
        { value: 28, name: "NTP" },
        { value: 17, name: "HTTP" }
      ]
    }
  ]
};

const NetworkVisibility = () => {
  const [samples, setSamples] = useState([]);
  const [interfaces, setInterfaces] = useState([]);
  const [connections, setConnections] = useState([]);
  const lastStatsRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const tick = async () => {
      try {
        const stats = await networkStats();
        if (!mounted || !stats?.success) return;

        const total = stats.interfaces.reduce((acc, item) => {
          acc.rxBytes += item.rxBytes;
          acc.txBytes += item.txBytes;
          acc.rxPackets += item.rxPackets;
          acc.txPackets += item.txPackets;
          return acc;
        }, { rxBytes: 0, txBytes: 0, rxPackets: 0, txPackets: 0 });

        const now = new Date();
        const label = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

        let rxMbps = 0;
        let txMbps = 0;
        let mbps = 0;
        let pps = 0;

        if (lastStatsRef.current) {
          const seconds = Math.max((stats.timestamp - lastStatsRef.current.timestamp) / 1000, 1);
          const rxBytesDelta = total.rxBytes - lastStatsRef.current.total.rxBytes;
          const txBytesDelta = total.txBytes - lastStatsRef.current.total.txBytes;
          const packetsDelta = (total.rxPackets + total.txPackets) - (lastStatsRef.current.total.rxPackets + lastStatsRef.current.total.txPackets);

          rxMbps = Number(((rxBytesDelta * 8) / seconds / 1000 / 1000).toFixed(2));
          txMbps = Number(((txBytesDelta * 8) / seconds / 1000 / 1000).toFixed(2));
          mbps = Number((rxMbps + txMbps).toFixed(2));
          pps = Math.max(Math.round(packetsDelta / seconds), 0);
        }

        setInterfaces(stats.interfaces);
        setSamples((prev) => [...prev.slice(-29), { time: label, rxMbps, txMbps, mbps, pps }]);
        lastStatsRef.current = { timestamp: stats.timestamp, total };

        const connectionStats = await networkConnections();
        if (connectionStats?.success) {
          setConnections(connectionStats.connections || []);
        }
      } catch (error) {
        console.warn("Network stats failed", error.message);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const downloadOption = {
    ...trafficOption,
    xAxis: {
      ...trafficOption.xAxis,
      data: samples.map((sample) => sample.time)
    },
    series: [
      {
        ...trafficOption.series[0],
        name: "Download Mbps",
        data: samples.map((sample) => sample.rxMbps)
      }
    ]
  };

  const uploadOption = {
    ...trafficOption,
    xAxis: {
      ...trafficOption.xAxis,
      data: samples.map((sample) => sample.time)
    },
    series: [
      {
        ...trafficOption.series[0],
        name: "Upload Mbps",
        data: samples.map((sample) => sample.txMbps)
      }
    ]
  };

  const packetsOption = {
    ...trafficOption,
    xAxis: {
      ...trafficOption.xAxis,
      data: samples.map((sample) => sample.time)
    },
    series: [
      {
        ...trafficOption.series[0],
        name: "Packets/sec",
        data: samples.map((sample) => sample.pps)
      }
    ]
  };

  const latestSample = samples[samples.length - 1];

  const currentMbps = latestSample?.mbps || 0;
  const currentPps = latestSample?.pps || 0;
  const primaryInterface = interfaces[0]?.interface || "N/A";
  const protocolCounts = connections.reduce((acc, conn) => {
    const key = String(conn.netid || "unknown").toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topPorts = connections.reduce((acc, conn) => {
    const address = `${conn.local || ""} ${conn.peer || ""}`;
    const matches = address.match(/:(\d{1,5})/g) || [];
    matches.forEach((match) => {
      const port = match.slice(1);
      acc[port] = (acc[port] || 0) + 1;
    });
    return acc;
  }, {});
  const dynamicProtocolOption = {
    ...protocolOption,
    series: [{
      ...protocolOption.series[0],
      data: Object.entries(protocolCounts).map(([name, value]) => ({ name, value }))
    }]
  };
  const exportReport = () => {
    const lines = [
      "# Live Network Visibility Report",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Current throughput: ${currentMbps} Mbps`,
      `Packets/sec: ${currentPps}`,
      `Interfaces: ${interfaces.length}`,
      `Connections: ${connections.length}`,
      "",
      "## Top Ports",
      ...Object.entries(topPorts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([port, count]) => `- ${port}: ${count} reference(s)`),
      "",
      "## Active Connections",
      ...connections.slice(0, 50).map((conn) => `- ${conn.netid || "-"} ${conn.state || "-"} ${conn.local || "-"} -> ${conn.peer || "-"} ${conn.process || ""}`.trim())
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "network-visibility-report.md";
    link.click();
    URL.revokeObjectURL(url);
  };


  return (
    <div style={{ marginTop: 24 }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 18
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800
          }}>
            🌐 Live Network Visibility
          </h2>

          <p style={{
            marginTop: 8,
            color: "#8B95A8"
          }}>
            Real-time operational traffic visibility and protocol intelligence
          </p>
        </div>

        <div style={{
          padding: "8px 14px",
          borderRadius: 999,
          background: "#0D2A22",
          border: "1px solid #00D4AA",
          color: "#00D4AA",
          fontWeight: 700
        }}>
          LIVE
        </div>
        <button onClick={exportReport} style={{
          padding: "8px 14px",
          borderRadius: 999,
          background: "#1A1F2E",
          border: "1px solid #38BDF855",
          color: "#38BDF8",
          fontWeight: 700,
          cursor: "pointer"
        }}>
          Export report
        </button>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 14,
        marginBottom: 18
      }}>
        {[
          {
            label: "Current throughput",
            value: `${currentMbps} Mbps`
          },
          {
            label: "Packets/sec",
            value: currentPps
          },
          {
            label: "Interfaces",
            value: interfaces.length
          },
          {
            label: "Primary interface",
            value: primaryInterface
          }
        ].map((item) => (
          <div key={item.label} style={{
            ...box,
            padding: 16
          }}>
            <div style={{
              color: "#8B95A8",
              fontSize: 12,
              marginBottom: 8
            }}>
              {item.label}
            </div>

            <div style={{
              fontSize: 24,
              fontWeight: 800
            }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 18
      }}>
        <div style={box}>
          <div style={{
            marginBottom: 12,
            fontWeight: 700,
            fontSize: 16
          }}>
            Download throughput (RX Mbps)
          </div>

          <ReactECharts
            option={downloadOption}
            style={{ height: 260 }}
          />
        </div>

        <div style={box}>
          <div style={{
            marginBottom: 12,
            fontWeight: 700,
            fontSize: 16
          }}>
            Upload throughput (TX Mbps)
          </div>

          <ReactECharts
            option={uploadOption}
            style={{ height: 260 }}
          />
        </div>

        <div style={box}>
          <div style={{
            marginBottom: 12,
            fontWeight: 700,
            fontSize: 16
          }}>
            Packet rate (packets/sec)
          </div>

          <ReactECharts
            option={packetsOption}
            style={{ height: 260 }}
          />
        </div>

        <div style={box}>
          <div style={{
            marginBottom: 12,
            fontWeight: 700,
            fontSize: 16
          }}>
            Protocol distribution
          </div>

          <ReactECharts
            option={dynamicProtocolOption}
            style={{ height: 360 }}
          />
        </div>
      </div>

      <div style={{ ...box, marginTop: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>
          Top local ports
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(topPorts).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([port, count]) => (
            <div key={port} style={{ padding: "8px 10px", borderRadius: 999, background: "#0F131C", border: "1px solid #1E2535", color: "#B8C0D0", fontSize: 12 }}>
              {port} · {count}
            </div>
          ))}
          {Object.keys(topPorts).length === 0 && <div style={{ color: "#8B95A8", fontSize: 13 }}>No port summary available.</div>}
        </div>
      </div>

      <div style={{ ...box, marginTop: 18 }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              Live connections
            </div>
            <div style={{ color: "#8B95A8", fontSize: 13, marginTop: 4 }}>
              Active TCP/UDP sockets from the local system
            </div>
          </div>

          <div style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: "#1A1F2E",
            border: "1px solid #2A3246",
            color: "#8B95A8",
            fontSize: 12
          }}>
            {connections.length} connections
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "90px 110px 1fr 1fr 1fr",
          gap: 8,
          color: "#8B95A8",
          fontSize: 12,
          fontWeight: 700,
          padding: "0 8px 8px"
        }}>
          <div>Proto</div>
          <div>State</div>
          <div>Local</div>
          <div>Peer</div>
          <div>Process</div>
        </div>

        <div style={{ display: "grid", gap: 6, maxHeight: 320, overflow: "auto" }}>
          {connections.length === 0 ? (
            <div style={{ color: "#8B95A8", padding: 12 }}>
              No active connections detected.
            </div>
          ) : (
            connections.slice(0, 30).map((conn, index) => (
              <div key={`${conn.local}-${conn.peer}-${index}`} style={{
                display: "grid",
                gridTemplateColumns: "90px 110px 1fr 1fr 1fr",
                gap: 8,
                alignItems: "center",
                padding: "10px 8px",
                borderRadius: 10,
                background: "#0F131C",
                border: "1px solid #1E2535",
                fontSize: 12
              }}>
                <div style={{ color: "#00D4AA", fontWeight: 800 }}>{conn.netid}</div>
                <div>{conn.state || "-"}</div>
                <div style={{ color: "#B8C0D0", overflow: "hidden", textOverflow: "ellipsis" }}>{conn.local}</div>
                <div style={{ color: "#B8C0D0", overflow: "hidden", textOverflow: "ellipsis" }}>{conn.peer}</div>
                <div style={{ color: "#8B95A8", overflow: "hidden", textOverflow: "ellipsis" }}>{conn.process || "-"}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkVisibility;
