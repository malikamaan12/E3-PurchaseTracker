import fs from "fs";
import path from "path";

async function queryE3WebProject() {
  const authPath = path.join(process.env.APPDATA || "", "com.vercel.cli", "Data", "auth.json");
  const authData = JSON.parse(fs.readFileSync(authPath, "utf-8"));
  const token = authData.token;

  console.log("=== CHECKING E3-WEB PROJECT ACCESS ===");
  const res = await fetch("https://api.vercel.com/v9/projects/prj_DrpuEMwXbeis1K3luqeTWHuuWhle?teamId=team_7M98jyVt7X8kDvFHdB7u8xi7", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  console.log("HTTP Status:", res.status);
  console.log("Response Body:", data);
}

queryE3WebProject()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
