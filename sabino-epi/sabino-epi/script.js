// Preços aqui são só para exibição. O valor cobrado vem do servidor.
var P=[
{id:"capacete-pro",n:"Capacete de Segurança Pro",c:"Cabeça",p:89.9,e:"⛑️",b:"Mais vendido"},
{id:"luva-anticorte",n:"Luva Anticorte Nível 5",c:"Mãos",p:42.5,e:"🧤"},
{id:"oculos-incolor",n:"Óculos de Proteção Incolor",c:"Visual",p:18.9,e:"🥽"},
{id:"respirador",n:"Respirador Semifacial",c:"Respiratória",p:159.9,e:"😷",b:"Novo"},
{id:"kit-essencial",n:"Kit Proteção Essencial",c:"Kits",p:139.9,e:"🦺",b:"Oferta"},
{id:"luva-grip",n:"Luva de Segurança Grip",c:"Mãos",p:29.9,e:"🧤"}];
var F=["Todos","Cabeça","Mãos","Visual","Respiratória","Kits"],cur="Todos",cart={};
var $=function(id){return document.getElementById(id)};
function brl(v){return "R$ "+v.toFixed(2).replace(".",",")}
function find(id){return P.filter(function(x){return x.id===id})[0]}
function count(){return Object.keys(cart).reduce(function(s,k){return s+cart[k]},0)}
function total(){return Object.keys(cart).reduce(function(s,k){return s+find(k).p*cart[k]},0)}

function render(){
  $("chips").innerHTML=F.map(function(f){return '<button class="chip'+(f===cur?' on':'')+'" data-f="'+f+'">'+f+'</button>'}).join("");
  $("grid").innerHTML=P.filter(function(x){return cur==="Todos"||x.c===cur}).map(function(x){
    return '<article class="prod"><div class="pimg">'+(x.b?'<span class="badge">'+x.b+'</span>':'')+x.e+'</div><div class="pb"><small>'+x.c+'</small><b>'+x.n+'</b><div class="price">'+brl(x.p)+'</div><div class="parc">ou 3x de '+brl(x.p/3)+' sem juros</div><button class="btn p add" data-id="'+x.id+'">Adicionar</button></div></article>'}).join("");
}
function renderCart(){
  $("cart").textContent="Carrinho ("+count()+")";
  var ids=Object.keys(cart);
  $("items").innerHTML=ids.length?ids.map(function(k){var x=find(k);
    return '<div class="line"><span>'+x.e+' '+x.n+'</span><span class="qty"><button data-act="dec" data-id="'+k+'">−</button>'+cart[k]+'<button data-act="inc" data-id="'+k+'">+</button></span><b>'+brl(x.p*cart[k])+'</b></div>'}).join(""):'<p class="sub">Seu carrinho está vazio.</p>';
  $("tot").textContent=ids.length?"Total: "+brl(total()):"";
  $("pay").disabled=!ids.length;
}
async function checkout(){
  var btn=$("pay"),msg=$("msg");
  btn.disabled=true;msg.textContent="Abrindo o pagamento seguro...";
  try{
    var r=await fetch("/.netlify/functions/create-checkout",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({items:Object.keys(cart).map(function(k){return {id:k,qty:cart[k]}})})});
    var d=await r.json();
    if(!r.ok||!d.url)throw new Error(d.error||"Erro");
    location.href=d.url;
  }catch(e){msg.textContent="Não foi possível iniciar o pagamento. Tente novamente.";btn.disabled=false}
}
document.addEventListener("click",function(e){
  var t=e.target.closest("[data-f]");if(t){cur=t.getAttribute("data-f");render()}
  var id=e.target.getAttribute("data-id");
  if(e.target.classList.contains("add")){cart[id]=(cart[id]||0)+1;renderCart()}
  var act=e.target.getAttribute("data-act");
  if(act==="inc"){cart[id]++;renderCart()}
  if(act==="dec"){cart[id]--;if(cart[id]<1)delete cart[id];renderCart()}
});
$("cart").onclick=function(){$("msg").textContent="";renderCart();$("dlg").showModal()};
$("close").onclick=function(){$("dlg").close()};
$("pay").onclick=checkout;

var st=new URLSearchParams(location.search).get("status");
var texts={sucesso:"Pagamento recebido! Obrigado pela compra.",pendente:"Pagamento pendente. Avisaremos quando for confirmado.",falha:"O pagamento não foi concluído. Você pode tentar novamente."};
if(texts[st]){$("status").textContent=texts[st];$("status").hidden=false}
render();renderCart();
