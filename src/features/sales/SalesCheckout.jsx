import React,{useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ArrowLeft,CheckCircle2,Plus,Trash2,ShoppingCart} from 'lucide-react';
import {apiGet,apiPost} from '../../services/api.js';
import {Button,Empty,ErrorState,Loading,Notice,PageHeader,Panel} from '../../components/ui/Primitives.jsx';

const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n||0));
const rowsFromResponse=result=>Array.isArray(result)?result:result?.items||[];

export function SalesCheckout(){
 const navigate=useNavigate();
 const [customers,setCustomers]=useState([]);
 const [products,setProducts]=useState([]);
 const [warehouses,setWarehouses]=useState([]);
 const [warehouseStock,setWarehouseStock]=useState([]);
 const [stockRefreshKey,setStockRefreshKey]=useState(0);
 const [loading,setLoading]=useState(true);
 const [stockLoading,setStockLoading]=useState(false);
 const [error,setError]=useState('');
 const [stockError,setStockError]=useState('');
 const [saving,setSaving]=useState(false);
 const [result,setResult]=useState(null);
 const [notice,setNotice]=useState('');
 const [customerId,setCustomerId]=useState('');
 const [warehouseId,setWarehouseId]=useState('');
 const [paymentMethod,setPaymentMethod]=useState('CASH');
 const [search,setSearch]=useState('');
 const [cart,setCart]=useState([]);

 useEffect(()=>{
  let cancelled=false;
  Promise.all([
   apiGet('/customers/?skip=0&limit=200'),
   apiGet('/products/?skip=0&limit=200'),
   apiGet('/warehouses/?skip=0&limit=200'),
  ]).then(([customerRows,productRows,warehouseRows])=>{
   if(cancelled)return;
   setCustomers(rowsFromResponse(customerRows));
   setProducts(rowsFromResponse(productRows));
   setWarehouses(rowsFromResponse(warehouseRows));
  }).catch(e=>{if(!cancelled)setError(e.message)}).finally(()=>{if(!cancelled)setLoading(false)});
  return()=>{cancelled=true};
 },[]);

 useEffect(()=>{
  if(!warehouseId){
   setWarehouseStock([]);
   setStockError('');
   setStockLoading(false);
   return undefined;
  }
  let cancelled=false;
  setWarehouseStock([]);
  setStockError('');
  setStockLoading(true);
  apiGet(`/inventory/?warehouse_id=${encodeURIComponent(warehouseId)}&skip=0&limit=500`)
   .then(rows=>{
    if(!cancelled)setWarehouseStock(rowsFromResponse(rows));
   })
   .catch(e=>{
    if(!cancelled){
     setStockError(e.message);
     setWarehouseStock([]);
    }
   })
   .finally(()=>{if(!cancelled)setStockLoading(false)});
  return()=>{cancelled=true};
 },[warehouseId,stockRefreshKey]);

 const stockByProduct=useMemo(
  ()=>new Map(warehouseStock.map(row=>[String(row.product_id),row])),
  [warehouseStock],
 );
 const productById=useMemo(
  ()=>new Map(products.map(product=>[String(product.id),product])),
  [products],
 );
 const availableProducts=useMemo(()=>products.filter(product=>{
  const stock=stockByProduct.get(String(product.id));
  return product.is_active!==false
   &&String(product.status||'ACTIVE').toUpperCase()==='ACTIVE'
   &&Number(stock?.available_quantity||0)>0
   &&JSON.stringify(product).toLowerCase().includes(search.trim().toLowerCase());
 }),[products,stockByProduct,search]);
 const total=cart.reduce((sum,item)=>sum+item.quantity*item.unit_price,0);

 function selectWarehouse(value){
  setWarehouseId(value);
  setCart([]);
  setNotice('');
 }

 function refreshWarehouseStock(){
  setStockRefreshKey(current=>current+1);
 }

 function add(product){
  const available=Number(stockByProduct.get(String(product.id))?.available_quantity||0);
  if(available<1){
   setNotice(`${product.name} has no available stock in the selected warehouse.`);
   return;
  }
  setCart(current=>{
   const existing=current.find(item=>item.product_id===product.id);
   if(existing){
    if(existing.quantity>=available){
     setNotice(`Only ${available} units of ${product.name} are available in this warehouse.`);
     return current;
    }
    return current.map(item=>item.product_id===product.id?{...item,quantity:item.quantity+1}:item);
   }
   return [...current,{
    product_id:product.id,
    name:product.name,
    quantity:1,
    available_quantity:available,
    unit_price:Number(product.selling_price||0),
   }];
  });
  setNotice('');
 }

 function setItemQuantity(productId,value){
  const item=cart.find(row=>row.product_id===productId);
  const quantity=Math.max(1,Math.min(item?.available_quantity||1,Number(value)||1));
  setCart(current=>current.map(row=>row.product_id===productId?{...row,quantity}:row));
 }

 async function submit(event){
  event.preventDefault();
  if(!cart.length){setNotice('Add at least one in-stock product before checkout.');return}
  setSaving(true);setNotice('');
  try{
   const sale=await apiPost('/sales/checkout',{
    customer_id:Number(customerId),
    warehouse_id:Number(warehouseId),
    items:cart.map(item=>({
     product_id:item.product_id,
     quantity:item.quantity,
     unit_price:item.unit_price,
     discount_amount:0,
     tax_amount:0,
    })),
    discount_amount:0,
    tax_amount:0,
    payment_method:paymentMethod,
   });
   setResult(sale);
   try{
    const updatedInventory=await apiGet(`/inventory/?warehouse_id=${encodeURIComponent(warehouseId)}&skip=0&limit=500`);
    setWarehouseStock(rowsFromResponse(updatedInventory));
    setStockError('');
   }catch(refreshError){
    setStockError(`Sale completed, but the latest warehouse stock could not be refreshed: ${refreshError.message}`);
   }
  }catch(e){setNotice(e.message)}
  finally{setSaving(false)}
 }

 if(loading)return <Loading label="Loading customers, products, and warehouses…"/>;
 if(error)return <ErrorState message={error}/>;
 if(result)return <>
  <PageHeader title="Sale completed" subtitle="The server recorded the sale and deducted the sold quantities from the selected warehouse inventory."/>
  {stockError&&<Notice type="error">{stockError}</Notice>}
  <Panel title="Checkout result">
   <div className="panel-body">
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
     <CheckCircle2 size={30} color="var(--green)"/>
     <div><strong>Sale and inventory update confirmed</strong><div className="muted" style={{fontSize:12,marginTop:4}}>Stock deduction is committed by the backend with the sale.</div></div>
    </div>
    {Object.entries(result).map(([key,value])=><div className="stat-row" key={key}><span>{key.replaceAll('_',' ')}</span><strong>{typeof value==='object'?JSON.stringify(value):String(value)}</strong></div>)}
    {Array.isArray(result.inventory_updates)&&<div style={{marginTop:18}}>
     <h3 style={{fontSize:14}}>Inventory after this sale</h3>
     <div className="table-scroll"><table>
      <thead><tr><th>Product</th><th>Sold</th><th>Remaining total</th><th>Available to sell</th></tr></thead>
      <tbody>{result.inventory_updates.map(update=>{
       const product=productById.get(String(update.product_id));
       const sold=cart.find(item=>item.product_id===update.product_id)?.quantity||0;
       return <tr key={update.product_id}>
        <td>{product?.name||`Product #${update.product_id}`}</td>
        <td>{sold}</td>
        <td>{update.quantity}</td>
        <td>{update.available_quantity}</td>
       </tr>;
      })}</tbody>
     </table></div>
    </div>}
    <div className="form-actions">
     <Button onClick={()=>navigate('/sales')}>View sales</Button>
     <Button variant="primary" onClick={()=>{setResult(null);setCart([]);setCustomerId('');selectWarehouse('')}}>Create another sale</Button>
    </div>
   </div>
  </Panel>
 </>;

 return <>
  <PageHeader title="Create sale" subtitle="Products are limited to available stock at the selected warehouse. Completing checkout deducts stock from that warehouse." actions={<Button onClick={()=>navigate('/sales')}><ArrowLeft size={15}/> Sales history</Button>}/>
  {notice&&<Notice type="error">{notice}</Notice>}
  {stockError&&<Notice type="error">{stockError}</Notice>}
  <form onSubmit={submit}>
   <div className="grid two-col">
    <Panel title="1. Sale details">
     <div className="panel-body form-grid">
      <div className="form-field">
       <label htmlFor="sale-customer">Customer *</label>
       <select id="sale-customer" className="field-select" value={customerId} onChange={event=>setCustomerId(event.target.value)} required>
        <option value="">Select customer</option>
        {customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name} {customer.email?`— ${customer.email}`:''}</option>)}
       </select>
      </div>
      <div className="form-field">
       <label htmlFor="sale-warehouse">Warehouse *</label>
       <select id="sale-warehouse" className="field-select" value={warehouseId} onChange={event=>selectWarehouse(event.target.value)} required>
        <option value="">Select warehouse</option>
        {warehouses.filter(warehouse=>warehouse.is_active!==false).map(warehouse=><option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
       </select>
       <small className="muted">Changing the warehouse clears the current sale items.</small>
      </div>
      <div className="form-field full">
       <label htmlFor="sale-payment-method">Payment method</label>
       <select id="sale-payment-method" className="field-select" value={paymentMethod} onChange={event=>setPaymentMethod(event.target.value)}>
        <option value="CASH">Cash</option><option value="CARD">Card</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CREDIT">Credit</option>
       </select>
      </div>
     </div>
    </Panel>
    <Panel title="2. Add products">
     <div className="table-tools"><input className="field-search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search by product name or SKU…" disabled={!warehouseId}/></div>
     {!warehouseId?<Empty title="Select a warehouse first" message="Only products with available inventory in the selected warehouse can be added."/>:
      stockLoading?<Loading label="Loading warehouse stock…"/>:
      stockError?<ErrorState message={stockError} onRetry={refreshWarehouseStock}/>:
      <div style={{maxHeight:340,overflowY:'auto'}}>
       {availableProducts.slice(0,50).map(product=>{
        const available=Number(stockByProduct.get(String(product.id))?.available_quantity||0);
        return <div key={product.id} className="stat-row" style={{padding:'12px 17px',gap:10}}>
         <div style={{flex:1,minWidth:0}}>
          <strong style={{display:'block',fontSize:12}}>{product.name}</strong>
          <span className="muted" style={{fontSize:10}}>{product.sku||`Product #${product.id}`} · {money(product.selling_price)} · {available} available</span>
         </div>
         <Button type="button" size="small" onClick={()=>add(product)} disabled={cart.find(item=>item.product_id===product.id)?.quantity>=available}><Plus size={13}/> Add</Button>
        </div>;
       })}
       {!availableProducts.length&&<Empty title={search?'No matching in-stock products':'No products in stock'} message={search?'Try another product name or SKU.':'This warehouse has no products with available quantity.'}/>}
      </div>}
    </Panel>
   </div>
   <div style={{marginTop:15}}>
    <Panel title="3. Review items">
     <div className="table-scroll">
      <table>
       <thead><tr><th>Product</th><th>Available at warehouse</th><th>Unit price</th><th>Quantity</th><th>Subtotal</th><th/></tr></thead>
       <tbody>{cart.map(item=><tr key={item.product_id}>
        <td>{item.name}</td>
        <td>{item.available_quantity}</td>
        <td>{money(item.unit_price)}</td>
        <td><input aria-label={`Quantity for ${item.name}`} type="number" min="1" max={item.available_quantity} value={item.quantity} className="field-input" style={{width:78,padding:7}} onChange={event=>setItemQuantity(item.product_id,event.target.value)}/></td>
        <td>{money(item.quantity*item.unit_price)}</td>
        <td><button className="icon-btn" type="button" aria-label={`Remove ${item.name}`} onClick={()=>setCart(current=>current.filter(row=>row.product_id!==item.product_id))}><Trash2 size={14}/></button></td>
       </tr>)}</tbody>
      </table>
      {!cart.length&&<Empty title="Your sale is empty" message="Select a warehouse, then add an in-stock product." icon={ShoppingCart}/>}
     </div>
     <div className="panel-body" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:15}}>
      <div><div className="muted" style={{fontSize:11}}>Estimated item subtotal</div><strong style={{fontSize:24}}>{money(total)}</strong><div className="muted" style={{fontSize:10,marginTop:4}}>The backend verifies available stock and calculates the final prices and taxes.</div></div>
      <Button type="submit" variant="primary" disabled={saving||stockLoading||!cart.length||!customerId||!warehouseId}>{saving?'Submitting…':'Confirm sale'} <ShoppingCart size={15}/></Button>
     </div>
    </Panel>
   </div>
  </form>
 </>;
}
