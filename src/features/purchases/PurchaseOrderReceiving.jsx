import React,{useEffect,useMemo,useState} from 'react';
import {PackageCheck,RefreshCw} from 'lucide-react';
import {useLocation,useNavigate} from 'react-router-dom';
import {apiGet,apiPost} from '../../services/api.js';
import {Badge,Button,Empty,ErrorState,Loading,Notice,PageHeader,Panel} from '../../components/ui/Primitives.jsx';
import {useAuth} from '../auth/AuthContext.jsx';

const rowsFromResponse=result=>Array.isArray(result)?result:result?.items||[];
const labelFor=(item,fallback)=>item?.name||item?.sku||item?.title||fallback;
const receivedFor=item=>Number(item.received_quantity??item.quantity_received??0);
const remainingFor=item=>Math.max(0,Number(item.quantity||0)-receivedFor(item));
const unavailableStatus=status=>['RECEIVED','CANCELLED','CANCELED','CLOSED'].includes(String(status||'').toUpperCase());

export function PurchaseOrderReceiving(){
 const {user}=useAuth(),navigate=useNavigate(),location=useLocation(),role=user?.role_name||user?.role||'';
 const [purchaseOrders,setPurchaseOrders]=useState([]),[orderItems,setOrderItems]=useState([]),[warehouses,setWarehouses]=useState([]),[products,setProducts]=useState([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[selectedOrderId,setSelectedOrderId]=useState(''),[warehouseId,setWarehouseId]=useState(''),[quantities,setQuantities]=useState({}),[notes,setNotes]=useState(''),[saving,setSaving]=useState(false),[notice,setNotice]=useState(null);
 const canReceive=['admin','purchase_manager','inventory_manager','warehouse_staff'].includes(role);
 const selectedOrder=purchaseOrders.find(order=>String(order.id)===selectedOrderId);
 const selectedItems=useMemo(()=>orderItems.filter(item=>String(item.purchase_order_id)===selectedOrderId),[orderItems,selectedOrderId]);
 const productById=useMemo(()=>new Map(products.map(product=>[String(product.id),product])),[products]);

 async function load(){
  setLoading(true);setError('');
  try{
   const [ordersResult,itemsResult,warehousesResult,productsResult]=await Promise.all([
    apiGet('/purchase-orders/?skip=0&limit=200'),
    apiGet('/purchase-order-items/?skip=0&limit=500'),
    apiGet('/warehouses/?skip=0&limit=200'),
    apiGet('/products/?skip=0&limit=200'),
   ]);
   setPurchaseOrders(rowsFromResponse(ordersResult));
   setOrderItems(rowsFromResponse(itemsResult));
   setWarehouses(rowsFromResponse(warehousesResult));
   setProducts(rowsFromResponse(productsResult));
  }catch(e){setError(e.message)}
  finally{setLoading(false)}
 }

 useEffect(()=>{load()},[]);

 useEffect(()=>{
  const requestedOrderId=new URLSearchParams(location.search).get('purchase_order_id');
  if(requestedOrderId&&!selectedOrderId&&purchaseOrders.length){
   selectOrder(requestedOrderId);
   navigate(location.pathname,{replace:true});
  }
 },[location.search,location.pathname,purchaseOrders,selectedOrderId,navigate]);

 function selectOrder(value){
  setSelectedOrderId(value);
  const order=purchaseOrders.find(item=>String(item.id)===value);
  setWarehouseId(order?.warehouse_id===undefined||order?.warehouse_id===null?'':String(order.warehouse_id));
  setQuantities({});
  setNotice(null);
 }

 function setQuantity(itemId,value){
  setQuantities(current=>({...current,[String(itemId)]:value}));
 }

 async function submit(event){
  event.preventDefault();setSaving(true);setNotice(null);
  try{
   if(!selectedOrder)throw new Error('Select a purchase order to receive.');
   if(!warehouseId)throw new Error('Select the warehouse receiving this order.');
   const requested=selectedItems.map((item,index)=>({
    item,
    quantity:Number(quantities[String(item.id??`${item.product_id}-${index}`)]||0),
   })).filter(line=>line.quantity>0);
   if(!requested.length)throw new Error('Enter a received quantity for at least one item.');
   for(const {item,quantity} of requested){
    if(!Number.isInteger(quantity)||quantity<1)throw new Error('Received quantities must be positive whole numbers.');
    if(quantity>remainingFor(item))throw new Error(`The received quantity for ${labelFor(productById.get(String(item.product_id)),`product #${item.product_id}`)} exceeds the remaining order quantity.`);
   }
   const itemsByProduct=new Map();
   requested.forEach(({item,quantity})=>{
    const key=String(item.product_id);
    itemsByProduct.set(key,(itemsByProduct.get(key)||0)+quantity);
   });
   await apiPost(`/purchase-orders/${selectedOrder.id}/receive`,{
    warehouse_id:Number(warehouseId),
    items:[...itemsByProduct].map(([product_id,quantity])=>({product_id:Number(product_id),quantity})),
    ...(notes.trim()?{notes:notes.trim()}:{})
   });
   setNotice({type:'success',text:'Receipt posted successfully. The server confirmed the inventory, goods receipt, stock movement, and purchase-order status update.'});
   setSelectedOrderId('');setWarehouseId('');setQuantities({});setNotes('');
   await load();
  }catch(e){setNotice({type:'error',text:e.message})}
  finally{setSaving(false)}
 }

 if(!canReceive)return <Panel title="Access restricted"><Empty title="Receiving is not available for your role" message="The backend remains the authority for permissions. Return to your dashboard to see the modules assigned to your account."/></Panel>;

 return <>
  <PageHeader title="Receive Purchase Orders" subtitle="Post received quantities against an order. The backend records the goods receipt and stock movement and updates inventory and order status." actions={<Button onClick={load}><RefreshCw size={14}/> Refresh</Button>}/>
  {notice&&<Notice type={notice.type}>{notice.text}</Notice>}
  {loading?<Loading label="Loading purchase orders and receiving options…"/>:error?<ErrorState message={error} onRetry={load}/>:<>
   <Panel title="Receipt details">
    <form className="panel-body" onSubmit={submit}>
     <div className="form-grid">
      <div className="form-field">
       <label htmlFor="purchase-order">Purchase order *</label>
       <select id="purchase-order" className="field-select" value={selectedOrderId} onChange={event=>selectOrder(event.target.value)} required>
        <option value="">Select a purchase order</option>
        {purchaseOrders.map(order=><option key={order.id} value={order.id} disabled={unavailableStatus(order.status)||!['APPROVED','ORDERED','PARTIALLY_RECEIVED'].includes(String(order.status||'').toUpperCase())}>
         {`PO #${order.id} · ${String(order.status||'Unknown').replaceAll('_',' ')}${order.supplier_id?` · Supplier #${order.supplier_id}`:''}`}
        </option>)}
       </select>
      </div>
      <div className="form-field">
       <label htmlFor="receiving-warehouse">Destination warehouse *</label>
       <select id="receiving-warehouse" className="field-select" value={warehouseId} onChange={event=>setWarehouseId(event.target.value)} required disabled={Boolean(selectedOrder?.warehouse_id)}>
        <option value="">Select a warehouse</option>
        {warehouses.map(warehouse=><option key={warehouse.id} value={warehouse.id}>{labelFor(warehouse,`Warehouse #${warehouse.id}`)}</option>)}
       </select>
      </div>
      <div className="form-field" style={{gridColumn:'1 / -1'}}>
       <label htmlFor="receipt-notes">Notes</label>
       <textarea id="receipt-notes" className="field-textarea" rows={3} value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Optional receipt notes"/>
      </div>
     </div>
    </form>
   </Panel>
   <Panel title="Items to receive" className="purchase-receiving-items">
    {!selectedOrder?<Empty title="Select a purchase order" message="Choose an order above to review its items and enter the quantities received." icon={PackageCheck}/>:selectedItems.length===0?<Empty title="No order items found" message="This purchase order has no item lines available to receive. Add items before posting a receipt." icon={PackageCheck}/>:<>
     <div className="table-scroll">
      <table>
       <thead><tr><th>Product</th><th>Ordered</th><th>Already received</th><th>Remaining</th><th>Receiving now</th></tr></thead>
       <tbody>{selectedItems.map((item,index)=>{
        const key=String(item.id??`${item.product_id}-${index}`),product=productById.get(String(item.product_id)),remaining=remainingFor(item);
        return <tr key={key}>
         <td>{labelFor(product,`Product #${item.product_id}`)}</td>
         <td>{item.quantity??'—'}</td>
         <td>{item.received_quantity??item.quantity_received??0}</td>
         <td>{remaining}</td>
         <td><input aria-label={`Quantity received for ${labelFor(product,`product #${item.product_id}`)}`} className="field-input" type="number" min="0" max={remaining} step="1" value={quantities[key]||''} onChange={event=>setQuantity(key,event.target.value)} disabled={remaining===0} placeholder="0" style={{width:110}}/></td>
        </tr>
       })}</tbody>
      </table>
     </div>
     <div className="panel-body form-actions">
      <Button type="button" onClick={()=>navigate('/purchase-orders')}>View purchase orders</Button>
      <Button type="button" variant="primary" disabled={saving||selectedItems.every((item,index)=>remainingFor(item)===0)} onClick={submit}>{saving?'Posting receipt…':'Post receipt'}</Button>
     </div>
    </>}
   </Panel>
  </>}
 </>;
}
