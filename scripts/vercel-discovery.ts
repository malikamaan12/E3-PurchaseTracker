import fs from "fs";
import path from "path";
import crypto from "crypto";

const STAGING_HOSTNAME = "ep-old-pond-amv5ogye-pooler.c-5.us-east-1.aws.neon.tech";
const stagingSha256 = crypto.createHash("sha256").update(STAGING_HOSTNAME).digest("hex");

async function runVercelDiscovery() {
  console.log("================================================================================");
  console.log("VERCEL PRODUCTION ENVIRONMENT & DISCOVERY INSPECTOR");
  console.log("================================================================================\n");

  // 1. Locate Vercel Token safely
  let token: string | null = process.env.VERCEL_TOKEN || null;

  if (!token) {
    const authPaths = [
      path.join(process.env.APPDATA || "", "com.vercel.cli", "Data", "auth.json"),
      path.join(process.env.USERPROFILE || "", ".vercel", "auth.json"),
    ];

    for (const p of authPaths) {
      if (fs.existsSync(p)) {
        try {
          const content = JSON.parse(fs.readFileSync(p, "utf-8"));
          if (content.token) {
            token = content.token;
            console.log(`✓ Loaded Vercel authentication token from: ${p}`);
            break;
          }
        } catch {
          // ignore
        }
      }
    }
  }

  if (!token) {
    console.log("✗ Blocker: No Vercel authentication token found in environment or CLI config.");
    return {
      status: "PRODUCTION ENVIRONMENT ACCESS BLOCKED — USER ACTION REQUIRED",
      reason: "No Vercel CLI token available.",
    };
  }

  // 2. Validate Vercel Token against Vercel API
  console.log("Validating token against Vercel REST API...");
  const userRes = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const userData = await userRes.json();

  if (!userRes.ok) {
    console.log(`✗ Vercel API Authentication Failed (HTTP ${userRes.status}):`, userData.error?.message || userData);
    return {
      status: "PRODUCTION ENVIRONMENT ACCESS BLOCKED — USER ACTION REQUIRED",
      httpStatus: userRes.status,
      error: userData.error?.message || "Token invalid or expired",
    };
  }

  console.log("✓ Authenticated as Vercel User:", {
    username: userData.user?.username,
    email: userData.user?.email,
    id: userData.user?.id,
  });

  // 3. Inspect Team / Organization
  let orgId = "team_7M98jyVt7X8kDvFHdB7u8xi7";
  let projectId = "prj_DrpuEMwXbeis1K3luqeTWHuuWhle";

  // Check local .vercel/project.json
  const projectJsonPath = path.resolve(process.cwd(), ".vercel", "project.json");
  if (fs.existsSync(projectJsonPath)) {
    try {
      const projConfig = JSON.parse(fs.readFileSync(projectJsonPath, "utf-8"));
      orgId = projConfig.orgId || orgId;
      projectId = projConfig.projectId || projectId;
    } catch {}
  }

  // Query Teams
  const teamsRes = await fetch("https://api.vercel.com/v2/teams", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const teamsData = await teamsRes.json();
  const team = (teamsData.teams || []).find((t: any) => t.id === orgId) || teamsData.teams?.[0];

  const teamParam = team ? `?teamId=${team.id}` : `?teamId=${orgId}`;

  // 4. Query Project Details
  console.log(`\nQuerying project details for Project ID ${projectId}...`);
  const projectRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}${teamParam}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const projectData = await projectRes.json();

  console.log("Project Details:", {
    id: projectData.id,
    name: projectData.name,
    framework: projectData.framework,
    nodeVersion: projectData.nodeVersion,
    targets: projectData.targets ? Object.keys(projectData.targets) : [],
  });

  // 5. Query Latest Deployments
  console.log("\nQuerying production deployments...");
  const deploysRes = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&target=production&limit=5${teamParam.replace("?", "&")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const deploysData = await deploysRes.json();
  const latestProdDeploy = deploysData.deployments?.[0];

  if (latestProdDeploy) {
    console.log("Latest Production Deployment:", {
      deploymentId: latestProdDeploy.uid,
      name: latestProdDeploy.name,
      url: `https://${latestProdDeploy.url}`,
      state: latestProdDeploy.state,
      readyState: latestProdDeploy.readyState,
      createdAt: new Date(latestProdDeploy.created).toISOString(),
      creator: latestProdDeploy.creator?.username,
      commitSha: latestProdDeploy.meta?.githubCommitSha || latestProdDeploy.meta?.gitCommitSha || "N/A",
      commitMessage: latestProdDeploy.meta?.githubCommitMessage || latestProdDeploy.meta?.gitCommitMessage || "N/A",
      branch: latestProdDeploy.meta?.githubCommitRef || latestProdDeploy.meta?.gitCommitRef || "N/A",
    });
  }

  // Query Custom Domains / Aliases
  console.log("\nQuerying project domains/aliases...");
  const domainsRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains${teamParam}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const domainsData = await domainsRes.json();
  const domainList = (domainsData.domains || []).map((d: any) => ({
    name: d.name,
    apexName: d.apexName,
    verified: d.verified,
  }));
  console.log("Configured Domains:", domainList);

  // 6. Query Environment Variables for Production
  console.log("\nQuerying production environment variables securely...");
  const envRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env${teamParam}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const envData = await envRes.json();
  const envs = envData.envs || [];

  const dbEnv = envs.find((e: any) => e.key === "DATABASE_URL" && (e.target?.includes("production") || !e.target));

  let dbAnalysis: any = null;

  if (dbEnv) {
    // If value is decrypted / available
    let rawDbUrl: string | null = dbEnv.value || null;

    // In Vercel API v9, env values can be fetched with /env/{id} if decrypted
    if (!rawDbUrl && dbEnv.id) {
      const singleEnvRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env/${dbEnv.id}${teamParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const singleEnvData = await singleEnvRes.json();
      rawDbUrl = singleEnvData.value || null;
    }

    if (rawDbUrl) {
      try {
        const u = new URL(rawDbUrl);
        const host = u.hostname;
        const hostSha256 = crypto.createHash("sha256").update(host).digest("hex");
        const isSameAsStaging = hostSha256 === stagingSha256;

        dbAnalysis = {
          provider: host.includes("neon.tech") ? "Neon Serverless Postgres" : "PostgreSQL",
          region: host.split(".")[3] || "unknown",
          redactedHostname: `host: ${host.slice(0, 8)}***.neon.tech`,
          databaseName: u.pathname.replace(/^\//, ""),
          endpointId: host.split("-pooler")[0] || host.split(".")[0],
          hostnameSha256: hostSha256,
          stagingHostnameSha256: stagingSha256,
          isSameAsStaging,
          conclusion: isSameAsStaging
            ? "Production and staging use the same database."
            : "Production uses a separate database.",
        };
      } catch (err: any) {
        dbAnalysis = { error: "Failed to parse database URL", details: err.message };
      }
    } else {
      dbAnalysis = {
        key: "DATABASE_URL",
        target: dbEnv.target,
        type: dbEnv.type,
        conclusion: "Production database configuration exists on Vercel, but raw value is encrypted/hidden.",
      };
    }
  } else {
    dbAnalysis = { conclusion: "Production has no database configuration." };
  }

  console.log("\nDatabase Configuration Analysis:");
  console.log(dbAnalysis);

  return {
    user: userData.user,
    team,
    project: projectData,
    latestProdDeploy,
    domains: domainList,
    dbAnalysis,
  };
}

runVercelDiscovery()
  .then((res) => {
    console.log("\n================================================================================");
    console.log("DISCOVERY RUN COMPLETED");
    console.log("================================================================================\n");
  })
  .catch((e) => {
    console.error("Discovery error:", e);
    process.exit(1);
  });
