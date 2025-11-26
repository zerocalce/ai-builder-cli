"use strict";
// Core CLI Auto-Deployment System Types
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentStatus = void 0;
var DeploymentStatus;
(function (DeploymentStatus) {
    DeploymentStatus["PENDING"] = "pending";
    DeploymentStatus["BUILDING"] = "building";
    DeploymentStatus["DEPLOYING"] = "deploying";
    DeploymentStatus["SUCCESS"] = "success";
    DeploymentStatus["FAILED"] = "failed";
    DeploymentStatus["ROLLING_BACK"] = "rolling_back";
    DeploymentStatus["ROLLED_BACK"] = "rolled_back";
})(DeploymentStatus = exports.DeploymentStatus || (exports.DeploymentStatus = {}));
