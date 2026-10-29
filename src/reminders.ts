// In-app reminders: while «روز» is open (foreground or background tab), show a
// notification when a task's reminder time (Tehran) arrives on the day it occurs.
import {Task,today,occursOn} from './planner';

const KEY='rooz-notified';
export const notificationsOn=()=>typeof Notification!=='undefined'&&Notification.permission==='granted';

export async function showLocal(title:string,body:string,tag:string){
 const reg=await navigator.serviceWorker?.getRegistration?.().catch(()=>undefined);
 const opts:NotificationOptions={body,tag,icon:'./icon-192.png',badge:'./icon-192.png'};
 if(reg)await reg.showNotification(title,opts);else new Notification(title,opts);
}
function tehranTime(){return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date())}

export function startReminders(getTasks:()=>Task[]){
 const check=()=>{
  if(!notificationsOn())return;
  const day=today(),now=tehranTime();
  let sent:Record<string,string>={};try{sent=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
  for(const k of Object.keys(sent))if(sent[k]<day)delete sent[k];
  for(const t of getTasks()){
   if(!t.reminder||t.status==='done'||!occursOn(t,day))continue;
   const key=t.id+'@'+day;
   // fire at the time, or up to 2 hours late if the app was closed at that moment
   if(t.reminder<=now&&!sent[key]&&minutes(now)-minutes(t.reminder)<=120){
    sent[key]=day;showLocal('روز · یادآوری',t.title,key).catch(()=>{});
   }
  }
  try{localStorage.setItem(KEY,JSON.stringify(sent))}catch{}
 };
 check();const id=setInterval(check,20000);
 return()=>clearInterval(id);
}
const minutes=(hm:string)=>+hm.slice(0,2)*60+ +hm.slice(3,5);
