import{f as s,d as o,B as a,al as l}from"./_plugin-vue_export-helper-dacf3d65.js";import{a5 as i}from"./shipment-53265c2d.js";const m=s({name:"container-column-view",setup(t){const n=i();return{container:o(()=>n.getStorageContainer)}},render(){const t=n=>{const e=this.container.samples?.findIndex(r=>r.storageSlotIndex===n);return e>-1?this.container.samples[e]:null};return a("div",{class:"max-h-[600px] overflow-y-auto"},[[...Array(this.container?.slots??0).keys()].map((n,e)=>a("div",{class:"grid grid-cols-12 gap-x-2 w-1/2",key:e},[a("span",{class:"col-span-1 my-1"},[e+1,l(":")]),a("span",{class:["col-span-5 my-1 p-1 text-white flex justify-center border-2",{"bg-slate-400":t(e+1)===null},{"bg-emerald-400":t(e+1)!==null}]},[t(e+1)?.sampleId])]))])}});export{m as ContainerColumn,m as default};