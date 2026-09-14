import { lazy } from "react";
import type { PluginItem } from "@/types";

const NotesPlugin = lazy(() => import("./NotesPlugin/NotesPlugin"));
const PlannerPlugin = lazy(() => import("./PlannerPlugin/PlannerPlugin"));
const SettingsPlugin = lazy(() => import("./SettingsPlugin/SettingsPlugin"));
const SleepTrackerPlugin = lazy(() => import("./SleepTrackerPlugin/SleepTrackerPlugin"));
const ESRAPlugin = lazy(() => import("./ESRAPlugin/ESRAPlugin"));
const HabitsPlugin = lazy(() => import("./HabitsPlugin/HabitsPlugin"));
const JournalPlugin = lazy(() => import("./JournalPlugin/JournalPlugin"));
const ProjectsPlugin = lazy(() => import("./ProjectsPlugin/ProjectsPlugin"));
const AcademicPlugin = lazy(() => import("./AcademicPlugin/AcademicPlugin"));
const AnalyticsPlugin = lazy(() => import("./AnalyticsPlugin/AnalyticsPlugin"));
const WardrobePlugin = lazy(() => import("./WardrobePlugin/WardrobePlugin"));
const FilmNegLabPlugin = lazy(() => import("./FilmNegLabPlugin/FilmNegLabPlugin"));
const SnakePlugin = lazy(() => import("./SnakePlugin/SnakePlugin"));
const TwentyFortyEightPlugin = lazy(() => import("./TwentyFortyEightPlugin/TwentyFortyEightPlugin"));
const PongPlugin = lazy(() => import("./PongPlugin/PongPlugin"));
const BreakoutPlugin = lazy(() => import("./BreakoutPlugin/BreakoutPlugin"));
const AsteroidsPlugin = lazy(() => import("./AsteroidsPlugin/AsteroidsPlugin"));
const LunarLanderPlugin = lazy(() => import("./LunarLanderPlugin/LunarLanderPlugin"));
const ArtilleryDuelPlugin = lazy(() => import("./ArtilleryDuelPlugin/ArtilleryDuelPlugin"));
const BattleshipPlugin = lazy(() => import("./BattleshipPlugin/BattleshipPlugin"));

export const plugins: PluginItem[] = [
  { id: "notes",        name: "Notes",           component: NotesPlugin         },
  { id: "planner",      name: "Planner",         component: PlannerPlugin        },
  { id: "settings",     name: "Settings",        component: SettingsPlugin       },
  { id: "sleep-tracker",name: "Sleep Tracker",   component: SleepTrackerPlugin, section: "clinic" },
  { id: "esra",         name: "L'ESRA",          component: ESRAPlugin,          section: "lab"   },
  { id: "habits",       name: "Habits",          component: HabitsPlugin,        section: "clinic"},
  { id: "journal",      name: "Journal",         component: JournalPlugin        },
  { id: "projects",     name: "Arcs & Projects", component: ProjectsPlugin       },
  { id: "academic",     name: "Deep Planner",    component: AcademicPlugin,      section: "lab"   },
  { id: "analytics",   name: "Analytics",       component: AnalyticsPlugin                           },
  { id: "wardrobe",    name: "Wardrobe",        component: WardrobePlugin,      section: "studio" },
  { id: "filmneg",     name: "Film Neg Lab",    component: FilmNegLabPlugin,    section: "studio" },
  { id: "snake",       name: "Snake",           component: SnakePlugin,             section: "arcade" },
  { id: "2048",        name: "2048",            component: TwentyFortyEightPlugin,  section: "arcade" },
  { id: "pong",        name: "Pong",            component: PongPlugin,              section: "arcade" },
  { id: "breakout",    name: "Breakout",        component: BreakoutPlugin,          section: "arcade" },
  { id: "asteroids",   name: "Asteroids",       component: AsteroidsPlugin,         section: "arcade" },
  { id: "lunar-lander", name: "Lunar Lander",   component: LunarLanderPlugin,       section: "arcade" },
  { id: "artillery-duel", name: "Artillery Duel", component: ArtilleryDuelPlugin,   section: "arcade" },
  { id: "battleship",  name: "Battleship",      component: BattleshipPlugin,        section: "arcade" },
];
