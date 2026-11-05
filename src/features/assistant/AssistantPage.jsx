import React,{useState} from 'react';
import {Bot,Send,Sparkles} from 'lucide-react';
import {apiPost} from '../../services/api.js';
import {Button,Notice,PageHeader,Panel} from '../../components/ui/Primitives.jsx';

const suggestedQuestions=[
 'Which products should we purchase this week?',
 'Which products have increasing demand?',
 'How were sales over the last 30 days?',
 'Which products are at risk of stockout?',
 'Which products look like dead stock?',
];

export function AssistantPage(){
 const [question,setQuestion]=useState('');
 const [answer,setAnswer]=useState(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');

 async function ask(event){
  event.preventDefault();
  const prompt=question.trim();
  if(prompt.length<3)return;
  setLoading(true);setError('');setAnswer(null);
  try{
   const result=await apiPost('/assistant/ask',{question:prompt});
   setAnswer(result);
  }catch(e){setError(e.message)}
  finally{setLoading(false)}
 }

 return <>
  <PageHeader title="AI analytics assistant" subtitle="Ask about sales, purchase planning, demand trends, stockout risks, and dead stock. Answers are grounded in backend analytics."/>
  <Panel title="Ask StockPilot">
   <div style={{padding:18,display:'grid',gap:16}}>
    <div style={{display:'flex',gap:10,alignItems:'flex-start',padding:14,borderRadius:12,background:'var(--surface)'}}>
     <Sparkles size={18} color="var(--primary)"/>
     <p className="muted" style={{margin:0,fontSize:12,lineHeight:1.6}}>The assistant uses read-only sales and inventory analytics. It can explain recommendations but cannot create or approve purchase orders.</p>
    </div>
    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
     {suggestedQuestions.map(item=><button key={item} type="button" className="btn btn-small" disabled={loading} onClick={()=>setQuestion(item)}>{item}</button>)}
    </div>
    <form onSubmit={ask} style={{display:'grid',gap:10}}>
     <label htmlFor="assistant-question" style={{fontWeight:700,fontSize:12}}>Your question</label>
     <textarea id="assistant-question" className="field-input" rows={3} maxLength={2000} value={question} onChange={event=>setQuestion(event.target.value)} placeholder="For example: Which products should we order this week?" required/>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
      <span className="muted" style={{fontSize:11}}>Do not include customer personal data or secrets.</span>
      <Button variant="primary" type="submit" disabled={loading||question.trim().length<3}><Send size={14}/>{loading?'Analyzing…':'Ask assistant'}</Button>
     </div>
    </form>
    {error&&<Notice type="error">{error}</Notice>}
    {answer&&<section aria-live="polite" style={{border:'1px solid var(--border)',borderRadius:12,padding:16,display:'grid',gap:12}}>
     <div style={{display:'flex',alignItems:'center',gap:8}}><Bot size={18}/><strong>Answer</strong></div>
     <p style={{whiteSpace:'pre-wrap',lineHeight:1.65,margin:0}}>{answer.answer}</p>
     <details>
      <summary style={{cursor:'pointer',fontWeight:700,fontSize:12}}>View analytics evidence ({answer.evidence?.length||0})</summary>
      <div style={{display:'grid',gap:10,marginTop:12}}>
       {(answer.evidence||[]).map((item,index)=><div key={`${item.tool}-${index}`} style={{border:'1px solid var(--border)',borderRadius:8,padding:12}}>
        <strong style={{fontSize:12}}>{item.tool.replaceAll('_',' ')}</strong>
        <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:11,maxHeight:320,overflow:'auto',marginBottom:0}}>{JSON.stringify(item.data,null,2)}</pre>
       </div>)}
      </div>
     </details>
     <span className="muted" style={{fontSize:10}}>Model: {answer.model} · Analytics evidence is shown above.</span>
    </section>}
   </div>
  </Panel>
 </>;
}
