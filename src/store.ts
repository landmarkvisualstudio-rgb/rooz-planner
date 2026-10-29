// Local-first task store for «روز».
// Data lives in localStorage on each device and is synced through a private GitHub Gist.
// Merge rule: per task, the newest `updatedAt` wins; deletions are kept as tombstones
// so a task deleted on one device does not come back from another.
import {Task,Status,daysBetween} from './planner';

export type SyncState='local'|'loading'|'saved'|'error';
type Data={tasks:Task[];deleted:Record<string,string>};
type SyncConfig={token:string;gistId:string;login?:string};

const DATA_KEY='rooz-data',SYNC_KEY='rooz-sync',FILE='rooz-planner.json',API='https://api.github.com';
const TOMBSTONE_DAYS=120;

function readJSON<T>(key:string,fallback:T):T{try{const v=localStorage.getItem(key);return v?JSON.parse(v) as T:fallback}catch{return fallback}}
function writeJSON(key:string,v:unknown){try{localStorage.setItem(key,JSON.stringify(v))}catch{}}

let data:Data=readJSON<Data>(DATA_KEY,{tasks:[],deleted:{}});
if(!Array.isArray(data.tasks))data={tasks:[],deleted:{}};
data.deleted ||= {};
let config:SyncConfig|null=readJSON<SyncConfig|null>(SYNC_KEY,null);
let state:SyncState=config?'loading':'local',lastError='',lastSync:string|null=null;
let dirty=false,syncing:Promise<void>|null=null,again=false,timer:any=null;
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(f=>f());
export function subscribe(f:()=>void){listeners.add(f);return()=>{listeners.delete(f)}}

const stamp=(t:Task)=>t.updatedAt||t.createdAt;
const sortTasks=(ts:Task[])=>ts.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.date.localeCompare(b.date));
function persist(){writeJSON(DATA_KEY,data)}

export function getTasks(){return data.tasks}
export function getSyncInfo(){return {state,lastError,lastSync,connected:!!config,login:config?.login||'',gistId:config?.gistId||''}}
export function exportData(){return {exportedAt:new Date().toISOString(),tasks:data.tasks,deleted:data.deleted}}

// ---------- merge ----------
export function merge(a:Data,b:Data):Data{
 const deleted:Record<string,string>={...a.deleted};
 for(const [id,ts] of Object.entries(b.deleted||{}))if(!deleted[id]||deleted[id]<ts)deleted[id]=ts;
 const byId=new Map<string,Task>();
 for(const t of [...a.tasks,...(b.tasks||[])]){const cur=byId.get(t.id);if(!cur||stamp(t)>stamp(cur)||(stamp(t)===stamp(cur)&&t.version>cur.version))byId.set(t.id,t)}
 const tasks=[...byId.values()].filter(t=>!deleted[t.id]||deleted[t.id]<stamp(t));
 const cutoff=new Date(Date.now()-TOMBSTONE_DAYS*864e5).toISOString();
 for(const id of Object.keys(deleted))if(deleted[id]<cutoff)delete deleted[id];
 return {tasks:sortTasks(tasks),deleted};
}
const same=(a:Data,b:Data)=>JSON.stringify(a)===JSON.stringify(b);

// ---------- mutations ----------
function commit(){persist();dirty=true;emit();schedule(800)}
const validDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v));

export function addTask(b:{title:string;note:string;start:string;end:string;reminder:string;completionMode?:'daily'|'once'}){
 const title=b.title.trim();
 if(!title||title.length>180||b.note.length>3000||!validDate(b.start)||!validDate(b.end)||b.end<b.start||(b.reminder&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.reminder)))throw Error('عنوان، تاریخ یا ساعت معتبر نیست.');
 const mode=b.completionMode||'daily';const dates=daysBetween(b.start,b.end);
 if(dates.length>366)throw Error('بازه حداکثر ۳۶۶ روز است.');
 const group=crypto.randomUUID(),now=new Date().toISOString();
 const rows:Task[]=(mode==='once'?[b.start]:dates).map(d=>({id:crypto.randomUUID(),groupId:group,title,note:b.note.trim(),date:d,status:'todo',completedAt:null,reminder:b.reminder,createdAt:now,updatedAt:now,version:1,completionMode:mode,endDate:mode==='once'?b.end:null}));
 data={...data,tasks:sortTasks([...rows,...data.tasks])};commit();
}
export function setStatus(id:string,status:Status){
 const now=new Date().toISOString();
 data={...data,tasks:data.tasks.map(t=>t.id===id?{...t,status,completedAt:status==='done'?now:null,version:t.version+1,updatedAt:now}:t)};commit();
}
export function removeTask(id:string){
 data={tasks:data.tasks.filter(t=>t.id!==id),deleted:{...data.deleted,[id]:new Date().toISOString()}};commit();
}
export function importBackup(json:any){
 if(!json||!Array.isArray(json.tasks))throw Error('فایل پشتیبان معتبر نیست.');
 const ok=json.tasks.filter((t:any)=>t&&typeof t.id==='string'&&typeof t.title==='string'&&validDate(t.date)&&['todo','doing','done'].includes(t.status));
 const now=new Date().toISOString();
 const incoming:Data={tasks:ok.map((t:any)=>({...t,note:t.note||'',reminder:t.reminder||'',groupId:t.groupId||t.id,version:t.version||1,createdAt:t.createdAt||now,updatedAt:t.updatedAt||t.createdAt||now})),deleted:json.deleted||{}};
 data=merge(data,incoming);commit();return ok.length as number;
}

// ---------- GitHub Gist ----------
async function gh(path:string,init:RequestInit={},token=config?.token){
 const r=await fetch(API+path,{...init,cache:'no-store',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28',...(init.body?{'Content-Type':'application/json'}:{})}});
 if(r.status===401)throw Error('توکن گیت‌هاب معتبر نیست یا منقضی شده.');
 if(r.status===403||r.status===429)throw Error('گیت‌هاب موقتاً اجازه نداد (محدودیت درخواست). کمی بعد دوباره تلاش می‌شود.');
 if(r.status===404)throw Error('Gist پیدا نشد؛ توکن باید دسترسی gist داشته باشد.');
 if(!r.ok)throw Error('ارتباط با گیت‌هاب برقرار نشد.');
 return r.json();
}
async function readGist(id:string):Promise<Data>{
 const g:any=await gh(`/gists/${id}`);const f=g.files?.[FILE];
 if(!f)return {tasks:[],deleted:{}};
 let text=f.content as string;
 if(f.truncated){const r=await fetch(f.raw_url,{cache:'no-store'});text=await r.text()}
 try{const j=JSON.parse(text);return {tasks:Array.isArray(j.tasks)?j.tasks:[],deleted:j.deleted||{}}}catch{return {tasks:[],deleted:{}}}
}
const body=(d:Data)=>JSON.stringify({files:{[FILE]:{content:JSON.stringify({app:'rooz',savedAt:new Date().toISOString(),...d},null,1)}}});

async function runSync(){
 if(!config)return;
 state='loading';emit();
 try{
  const remote=await readGist(config.gistId);
  const merged=merge(data,remote);
  dirty=false;
  if(!same(merged,remote))await gh(`/gists/${config.gistId}`,{method:'PATCH',body:body(merged)});
  // keep edits made while the request was in flight
  data=dirty?merge(merged,data):merged;persist();
  if(dirty)again=true;
  state='saved';lastError='';lastSync=new Date().toISOString();
 }catch(e:any){dirty=true;state='error';lastError=e?.message||'ارتباط برقرار نشد.'}
 emit();
}
export function syncNow():Promise<void>{
 if(!config){state='local';emit();return Promise.resolve()}
 if(syncing){again=true;return syncing}
 syncing=runSync().finally(()=>{syncing=null;if(again){again=false;syncNow()}});
 return syncing;
}
function schedule(ms:number){clearTimeout(timer);if(config)timer=setTimeout(syncNow,ms)}

export async function connect(rawToken:string){
 const token=rawToken.trim();
 if(!token)throw Error('توکن را وارد کن.');
 const user:any=await gh('/user',{},token);
 // Find an existing «روز» gist so every device uses the same one.
 let gistId='';
 for(let page=1;page<=5&&!gistId;page++){
  const list:any[]=await gh(`/gists?per_page=100&page=${page}`,{},token);
  gistId=list.find(g=>g.files&&g.files[FILE])?.id||'';
  if(list.length<100)break;
 }
 if(!gistId){
  const g:any=await gh('/gists',{method:'POST',body:JSON.stringify({description:'روز — داده‌های همگام‌سازی (خصوصی)',public:false,files:JSON.parse(body(data)).files})},token);
  gistId=g.id;
 }
 config={token,gistId,login:user.login};writeJSON(SYNC_KEY,config);dirty=true;
 await syncNow();
 if(state==='error')throw Error(lastError);
}
export function disconnect(){config=null;try{localStorage.removeItem(SYNC_KEY)}catch{}state='local';lastError='';emit()}

// background sync: on start, every 30s while visible, on focus / online
export function startAutoSync(){
 if(config)syncNow();
 const tick=setInterval(()=>{if(config&&document.visibilityState==='visible')syncNow()},30000);
 const wake=()=>{if(config&&document.visibilityState==='visible')syncNow()};
 window.addEventListener('focus',wake);window.addEventListener('online',wake);document.addEventListener('visibilitychange',wake);
 // other tabs on the same device
 const storage=(e:StorageEvent)=>{if(e.key===DATA_KEY&&e.newValue){try{data=JSON.parse(e.newValue);emit()}catch{}}};
 window.addEventListener('storage',storage);
 return()=>{clearInterval(tick);window.removeEventListener('focus',wake);window.removeEventListener('online',wake);document.removeEventListener('visibilitychange',wake);window.removeEventListener('storage',storage)};
}
