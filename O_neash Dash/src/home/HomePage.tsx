import { useEffect, useRef, useState } from "react";
import ClockPlugin from "../plugins/ClockPlugin/ClockPlugin";
import { LaunchMenu } from "./LaunchMenu";
import { HackerNews } from "../widgets/widgets/HackerNews";
import { ResearchFeed } from "../widgets/widgets/ResearchFeed";
import { usePlannerStore } from "../plugins/PlannerPlugin/store/usePlannerStore";
import { QuickActionButtons } from "./quick-actions/QuickActionButtons";
import { WeatherPanel } from "./weather/WeatherPanel";
import { usePersonalSettingsStore } from '../store/usePersonalSettingsStore';
import { feedEnabled, pluginEnabled } from '../lib/personalFeaturePolicy';
import './HomePage.css';
import { QuotePanel } from "./quote/QuotePanel";

// Eye positions calibrated to cyphel_grey_noeyes.png at 140×140px
const EYES = [
  { left: 56.5, top: 70 }, // left eye
  { left: 74.5, top: 70 }, // right eye
];
const EYE_SIZE = 9; // diameter in px

function AvatarWithEyes() {
  const [blink, setBlink] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const doBlink = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 130);
      timerRef.current = setTimeout(doBlink, 2200 + Math.random() * 2800);
    };
    timerRef.current = setTimeout(doBlink, 1000 + Math.random() * 1500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div style={{ position: "relative", width: 140, height: 140, flexShrink: 0 }}>
      <img
        src="/icons/character/cyphel_grey_noeyes.png"
        alt="avatar"
        style={{ width: 140, height: 140, objectFit: "cover", display: "block" }}
      />
      {EYES.map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: pos.left,
            top: pos.top,
            width: EYE_SIZE,
            height: EYE_SIZE,
            borderRadius: "50%",
            background: "transparent",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#fff",
              transformOrigin: "bottom",
              transform: blink ? "scaleY(0)" : "scaleY(1)",
              transition: blink
                ? "transform 0.07s ease-in"
                : "transform 0.09s ease-out",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function HomePage() {
  const { settings, loaded, error } = usePersonalSettingsStore();
  const ready = loaded && !error;
  const showNews = feedEnabled('news', settings, ready);
  const showResearch = feedEnabled('research', settings, ready);
  const showWeather = feedEnabled('weather', settings, ready);
  const showQuotes = feedEnabled('quotes', settings, ready);
  const plannerVisible = pluginEnabled('planner', settings.disabledPluginIds, ready);
  const loadAll = usePlannerStore((s) => s.loadAll);

  useEffect(() => {
    if (plannerVisible) void loadAll();
  }, [loadAll, plannerVisible]);

  return (
    <div className="personal-home"
      style={{
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        padding: "0 6vw",
      }}
    >
      <div className="personal-home-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "auto auto",
          columnGap: "4vw",
          rowGap: 32,
          alignItems: "start",
          justifyContent: "center",
        }}
      >
        {/* ── Avatar + clock ── */}
        <div className="personal-home-header" style={{ gridColumn: "1 / 3", gridRow: 1, display: "flex", alignItems: "flex-start" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
              flexShrink: 0,
              marginTop: 20,
            }}
          >
            {settings.avatarDataUrl ? <img src={settings.avatarDataUrl} alt="Profile" style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 12 }} /> : <AvatarWithEyes />}
            <div style={{ fontFamily: "var(--font-main), var(--font-kr), monospace" }}>
              <div
                style={{
                  fontSize: "0.9rem",
                  color: "rgba(255,255,255,0.35)",
                  letterSpacing: "2px",
                }}
              >
                {settings.displayName ? "Welcome," : "Welcome"}
              </div>
              <div
                style={{
                  fontSize: "1.7rem",
                  color: "#fff",
                  letterSpacing: "3px",
                  lineHeight: 1.1,
                  maxWidth: 200,
                  overflowWrap: "anywhere",
                }}
              >
                {settings.displayName}
              </div>
            </div>
          </div>

          <ClockPlugin />

          <div style={{ marginLeft: "auto", marginTop: 20 }}>
            {showWeather && <WeatherPanel />}
          </div>

          <div style={{ marginLeft: 32, alignSelf: "stretch", paddingTop: 20, boxSizing: "border-box" }}>
            <QuickActionButtons />
          </div>
        </div>

        {/* ── News / research feeds ── */}
        <div className="personal-home-feeds" style={{ gridColumn: 1, gridRow: 2, display: "flex", flexDirection: "column", gap: 10, width: 580 }}>
          <div style={{ position: "relative" }}>
            {showNews && <HackerNews size="2x2" instanceId="home-hn" />}
          </div>
          <div style={{ position: "relative" }}>
            {showResearch && <ResearchFeed size="2x2" instanceId="home-research" />}
          </div>
        </div>

        {/* ── App selector — top-aligned with the news feeds ── */}
        <div className="personal-home-launcher" style={{ gridColumn: 2, gridRow: 2, flexShrink: 0 }}>
          <LaunchMenu />
        </div>
      </div>

      {/* ── Quote of the day — bottom center ── */}
      <div className="personal-home-quote"
        style={{
          position: "absolute",
          bottom: 28,
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
        }}
      >
        {showQuotes && <QuotePanel />}
      </div>

    </div>
  );
}

export default HomePage;
