import { type Line, type MeetingSource, withScenes } from "../dsl";
import { interviewBackend, interviewCsm, interviewDesigner } from "./interviews";
import { designCrit, launchPlanning, postmortem } from "./internal";
import { brightlineCheckin, leadershipSync, pricingSession } from "./leadership";
import { oneOnOneDaniel, oneOnOneElena, oneOnOneRaj } from "./one-on-ones";
import q4 from "./q4-alignment";
import { arcadiaDiscovery, globexSecurity, juniperIntro, kestrelDiscovery } from "./sales";
import { internalScenes } from "./scenes-internal";
import { peopleScenes } from "./scenes-people";
import { round2Scenes } from "./scenes-round2";
import { round3Scenes } from "./scenes-round3";
import { round4Scenes } from "./scenes-round4";
import { round5Scenes } from "./scenes-round5";
import { round6Scenes } from "./scenes-round6";
import { salesScenes } from "./scenes-sales";
import { standupD1, standupD3, standupD8 } from "./standups";

const passes = [salesScenes, peopleScenes, internalScenes, round2Scenes, round3Scenes, round4Scenes, round5Scenes, round6Scenes];
const scenes: Record<string, Record<string, Line[]>> = {};
for (const pass of passes) {
  for (const [key, byAnchor] of Object.entries(pass)) {
    const merged = (scenes[key] ??= {});
    for (const [anchor, lines] of Object.entries(byAnchor)) merged[anchor] = [...(merged[anchor] ?? []), ...lines];
  }
}

/** Hero meeting first, then supporting meetings newest-first. */
const base: MeetingSource[] = [
  q4,
  standupD1,
  pricingSession,
  globexSecurity,
  standupD3,
  designCrit,
  interviewBackend,
  launchPlanning,
  oneOnOneRaj,
  oneOnOneDaniel,
  leadershipSync,
  interviewDesigner,
  oneOnOneElena,
  standupD8,
  kestrelDiscovery,
  brightlineCheckin,
  interviewCsm,
  juniperIntro,
  arcadiaDiscovery,
  postmortem,
];

const unknown = Object.keys(scenes).filter((k) => !base.some((m) => m.key === k));
if (unknown.length) throw new Error(`scenes for unknown meetings: ${unknown.join(", ")}`);

export const meetings: MeetingSource[] = base.map((m) => withScenes(m, scenes[m.key]));
