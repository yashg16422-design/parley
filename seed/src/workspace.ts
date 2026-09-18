/**
 * The fictional workspace: Driftwood, a B2B customer-feedback analytics company
 * preparing to launch "Insights 2.0" (AI theme clustering). Every meeting in the
 * seed threads through the same storylines - the Insights 2.0 beta, SAML SSO
 * blocking enterprise deals, pricing for AI features - so cross-meeting search
 * has something real to find.
 *
 * All domains use the reserved .example TLD.
 */
import type { DatasetInput } from "../../src/db/seed/fixtures";

type Users = NonNullable<DatasetInput["users"]>;
type Events = NonNullable<DatasetInput["calendarEvents"]>;

export const D = (handle: string) => `${handle}@driftwood.example`;

export const people = {
  maya: { name: "Maya Chen", title: "VP of Product" },
  raj: { name: "Raj Patel", title: "Engineering Lead, Platform" },
  priya: { name: "Priya Nair", title: "Staff ML Engineer" },
  marcus: { name: "Marcus Johnson", title: "Head of Design" },
  elena: { name: "Elena Rossi", title: "Product Marketing Lead" },
  tom: { name: "Tom Becker", title: "Customer Success Lead" },
  aisha: { name: "Aisha Bello", title: "Director of Sales" },
  daniel: { name: "Daniel Kim", title: "Senior PM, Integrations" },
  sam: { name: "Sam Okafor", title: "Software Engineer" },
  lena: { name: "Lena Weiss", title: "Software Engineer" },
  noah: { name: "Noah Fischer", title: "Solutions Engineer" },
  chris: { name: "Chris Alvarez", title: "CEO" },
  helen: { name: "Helen Park", title: "CFO" },
} as const;

export type Handle = keyof typeof people;

/** Participant entry for an internal user, for use in meeting sources. */
export const staff = (h: Handle) => ({ name: people[h].name, user: D(h), title: people[h].title });

export const users: Users = (Object.keys(people) as Handle[]).map((h) => ({
  email: D(h),
  name: people[h].name,
  title: people[h].title,
  timezone: h === "elena" ? "Europe/Rome" : h === "daniel" ? "America/Los_Angeles" : "America/New_York",
}));

export const calendarConnections: NonNullable<DatasetInput["calendarConnections"]> = [
  { userEmail: D("maya"), provider: "google", accountEmail: D("maya"), autoRecord: "all" },
  { userEmail: D("aisha"), provider: "google", accountEmail: D("aisha"), autoRecord: "external" },
  { userEmail: D("raj"), provider: "google", accountEmail: D("raj"), autoRecord: "all" },
  { userEmail: D("marcus"), provider: "google", accountEmail: D("marcus"), autoRecord: "all" },
  { userEmail: D("tom"), provider: "outlook", accountEmail: D("tom"), autoRecord: "external" },
  { userEmail: D("elena"), provider: "google", accountEmail: D("elena"), autoRecord: "all" },
];

const internal = (owner: Handle, ...hs: Handle[]) =>
  [owner, ...hs].map((h, i) => ({ name: people[h].name, email: D(h), responseStatus: "accepted" as const, isOrganizer: i === 0 }));
const guest = (name: string, email: string, responseStatus: "accepted" | "tentative" | "needsAction" = "accepted") => ({
  name,
  email,
  responseStatus,
  isOrganizer: false,
});

const squad: Handle[] = ["raj", "priya", "marcus", "sam", "lena"];

/** Upcoming (and a few unrecorded past) events so the calendar is never empty. */
export const upcomingEvents: Events = [
  // Daily squad standups, next two weeks (weekends aren't modelled - dates are relative).
  ...[1, 2, 3, 4, 7, 8, 9, 10, 11].map((d) => ({
    key: `up-standup-d${d}`,
    userEmail: D("maya"),
    title: "Insights squad standup",
    startsAt: `D+${d}@14:30`,
    durationMin: 15,
    platform: "google_meet" as const,
    attendees: internal("maya", ...squad),
  })),
  {
    key: "up-go-no-go",
    userEmail: D("maya"),
    title: "Insights 2.0 beta go/no-go",
    description: "Decide whether the beta ships to design partners. Inputs: Priya's precision eval, Raj's latency numbers, Tom's partner list.",
    startsAt: "D+10@17:00",
    durationMin: 45,
    platform: "zoom",
    attendees: internal("maya", "raj", "priya", "marcus", "elena", "tom", "daniel"),
  },
  {
    key: "up-globex-saml",
    userEmail: D("aisha"),
    title: "Globex: SAML SSO follow-up",
    description: "Walk Globex security through the SAML design and timeline.",
    startsAt: "D+4@16:00",
    durationMin: 30,
    platform: "zoom",
    attendees: [...internal("aisha", "maya", "daniel"), guest("Victor Hale", "victor.hale@globex.example"), guest("Nadia Simmons", "nadia.simmons@globex.example", "tentative")],
  },
  {
    key: "up-pricing-leadership",
    userEmail: D("maya"),
    title: "AI usage caps: pricing proposal review",
    startsAt: "D+5@18:00",
    durationMin: 45,
    platform: "google_meet",
    attendees: internal("maya", "chris", "helen", "aisha", "elena"),
  },
  {
    key: "up-interview-staff-data",
    userEmail: D("raj"),
    title: "Interview: Staff Data Engineer (Kwame Mensah)",
    startsAt: "D+2@19:00",
    durationMin: 60,
    platform: "zoom",
    attendees: [...internal("raj", "priya"), guest("Kwame Mensah", "kwame.mensah@mail.example")],
  },
  {
    key: "up-1on1-raj",
    userEmail: D("maya"),
    title: "Maya / Raj 1:1",
    startsAt: "D+3@19:30",
    durationMin: 30,
    platform: "google_meet",
    attendees: internal("maya", "raj"),
  },
  {
    key: "up-1on1-elena",
    userEmail: D("maya"),
    title: "Maya / Elena 1:1",
    startsAt: "D+6@15:00",
    durationMin: 30,
    platform: "google_meet",
    attendees: internal("maya", "elena"),
  },
  {
    key: "up-1on1-daniel",
    userEmail: D("maya"),
    title: "Maya / Daniel 1:1",
    startsAt: "D+2@21:00",
    durationMin: 30,
    platform: "google_meet",
    attendees: internal("maya", "daniel"),
  },
  {
    key: "up-kestrel-kickoff",
    userEmail: D("tom"),
    title: "Kestrel Logistics: design partner kickoff",
    startsAt: "D+6@17:00",
    durationMin: 45,
    platform: "teams",
    attendees: [...internal("tom", "maya", "aisha"), guest("Grace Liu", "grace.liu@kestrel.example"), guest("Ben Carter", "ben.carter@kestrel.example")],
  },
  {
    key: "up-leadership-sync",
    userEmail: D("chris"),
    title: "Weekly leadership sync",
    startsAt: "D+7@16:00",
    durationMin: 60,
    platform: "zoom",
    attendees: internal("chris", "maya", "aisha", "raj", "tom", "helen"),
  },
  {
    key: "up-design-crit",
    userEmail: D("marcus"),
    title: "Design crit: beta onboarding flow",
    startsAt: "D+2@17:30",
    durationMin: 45,
    platform: "google_meet",
    attendees: internal("marcus", "maya", "elena", "sam"),
  },
  {
    key: "up-arcadia-demo",
    userEmail: D("aisha"),
    title: "Arcadia Health: technical deep dive",
    startsAt: "D+5@15:00",
    durationMin: 60,
    platform: "zoom",
    attendees: [...internal("aisha", "noah", "daniel"), guest("Rosa Delgado", "rosa.delgado@arcadiahealth.example"), guest("Imran Qureshi", "imran.qureshi@arcadiahealth.example")],
  },
  {
    key: "up-launch-review",
    userEmail: D("elena"),
    title: "Beta launch comms review",
    startsAt: "D+8@15:30",
    durationMin: 30,
    platform: "google_meet",
    attendees: internal("elena", "maya", "tom", "marcus"),
  },
  {
    key: "up-cab",
    userEmail: D("tom"),
    title: "Customer Advisory Board (Q4)",
    description: "Quarterly session with 9 advisory customers. Preview of Insights 2.0 themes view.",
    startsAt: "D+12@14:30",
    durationMin: 90,
    platform: "zoom",
    attendees: [
      ...internal("tom", "maya", "chris", "elena"),
      guest("Olivia Grant", "olivia.grant@brightline.example"),
      guest("Grace Liu", "grace.liu@kestrel.example", "tentative"),
      guest("Hiro Tanaka", "hiro.tanaka@juniperfoods.example", "needsAction"),
    ],
  },
  {
    key: "up-offsite-prep",
    userEmail: D("maya"),
    title: "Q1 planning offsite prep",
    startsAt: "D+9@18:00",
    durationMin: 60,
    platform: "google_meet",
    attendees: internal("maya", "raj", "marcus", "daniel", "elena"),
  },
  {
    key: "up-latency-review",
    userEmail: D("raj"),
    title: "Clustering latency review",
    startsAt: "D+4@19:00",
    durationMin: 30,
    platform: "google_meet",
    attendees: internal("raj", "priya", "sam", "maya"),
  },
  {
    key: "up-juniper-discovery",
    userEmail: D("aisha"),
    title: "Juniper Foods: follow-up discovery",
    startsAt: "D+11@16:00",
    durationMin: 30,
    platform: "teams",
    attendees: [...internal("aisha", "noah"), guest("Hiro Tanaka", "hiro.tanaka@juniperfoods.example")],
  },
  {
    key: "up-security-review",
    userEmail: D("daniel"),
    title: "SAML SSO security design review",
    startsAt: "D+7@20:00",
    durationMin: 45,
    platform: "zoom",
    attendees: internal("daniel", "raj", "lena", "maya"),
  },
  {
    key: "up-board-prep",
    userEmail: D("maya"),
    title: "Board deck prep (not recorded)",
    startsAt: "D+12@17:00",
    durationMin: 60,
    platform: "zoom",
    attendees: internal("maya", "chris", "helen"),
    recordEnabled: false,
  },
  {
    key: "past-board-sync",
    userEmail: D("maya"),
    title: "Board metrics sync (not recorded)",
    startsAt: "D-5@20:00",
    durationMin: 30,
    platform: "zoom",
    attendees: internal("maya", "chris", "helen"),
    recordEnabled: false,
  },
  {
    key: "up-ga-readiness",
    userEmail: D("maya"),
    title: "Insights 2.0 beta kickoff with design partners",
    startsAt: "D+14@17:00",
    durationMin: 60,
    platform: "zoom",
    attendees: internal("maya", "raj", "priya", "marcus", "elena", "tom", "aisha", "daniel"),
  },
];
