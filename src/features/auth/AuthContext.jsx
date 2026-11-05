import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {clearSession,getMe,login as loginRequest} from '../../services/authService.js';
const AuthContext=createContext(null);
export function AuthProvider({children}){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{if(!sessionStorage.getItem('stockpiolet_token')){setUser(null);setLoading(false);return null;}try{const u=await getMe();setUser(u);return u;}catch{clearSession();setUser(null);return null;}finally{setLoading(false);}},[]);
 useEffect(()=>{refresh();},[refresh]);
 const login=useCallback(async(email,password)=>{await loginRequest(email,password);const u=await getMe();setUser(u);return u;},[]);
 const logout=useCallback(()=>{clearSession();setUser(null);},[]);
 const value=useMemo(()=>({user,loading,login,logout,refresh}),[user,loading,login,logout,refresh]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
