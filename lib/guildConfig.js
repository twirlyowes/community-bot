const {db}=require("../firebase");
const DEFAULT_CONFIG={prefix:".",branding:{name:"Community Bot",color:0x38BDF8},moderation:{staffRoleId:null,logChannelId:null}};
function merge(base,extra={}){const out={...base,...extra};for(const k of Object.keys(base))if(base[k]&&typeof base[k]==="object"&&!Array.isArray(base[k]))out[k]=merge(base[k],extra[k]||{});return out;}
const ref=id=>db.collection("guilds").doc(id).collection("settings").doc("config");
async function getGuildConfig(id){const r=ref(id),s=await r.get();if(!s.exists){const c=JSON.parse(JSON.stringify(DEFAULT_CONFIG));await r.set(c);return c;}return merge(DEFAULT_CONFIG,s.data());}
async function updateGuildConfig(id,changes){await ref(id).set(changes,{merge:true});return getGuildConfig(id);}
module.exports={DEFAULT_CONFIG,getGuildConfig,updateGuildConfig,initializeGuild:getGuildConfig};