import React,{useCallback,useEffect,useState} from 'react';
import {AlertTriangle,MapPin,RefreshCw} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {apiGet} from '../../services/api.js';
import {useAuth} from '../auth/AuthContext.jsx';
import {Badge,Button,Empty,ErrorState,Loading,Notice,PageHeader,Panel} from '../../components/ui/Primitives.jsx';

const rowsFromResponse=result=>Array.isArray(result)?result:result?.items||[];
const number=value=>Number(value||0).toLocaleString();
const canViewAlerts=role=>['admin','inventory_manager','purchase_manager','warehouse_staff','sales_staff','finance_billing_staff'].includes(role);

export function NotificationCenter(){
 const {user}=useAuth();
 const navigate=useNavigate();
 const role=user?.role_name||user?.role||'';
 const [alerts,setAlerts]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');

 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const result=await apiGet('/notifications/low-stock');
   setAlerts(rowsFromResponse(result));
  }catch(e){setError(e.message)}
  finally{setLoading(false)}
 },[]);

 useEffect(()=>{load()},[load]);

 if(!canViewAlerts(role)){
  return <Panel title="Access restricted"><Empty title="Notifications are not available for your role" message="Return to your dashboard to see the modules assigned to your account."/></Panel>;
 }

 return <>
  <PageHeader title="Low-stock notifications" subtitle="Live alerts show the product and warehouse whenever available stock is at or below its reorder level." actions={<><Button variant="primary" onClick={()=>navigate('/notifications/all')}>All notifications</Button><Button onClick={load}><RefreshCw size={14}/> Refresh</Button></>}/>
  {error&&<Notice type="error">Low-stock notifications could not be loaded: {error}</Notice>}
  <Panel title="Active low stock" action={<span className="muted" style={{fontSize:11}}>{loading?'Checking…':`${alerts.length} active`}</span>}>
   {loading?<Loading label="Checking inventory levels…"/>:error?<ErrorState message={error} onRetry={load}/>:alerts.length===0?
    <Empty title="No low-stock alerts" message="All tracked products are currently above their reorder levels." icon={AlertTriangle}/>:
    <div style={{display:'grid',gap:12,padding:16}}>
     {alerts.map(alert=><article key={`${alert.warehouse_id}-${alert.product_id}`} style={{border:'1px solid var(--border)',borderLeft:`4px solid ${alert.severity==='CRITICAL'?'#dc2626':'#f59e0b'}`,borderRadius:12,padding:15,background:'var(--surface)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
       <div style={{display:'flex',alignItems:'center',gap:9,minWidth:0}}>
        <AlertTriangle size={18} color={alert.severity==='CRITICAL'?'#dc2626':'#d97706'}/>
        <div>
         <strong>{alert.product_name}</strong>
         <div className="muted" style={{fontSize:11,marginTop:3}}>SKU: {alert.sku||'—'}</div>
        </div>
       </div>
       <Badge value={alert.severity}/>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6,marginTop:12,fontSize:12}}>
       <MapPin size={14}/><strong>{alert.warehouse_name}</strong><span className="muted">· {alert.warehouse_location||'Location not provided'}</span>
      </div>
      <p className="muted" style={{fontSize:12,margin:'10px 0'}}>{alert.message}</p>
      <div style={{display:'flex',flexWrap:'wrap',gap:'8px 20px',fontSize:11}}>
       <span>Available: <strong>{number(alert.available_quantity)}</strong></span>
       <span>Total stock: <strong>{number(alert.quantity)}</strong></span>
       <span>Reserved: <strong>{number(alert.reserved_quantity)}</strong></span>
       <span>Reorder level: <strong>{number(alert.reorder_level)}</strong></span>
       <span>Safety stock: <strong>{number(alert.safety_stock)}</strong></span>
      </div>
     </article>)}
    </div>}
  </Panel>
 </>;
}
