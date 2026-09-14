import { usePersonalSettingsStore } from '../../../store/usePersonalSettingsStore';
import { analyticsSelection } from '../../../lib/personalFeaturePolicy';
import { useState } from "react";
import PlannerPanel from "../panels/planner/PlannerPanel";
import SleepPanel from "../panels/sleep/SleepPanel";
import PlannerSleepPanel from "../panels/planner-sleep/PlannerSleepPanel";

const VT = "var(--font-main), var(--font-kr), monospace";

interface PluginDef {
  id: "planner" | "sleep";
  label: string;
  color: string;
}

const PLUGINS: PluginDef[] = [
  { id: "planner",  label: "Planner",          color: "#00c4a7" },
  { id: "sleep",    label: "Sleep Tracker",     color: "#60a5fa" },
];

function PluginChip({
  plugin,
  selected,
  onToggle,
}: {
  plugin: PluginDef;
  selected: boolean;
  onToggle: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: selected ? plugin.color : "transparent",
        border: `1.5px solid ${selected ? plugin.color : hov ? plugin.color : "rgba(255,255,255,0.18)"}`,
        color: selected ? "#000" : hov ? plugin.color : "rgba(255,255,255,0.55)",
        fontFamily: VT,
        fontSize: "1rem",
        letterSpacing: "2px",
        textTransform: "uppercase",
        padding: "0.15rem 0.75rem",
        cursor: "pointer",
        transition: "background 0.12s, border-color 0.12s, color 0.12s",
        lineHeight: 1.4,
        userSelect: "none",
        borderRadius: 0,
      }}
    >
      {plugin.label}
    </button>
  );
}

export default function HubView() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { settings, loaded, error } = usePersonalSettingsStore();
  const ready = loaded && !error;
  const available = PLUGINS.filter(plugin => ready && settings.analytics[plugin.id]);
  const selection = analyticsSelection(selected, settings.analytics, ready);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div
      style={{
        height: "100%",
        background: "#000",
        color: "#fff",
        fontFamily: VT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "72px 80px 60px",
        boxSizing: "border-box",
        overflow: "hidden",
        gap: "2.5rem",
      }}
    >
      {/* Header + chips */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.2rem",
          flexShrink: 0,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "2.2rem",
              letterSpacing: "8px",
              textTransform: "uppercase",
              color: "#00c4a7",
              lineHeight: 1,
              marginBottom: "0.3rem",
            }}
          >
            analytics
          </div>
          <div
            style={{
              fontSize: "0.9rem",
              letterSpacing: "2px",
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase",
            }}
          >
            {available.length ? "select one or more data sources" : "Enable Planner or Sleep analytics in Settings"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.6rem",
            justifyContent: "center",
          }}
        >
          {available.map((p) => (
            <PluginChip
              key={p.id}
              plugin={p}
              selected={selected.has(p.id)}
              onToggle={() => toggle(p.id)}
            />
          ))}
        </div>
      </div>

      {/* Graph grid — appears when a plugin is selected */}
      {selection !== null && (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            flexShrink: 0,
          }}
        >
          {selection === "planner" ? (
            <PlannerPanel />
          ) : selection === "sleep" ? (
            <SleepPanel />
          ) : selection === "combined" ? (
            <PlannerSleepPanel />
          ) : null}
        </div>
      )}
    </div>
  );
}
