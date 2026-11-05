import React from 'react';
import {LoaderCircle,PackageOpen,AlertCircle,RefreshCw} from 'lucide-react';
export function Button({children,variant='default',size='',...props}){return <button className={`btn ${variant==='primary'?'btn-primary':variant==='dark'?'btn-dark':variant==='danger'?'btn-danger':''} ${size==='small'?'btn-small':''}`} {...props}>{children}</button>}
export function Badge({value}){const s=String(value??'—'),v=s.toLowerCase();let tone='';if(/paid|active|complete|received|success|healthy|approved/.test(v))tone='green';else if(/pending|draft|partial|await|ordered/.test(v))tone='orange';else if(/out|failed|cancel|overdue|inactive|reject/.test(v))tone='red';else if(/processing|sent|open|info/.test(v))tone='blue';else if(/high|critical/.test(v))tone='purple';return <span className={`badge ${tone}`}>{s.replaceAll('_',' ')}</span>}
export function Loading({label='Loading data…'}){return <div className="loading-state"><LoaderCircle size={24} className="spin"/><p>{label}</p></div>}
export function Empty({title='Nothing here yet',message='When records are available, they will appear here.',icon:Icon=PackageOpen}){return <div className="empty-state"><div className="empty-icon"><Icon size={20}/></div><h3>{title}</h3><p>{message}</p></div>}
export function ErrorState({message,onRetry}){return <div className="error-state"><AlertCircle size={25}/><p>{message}</p>{onRetry&&<Button onClick={onRetry}><RefreshCw size={14}/> Try again</Button>}</div>}
export function Panel({title,action,children,className=''}){return <section className={`panel ${className}`}><header className="panel-head"><h2>{title}</h2>{action}</header>{children}</section>}
export function PageHeader({title,subtitle,actions}){return <div className="page-head"><div><h1>{title}</h1><p>{subtitle}</p></div>{actions&&<div className="head-actions">{actions}</div>}</div>}
export function Notice({children,type=''}){return <div className={`notice ${type}`}>{children}</div>}
