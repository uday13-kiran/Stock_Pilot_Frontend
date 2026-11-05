import React from 'react';
import {Navigate,Route,Routes,useLocation} from 'react-router-dom';
import {AppShell} from '../components/layout/AppShell.jsx';
import {LoginPage} from '../features/auth/LoginPage.jsx';
import {Dashboard,InventoryPage} from '../features/dashboard/Dashboard.jsx';
import {ResourcePage} from '../features/resources/ResourcePage.jsx';
import {SalesCheckout} from '../features/sales/SalesCheckout.jsx';
import {PurchaseOrderReceiving} from '../features/purchases/PurchaseOrderReceiving.jsx';
import {PurchaseOrderWorkflow} from '../features/purchases/PurchaseOrderWorkflow.jsx';
import {NotificationCenter} from '../features/notifications/NotificationCenter.jsx';
import {AssistantPage} from '../features/assistant/AssistantPage.jsx';
import {useAuth} from '../features/auth/AuthContext.jsx';
import {Loading} from '../components/ui/Primitives.jsx';
import {REPORTS} from '../config/resources.js';
function Protected(){const {user,loading}=useAuth(),location=useLocation();if(loading)return <Loading label="Restoring your session…"/>;if(!user)return <Navigate to="/login" replace state={{from:location.pathname}}/>;return <AppShell/>}
function LoginRoute(){const {user,loading}=useAuth();if(loading)return <Loading label="Checking session…"/>;if(user)return <Navigate to="/dashboard" replace/>;return <LoginPage/>}
export function App(){return <Routes><Route path="/login" element={<LoginRoute/>}/><Route element={<Protected/>}><Route path="/" element={<Navigate to="/dashboard" replace/>}/><Route path="/dashboard" element={<Dashboard/>}/><Route path="/inventory" element={<InventoryPage/>}/><Route path="/assistant" element={<AssistantPage/>}/><Route path="/notifications" element={<NotificationCenter/>}/><Route path="/notifications/all" element={<ResourcePage resourceKey="notifications"/>}/><Route path="/sales/checkout" element={<SalesCheckout/>}/><Route path="/purchase-orders" element={<PurchaseOrderWorkflow/>}/><Route path="/purchase-order-receiving" element={<PurchaseOrderReceiving/>}/><Route path="/reports-view" element={<ResourcePage/>}/>{REPORTS.map(r=><Route key={r.path} path={r.path} element={<ResourcePage reportPath={r.path}/>}/>)}<Route path="/:resource" element={<ResourcePage/>}/><Route path="*" element={<Navigate to="/dashboard" replace/>}/></Route></Routes>}
