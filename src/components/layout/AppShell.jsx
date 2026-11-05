import React,{useEffect,useState} from 'react';
import {NavLink,Outlet,useLocation,useNavigate} from 'react-router-dom';
import * as Icons from 'lucide-react';
import {Search,Sun,Moon,Bell,Menu,ChevronDown,LogOut,PanelLeftClose,PanelLeftOpen,MessageCircle,Send,X,Bot} from 'lucide-react';
import {useAuth} from '../../features/auth/AuthContext.jsx';
import {RESOURCE_CONFIG,REPORTS,ROLE_LABELS} from '../../config/resources.js';
import {Button} from '../ui/Primitives.jsx';
import {apiGet,apiPost} from '../../services/api.js';
const NAV_ITEMS=[
 {label:'Overview',path:'/dashboard',icon:'LayoutDashboard',group:'Overview',roles:['admin','inventory_manager','purchase_manager','sales_staff','warehouse_staff','finance_billing_staff']},
 {label:'Inventory Dashboard',path:'/inventory',icon:'Boxes',group:'Inventory',roles:['admin','inventory_manager','warehouse_staff']},
 {label:'Products',path:'/products',icon:'Package',group:'Inventory',roles:['admin','inventory_manager','purchase_manager','sales_staff','warehouse_staff','finance_billing_staff']},
 {label:'Customers',path:'/customers',icon:'Users',group:'Relationships',roles:['admin','sales_staff','finance_billing_staff']},
 {label:'Suppliers',path:'/suppliers',icon:'Truck',group:'Relationships',roles:['admin','purchase_manager','inventory_manager']},
 {label:'Purchase Orders',path:'/purchase-orders',icon:'ShoppingBasket',group:'Transactions',roles:['admin','purchase_manager','inventory_manager']},
 {label:'Sales',path:'/sales',icon:'ShoppingCart',group:'Transactions',roles:['admin','sales_staff','finance_billing_staff']},
 {label:'Goods Receipt',path:'/goods-receipts',icon:'PackageCheck',group:'Transactions',roles:['admin','purchase_manager','inventory_manager','warehouse_staff']},
 {label:'Invoices',path:'/invoices',icon:'FileText',group:'Finance',roles:['admin','sales_staff','finance_billing_staff']},
 {label:'Payments',path:'/payments',icon:'CreditCard',group:'Finance',roles:['admin','finance_billing_staff']},
 {label:'Purchase Recommendations',path:'/purchase-recommendations',icon:'BrainCircuit',group:'Analytics',roles:['admin','inventory_manager','purchase_manager']},
 {label:'Demand Forecasts',path:'/demand-forecasts',icon:'ChartNoAxesCombined',group:'Analytics',roles:['admin','inventory_manager','purchase_manager']},
 {label:'Sales Insights',path:'/reports/sales-summary',icon:'ChartNoAxesCombined',group:'Analytics',roles:['admin','finance_billing_staff']},
 {label:'Inventory Insights',path:'/reports/inventory-summary',icon:'ChartNoAxesCombined',group:'Analytics',roles:['admin','inventory_manager','warehouse_staff']},
 {label:'Stockout & Dead Stock',path:'/planning/stockout-predictions',icon:'TrendingDown',group:'Analytics',roles:['admin','inventory_manager','purchase_manager']},
 {label:'Notifications',path:'/notifications',icon:'Bell',group:'Overview',roles:['admin','inventory_manager','purchase_manager','sales_staff','warehouse_staff','finance_billing_staff']},
 {label:'Users & Roles',path:'/users',icon:'UserCog',group:'Administration',roles:['admin']},
];
const navForRole=(role)=>NAV_ITEMS.filter(item=>item.roles.includes(role));
export function AppShell(){
 const {user,logout}=useAuth(),[mobileOpen,setMobileOpen]=useState(false),[dark,setDark]=useState(false),[collapsed,setCollapsed]=useState(false);
 const [lowStockCount,setLowStockCount]=useState(null),[notificationError,setNotificationError]=useState('');
 const [chatOpen,setChatOpen]=useState(false),[chatText,setChatText]=useState(''),[chatBusy,setChatBusy]=useState(false),[chatError,setChatError]=useState(''),[chatMessages,setChatMessages]=useState([{from:'bot',text:'Hi! I’m StockPilot. Ask me about inventory, sales, demand or purchase planning.'}]);
 const location=useLocation(),navigate=useNavigate(),role=user?.role_name||user?.role||'';
 const nav=navForRole(role); const groups=['Overview','Inventory','Relationships','Transactions','Finance','Analytics','Administration'].filter(group=>nav.some(item=>item.group===group));
 const sendChat=async(event)=>{event.preventDefault();const question=chatText.trim();if(question.length<3||chatBusy)return;setChatMessages(items=>[...items,{from:'user',text:question}]);setChatText('');setChatBusy(true);setChatError('');try{const result=await apiPost('/assistant/ask',{question});setChatMessages(items=>[...items,{from:'bot',text:result?.answer||'I could not find an answer for that question.'}]);}catch(error){setChatError(error.message||'Could not reach the assistant.');}finally{setChatBusy(false);}};
 React.useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';},[dark]);
 useEffect(()=>{
  const canViewAlerts=['admin','inventory_manager','purchase_manager','warehouse_staff','sales_staff','finance_billing_staff'].includes(role);
  if(!canViewAlerts){setLowStockCount(null);setNotificationError('');return undefined}
  let active=true;
  const loadLowStockCount=async()=>{
   try{
    const result=await apiGet('/notifications/low-stock');
    if(active){setLowStockCount(Number(result?.count||0));setNotificationError('')}
   }catch(error){
    if(active){setLowStockCount(null);setNotificationError(error.message)}
   }
  };
  loadLowStockCount();
  const interval=window.setInterval(loadLowStockCount,60000);
  const refreshWhenVisible=()=>{if(document.visibilityState==='visible')loadLowStockCount()};
  window.addEventListener('focus',refreshWhenVisible);
  document.addEventListener('visibilitychange',refreshWhenVisible);
  return()=>{
   active=false;
   window.clearInterval(interval);
   window.removeEventListener('focus',refreshWhenVisible);
   document.removeEventListener('visibilitychange',refreshWhenVisible);
  };
 },[role]);
 const title=location.pathname==='/dashboard'?'Dashboard':nav.find(n=>n.path===location.pathname)?.label||'Workspace';
 return <div className="app-shell">
 <div className={`mobile-overlay ${mobileOpen?'open':''}`} onClick={()=>setMobileOpen(false)}/>
 <aside className={`sidebar ${mobileOpen?'open':''}`} style={collapsed?{width:76}:undefined}>
 <div className="brand"><span className="brand-mark"><i/><i/><i/></span>{!collapsed&&<span>StockPilot</span>}</div>
 <nav>{groups.map(group=><div className="nav-group" key={group}>{!collapsed&&<div className="nav-heading">{group}</div>}{nav.filter(n=>n.group===group).map(item=>{const Icon=Icons[item.icon]||Icons.Circle;return <NavLink key={item.path} to={item.path} title={collapsed?item.label:undefined} className={({isActive})=>`nav-link ${isActive?'active':''}`} onClick={()=>setMobileOpen(false)}><Icon size={17}/>{!collapsed&&<span>{item.label}</span>}</NavLink>})}</div>)}</nav>
 <div className="sidebar-bottom"><button className="nav-link" onClick={()=>setCollapsed(!collapsed)}>{collapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}{!collapsed&&<span>Collapse sidebar</span>}</button><div className="user-mini"><div className="avatar">{(user?.name||user?.email||'U').slice(0,1).toUpperCase()}</div>{!collapsed&&<div style={{minWidth:0,flex:1}}><strong>{user?.name||user?.email||'User'}</strong><small>{ROLE_LABELS[role]||role||'Account'}</small></div>}{!collapsed&&<button className="icon-btn" aria-label="Sign out" onClick={()=>{logout();navigate('/login')}}><LogOut size={15}/></button>}</div></div>
 </aside>
 <main className="main-area" style={collapsed?{marginLeft:76,maxWidth:'calc(100vw - 76px)'}:undefined}>
 <header className="topbar"><button className="icon-btn mobile-menu" aria-label="Open navigation" onClick={()=>setMobileOpen(true)}><Menu size={18}/></button><label className="global-search"><Search size={17}/><input placeholder="Search products, invoices, customers…" onKeyDown={e=>{if(e.key==='Enter'){const q=e.currentTarget.value.trim();if(q)navigate(`/products?search=${encodeURIComponent(q)}`)}}}/><span className="shortcut" style={{fontSize:10,whiteSpace:'nowrap'}}>Ctrl + K</span></label><div className="top-spacer"/><button className="icon-btn" title="Toggle theme" onClick={()=>setDark(!dark)}>{dark?<Moon size={17}/>:<Sun size={17}/>}</button><button className="icon-btn" aria-label={notificationError?`Low stock notifications unavailable: ${notificationError}`:`Low-stock notifications${lowStockCount===null?'':`: ${lowStockCount} active`}`} title={notificationError?`Low stock notifications unavailable: ${notificationError}`:`${lowStockCount??'…'} active low-stock notifications`} onClick={()=>navigate('/notifications')} style={{position:'relative'}}><Bell size={17}/>{lowStockCount>0&&<span style={{position:'absolute',top:0,right:0,minWidth:16,height:16,padding:'0 4px',borderRadius:10,background:'#dc2626',color:'#fff',fontSize:9,fontWeight:800,lineHeight:'16px',textAlign:'center'}}>{lowStockCount>99?'99+':lowStockCount}</span>}</button><button className="company-pill" onClick={()=>navigate('/dashboard')}>StockPilot <ChevronDown size={13} style={{verticalAlign:'middle',marginLeft:7}}/></button><div className="avatar">{(user?.name||'U').slice(0,1).toUpperCase()}</div></header>
 <div className="muted" style={{fontSize:11,marginBottom:13}}>{title==='Dashboard'?'OVERVIEW':`WORKSPACE / ${title.toUpperCase()}`}</div><Outlet/>
 </main>
 <div className="chat-launcher">{chatOpen&&<section className="chat-popover" aria-label="StockPilot chat assistant"><header><span className="chat-bot-icon"><Bot size={18}/></span><div><strong>StockPilot Assistant</strong><small>Inventory and business help</small></div><button className="icon-btn" aria-label="Close chat" onClick={()=>setChatOpen(false)}><X size={16}/></button></header><div className="chat-messages" aria-live="polite">{chatMessages.map((message,index)=><div key={index} className={`chat-bubble ${message.from}`}>{message.text}</div>)}{chatBusy&&<div className="chat-bubble bot">Thinking…</div>}</div>{chatError&&<p className="chat-error">{chatError}</p>}<form className="chat-compose" onSubmit={sendChat}><input value={chatText} onChange={event=>setChatText(event.target.value)} placeholder="Ask anything…" aria-label="Message StockPilot"/><button className="btn btn-primary" disabled={chatBusy||chatText.trim().length<3} aria-label="Send message"><Send size={15}/></button></form></section>}<button className="chat-fab" onClick={()=>setChatOpen(value=>!value)} aria-label={chatOpen?'Close assistant':'Open chat assistant'}>{chatOpen?<X size={22}/>:<MessageCircle size={22}/>}<span>{chatOpen?'Close':'Chat with us'}</span></button></div>
 </div>
}
