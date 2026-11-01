export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Category = 'security' | 'quality' | 'maintainability' | 'dependencies';
export type SourceFile = { path: string; content: string };
export type Finding = {
  id: string; ruleId: string; file: string; line: number; column: number;
  severity: Severity; category: Category; title: string; detail: string;
  impact: string; fix: string; evidence: string; confidence: 'high'|'medium'|'low';
  replacement?: string;
};
export type RuleDescription = { id:string; title:string; severity:Severity; category:Category; languages:string[]; description:string };
export type FileSummary = { path:string; lines:number; findings:number; critical:number; high:number; medium:number; low:number };
export type ProjectResult = {
  findings:Finding[]; files:FileSummary[]; score:number; risk:'Critical'|'High'|'Moderate'|'Low';
  totalLines:number; scannedFiles:number; skippedFiles:number; generatedAt:string;
  engine:string; checks:number;
};

type Rule = RuleDescription & {
  pattern: RegExp;
  impact:string; fix:string; confidence:'high'|'medium'|'low';
  replacement?: (line:string,match:RegExpExecArray)=>string|undefined;
};

const JS = ['javascript','typescript','jsx','tsx'];
const PY = ['python'];
const ANY = ['javascript','typescript','jsx','tsx','python','html','css','json','other'];
const create = (id:string,title:string,severity:Severity,category:Category,languages:string[],pattern:RegExp,description:string,impact:string,fix:string,confidence:'high'|'medium'|'low'='medium',replacement?:Rule['replacement']):Rule=>({id,title,severity,category,languages,pattern,description,impact,fix,confidence,replacement});
export const RULES: Rule[] = [
  create('JS001','Dynamic eval execution','high','security',JS,/\beval\s*\(/g,'eval can interpret an uncontrolled string as code.','Untrusted data could execute with application privileges.','Use JSON.parse for data or a finite operation lookup; never evaluate user input.','high'),
  create('JS002','Function constructor','high','security',JS,/\bnew\s+Function\s*\(/g,'The Function constructor compiles strings into executable code.','Possible code injection if any argument is attacker controlled.','Replace dynamic compilation with explicit functions or a parser.','high'),
  create('JS003','Direct innerHTML assignment','medium','security',JS,/\.innerHTML\s*=/g,'HTML is inserted without escaping.','Potential cross-site scripting if the value is user controlled.','Prefer textContent for text; sanitize permitted HTML with a maintained sanitizer.','medium'),
  create('JS004','React raw HTML render','medium','security',JS,/dangerouslySetInnerHTML\s*=/g,'React is being asked to render raw HTML.','Untrusted markup could enable cross-site scripting.','Avoid raw HTML or sanitize with a trusted library before rendering.','high'),
  create('JS005','Hardcoded credential candidate','high','security',JS,/\b(?:api[_-]?key|secret|password|private[_-]?key|token)\b\s*[:=]\s*['"`]([^'"`]{6,})['"`]/gi,'A credential-like literal appears in source.','If real, it may leak through source control, bundles or logs.','Rotate exposed credentials and move private values to server-only environment variables.','medium'),
  create('JS006','Unsafe command execution','high','security',JS,/\b(?:exec|execSync)\s*\(/g,'A command-execution function appears in this file.','Passing untrusted input could trigger command injection.','Use argument-array APIs without shell interpolation and validate input.','low'),
  create('JS007','Weak randomness for security','medium','security',JS,/Math\.random\s*\(/g,'Math.random is not cryptographically secure.','Unsafe for secrets, tokens or security decisions; fine for many UI uses.','For security values, use crypto.getRandomValues or crypto.randomUUID.','low'),
  create('JS008','Dangerous browser storage candidate','medium','security',JS,/localStorage\.setItem\s*\(\s*['"`](?:token|password|secret|access_token)/gi,'A sensitive-sounding value may be stored in localStorage.','JavaScript on the page can read this storage; XSS may expose data.','Prefer secure server-managed HttpOnly cookies for sessions.','medium'),
  create('JS009','Disabled TLS verification','critical','security',JS,/rejectUnauthorized\s*:\s*false/g,'TLS certificate validation appears disabled.','A network attacker might intercept or impersonate servers.','Remove the override and install valid certificates.','high'),
  create('JS010','Debug logging','low','quality',JS,/\bconsole\.(?:log|debug)\s*\(/g,'A debug logging call is present.','Logs can clutter production output or expose sensitive state.','Review and remove diagnostic logs before release.','medium'),
  create('JS011','Legacy var declaration','low','maintainability',JS,/\bvar\s+[A-Za-z_$][\w$]*/g,'var uses function-scoping rather than block-scoping.','Unexpected scope and hoisting can make refactors harder.','Consider let or const after verifying reassignment behavior.','high', (line,m)=>line.slice(0,m.index)+m[0].replace(/^var\b/,'let')+line.slice(m.index+m[0].length)),
  create('JS012','Debugger breakpoint','medium','quality',JS,/\bdebugger\s*;?/g,'A debugger breakpoint was left in the source.','May unexpectedly pause a browser with devtools attached.','Remove the breakpoint when not intentionally debugging.','high',(line,m)=>line.slice(0,m.index)+line.slice(m.index+m[0].length)),
  create('JS013','TypeScript any escape hatch','low','maintainability',['typescript','tsx'],/\b:\s*any\b|\bas\s+any\b/g,'The any type bypasses checks.','Unexpected input shapes can escape compile-time validation.','Use unknown and narrow the type, or define an explicit type.','high'),
  create('JS014','Suppressed TypeScript error','medium','maintainability',['typescript','tsx'],/@ts-ignore\b/g,'A TypeScript error is suppressed.','Compiler checks can stop guarding the affected code.','Replace the suppression with a targeted type fix or documented @ts-expect-error.','high'),
  create('JS015','Loose equality','low','quality',JS,/(^|[^=!<>])==(?!=)/g,'Loose equality coerces operands implicitly.','Coercion may cause unexpected comparisons.','Consider strict equality after checking expected types.','medium'),
  create('JS016','Empty catch handler','medium','quality',JS,/catch\s*\([^)]*\)\s*\{\s*\}/g,'A caught error is silently discarded.','Operational failures may become invisible.','Handle, rethrow, or log the error safely.','high'),
  create('PY001','Python eval execution','high','security',PY,/\beval\s*\(/g,'eval may interpret a string as Python code.','Untrusted input could lead to arbitrary code execution.','Use ast.literal_eval for literals, or explicit parsing.','high'),
  create('PY002','Python exec execution','high','security',PY,/\bexec\s*\(/g,'exec runs dynamic Python code.','Arbitrary code execution if source is attacker controlled.','Remove dynamic execution and use a safe dispatch table.','high'),
  create('PY003','Subprocess shell enabled','high','security',PY,/shell\s*=\s*True/g,'A subprocess uses the shell.','String interpolation could enable command injection.','Use subprocess.run with a list of arguments and shell=False.','high'),
  create('PY004','Unsafe pickle deserialization','high','security',PY,/\bpickle\.(?:loads|load)\s*\(/g,'Pickle may execute arbitrary code when deserializing.','Loading untrusted pickles can compromise the process.','Do not unpickle untrusted data; prefer JSON for data exchange.','high'),
  create('PY005','TLS verification disabled','critical','security',PY,/verify\s*=\s*False/g,'TLS certificate verification appears disabled.','Network responses may be intercepted or forged.','Use valid certificates and leave verification enabled.','high'),
  create('PY006','Broad bare except','medium','quality',PY,/\bexcept\s*:/g,'The except clause catches every exception, including interrupts.','Errors and shutdown signals might be swallowed.','Catch specific exception types.','high'),
  create('PY007','Python print debugging','low','quality',PY,/\bprint\s*\(/g,'A print call might be temporary debug output.','Production logs may become noisy or expose data.','Use structured logging with controlled log levels.','low'),
  create('PY008','Hardcoded secret candidate','high','security',PY,/\b(?:api_key|password|secret|token)\s*=\s*['"]([^'"]{6,})['"]/gi,'A credential-like string appears in source.','A real secret can leak if the file is shared.','Rotate exposed values and load secrets from a secret manager or environment.','medium'),
  create('HTML001','Target blank without explicit rel','medium','security',['html'],/<a\b(?=[^>]*target\s*=\s*['"]_blank['"])(?![^>]*rel\s*=)[^>]*>/gi,'A link opens a new window without an explicit rel attribute.','Older browsers may expose opener control; explicit rel also documents intent.','Add rel="noopener noreferrer".','medium'),
  create('HTML002','Inline event handler','medium','security',['html'],/\bon(?:click|load|error|mouseover)\s*=/gi,'An inline handler embeds JavaScript in HTML.','Makes strict Content Security Policy harder to enforce.','Bind listeners in JavaScript and apply a restrictive CSP.','medium'),
  create('CSS001','Heavy cascade override','low','maintainability',['css'],/!important\b/g,'An !important rule forces cascade priority.','Repeated overrides can make styles hard to evolve.','Prefer scoped selectors or component-level styles.','medium'),
  create('CFG001','Wildcard dependency range','medium','dependencies',['json'],/"[^"\n]+"\s*:\s*"(?:\*|latest)"/g,'A wildcard or latest dependency is unpinned.','Unexpected major releases may change build behavior.','Use compatible version ranges and commit a lockfile.','high'),
  create('CFG002','Unrestricted dependency version','low','dependencies',['json'],/"[^"\n]+"\s*:\s*">=\s*\d+[^"\n]*"/g,'A dependency range permits unbounded future releases.','Large updates can introduce breaking changes unexpectedly.','Set an intentional upper range and use a lockfile.','medium'),
  create('GEN001','Unresolved TODO marker','low','maintainability',ANY,/\b(?:TODO|FIXME|HACK)\b/g,'An unresolved work marker appears in source.','Important unfinished work may reach release.','Track it in an issue and resolve when appropriate.','high'),
];
export const RULE_CATALOG:RuleDescription[] = RULES.map(({id,title,severity,category,languages,description})=>({id,title,severity,category,languages,description}));
const EXT:Record<string,string>={js:'javascript',mjs:'javascript',cjs:'javascript',ts:'typescript',jsx:'jsx',tsx:'tsx',py:'python',html:'html',htm:'html',css:'css',json:'json'};
export function inferLanguage(path:string):string { const ext=path.split('.').pop()?.toLowerCase()||''; return EXT[ext]||'other'; }
export function analyze(code:string,language:string='javascript',file='snippet.js',disabled:string[]=[]):Finding[]{
 const findings:Finding[]=[];
 const lines=code.split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
   const line=lines[i];
   for(const rule of RULES){
     if(!rule.languages.includes(language)||disabled.includes(rule.id))continue;
     const regex=new RegExp(rule.pattern.source,rule.pattern.flags);
     let match:RegExpExecArray|null;
     while((match=regex.exec(line))!==null){
       findings.push({id:`${file}:${i+1}:${match.index}:${rule.id}`,ruleId:rule.id,file,line:i+1,column:match.index+1,severity:rule.severity,category:rule.category,title:rule.title,detail:rule.description,impact:rule.impact,fix:rule.fix,evidence:line.trim().slice(0,240),confidence:rule.confidence,replacement:rule.replacement?.(line,match)});
       if(match[0].length===0)regex.lastIndex++;
       if(findings.length>=3000)return findings;
     }
   }
 }
 return findings;
}
const MAX_FILES=120;const MAX_CHARS=400000;
export function analyzeProject(files:SourceFile[],disabled:string[]=[]):ProjectResult{
 const valid=files.filter(f=>typeof f.path==='string'&&typeof f.content==='string'&&f.content.length<=MAX_CHARS).slice(0,MAX_FILES);
 const findings:Finding[]=[];let totalLines=0;const summaries:FileSummary[]=[];
 for(const f of valid){const language=inferLanguage(f.path);const items=analyze(f.content,language,f.path,disabled);findings.push(...items);const lines=f.content.split(/\r?\n/).length;totalLines+=lines;summaries.push({path:f.path,lines,findings:items.length,critical:items.filter(v=>v.severity==='critical').length,high:items.filter(v=>v.severity==='high').length,medium:items.filter(v=>v.severity==='medium').length,low:items.filter(v=>v.severity==='low').length});}
 const critical=findings.filter(x=>x.severity==='critical').length,high=findings.filter(x=>x.severity==='high').length,medium=findings.filter(x=>x.severity==='medium').length,low=findings.filter(x=>x.severity==='low').length;
 const score=Math.max(0,Math.round(100-Math.min(100,critical*22+high*12+medium*4+low*1.5)));
 const risk=critical>0?'Critical':high>0?'High':medium>0?'Moderate':'Low';
 return {findings,files:summaries,score,risk,totalLines,scannedFiles:valid.length,skippedFiles:files.length-valid.length,generatedAt:new Date().toISOString(),engine:'FORGEX heuristic rules v0.2',checks:RULES.length-disabled.length};
}
