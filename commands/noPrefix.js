const {SlashCommandBuilder,PermissionFlagsBits}=require("discord.js");
const {db}=require("../firebase");
const {getGuildConfig}=require("../lib/guildConfig");
const {card,COLORS,EMOJIS}=require("../lib/ui");
const ref=(g,u)=>db.collection("guilds").doc(g).collection("noPrefix").doc(u);
module.exports={data:new SlashCommandBuilder().setName("np").setDescription("Manage no-prefix users.")
.addSubcommand(s=>s.setName("add").setDescription("Allow a user to use prefix commands without a prefix.").addUserOption(o=>o.setName("user").setDescription("User to allow").setRequired(true)))
.addSubcommand(s=>s.setName("remove").setDescription("Remove a user's no-prefix access.").addUserOption(o=>o.setName("user").setDescription("User to remove").setRequired(true)))
.addSubcommand(s=>s.setName("list").setDescription("List users with no-prefix access."))
.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
async execute(i,c){
 if(!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))return i.reply({content:"You need Manage Server permission.",ephemeral:true});
 const sub=i.options.getSubcommand();
 if(sub==="list"){
  const snap=await db.collection("guilds").doc(i.guildId).collection("noPrefix").get();
  const users=snap.docs.map(d=>"<@"+d.id+">").join("\n")||"No users currently have no-prefix access.";
  return i.reply(card(c,EMOJIS.SETTINGS+" No Prefix Users",users,"No Prefix",COLORS.SKY_BLUE));
 }
 const user=i.options.getUser("user",true),r=ref(i.guildId,user.id);
 if(sub==="add"){await r.set({userId:user.id,addedBy:i.user.id,addedAt:new Date().toISOString()});return i.reply(card(c,EMOJIS.SUCCESS+" No Prefix Enabled","<@"+user.id+"> can now use commands without the configured prefix.","No Prefix",COLORS.GREEN));}
 await r.delete();return i.reply(card(c,EMOJIS.SUCCESS+" No Prefix Removed","<@"+user.id+"> must use the configured prefix again.","No Prefix",COLORS.SKY_BLUE));
},
register(client){
 client.on("messageCreate",async m=>{
  if(m.author.bot||!m.guild)return;
  try{
   const c=await getGuildConfig(m.guild.id);
   const allowed=(await ref(m.guild.id,m.author.id).get()).exists;
   if(!allowed)return;
   const content=m.content.trim();
   if(!content)return;
   const prefix=c.prefix;
   const isPrefixed=content.startsWith(prefix);
   if(isPrefixed)return;
   const parts=content.split(/\s+/);
   const cmd=parts.shift().toLowerCase();
   if(cmd==="ping")return m.reply(card(c,"Pong!","WebSocket latency: **"+client.ws.ping+"ms**","Ping"));
   if(cmd==="help")return m.reply(card(c,"Help","Use **/"+ "help"+"** for slash commands.\nNo-prefix access is enabled for you.","Help"));
   const command=client.commands.get(cmd);
   if(!command||!command.execute)return;
   if(cmd==="np"||cmd==="config")return;
   const fake={guildId:m.guild.id,user:m.author,member:m.member,client,options:{getSubcommand:()=>null}};
   return;
  }catch(e){console.error("No-prefix system error:",e);}
 });
}
};