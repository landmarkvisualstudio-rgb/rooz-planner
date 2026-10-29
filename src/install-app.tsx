import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Copy,Download,Monitor,Smartphone,X} from './icons';

type InstallEvent = Event & {
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:'accepted'|'dismissed'}>;
};
type PWAWindow = Window & {__roozPWA?:{prompt:InstallEvent|null;installed:boolean}};
type Platform = 'android'|'desktop'|'ios';
const guides:Record<Platform,{title:string;steps:string[]}>={
  android:{title:'روی گوشی سامسونگ و اندروید',steps:[
    'این صفحه را در Chrome باز کن.',
    'از منوی سه‌نقطه، «افزودن به صفحهٔ اصلی» یا «نصب برنامه» را انتخاب کن.',
    'نصب را تأیید کن؛ آیکون «روز» به برنامه‌های گوشی اضافه می‌شود.'
  ]},
  desktop:{title:'روی لپ‌تاپ و کامپیوتر',steps:[
    'این صفحه را در Chrome یا Edge باز کن.',
    'آیکون نصب کنار نوار آدرس را بزن؛ یا از منوی مرورگر، بخش برنامه‌ها و گزینهٔ نصب این سایت را انتخاب کن.',
    'نصب را تأیید کن و «روز» را از فهرست برنامه‌ها باز کن.'
  ]},
  ios:{title:'روی آیفون و آیپد',steps:[
    'این صفحه را در Safari باز کن.',
    'دکمهٔ اشتراک‌گذاری را بزن و «افزودن به صفحهٔ اصلی» را انتخاب کن.',
    'اگر گزینهٔ «باز کردن به‌عنوان وب‌اپ» نمایش داده شد، آن را روشن کن و «افزودن» را بزن.'
  ]}
};

export default function InstallApp(){
  const [mounted,setMounted]=useState(false),[open,setOpen]=useState(false),[installed,setInstalled]=useState(false);
  const [prompt,setPrompt]=useState<InstallEvent|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [platform,setPlatform]=useState<Platform>('android');
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const installAction=useRef<()=>void>(()=>{}),pendingPrompt=useRef<InstallEvent|null>(null),installing=useRef(false);
  useEffect(()=>{
    setMounted(true);
    const ua=navigator.userAgent;
    setPlatform(/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'ios':/Android/.test(ua)?'android':'desktop');
    const media=window.matchMedia('(display-mode: standalone)');
    const update=()=>setInstalled(media.matches||!!(navigator as Navigator & {standalone?:boolean}).standalone||!!(window as PWAWindow).__roozPWA?.installed);
    const ready=()=>{const state=(window as PWAWindow).__roozPWA;pendingPrompt.current=state?.prompt||null;setPrompt(state?.prompt||null);update();if(state?.installed)setMessage('روز نصب شد؛ از آیکون برنامه بازش کن.')};
    const show=()=>installAction.current();
    ready();media.addEventListener('change',update);
    window.addEventListener('rooz:pwa-change',ready);
    window.addEventListener('rooz:install',show);
    return()=>{media.removeEventListener('change',update);window.removeEventListener('rooz:pwa-change',ready);window.removeEventListener('rooz:install',show)};
  },[]);
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close()},[open]);
  function close(){setOpen(false);trigger.current?.focus()}
  async function install(){
    if(installing.current)return;
    if(installed){setMessage('روز در حالت برنامه باز است.');return}
    const event=pendingPrompt.current;
    if(!event){
      setMessage(platform==='ios'?'برای نصب روی آیفون، در Safari گزینهٔ «افزودن به صفحهٔ اصلی» را بزن.':'این مرورگر هنوز نصب مستقیم را در دسترس نگذاشته؛ صفحه را در Chrome یا Edge باز کن یا از منوی مرورگر گزینهٔ نصب را بزن.');
      return;
    }
    pendingPrompt.current=null;const state=(window as PWAWindow).__roozPWA;if(state)state.prompt=null;setPrompt(null);installing.current=true;setBusy(true);setMessage('');setOpen(false);
    try{
      // Keep this call in the original click gesture; opening a guide first adds an unnecessary step.
      await event.prompt();
      const result=await event.userChoice;
      setMessage(result.outcome==='accepted'?'درخواست نصب تأیید شد؛ مرورگر مراحل نصب را تکمیل می‌کند.':'نصب را لغو کردی؛ هر وقت خواستی از منوی مرورگر نصبش کن.');
    }catch{setMessage('مرورگر پنجرهٔ نصب را باز نکرد؛ از منوی مرورگر گزینهٔ نصب برنامه را بزن.')}
    finally{installing.current=false;setBusy(false)}
  }
  installAction.current=()=>{void install()};
  async function copyLink(){
    try{await navigator.clipboard.writeText(location.href.split('#')[0]);setMessage('لینک کپی شد؛ در مرورگر دستگاهت بازش کن.')}
    catch{setMessage('کپی خودکار ممکن نشد؛ آدرس صفحه را از نوار مرورگر کپی کن.')}
  }
  return <>
    <button ref={trigger} className="install-trigger" onClick={install} disabled={busy||installed}>
      {installed?<Check size={16}/>:<Download size={16}/>}<span>{installed?'نصب‌شده':busy?'در حال نصب…':'نصب برنامه'}</span>
    </button>
    {mounted&&!open&&message&&createPortal(<div className="install-feedback" role="status"><p>{message}</p><div><button onClick={()=>setOpen(true)}>راهنمای نصب</button><button aria-label="بستن پیام نصب" onClick={()=>setMessage('')}><X size={16}/></button></div></div>,document.body)}
    {mounted&&createPortal(<dialog ref={dialog} className="install-dialog" aria-labelledby="install-title" onCancel={close}>
      <div className="modal-heading"><h2 id="install-title">روز، همیشه دم دست</h2><button className="icon-button" aria-label="بستن راهنمای نصب" onClick={close}><X size={20}/></button></div>
      <div className="install-intro"><img src="./icon-192.png" width="64" height="64" alt=""/><div><strong>دانلود و نصب وب‌اپ روز</strong><p>یک آیکون روی دستگاهت، یک فضای آرام برای کارهایت.</p></div></div>
      <div className="install-benefits"><span><Smartphone size={15}/> گوشی</span><span><Monitor size={15}/> لپ‌تاپ</span><span><Check size={15}/> همگام بین دستگاه‌ها</span></div>
      {installed?<p className="install-success"><Check size={19}/> روز روی این دستگاه نصب شده یا در حالت برنامه باز است.</p>:<>
        {prompt&&<button className="primary install-now" disabled={busy} onClick={install}><Download size={18}/> نصب روی این دستگاه</button>}
        <p className="install-caption">{prompt?'با تأیید پنجرهٔ مرورگر، نصب کامل می‌شود.':'اگر دکمهٔ نصب مستقیم نمایش داده نمی‌شود، از راهنمای دستگاهت استفاده کن.'}</p>
        <div className="install-platforms" role="group" aria-label="نوع دستگاه">{(['android','desktop','ios'] as Platform[]).map(p=><button key={p} aria-pressed={platform===p} onClick={()=>setPlatform(p)}>{p==='android'?'اندروید / سامسونگ':p==='desktop'?'لپ‌تاپ':'آیفون / آیپد'}</button>)}</div>
        <section className="install-guide"><h3>{guides[platform].title}</h3><ol>{guides[platform].steps.map(s=><li key={s}>{s}</li>)}</ol>{platform==='android'&&<p>در Samsung Internet هم می‌توانی از منوی مرورگر، گزینهٔ افزودن صفحه به صفحهٔ اصلی را انتخاب کنی.</p>}</section>
      </>}
      <p className="install-caption">داخل مرورگرِ یک برنامه هستی؟ لینک را کپی کن و در Chrome یا Safari باز کن. برای همگام‌سازی بین دستگاه‌ها، در تنظیمات توکن گیت‌هاب را وارد کن.</p>
      <button className="secondary" onClick={copyLink}><Copy size={16}/> کپی لینک برنامه</button>
      <p className="install-message" role="status" aria-live="polite">{message}</p>
    </dialog>,document.body)}
  </>;
}
