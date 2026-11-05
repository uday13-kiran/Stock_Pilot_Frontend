import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Boxes,
  ChartNoAxesCombined,
  CircleAlert,
  CreditCard,
  Eye,
  MapPin,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBasket,
  ShoppingCart,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { apiGet } from '../../services/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Badge, Button, Empty, ErrorState, Loading, PageHeader, Panel } from '../../components/ui/Primitives.jsx';
import './inventory-dashboard.css';

const roles = {
  admin: {
    title: 'Good morning',
    subtitle: 'Here’s what’s happening with your business today.',
    links: [
      ['Create Sale', '/sales/checkout', ShoppingCart],
      ['Create Purchase', '/purchase-orders', ShoppingBasket],
      ['Inventory Dashboard', '/inventory', Boxes],
    ],
    reports: ['/reports/sales-summary', '/reports/purchase-summary', '/reports/inventory-summary'],
  },
  inventory_manager: {
    title: 'Inventory overview',
    subtitle: 'Keep stock accurate, available, and ready for demand.',
    links: [
      ['Stock Adjustments', '/stock-adjustments', Activity],
      ['Reorder Rules', '/reorder-rules', RefreshCw],
    ],
    reports: ['/reports/inventory-summary', '/reports/stock-movements'],
  },
  purchase_manager: {
    title: 'Purchasing workspace',
    subtitle: 'Track supplier orders, receipts, and replenishment needs.',
    links: [
      ['New Purchase Order', '/purchase-orders', ShoppingBasket],
      ['Purchase Recommendations', '/purchase-recommendations', ChartNoAxesCombined],
    ],
    reports: ['/reports/purchase-summary', '/reports/inventory-summary', '/planning/stockout-predictions'],
  },
  sales_staff: {
    title: 'Sales workspace',
    subtitle: 'Find products, serve customers, and complete sales.',
    links: [
      ['Create Sale', '/sales/checkout', ShoppingCart],
      ['Customers', '/customers', Users],
    ],
    reports: [],
  },
  warehouse_staff: {
    title: 'Warehouse operations',
    subtitle: 'Review inventory movement and keep fulfilment on track.',
    links: [
      ['Stock Transfers', '/stock-transfers', ArrowRight],
      ['Goods Receipts', '/goods-receipts', PackageCheck],
    ],
    reports: ['/reports/inventory-summary', '/reports/stock-movements'],
  },
  finance_billing_staff: {
    title: 'Finance & billing',
    subtitle: 'Keep invoices, payments, and collections moving.',
    links: [
      ['Invoices', '/invoices', CreditCard],
      ['Payments', '/payments', CreditCard],
    ],
    reports: ['/reports/sales-summary'],
  },
};

const money = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const GOODS_RECEIPT_ITEMS_ENDPOINT = '/goods-receipt-items/?skip=0&limit=500';
const rowsFromResponse = (result) => (Array.isArray(result) ? result : result?.items || []);
const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN');
const inventoryRows = (result) => rowsFromResponse(result);

export function Dashboard() {
  const { user } = useAuth();
  const role = user?.role_name || user?.role || '';

  return role === 'inventory_manager' || role === 'warehouse_staff' ? <InventoryPage /> : <RoleDashboard />;
}

export function InventoryPage() {
  const { user } = useAuth();
  const role = user?.role_name || user?.role || '';

  if (!['admin', 'inventory_manager', 'warehouse_staff'].includes(role)) {
    return <Panel title="Access restricted"><Empty title="Inventory overview is not available for your role" message="Return to your dashboard to see the modules assigned to your account." icon={Warehouse} /></Panel>;
  }

  return <InventoryOverview />;
}

function InventoryOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState({});
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState('All');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const load = useCallback(async () => {
    setBusy(true);
    const endpoints = [
      ['/products/?skip=0&limit=200', 'products'],
      ['/warehouses/?skip=0&limit=200', 'warehouses'],
      ['/inventory/?skip=0&limit=500', 'inventory'],
      ['/categories/?skip=0&limit=200', 'categories'],
      ['/goods-receipts/?skip=0&limit=500', 'goodsReceipts'],
      [GOODS_RECEIPT_ITEMS_ENDPOINT, 'goodsReceiptItems'],
    ];
    const results = await Promise.all(endpoints.map(async ([path, key]) => {
      try {
        return [key, await apiGet(path)];
      } catch (error) {
        return [key, { __error: error.message }];
      }
    }));
    setData(Object.fromEntries(results));
    setBusy(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [load]);

  const products = inventoryRows(data.products);
  const warehouses = inventoryRows(data.warehouses);
  const stockRecords = inventoryRows(data.inventory);
  const categories = inventoryRows(data.categories);
  const receipts = inventoryRows(data.goodsReceipts);
  const receiptItems = inventoryRows(data.goodsReceiptItems);
  const productById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [String(category.id), category.name])), [categories]);
  const receiptById = useMemo(() => new Map(receipts.map((receipt) => [String(receipt.id), receipt])), [receipts]);

  const warehouseSummaries = useMemo(() => warehouses.map((warehouse) => {
    const records = stockRecords.filter((record) => String(record.warehouse_id) === String(warehouse.id));
    const units = records.reduce((sum, record) => sum + Number(record.quantity || 0), 0);
    const available = records.reduce((sum, record) => sum + Math.max(0, Number(record.quantity || 0) - Number(record.reserved_quantity || 0)), 0);
    const receiptIds = new Set(receipts
      .filter((receipt) => String(receipt.warehouse_id) === String(warehouse.id))
      .map((receipt) => String(receipt.id)));
    const received = receiptItems
      .filter((item) => receiptIds.has(String(item.goods_receipt_id)))
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return {
      ...warehouse,
      records,
      units,
      available,
      received,
      productCount: new Set(records.map((record) => String(record.product_id))).size,
    };
  }), [warehouses, stockRecords, receipts, receiptItems]);

  const filteredWarehouses = warehouseSummaries.filter((warehouse) => {
    if (filter === 'Active') return warehouse.is_active !== false;
    if (filter === 'Inactive') return warehouse.is_active === false;
    return true;
  });
  const selectedWarehouse = filteredWarehouses.find((warehouse) => String(warehouse.id) === String(selectedWarehouseId))
    || filteredWarehouses[0];

  const rows = useMemo(() => {
    if (!selectedWarehouse) return [];
    return selectedWarehouse.records.map((record) => {
      const product = productById.get(String(record.product_id)) || {};
      const quantity = Number(record.quantity || 0);
      const reserved = Number(record.reserved_quantity || 0);
      const available = Math.max(0, quantity - reserved);
      const reorderLevel = Number(product.reorder_level || 0);
      const lowStock = available <= reorderLevel;
      const received = receiptItems
        .filter((item) => String(item.product_id) === String(record.product_id)
          && String(receiptById.get(String(item.goods_receipt_id))?.warehouse_id) === String(selectedWarehouse.id))
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      return { ...record, product, quantity, reserved, available, lowStock, received };
    }).filter((record) => `${record.product.name || ''} ${record.product.sku || ''} ${categoryById.get(String(record.product.category_id)) || ''}`
      .toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => a.product.name?.localeCompare(b.product.name || '') || 0);
  }, [selectedWarehouse, productById, categoryById, receiptItems, receiptById, query]);

  const totalStockValue = stockRecords.reduce((sum, record) => {
    const product = productById.get(String(record.product_id));
    return sum + Number(record.quantity || 0) * Number(product?.purchase_price || 0);
  }, 0);
  const lowStockCount = stockRecords.reduce((count, record) => {
    const product = productById.get(String(record.product_id));
    const available = Math.max(0, Number(record.quantity || 0) - Number(record.reserved_quantity || 0));
    return count + (available <= Number(product?.reorder_level || 0) ? 1 : 0);
  }, 0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const failedLoads = Object.values(data).filter((value) => value?.__error);
  const errors = failedLoads.map((value) => value.__error).filter(Boolean);

  useEffect(() => {
    setPage(1);
  }, [selectedWarehouseId, query]);

  return (
    <div className="inventory-overview">
      <PageHeader
        title="Inventory"
        subtitle="Track products, stock levels, and receipts across all warehouses."
        actions={
          <>
            <Button variant="primary" onClick={() => navigate('/reports/stock-movements')}>
              <Activity size={15} /> Stock Movements
            </Button>
            <Button onClick={load}><RefreshCw size={14} /> Refresh</Button>
          </>
        }
      />

      {errors.length > 0 && (
        <div className="notice" role="status">
          Some inventory details could not be loaded: {errors.join('; ')}
        </div>
      )}

      <div className="inventory-overview-kpis">
        <div className="inventory-kpi mint">
          <span className="inventory-kpi-icon"><Package size={21} /></span>
          <div><span>Total Products</span><strong>{busy || data.products?.__error ? '—' : formatNumber(products.length)}</strong></div>
          <small>In the product catalogue</small>
        </div>
        <div className="inventory-kpi sky">
          <span className="inventory-kpi-icon"><Warehouse size={21} /></span>
          <div><span>Total Warehouses</span><strong>{busy || data.warehouses?.__error ? '—' : formatNumber(warehouses.length)}</strong></div>
          <small>{data.warehouses?.__error ? 'Unavailable' : `${formatNumber(warehouseSummaries.filter((warehouse) => warehouse.is_active !== false).length)} active`}</small>
        </div>
        <div className="inventory-kpi sand">
          <span className="inventory-kpi-icon"><Boxes size={21} /></span>
          <div><span>Total Stock Value</span><strong>{busy || data.inventory?.__error || data.products?.__error ? '—' : money(totalStockValue)}</strong></div>
          <small>Based on purchase price</small>
        </div>
        <div className="inventory-kpi rose">
          <span className="inventory-kpi-icon"><CircleAlert size={21} /></span>
          <div><span>Low Stock Items</span><strong>{busy || data.inventory?.__error || data.products?.__error ? '—' : formatNumber(lowStockCount)}</strong></div>
          <small>At or below reorder level</small>
        </div>
      </div>

      <Panel title="Warehouses" action={
        <div className="inventory-filters" aria-label="Filter warehouses">
          {['All', 'Active', 'Inactive'].map((option) => (
            <button type="button" key={option} className={filter === option ? 'selected' : ''} onClick={() => setFilter(option)}>
              {option}
            </button>
          ))}
        </div>
      }>
        {busy ? <Loading label="Loading warehouses and stock…" /> : filteredWarehouses.length ? (
          <div className="warehouse-cards">
            {filteredWarehouses.map((warehouse) => (
              <button
                type="button"
                key={warehouse.id}
                className={`warehouse-card ${String(selectedWarehouse?.id) === String(warehouse.id) ? 'selected' : ''}`}
                onClick={() => setSelectedWarehouseId(warehouse.id)}
              >
                <span className="warehouse-card-icon"><Warehouse size={22} /></span>
                <span className="warehouse-card-content">
                  <strong>{warehouse.name || `Warehouse #${warehouse.id}`}</strong>
                  <small>{formatNumber(warehouse.productCount)} products · {formatNumber(warehouse.units)} units</small>
                </span>
                <span className="warehouse-card-arrow"><Eye size={16} /></span>
              </button>
            ))}
          </div>
        ) : <Empty title="No warehouses found" message="Add or activate a warehouse to see its inventory overview." icon={Warehouse} />}
      </Panel>

      {busy ? <div className="panel inventory-detail-loading"><Loading label="Preparing inventory overview…" /></div> : selectedWarehouse ? (
        <div className="inventory-detail-layout">
          <Panel className="warehouse-detail-panel" title="Warehouse details">
            <div className="warehouse-detail">
              <div className="warehouse-detail-hero"><Warehouse size={42} /></div>
              <div className="warehouse-detail-title">
                <h3>{selectedWarehouse.name || `Warehouse #${selectedWarehouse.id}`}</h3>
                <Badge value={selectedWarehouse.is_active === false ? 'Inactive' : 'Active'} />
              </div>
              <div className="warehouse-location">
                <MapPin size={16} />
                <span>{selectedWarehouse.location || selectedWarehouse.address || 'Location not provided'}</span>
              </div>
              <div className="warehouse-detail-stats">
                <div><span>Current stock</span><strong>{formatNumber(selectedWarehouse.units)} units</strong></div>
                <div><span>Available stock</span><strong>{formatNumber(selectedWarehouse.available)} units</strong></div>
                <div><span>Units received</span><strong>{data.goodsReceiptItems?.__error || data.goodsReceipts?.__error ? '—' : formatNumber(selectedWarehouse.received)}</strong></div>
                <div><span>Products stocked</span><strong>{formatNumber(selectedWarehouse.productCount)}</strong></div>
              </div>
              <div className="warehouse-utilization">
                <div><span>Stock availability</span><strong>{selectedWarehouse.units ? `${Math.round(selectedWarehouse.available / selectedWarehouse.units * 100)}%` : '0%'}</strong></div>
                <div className="utilization-track"><span style={{ width: `${selectedWarehouse.units ? selectedWarehouse.available / selectedWarehouse.units * 100 : 0}%` }} /></div>
                <small>Available units compared with total stock</small>
              </div>
            </div>
          </Panel>

          <Panel title={`Products in ${selectedWarehouse.name || `Warehouse #${selectedWarehouse.id}`}`} className="inventory-products-panel" action={
            <label className="inventory-product-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products…" /></label>
          }>
            {data.inventory?.__error || data.products?.__error ? (
              <ErrorState message={data.inventory?.__error || data.products?.__error} onRetry={load} />
            ) : pageRows.length ? (
              <>
                <div className="table-scroll">
                  <table className="inventory-overview-table">
                    <thead><tr><th>#</th><th>Product</th><th>Category</th><th>Available</th><th>Reserved</th><th>Total Stock</th><th>Received</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>{pageRows.map((record, index) => (
                      <tr key={record.id ?? `${record.product_id}-${index}`}>
                        <td>{(page - 1) * pageSize + index + 1}</td>
                        <td><span className="inventory-product-name">{record.product.name || `Product #${record.product_id}`}</span><small>{record.product.sku || ''}</small></td>
                        <td><span className="inventory-category">{categoryById.get(String(record.product.category_id)) || 'Uncategorized'}</span></td>
                        <td>{formatNumber(record.available)}</td>
                        <td>{formatNumber(record.reserved)}</td>
                        <td>{formatNumber(record.quantity)}</td>
                        <td>{data.goodsReceiptItems?.__error || data.goodsReceipts?.__error ? '—' : formatNumber(record.received)}</td>
                        <td><span className={`badge ${record.lowStock ? 'orange' : 'green'}`}>{record.lowStock ? 'Low Stock' : 'In Stock'}</span></td>
                        <td><button type="button" className="inventory-view-button" aria-label={`View ${record.product.name || 'product'}`} onClick={() => setSelectedProduct(record)}><Eye size={16} /></button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <div className="inventory-table-footer">
                  <span>Showing {rows.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, rows.length)} of {formatNumber(rows.length)} products</span>
                  <div className="inventory-pagination">
                    <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>‹</button>
                    <span>{page} / {pages}</span>
                    <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>›</button>
                  </div>
                </div>
              </>
            ) : <Empty title="No inventory records" message={query ? 'Try another product or category search.' : 'There are no stock records for this warehouse yet.'} icon={Package} />}
          </Panel>
        </div>
      ) : !busy ? <Panel title="Warehouse inventory"><Empty title="No warehouse selected" message="Create a warehouse to view its products and stock levels." icon={Warehouse} /></Panel> : null}
      {selectedProduct&&<div role="presentation" onClick={()=>setSelectedProduct(null)} style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(15,23,42,.55)',display:'grid',placeItems:'center',padding:20}}>
        <section role="dialog" aria-modal="true" aria-labelledby="inventory-product-title" className="panel" onClick={event=>event.stopPropagation()} style={{width:'min(620px,100%)',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 24px 80px rgba(0,0,0,.25)'}}>
          <header className="panel-head"><h2 id="inventory-product-title">Product details</h2><button type="button" className="inventory-view-button" aria-label="Close product details" onClick={()=>setSelectedProduct(null)}><X size={16}/></button></header>
          <div className="panel-body">
            <h3 style={{margin:'0 0 5px'}}>{selectedProduct.product.name||`Product #${selectedProduct.product_id}`}</h3>
            <div className="muted" style={{marginBottom:14}}>{selectedProduct.product.sku||'SKU not provided'}</div>
            {[
              ['Warehouse',selectedWarehouse?.name||'—'],
              ['Category',categoryById.get(String(selectedProduct.product.category_id))||'Uncategorized'],
              ['Description',selectedProduct.product.description||'—'],
              ['Barcode',selectedProduct.product.barcode||'—'],
              ['Available quantity',formatNumber(selectedProduct.available)],
              ['Reserved quantity',formatNumber(selectedProduct.reserved)],
              ['Total warehouse quantity',formatNumber(selectedProduct.quantity)],
              ['Units received',data.goodsReceiptItems?.__error||data.goodsReceipts?.__error?'—':formatNumber(selectedProduct.received)],
              ['Selling price',money(selectedProduct.product.selling_price)],
              ['Purchase price',money(selectedProduct.product.purchase_price)],
              ['Tax rate',`${Number(selectedProduct.product.tax_percent||0)}%`],
              ['Reorder level',formatNumber(selectedProduct.product.reorder_level)],
              ['Safety stock',formatNumber(selectedProduct.product.safety_stock)],
              ['Maximum stock',formatNumber(selectedProduct.product.maximum_stock)],
              ['Lead time',`${formatNumber(selectedProduct.product.lead_time)} days`],
              ['Status',selectedProduct.product.status||'—'],
            ].map(([label,value])=><div className="stat-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </div>
        </section>
      </div>}
    </div>
  );
}

function RoleDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role_name || user?.role || '';
  const config = roles[role] || roles.sales_staff;

  const [data, setData] = useState({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');

    const endpoints = [...(config.reports || [])];
    if (role === 'inventory_manager' || role === 'warehouse_staff') {
      endpoints.push(GOODS_RECEIPT_ITEMS_ENDPOINT);
    }
    const results = await Promise.all(
      endpoints.map(async (path) => {
        try {
          return [path, await apiGet(path)];
        } catch (e) {
          return [path, { __error: e.message }];
        }
      })
    );

    setData(Object.fromEntries(results));
    setBusy(false);
  }, [config.reports, role]);

  useEffect(() => {
    load();
  }, [load]);

  const sales = data['/reports/sales-summary'];
  const purchases = data['/reports/purchase-summary'];
  const inventory = data['/reports/inventory-summary'];
  const movements = data['/reports/stock-movements'];
  const goodsReceiptItems = data[GOODS_RECEIPT_ITEMS_ENDPOINT];
  const receivedUnits = goodsReceiptItems && !goodsReceiptItems.__error
    ? rowsFromResponse(goodsReceiptItems).reduce((total, item) => total + Number(item.quantity || 0), 0)
    : null;

  const kpis = useMemo(() => {
    if (role === 'admin') {
      return [
        {
          label: 'Total Sales',
          value: sales && !sales.__error ? money(sales.sales_total) : '—',
          icon: ShoppingCart,
          color: 'green',
          sub: sales && !sales.__error ? `${sales.sales_count ?? 0} recorded sales` : 'Unavailable from API',
        },
        {
          label: 'Total Purchases',
          value: purchases && !purchases.__error ? money(purchases.purchase_order_total) : '—',
          icon: ShoppingBasket,
          color: 'orange',
          sub: purchases && !purchases.__error ? `${purchases.purchase_order_count ?? 0} purchase orders` : 'Unavailable from API',
        },
        {
          label: 'Inventory Units',
          value: inventory && !inventory.__error ? Number(inventory.total_units || 0).toLocaleString() : '—',
          icon: Boxes,
          color: 'purple',
          sub: inventory && !inventory.__error ? `${inventory.total_available_units ?? 0} available units` : 'Unavailable from API',
        },
        {
          label: 'Products in Stock',
          value: inventory && !inventory.__error ? Number(inventory.stocked_product_count || 0).toLocaleString() : '—',
          icon: Package,
          color: 'blue',
          sub: inventory && !inventory.__error ? `${Number(inventory.product_count || 0).toLocaleString()} products in catalogue` : 'Unavailable from API',
        },
      ];
    }

    if (role === 'inventory_manager' || role === 'warehouse_staff') {
      return [
        {
          label: 'Total Products',
          value: inventory && !inventory.__error ? Number(inventory.product_count || 0).toLocaleString() : '—',
          icon: Package,
          color: 'green',
          sub: 'Products in the catalogue',
        },
        {
          label: 'Units Received',
          value: receivedUnits === null ? '—' : receivedUnits.toLocaleString(),
          icon: PackageCheck,
          color: 'blue',
          sub: 'Across recorded goods receipts',
        },
        {
          label: 'Available Units',
          value: inventory && !inventory.__error ? Number(inventory.total_available_units || 0).toLocaleString() : '—',
          icon: Package,
          color: 'purple',
          sub: 'Available stock from API',
        },
        {
          label: 'Stock Movements',
          value: movements && !movements.__error ? movements.reduce((sum, row) => sum + Number(row.count || 0), 0).toLocaleString() : '—',
          icon: Activity,
          color: 'orange',
          sub: 'Grouped movement records',
        },
      ];
    }

    if (role === 'purchase_manager') {
      return [
        {
          label: 'Purchase Orders',
          value: purchases && !purchases.__error ? purchases.purchase_order_count : '—',
          icon: ShoppingBasket,
          color: 'green',
          sub: 'Orders returned by API',
        },
        {
          label: 'Purchase Value',
          value: purchases && !purchases.__error ? money(purchases.purchase_order_total) : '—',
          icon: CreditCard,
          color: 'orange',
          sub: 'Reported purchase order total',
        },
        {
          label: 'Stockout Risk',
          value: 'Open report',
          icon: CircleAlert,
          color: 'purple',
          sub: 'Estimate from planning API',
        },
        {
          label: 'Products in Stock',
          value: inventory && !inventory.__error ? Number(inventory.stocked_product_count || 0).toLocaleString() : '—',
          icon: Package,
          color: 'blue',
          sub: inventory && !inventory.__error ? `${Number(inventory.total_units || 0).toLocaleString()} total units` : 'Unavailable from API',
        },
      ];
    }

    if (role === 'finance_billing_staff') {
      return [
        {
          label: 'Sales Total',
          value: sales && !sales.__error ? money(sales.sales_total) : '—',
          icon: CreditCard,
          color: 'green',
          sub: 'Reported sales total',
        },
        {
          label: 'Sales Count',
          value: sales && !sales.__error ? sales.sales_count : '—',
          icon: Activity,
          color: 'blue',
          sub: 'Recorded sales',
        },
        {
          label: 'Invoices',
          value: 'Open invoices',
          icon: Package,
          color: 'orange',
          sub: 'View invoice statuses',
        },
        {
          label: 'Payments',
          value: 'Open payments',
          icon: CreditCard,
          color: 'purple',
          sub: 'Review payment history',
        },
      ];
    }

    return [
      {
        label: 'Sales Total',
        value: sales && !sales.__error ? money(sales.sales_total) : '—',
        icon: ShoppingCart,
        color: 'green',
        sub: 'Reported sales total',
      },
      {
        label: 'Sales Count',
        value: sales && !sales.__error ? sales.sales_count : '—',
        icon: Activity,
        color: 'blue',
        sub: 'Recorded sales',
      },
      {
        label: 'Customers',
        value: 'View customers',
        icon: Users,
        color: 'orange',
        sub: 'Search customer records',
      },
      {
        label: 'Products',
        value: 'Find products',
        icon: Package,
        color: 'purple',
        sub: 'Check product catalogue',
      },
    ];
  }, [role, sales, purchases, inventory, movements, receivedUnits]);

  const reportErrors = Object.values(data).filter((value) => value?.__error);

  return (
    <>
      <PageHeader
        title={`${config.title}, ${(user?.name || 'there').split(' ')[0]} 👋`}
        subtitle={config.subtitle}
        actions={
          <>
            <Button onClick={load}>
              <RefreshCw size={14} /> Refresh
            </Button>
            {config.links.map(([label, path, Icon]) => (
              <Button key={path} variant="primary" onClick={() => navigate(path)}>
                <Icon size={15} />
                {label}
              </Button>
            ))}
          </>
        }
      />

      {reportErrors.length > 0 && (
        <div className="notice" role="status">
          Some dashboard data could not be loaded for this role. Values below reflect only successful API responses.{' '}
          {reportErrors.length} request(s) failed.
        </div>
      )}

      <div className="grid kpi-grid">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div className={`kpi ${kpi.color}`} key={kpi.label}>
              <div className="kpi-top">
                <div className="kpi-icon">
                  <Icon size={20} />
                </div>
                <div>
                  <div className="kpi-label">{kpi.label}</div>
                  <div className="kpi-value" style={{ fontSize: String(kpi.value).length > 12 ? 18 : 24 }}>
                    {kpi.value}
                  </div>
                </div>
              </div>
              <div className="kpi-foot">{kpi.sub}</div>
              <div className="kpi-glow" />
            </div>
          );
        })}
      </div>

      {busy ? (
        <div className="panel">
          <Loading label="Loading your role-specific workspace…" />
        </div>
      ) : (
        <div className="grid two-col">
          <Panel
            title={
              role === 'admin'
                ? 'Operational snapshot'
                : role === 'sales_staff'
                  ? 'Sales performance'
                  : role === 'finance_billing_staff'
                    ? 'Billing snapshot'
                    : role === 'purchase_manager'
                      ? 'Purchasing snapshot'
                      : 'Inventory activity'
            }
            action={<span className="muted" style={{ fontSize: 10 }}>Live API data</span>}
          >
            <div className="panel-body">
              {(role === 'admin' || role === 'sales_staff' || role === 'finance_billing_staff') && (
                <div className="stat-row">
                  <span>Reported sales total</span>
                  <strong>{sales && !sales.__error ? money(sales.sales_total) : 'Unavailable'}</strong>
                </div>
              )}

              {(role === 'admin' || role === 'purchase_manager') && (
                <div className="stat-row">
                  <span>Purchase order value</span>
                  <strong>{purchases && !purchases.__error ? money(purchases.purchase_order_total) : 'Unavailable'}</strong>
                </div>
              )}

              {inventory && !inventory.__error && (
                <>
                  <div className="stat-row">
                    <span>Total units in inventory</span>
                    <strong>{Number(inventory.total_units || 0).toLocaleString()}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Available units</span>
                    <strong>{Number(inventory.total_available_units || 0).toLocaleString()}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Distinct products with available stock</span>
                    <strong>{Number(inventory.stocked_product_count || 0).toLocaleString()}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Products in catalogue</span>
                    <strong>{Number(inventory.product_count || 0).toLocaleString()}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Inventory records</span>
                    <strong>{inventory.record_count}</strong>
                  </div>
                </>
              )}

              {movements && !movements.__error && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 750, fontSize: 12, marginBottom: 8 }}>Movement types</div>
                  {movements.length ? (
                    movements.map((movement) => (
                      <div className="stat-row" key={movement.transaction_type}>
                        <span>{movement.transaction_type || 'Unspecified'}</span>
                        <strong>
                          {movement.count} · {movement.net_quantity} units
                        </strong>
                      </div>
                    ))
                  ) : (
                    <Empty title="No movements recorded" />
                  )}
                </div>
              )}

              {!sales && !purchases && !inventory && !movements && (
                <Empty
                  title="No summary data"
                  message="The available report endpoints did not return data for this workspace."
                />
              )}
            </div>
          </Panel>

          <Panel title="Quick actions" action={<span className="muted" style={{ fontSize: 10 }}>Your workflow</span>}>
            <div className="panel-body">
              <div className="quick-grid">
                {config.links.map(([label, path, Icon]) => (
                  <button className="quick-action" key={path} onClick={() => navigate(path)}>
                    <span className="quick-icon">
                      <Icon size={20} />
                    </span>
                    {label}
                  </button>
                ))}

                {role === 'admin' && (
                  <button className="quick-action" onClick={() => navigate('/products')}>
                    <span className="quick-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>
                      <Package size={20} />
                    </span>
                    Products
                  </button>
                )}

                {role === 'sales_staff' && (
                  <button className="quick-action" onClick={() => navigate('/products')}>
                    <span className="quick-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>
                      <Package size={20} />
                    </span>
                    Product lookup
                  </button>
                )}
              </div>
            </div>
          </Panel>
        </div>
      )}

      <div className="grid two-col">
        <Panel title="Business records" action={<span className="muted" style={{ fontSize: 10 }}>Choose a workspace</span>}>
          <div className="panel-body">
            <div className="alert-list">
              {config.links.map(([label, path, Icon], index) => (
                <div className="alert-row" key={path}>
                  <div className={`alert-icon ${index % 2 ? 'blue' : 'orange'}`}>
                    <Icon size={17} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong>{label}</strong>
                    <p>Open the relevant operational workspace and review current records.</p>
                  </div>
                  <button className="panel-link" onClick={() => navigate(path)}>
                    Open →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Reports & planning" action={<ChartNoAxesCombined size={17} color="var(--muted)" />}>
          <div className="panel-body">
            {config.reports.map((path) => (
              <div className="stat-row" key={path}>
                <span>
                  {path
                    .split('/')
                    .pop()
                    .replaceAll('-', ' ')
                    .replace(/\b\w/g, (char) => char.toUpperCase())}
                </span>
                <button className="panel-link" onClick={() => navigate(`/reports-view?path=${encodeURIComponent(path)}`)}>
                  View report →
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
