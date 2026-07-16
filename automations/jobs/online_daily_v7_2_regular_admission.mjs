import {
  evaluateMediaIndiePrelaunchAdmission,
  evaluateSteamIndiePrelaunchAdmission
} from "./online_daily_v7_indie_admission.mjs";
import {
  CHINA_JOINT_RULE_VERSION,
  evaluateMediaChinaJointAdmission,
  evaluateSteamChinaJointAdmission
} from "./online_daily_v7_2_china_joint_admission.mjs";

export const REGULAR_SOURCING_RULE_VERSION = CHINA_JOINT_RULE_VERSION;

export function evaluateSteamRegularAdmission(candidate = {}) {
  return selectRegularAdmission(
    evaluateSteamIndiePrelaunchAdmission(candidate),
    evaluateSteamChinaJointAdmission(candidate)
  );
}

export function evaluateMediaRegularAdmission(lead = {}) {
  return selectRegularAdmission(
    evaluateMediaIndiePrelaunchAdmission(lead),
    evaluateMediaChinaJointAdmission(lead)
  );
}

export function selectRegularAdmission(indieAdmission, chinaJointAdmission) {
  const selected = indieAdmission.qualified
    ? indieAdmission
    : chinaJointAdmission.qualified
      ? chinaJointAdmission
      : indieAdmission.disposition !== "excluded"
        ? indieAdmission
        : chinaJointAdmission;

  return {
    ...selected,
    sourcing_rule_version: REGULAR_SOURCING_RULE_VERSION,
    matched_rules: uniqueStrings([
      ...indieAdmission.matched_rules,
      ...chinaJointAdmission.matched_rules
    ]),
    lane_results: {
      indie_prelaunch: indieAdmission,
      china_joint: chinaJointAdmission
    }
  };
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}
