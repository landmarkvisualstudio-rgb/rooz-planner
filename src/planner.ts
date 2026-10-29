export type Status = 'todo'|'doing'|'done';
export type Task = { id:string; groupId:string; title:string; note:string; date:string; status:Status; completedAt:string|null; reminder:string; createdAt:string; version:number; completionMode?:'daily'|'once'; endDate?:string|null; updatedAt?:string };
export const fa = (n:number) => new Intl.NumberFormat('fa-IR').format(n);
export const iso = (d:Date) => d.toISOString().slice(0,10);
export function today() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export const dateObj = (s:string) => new Date(s+'T12:00:00Z');
export function addDays(s:string,n:number) { const d=dateObj(s);d.setUTCDate(d.getUTCDate()+n);return iso(d); }
export function weekStart(s:string) { return addDays(s,-((dateObj(s).getUTCDay()+1)%7)); }
export function persian(s:string,opts:Intl.DateTimeFormatOptions={day:'numeric',month:'long'}) { return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{...opts,timeZone:'Asia/Tehran'}).format(dateObj(s)); }
export function jalaliParts(s:string) { const p=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'numeric',day:'numeric',timeZone:'Asia/Tehran'}).formatToParts(dateObj(s));return {year:+p.find(x=>x.type==='year')!.value,month:+p.find(x=>x.type==='month')!.value,day:+p.find(x=>x.type==='day')!.value}; }
export function monthDays(s:string) { const p=jalaliParts(s);const first=addDays(s,1-p.day);let end=addDays(first,29);while(jalaliParts(addDays(end,1)).month===p.month)end=addDays(end,1);if(jalaliParts(end).month!==p.month)end=addDays(end,-1);return {first,end,offset:(dateObj(first).getUTCDay()+1)%7,days:daysBetween(first,end)}; }
export function daysBetween(start:string,end:string) { const out:string[]=[];for(let d=start;d<=end&&out.length<367;d=addDays(d,1))out.push(d);return out; }
export function stats(tasks:Task[],date:string) { const rows=tasks.filter(t=>occursOn(t,date));const done=rows.filter(t=>t.status==='done').length;return {total:rows.length,done,percent:rows.length?Math.round(done/rows.length*100):0}; }
export const late = (t:Task) => t.status==='done'&&!!t.completedAt&&new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t.completedAt))>taskEnd(t);

export const taskEnd=(t:Task)=>t.completionMode==='once'?(t.endDate||t.date):t.date;
export const occursOn=(t:Task,date:string)=>t.date<=date&&taskEnd(t)>=date;
export const isOverdue=(t:Task,now:string)=>t.status!=='done'&&taskEnd(t)<now&&taskEnd(t)>=weekStart(now);
