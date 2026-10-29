import {useState} from 'react';
import {CloudCheck,CloudOff,ExternalLink,LoaderCircle,RefreshCw,Unplug} from './icons';
import * as store from './store';

const TOKEN_URL='https://github.com/settings/tokens/new?scopes=gist&description=Rooz%20planner%20sync';

export default function SyncSettings({info,notify}:{info:ReturnType<typeof store.getSyncInfo>;notify:(s:string)=>void}){
 const [token,setToken]=useState(''),[busy,setBusy]=useState(false);
 async function connect(e:React.FormEvent){e.preventDefault();setBusy(true);try{await store.connect(token);setToken('');notify('همگام‌سازی روشن شد ✨')}catch(err:any){notify(err.message||'اتصال برقرار نشد.')}finally{setBusy(false)}}
 const when=info.lastSync?new Intl.DateTimeFormat('fa-IR',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Tehran'}).format(new Date(info.lastSync)):'';
 return <div className="settings-section sync-settings">
  <h3>همگام‌سازی بین دستگاه‌ها</h3>
  {info.connected?<>
   <p className={`sync-status ${info.state}`}>{info.state==='saved'?<CloudCheck size={16}/>:info.state==='error'?<CloudOff size={16}/>:<LoaderCircle size={16} className="spin"/>}
    {info.state==='saved'?`همگام با حساب ${info.login}${when?` · آخرین بار ${when}`:''}`:info.state==='error'?(info.lastError||'همگام‌سازی انجام نشد.'):'در حال همگام‌سازی…'}</p>
   <p>کارها در یک Gist خصوصی در حساب گیت‌هابت ذخیره می‌شوند. روی هر دستگاه دیگر همین توکن را وارد کن تا همان داده‌ها بیاید.</p>
   <div className="settings-buttons">
    <button className="secondary" onClick={()=>store.syncNow()}><RefreshCw size={16}/> همگام‌سازی الان</button>
    <button className="secondary" onClick={()=>{store.disconnect();notify('همگام‌سازی روی این دستگاه خاموش شد؛ کارها روی دستگاه باقی می‌مانند.')}}><Unplug size={16}/> قطع اتصال</button>
   </div>
  </>:<>
   <p>الان کارها فقط روی همین دستگاه ذخیره می‌شوند. برای همگام‌سازی گوشی و لپ‌تاپ، یک توکن گیت‌هاب با دسترسی <b>gist</b> بساز و اینجا وارد کن.</p>
   <ol className="sync-steps">
    <li><a href={TOKEN_URL} target="_blank" rel="noreferrer">ساخت توکن در گیت‌هاب <ExternalLink size={13}/></a> — فقط تیک gist زده باشد؛ مدت اعتبار را «No expiration» یا طولانی بگذار.</li>
    <li>توکن (شروعش ghp_) را کپی کن و پایین وارد کن.</li>
    <li>روی دستگاه دوم هم همین توکن را وارد کن.</li>
   </ol>
   <form className="sync-form" onSubmit={connect}>
    <input type="password" dir="ltr" autoComplete="off" spellCheck={false} value={token} onChange={e=>setToken(e.target.value)} placeholder="ghp_…" aria-label="توکن گیت‌هاب"/>
    <button className="primary" disabled={busy||!token.trim()}>{busy?<LoaderCircle size={16} className="spin"/>:<CloudCheck size={16}/>} اتصال</button>
   </form>
   <p className="field-hint">توکن فقط روی همین دستگاه نگه داشته می‌شود و جز به api.github.com جایی فرستاده نمی‌شود.</p>
  </>}
 </div>;
}
