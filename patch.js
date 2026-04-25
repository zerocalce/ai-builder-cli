const fs = require('fs');
let code = fs.readFileSync('src/core/deployment-store.ts', 'utf8');

// Fix appendLog method in SQLiteDeploymentStore
code = code.replace(
  "stmt.run(id, log.timestamp ? new Date(log.timestamp).getTime() : Date.now(), log.level || 'info', log.message || '');",
  "stmt.run(id, log.timestamp ? new Date(log.timestamp).getTime() : Date.now(), log.level || 'info', log.message || '');\n    // Append log to deployment data directly\n    const deployment = await this.getDeployment(id);\n    if (deployment) {\n      deployment.logs = deployment.logs || [];\n      deployment.logs.push(log);\n      await this.saveDeployment(deployment);\n    }"
);

fs.writeFileSync('src/core/deployment-store.ts', code);
