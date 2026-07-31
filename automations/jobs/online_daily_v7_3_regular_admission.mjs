import {
  evaluateMediaChinaJointAdmission,
  evaluateSteamChinaJointAdmission
} from "./online_daily_v7_2_china_joint_admission.mjs";
import { selectRegularAdmission } from "./online_daily_v7_2_regular_admission.mjs";
import {
  evaluateV73IndiePrelaunchAdmission,
  V73_OBTAINABLE_EVIDENCE_RULE_VERSION
} from "./online_daily_v7_3_obtainable_evidence.mjs";
import {
  mediaIndieAdmissionEvidence,
  steamIndieAdmissionEvidence
} from "./online_daily_v7_indie_admission.mjs";

export function evaluateSteamV73RegularAdmission(candidate = {}) {
  return activateV73Admission(
    evaluateV73IndiePrelaunchAdmission(steamIndieAdmissionEvidence(candidate)),
    evaluateSteamChinaJointAdmission(candidate)
  );
}

export function evaluateMediaV73RegularAdmission(lead = {}) {
  return activateV73Admission(
    evaluateV73IndiePrelaunchAdmission(mediaIndieAdmissionEvidence(lead)),
    evaluateMediaChinaJointAdmission(lead)
  );
}

function activateV73Admission(indieAdmission, chinaJointAdmission) {
  return {
    ...selectRegularAdmission(indieAdmission, chinaJointAdmission),
    sourcing_rule_version: V73_OBTAINABLE_EVIDENCE_RULE_VERSION
  };
}
