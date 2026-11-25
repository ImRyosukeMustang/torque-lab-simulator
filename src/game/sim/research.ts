export interface ResearchProject {
  id: string;
  name: string;
  field: "aerodynamics" | "chassis";
  description: string;
  partId: string;
  cost: number;
  requiredChallenge: string;
}

export const RESEARCH_PROJECTS: ResearchProject[] = [
  {
    id: "cfd-ground-effects",
    name: "Ground-Effect CFD",
    field: "aerodynamics",
    description: "Model the splitter, flat floor and diffuser as one underbody package.",
    partId: "aero-gt",
    cost: 5,
    requiredChallenge: "c3",
  },
  {
    id: "swan-neck-wing",
    name: "Swan-Neck Wing Study",
    field: "aerodynamics",
    description: "Refine the wing mount to keep the suction side clear and gain downforce efficiently.",
    partId: "wing-swan",
    cost: 7,
    requiredChallenge: "c4",
  },
  {
    id: "wide-track-tyres",
    name: "Wide-Track Tyre Programme",
    field: "chassis",
    description: "Validate a wider footprint and the bodywork needed to clear it.",
    partId: "body-wide",
    cost: 6,
    requiredChallenge: "c4",
  },
];

export function researchProjectForPart(partId: string): ResearchProject | undefined {
  return RESEARCH_PROJECTS.find((project) => project.partId === partId);
}
