import { CHALLENGES } from "./challenges";
import { findPart } from "./parts";

const FEATURE_PART_IDS = [
  "intake-hf",
  "body-light-coupe",
  "engine-i5-25",
  "body-fourdoor-coupe",
  "turbo-t35",
  "clutch-stage2",
  "dt-fwd",
  "body-hatch",
  "cam-vvt",
  "engine-v6-32",
  "diff-helical",
  "fuel-e85",
  "ic-large",
  "exh-header",
  "engine-v8-40",
  "dt-awd",
  "body-wide",
  "gbx-dct7",
  "turbo-t45",
  "gbx-seq6",
  "body-sedan",
  "wing-swan",
  "clutch-twin",
  "ic-w2a",
  "diff-clutch",
] as const;

export interface CareerFeatureReward {
  id: string;
  contractLevel: number;
  challengeId: string;
  partId: (typeof FEATURE_PART_IDS)[number];
}

export function completedCareerContracts(progress: Record<string, unknown>): number {
  return CHALLENGES.filter((challenge) => Boolean(progress[challenge.id])).length;
}

export const CAREER_FEATURE_REWARDS: CareerFeatureReward[] = FEATURE_PART_IDS.map(
  (partId, index) => {
    const contractLevel = (index + 1) * 2;
    const challenge = CHALLENGES[contractLevel - 1];
    if (!challenge || !findPart(partId)) {
      throw new Error(`Invalid career feature reward at contract ${contractLevel}: ${partId}`);
    }
    return {
      id: `career-feature-${String(contractLevel).padStart(2, "0")}`,
      contractLevel,
      challengeId: challenge.id,
      partId,
    };
  },
);

export function careerFeatureRewardAtLevel(contractLevel: number): CareerFeatureReward | null {
  return CAREER_FEATURE_REWARDS.find((reward) => reward.contractLevel === contractLevel) ?? null;
}

export function nextCareerFeatureReward(completedContracts: number): CareerFeatureReward | null {
  const nextMilestone = (Math.floor(completedContracts / 2) + 1) * 2;
  return careerFeatureRewardAtLevel(nextMilestone);
}

export function earnedCareerFeatureRewards(completedContracts: number): CareerFeatureReward[] {
  return CAREER_FEATURE_REWARDS.filter((reward) => reward.contractLevel <= completedContracts);
}
