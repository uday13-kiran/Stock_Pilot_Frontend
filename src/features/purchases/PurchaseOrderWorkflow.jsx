import React,{useEffect,useMemo,useState} from 'react';
import {ArrowRight,Plus,RefreshCw,Trash2} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {apiGet,apiPost} from '../../services/api.js';
import {Badge,Button,Empty,ErrorState,Loading,Notice,PageHeader,Panel} from '../../components/ui/Primitives.jsx';
import {useAuth} from '../auth/AuthContext.jsx';

const rowsFromResponse=result=>Array.isArray(result)?result:result?.items||[];
const recordLabel=(item,fallback)=>item?.name||item?.sku||fallback;
const active=item=>item?.is_active!==false&&String(item?.status||'ACTIVE').toUpperCase()==='ACTIVE';
const itemKey=()=>`${Date.now()}-${Math.random()}`;
const lookupEndpoints={category:'/categories/',brand:'/brands/',unit:'/units/'};
const initialProduct=()=>({
 sku:'',barcode:'',name:'',description:'',category_id:'',brand_id:'',unit_id:'',
 selling_price:'0',purchase_price:'0',tax_percent:'0',reorder_level:'0',
 safety_stock:'0',maximum_stock:'0',lead_time:'0',status:'ACTIVE',
});

export function PurchaseOrderWorkflow(){
 const {user}=useAuth(),navigate=useNavigate(),role=user?.role_name||user?.role||'';
 const canCreate=['admin','purchase_manager'].includes(role),isAdmin=role==='admin';
 const [data,setData]=useState({orders:[],items:[],suppliers:[],warehouses:[],products:[],categories:[],brands:[],units:[]});
 const [lines,setLines]=useState([{key:itemKey(),product_id:'',quantity:'1'}]);
 const [supplierId,setSupplierId]=useState(''),[warehouseId,setWarehouseId]=useState('');
 const [expectedDate,setExpectedDate]=useState(''),[notes,setNotes]=useState('');
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState(false),[notice,setNotice]=useState(null);
 const [modalType,setModalType]=useState(''),[modalError,setModalError]=useState('');
 const [supplierDraft,setSupplierDraft]=useState({name:'',contact_person:'',email:'',phone:'',address:''});
 const [warehouseDraft,setWarehouseDraft]=useState({name:'',location:'',address:''});
 const [productDraft,setProductDraft]=useState(initialProduct);
 const [lookupDraft,setLookupDraft]=useState({type:'',field:'',name:''});
 const [productTargetLine,setProductTargetLine]=useState('');
 const supplierById=useMemo(()=>new Map(data.suppliers.map(item=>[String(item.id),item])),[data.suppliers]);
 const warehouseById=useMemo(()=>new Map(data.warehouses.map(item=>[String(item.id),item])),[data.warehouses]);
 const itemCounts=useMemo(()=>data.items.reduce((counts,item)=>{
  const key=String(item.purchase_order_id);
  counts[key]=(counts[key]||0)+1;
  return counts;
 },{}),[data.items]);

 async function load(){
  setLoading(true);setError('');
  try{
   const [orders,items,suppliers,warehouses,products,categories,brands,units]=await Promise.all([
    apiGet('/purchase-orders/?skip=0&limit=200'),
    apiGet('/purchase-order-items/?skip=0&limit=500'),
    apiGet('/suppliers/?skip=0&limit=200'),
    apiGet('/warehouses/?skip=0&limit=200'),
    apiGet('/products/?skip=0&limit=200'),
    apiGet('/categories/'),
    apiGet('/brands/?skip=0&limit=200'),
    apiGet('/units/?skip=0&limit=200'),
   ]);
   setData({
    orders:rowsFromResponse(orders),items:rowsFromResponse(items),suppliers:rowsFromResponse(suppliers),
    warehouses:rowsFromResponse(warehouses),products:rowsFromResponse(products),categories:rowsFromResponse(categories),
    brands:rowsFromResponse(brands),units:rowsFromResponse(units),
   });
  }catch(e){setError(e.message)}
  finally{setLoading(false)}
 }

 useEffect(()=>{load()},[]);

 function updateLine(key,field,value){
  setLines(current=>current.map(line=>line.key===key?{...line,[field]:value}:line));
 }

 function openModal(type,lineKey=''){
  setModalType(type);setModalError('');setProductTargetLine(lineKey);
  if(type==='supplier')setSupplierDraft({name:'',contact_person:'',email:'',phone:'',address:''});
  if(type==='warehouse')setWarehouseDraft({name:'',location:'',address:''});
  if(type==='product')setProductDraft(initialProduct());
 }

 async function saveLookup(event){
  event.preventDefault();setSaving(true);setModalError('');
  try{
    const endpoint=lookupEndpoints[lookupDraft.type];
   const created=await apiPost(endpoint,{name:lookupDraft.name.trim()});
   const key=`${lookupDraft.type}s`;
   setData(current=>({...current,[key]:[...current[key],created]}));
   setProductDraft(current=>({...current,[lookupDraft.field]:String(created.id)}));
   setModalType('product');
  }catch(e){setModalError(e.message)}
  finally{setSaving(false)}
 }

 async function saveMasterRecord(event){
  event.preventDefault();setSaving(true);setModalError('');
  try{
   if(modalType==='supplier'){
    const created=await apiPost('/suppliers/',{
     ...supplierDraft,name:supplierDraft.name.trim(),
     ...(supplierDraft.email.trim()?{email:supplierDraft.email.trim()}:{email:null}),
    });
    setData(current=>({...current,suppliers:[...current.suppliers,created]}));
    setSupplierId(String(created.id));
   }else if(modalType==='warehouse'){
    const created=await apiPost('/warehouses/',{
     ...warehouseDraft,name:warehouseDraft.name.trim(),location:warehouseDraft.location.trim(),
    });
    setData(current=>({...current,warehouses:[...current.warehouses,created]}));
    setWarehouseId(String(created.id));
   }else if(modalType==='product'){
    const body={
     ...productDraft,
     selling_price:Number(productDraft.selling_price),
     purchase_price:Number(productDraft.purchase_price),
     tax_percent:Number(productDraft.tax_percent),
     reorder_level:Number(productDraft.reorder_level),
     safety_stock:Number(productDraft.safety_stock),
     maximum_stock:Number(productDraft.maximum_stock),
     lead_time:Number(productDraft.lead_time),
     category_id:Number(productDraft.category_id),
     brand_id:Number(productDraft.brand_id),
     unit_id:Number(productDraft.unit_id),
    };
    const created=await apiPost('/products/',body);
    setData(current=>({...current,products:[...current.products,created]}));
    if(productTargetLine)updateLine(productTargetLine,'product_id',String(created.id));
   }
   setModalType('');
  }catch(e){setModalError(e.message)}
  finally{setSaving(false)}
 }

 async function createOrder(event){
  event.preventDefault();setSaving(true);setNotice(null);
  try{
   if(!supplierId)throw new Error('Select a supplier.');
   if(!warehouseId)throw new Error('Select the destination warehouse for this inventory.');
   const items=lines.map(line=>({
    product_id:Number(line.product_id),
    quantity:Number(line.quantity),
   }));
   if(items.some(item=>!item.product_id||!Number.isInteger(item.quantity)||item.quantity<1)){
    throw new Error('Choose a product and enter a positive whole-number quantity for every line.');
   }
   if(new Set(items.map(item=>item.product_id)).size!==items.length){
    throw new Error('Each product can appear only once. Update the quantity on its existing line.');
   }
   await apiPost('/purchase-orders/workflow',{
    supplier_id:Number(supplierId),
    warehouse_id:Number(warehouseId),
    items,
    ...(expectedDate?{expected_delivery_date:new Date(expectedDate).toISOString()}:{}),
    ...(notes.trim()?{notes:notes.trim()}:{}),
   });
   setNotice({type:'success',text:'Draft purchase order created with all product lines. Review and approve it when it is ready to send to the supplier.'});
   setLines([{key:itemKey(),product_id:'',quantity:'1'}]);
   setSupplierId('');setWarehouseId('');setExpectedDate('');setNotes('');
   await load();
  }catch(e){setNotice({type:'error',text:e.message})}
  finally{setSaving(false)}
 }

 async function approveOrder(orderId){
  setSaving(true);setNotice(null);
  try{
   await apiPost(`/purchase-orders/${orderId}/approve`,{});
   setNotice({type:'success',text:`Purchase order #${orderId} approved.`});
   await load();
  }catch(e){setNotice({type:'error',text:e.message})}
  finally{setSaving(false)}
 }

 if(!['admin','purchase_manager','inventory_manager'].includes(role)){
  return <Panel title="Access restricted"><Empty title="Purchase orders are not available for your role" message="Return to your dashboard to see the modules assigned to your account."/></Panel>;
 }

 const visibleSuppliers=data.suppliers.filter(active);
 const visibleWarehouses=data.warehouses.filter(active);
 const visibleProducts=data.products.filter(active);

 return <>
  <PageHeader title="Purchase Orders" subtitle="Create a supplier order for a specific warehouse inventory, approve it, then receive stock into that same warehouse." actions={<Button onClick={load}><RefreshCw size={14}/> Refresh</Button>}/>
  {notice&&<Notice type={notice.type}>{notice.text}</Notice>}
  {loading?<Loading label="Loading purchase orders and master data…"/>:error?<ErrorState message={error} onRetry={load}/>:<>
   {canCreate&&<Panel title="Create purchase order">
    <form className="panel-body" onSubmit={createOrder}>
     <div className="form-grid">
      <div className="form-field">
       <label htmlFor="po-supplier">Supplier *</label>
       <div style={{display:'flex',gap:8}}>
        <select id="po-supplier" className="field-select" value={supplierId} onChange={event=>setSupplierId(event.target.value)} required>
         <option value="">Select a supplier</option>
         {visibleSuppliers.map(item=><option key={item.id} value={item.id}>{recordLabel(item,`Supplier #${item.id}`)}</option>)}
        </select>
        <Button type="button" onClick={()=>openModal('supplier')} disabled={!['admin','purchase_manager'].includes(role)}><Plus size={14}/> New</Button>
       </div>
      </div>
      <div className="form-field">
       <label htmlFor="po-warehouse">Destination warehouse / inventory *</label>
       <div style={{display:'flex',gap:8}}>
        <select id="po-warehouse" className="field-select" value={warehouseId} onChange={event=>setWarehouseId(event.target.value)} required>
         <option value="">Select the inventory warehouse</option>
         {visibleWarehouses.map(item=><option key={item.id} value={item.id}>{`${recordLabel(item,`Warehouse #${item.id}`)}${item.location?` · ${item.location}`:''}`}</option>)}
        </select>
        <Button type="button" onClick={()=>openModal('warehouse')} disabled={!isAdmin}><Plus size={14}/> New</Button>
       </div>
       <small className="muted">Receiving this order updates stock in this warehouse.</small>
      </div>
      <div className="form-field">
       <label htmlFor="po-expected-date">Expected delivery date</label>
       <input id="po-expected-date" className="field-input" type="date" value={expectedDate} onChange={event=>setExpectedDate(event.target.value)}/>
      </div>
      <div className="form-field">
       <label htmlFor="po-notes">Notes</label>
       <input id="po-notes" className="field-input" value={notes} onChange={event=>setNotes(event.target.value)} maxLength={500} placeholder="Optional notes"/>
      </div>
     </div>
     <div className="form-field" style={{marginTop:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:10}}>
       <label>Products *</label>
       <Button type="button" onClick={()=>setLines(current=>[...current,{key:itemKey(),product_id:'',quantity:'1'}])}><Plus size={14}/> Add product</Button>
      </div>
      <div className="table-scroll">
       <table>
        <thead><tr><th>Product</th><th>Quantity</th><th aria-label="Actions"/></tr></thead>
        <tbody>{lines.map(line=><tr key={line.key}>
         <td>
          <div style={{display:'flex',gap:8}}>
           <select aria-label="Product" className="field-select" value={line.product_id} onChange={event=>updateLine(line.key,'product_id',event.target.value)} required>
            <option value="">Select a product</option>
            {visibleProducts.map(item=><option key={item.id} value={item.id} disabled={lines.some(other=>other.key!==line.key&&String(other.product_id)===String(item.id))}>{`${item.name} · ${item.sku}`}</option>)}
           </select>
           <Button type="button" onClick={()=>openModal('product',line.key)} disabled={!isAdmin}><Plus size={14}/> New</Button>
          </div>
         </td>
         <td><input aria-label="Quantity" className="field-input" type="number" min="1" step="1" value={line.quantity} onChange={event=>updateLine(line.key,'quantity',event.target.value)} required style={{maxWidth:140}}/></td>
         <td><Button type="button" aria-label="Remove product line" onClick={()=>setLines(current=>current.length>1?current.filter(item=>item.key!==line.key):current)} disabled={lines.length===1}><Trash2 size={15}/></Button></td>
        </tr>)}</tbody>
       </table>
      </div>
      <small className="muted">Supplier pricing is used when available; otherwise the product’s purchase price is used.</small>
     </div>
     <div className="form-actions" style={{marginTop:18}}>
      <Button type="submit" variant="primary" disabled={saving}>{saving?'Creating…':'Create draft purchase order'}</Button>
     </div>
    </form>
   </Panel>}

   <Panel title="Purchase order status">
    {data.orders.length===0?<Empty title="No purchase orders yet" message="Create a purchase order above to begin purchasing stock from a supplier."/>:
     <div className="table-scroll"><table>
      <thead><tr><th>Order</th><th>Supplier</th><th>Inventory warehouse</th><th>Products</th><th>Total</th><th>Status</th><th>Next step</th></tr></thead>
      <tbody>{data.orders.map(order=>{
       const supplier=supplierById.get(String(order.supplier_id)),warehouse=warehouseById.get(String(order.warehouse_id));
       const status=String(order.status||'').toUpperCase();
       return <tr key={order.id}>
        <td>PO #{order.id}</td>
        <td>{recordLabel(supplier,`Supplier #${order.supplier_id}`)}</td>
        <td>{recordLabel(warehouse,`Warehouse #${order.warehouse_id||'—'}`)}</td>
        <td>{itemCounts[String(order.id)]||0}</td>
        <td>{Number(order.total_amount||0).toLocaleString(undefined,{style:'currency',currency:'INR'})}</td>
        <td><Badge value={status}/></td>
        <td>{status==='DRAFT'&&canCreate?<Button type="button" variant="primary" size="small" disabled={saving||!itemCounts[String(order.id)]} onClick={()=>approveOrder(order.id)}>Approve</Button>:
         ['APPROVED','ORDERED','PARTIALLY_RECEIVED'].includes(status)?<Button type="button" size="small" onClick={()=>navigate(`/purchase-order-receiving?purchase_order_id=${order.id}`)}>Receive stock <ArrowRight size={14}/></Button>:'—'}</td>
       </tr>
      })}</tbody>
     </table></div>}
   </Panel>
  </>}

  {modalType&&<div role="presentation" onClick={()=>setModalType('')} style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(15,23,42,.55)',display:'grid',placeItems:'center',padding:20}}>
   <section role="dialog" aria-modal="true" aria-labelledby="quick-create-title" className="panel" onClick={event=>event.stopPropagation()} style={{width:'min(760px,100%)',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 24px 80px rgba(0,0,0,.25)'}}>
    <header className="panel-head"><h2 id="quick-create-title">{modalType==='product'?'Create product':modalType==='supplier'?'Create supplier':modalType==='warehouse'?'Create warehouse':`Create ${modalType}`}</h2><Button type="button" onClick={()=>setModalType('')}>Close</Button></header>
    {modalError&&<div style={{padding:'0 20px'}}><Notice type="error">{modalError}</Notice></div>}
    {['category','brand','unit'].includes(modalType)?<form className="panel-body" onSubmit={saveLookup}>
     <div className="form-field"><label htmlFor="lookup-name">Name *</label><input id="lookup-name" className="field-input" value={lookupDraft.name} onChange={event=>setLookupDraft(current=>({...current,name:event.target.value}))} required autoFocus/></div>
     <div className="form-actions"><Button type="button" onClick={()=>setModalType('product')}>Back</Button><Button type="submit" variant="primary" disabled={saving}>{saving?'Creating…':'Create'}</Button></div>
    </form>:modalType==='supplier'?<form className="panel-body" onSubmit={saveMasterRecord}>
     <div className="form-grid">
      <div className="form-field"><label htmlFor="supplier-name">Name *</label><input id="supplier-name" className="field-input" value={supplierDraft.name} onChange={event=>setSupplierDraft(current=>({...current,name:event.target.value}))} required/></div>
      <div className="form-field"><label htmlFor="supplier-contact">Contact person</label><input id="supplier-contact" className="field-input" value={supplierDraft.contact_person} onChange={event=>setSupplierDraft(current=>({...current,contact_person:event.target.value}))}/></div>
      <div className="form-field"><label htmlFor="supplier-email">Email</label><input id="supplier-email" className="field-input" type="email" value={supplierDraft.email} onChange={event=>setSupplierDraft(current=>({...current,email:event.target.value}))}/></div>
      <div className="form-field"><label htmlFor="supplier-phone">Phone</label><input id="supplier-phone" className="field-input" value={supplierDraft.phone} onChange={event=>setSupplierDraft(current=>({...current,phone:event.target.value}))}/></div>
      <div className="form-field" style={{gridColumn:'1 / -1'}}><label htmlFor="supplier-address">Address</label><textarea id="supplier-address" className="field-textarea" value={supplierDraft.address} onChange={event=>setSupplierDraft(current=>({...current,address:event.target.value}))}/></div>
     </div>
     <div className="form-actions"><Button type="button" onClick={()=>setModalType('')}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving?'Creating…':'Create supplier'}</Button></div>
    </form>:modalType==='warehouse'?<form className="panel-body" onSubmit={saveMasterRecord}>
     <div className="form-grid">
      <div className="form-field"><label htmlFor="warehouse-name">Name *</label><input id="warehouse-name" className="field-input" value={warehouseDraft.name} onChange={event=>setWarehouseDraft(current=>({...current,name:event.target.value}))} required/></div>
      <div className="form-field"><label htmlFor="warehouse-location">Location *</label><input id="warehouse-location" className="field-input" value={warehouseDraft.location} onChange={event=>setWarehouseDraft(current=>({...current,location:event.target.value}))} required/></div>
      <div className="form-field" style={{gridColumn:'1 / -1'}}><label htmlFor="warehouse-address">Address</label><textarea id="warehouse-address" className="field-textarea" value={warehouseDraft.address} onChange={event=>setWarehouseDraft(current=>({...current,address:event.target.value}))}/></div>
     </div>
     <div className="form-actions"><Button type="button" onClick={()=>setModalType('')}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving?'Creating…':'Create warehouse'}</Button></div>
    </form>:<form className="panel-body" onSubmit={saveMasterRecord}>
     <div className="form-grid">
      <div className="form-field"><label htmlFor="product-sku">SKU *</label><input id="product-sku" className="field-input" value={productDraft.sku} onChange={event=>setProductDraft(current=>({...current,sku:event.target.value}))} required/></div>
      <div className="form-field"><label htmlFor="product-name">Name *</label><input id="product-name" className="field-input" value={productDraft.name} onChange={event=>setProductDraft(current=>({...current,name:event.target.value}))} required/></div>
      <div className="form-field"><label htmlFor="product-category">Category *</label><div style={{display:'flex',gap:8}}><select id="product-category" className="field-select" value={productDraft.category_id} onChange={event=>setProductDraft(current=>({...current,category_id:event.target.value}))} required><option value="">Select category</option>{data.categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><Button type="button" onClick={()=>{setLookupDraft({type:'category',field:'category_id',name:''});setModalType('category')}}><Plus size={14}/></Button></div></div>
      <div className="form-field"><label htmlFor="product-brand">Brand *</label><div style={{display:'flex',gap:8}}><select id="product-brand" className="field-select" value={productDraft.brand_id} onChange={event=>setProductDraft(current=>({...current,brand_id:event.target.value}))} required><option value="">Select brand</option>{data.brands.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><Button type="button" onClick={()=>{setLookupDraft({type:'brand',field:'brand_id',name:''});setModalType('brand')}}><Plus size={14}/></Button></div></div>
      <div className="form-field"><label htmlFor="product-unit">Unit *</label><div style={{display:'flex',gap:8}}><select id="product-unit" className="field-select" value={productDraft.unit_id} onChange={event=>setProductDraft(current=>({...current,unit_id:event.target.value}))} required><option value="">Select unit</option>{data.units.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><Button type="button" onClick={()=>{setLookupDraft({type:'unit',field:'unit_id',name:''});setModalType('unit')}}><Plus size={14}/></Button></div></div>
      <div className="form-field"><label htmlFor="product-selling-price">Selling price *</label><input id="product-selling-price" className="field-input" type="number" min="0" step="0.01" value={productDraft.selling_price} onChange={event=>setProductDraft(current=>({...current,selling_price:event.target.value}))} required/></div>
      <div className="form-field"><label htmlFor="product-purchase-price">Purchase price *</label><input id="product-purchase-price" className="field-input" type="number" min="0" step="0.01" value={productDraft.purchase_price} onChange={event=>setProductDraft(current=>({...current,purchase_price:event.target.value}))} required/></div>
      <div className="form-field"><label htmlFor="product-tax">Tax percent *</label><input id="product-tax" className="field-input" type="number" min="0" step="0.01" value={productDraft.tax_percent} onChange={event=>setProductDraft(current=>({...current,tax_percent:event.target.value}))} required/></div>
      <div className="form-field"><label htmlFor="product-reorder">Reorder level *</label><input id="product-reorder" className="field-input" type="number" min="0" step="1" value={productDraft.reorder_level} onChange={event=>setProductDraft(current=>({...current,reorder_level:event.target.value}))} required/></div>
      <div className="form-field"><label htmlFor="product-safety">Safety stock *</label><input id="product-safety" className="field-input" type="number" min="0" step="1" value={productDraft.safety_stock} onChange={event=>setProductDraft(current=>({...current,safety_stock:event.target.value}))} required/></div>
      <div className="form-field"><label htmlFor="product-maximum">Maximum stock *</label><input id="product-maximum" className="field-input" type="number" min="0" step="1" value={productDraft.maximum_stock} onChange={event=>setProductDraft(current=>({...current,maximum_stock:event.target.value}))} required/></div>
      <div className="form-field"><label htmlFor="product-lead">Lead time (days) *</label><input id="product-lead" className="field-input" type="number" min="0" step="1" value={productDraft.lead_time} onChange={event=>setProductDraft(current=>({...current,lead_time:event.target.value}))} required/></div>
      <div className="form-field"><label htmlFor="product-barcode">Barcode</label><input id="product-barcode" className="field-input" value={productDraft.barcode} onChange={event=>setProductDraft(current=>({...current,barcode:event.target.value}))}/></div>
      <div className="form-field" style={{gridColumn:'1 / -1'}}><label htmlFor="product-description">Description</label><textarea id="product-description" className="field-textarea" value={productDraft.description} onChange={event=>setProductDraft(current=>({...current,description:event.target.value}))}/></div>
     </div>
     <div className="form-actions"><Button type="button" onClick={()=>setModalType('')}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving?'Creating…':'Create product'}</Button></div>
    </form>}
   </section>
  </div>}
 </>;
}
