import path from "node:path";

// Render code as PowerShell literal here-strings piped to Node. No shell
// expansion or Windows native -e quoting; nonsecret data is JS escaped, ASCII.
export function nodeCommand(code) {
  if (code.includes("\n'@") || code.includes("\0")) throw Error("unsafe_command");
  return `@'\n${code}\n'@ | & node --input-type=module\nif ($LASTEXITCODE -ne 0) { throw 'KUT release command failed; inspect private evidence.' }`;
}
const asciiJson = (value) =>
  JSON.stringify(value).replace(
    /[\u007f-\uffff]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );

export function handoffCommands(root, { sha, authorization, gate, approval }) {
  const data = { root: path.resolve(root), sha, authorization, gate, approval };
  const header = `import {spawnSync} from "node:child_process";\nimport {pathToFileURL} from "node:url";\nimport path from "node:path";\nconst data=${asciiJson(data)};\nconst load=relative=>import(pathToFileURL(path.join(data.root,relative)).href);\nfunction call(file,args,input) { const r=spawnSync(file,args,{cwd:data.root,encoding:"utf8",timeout:90000,maxBuffer:16*1024*1024,windowsHide:true,stdio:["pipe","pipe","pipe"],input}); if(r.error||r.status!==0) throw Error("command_failed"); return r.stdout; }\n`;
  const deployment =
    header +
    `try {
  const {inspectAuthorization}=await load("scripts/release/release-authorization.mjs");
  const current=await inspectAuthorization(data.root,data.sha,data.authorization.pull_request);
  if(JSON.stringify(current)!==JSON.stringify({...data.authorization,explicit_release:undefined})) throw Error("authorization_changed");
  if(current.documentation_only && !data.authorization.explicit_release) throw Error("authorization_invalid");
  const {assertUnchanged}=await load("scripts/release/prepare-release-contract.mjs");
  await assertUnchanged(data.gate,data.approval);
  const {runReleaseStage}=await load("scripts/release/release-stage-command.mjs");
  await runReleaseStage(data.root,"assertion",data.sha,{gate:data.gate.path});
  const {resolveVercelCli}=await load("scripts/release/vercel-cli.mjs");
  const cli=resolveVercelCli(data.root);
  const api=(endpoint,method="GET",input)=>JSON.parse(call(process.execPath,[cli,"api",endpoint,"--method",method,"--raw","--scope","vibetrunk","--no-color","--non-interactive",...(input?["--input","-"]:[])],input));
  const project=api("/v9/projects/kut");
  if(project.id!=="prj_26aP5n78r1uCGWZBWiTw1HeO0yKp" || project.name!=="kut" || project.link?.type!=="github" || project.link?.repoId!==1335996257 || project.link?.org!=="VibeTrunk" || project.link?.repo!=="kut") throw Error("project_changed");
  const request={name:"kut",project:project.id,target:"production",gitSource:{type:"github",repoId:project.link.repoId,ref:data.sha,sha:data.sha}};
  const result=api("/v13/deployments?teamId=team_4Vtl8L10Nyxaln5P2ptOZ88t","POST",JSON.stringify(request));
  if(!/^dpl_[a-zA-Z0-9]+$/.test(result.id)||result.target!=="production") throw Error("deployment_unverified");
  console.log(JSON.stringify({result:"created",candidate_sha:data.sha,deployment_id:result.id}));
} catch { console.log(JSON.stringify({result:"failed",candidate_sha:data.sha})); process.exitCode=1; }`;
  const verification =
    header +
    `try {
  const output=JSON.parse(call(process.execPath,[path.join(data.root,"scripts/release/check-vercel-deployment.mjs"),"--candidate",data.sha]));
  if(output.result!=="candidate_live" || output.candidate_sha!==data.sha || output.candidate_lookup_complete!==true || output.legacy_redirect?.verified!==true) throw Error("binding_unverified");
  console.log(JSON.stringify(output));
} catch { console.log(JSON.stringify({result:"verification_failed",candidate_sha:data.sha})); process.exitCode=1; }`;
  return { deployment: nodeCommand(deployment), verification: nodeCommand(verification) };
}
