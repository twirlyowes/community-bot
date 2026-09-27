const {db}=require("../firebase");
const DEFAULT_CONFIG={prefix:".",branding:{name:"Community Bot",color:0x38BDF8},moderation:{staffRoleId:null,logChannelId:null},activeTime:{enabled:false,staffRoleId:null,logChannelId:null},voice:{createChannelId:null,categoryId:null}};
function merge(base,extra={}){const out={...base,...extra};for(const k of Object.keys(base))if(base[k]&&typeof base[k]==="object"&&!Array.isArray(base[k]))out[k]=merge(base[k],extra[k]||{});return out;}
const ref=id=>db.collection("guilds").doc(id).collection("settings").doc("config");

async function getGuildConfig(id){
  try {
    const r=ref(id);
    const s=await r.get();
    if(!s.exists){
      const c=JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      try {
        await r.set(c);
      } catch(err) {
        console.error("Firestore set failed:",err.code,err.message);
      }
      return c;
    }
    return merge(DEFAULT_CONFIG,s.data());
  } catch(err) {
    console.error("Firestore get failed:",err.code,err.message);
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

async function updateGuildConfig(id,changes){
  try {
    await ref(id).set(changes,{merge:true});
  } catch(err) {
    console.error("Firestore update failed:",err.code,err.message);
  }
  return getGuildConfig(id);
}

module.exports={DEFAULT_CONFIG,getGuildConfig,updateGuildConfig,initializeGuild:getGuildConfig};