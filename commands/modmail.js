const {ChannelType,ActionRowBuilder,ButtonBuilder,ButtonStyle,PermissionFlagsBits,MessageFlags}=require("discord.js");
const {db}=require("../firebase");
const {getGuildConfig}=require("../lib/guildConfig");
const {card,COLORS,EMOJIS,getAvatarURL}=require("../lib/ui");

const tickets=db.collection("guilds");
const ticketRef=(g,c)=>tickets.doc(g).collection("modmail").doc(c);
const pendingRef=(g,u)=>tickets.doc(g).collection("modmailPending").doc(u);
const categories={minecraft:"Minecraft",discord:"Discord",others:"Others"};

function buttons(){return new ActionRowBuilder().addComponents(
 new ButtonBuilder().setCustomId("modmail_minecraft").setLabel("Minecraft").setStyle(ButtonStyle.Primary).setEmoji("⛏️"),
 new ButtonBuilder().setCustomId("modmail_discord").setLabel("Discord").setStyle(ButtonStyle.Secondary).setEmoji("💬"),
 new ButtonBuilder().setCustomId("modmail_others").setLabel("Others").setStyle(ButtonStyle.Success).setEmoji("📩")
);}
async function findOpen(g,u){const s=await tickets.doc(g).collection("modmail").where("userId","==",u).where("status","==","open").limit(1).get();return s.empty?null:s.docs[0];}
async function sendToTicket(client,g,u,message){
 const s=await findOpen(g,u);if(!s)return false;const d=s.data(),ch=await client.channels.fetch(d.channelId).catch(()=>null);if(!ch)return false;
 const content="<@"+u+"> **"+message.author.tag+"**\n\n"+(message.content||"*No text content*")+"\n\n-# "+(client.user.username||"Community Bot")+" • ModMail";
 await ch.send({components:[card(await getGuildConfig(g),content,"","ModMail",COLORS.SKY_BLUE)],flags:MessageFlags.IsComponentsV2,files:[...message.attachments.values()].map(a=>a.url)}).catch(()=>{});
 return true;
}
module.exports={
 data:null,
 register(client){
  client.on("messageCreate",async m=>{
   if(m.author.bot||m.channel.type!==ChannelType.DM)return;
   try{
    const guilds=client.guilds.cache;
    for(const g of guilds.values()){
     if(await sendToTicket(client,g.id,m.author.id,m))return;
    }
    const cfgs=[];
    for(const g of guilds.values()){const c=await getGuildConfig(g.id);cfgs.push([g,c]);}
    if(!cfgs.length)return;
    const [guild,c]=cfgs[0];
    const pending=pendingRef(guild.id,m.author.id);
    const old=await pending.get();
    const messages=old.exists?old.data().messages||[]:[];
    messages.push({content:m.content,attachments:[...m.attachments.values()].map(a=>a.url),timestamp:new Date().toISOString()});
    await pending.set({messages},{merge:true});
    await m.reply({components:[card(c,EMOJIS.MESSAGE+" Support ModMail","Welcome to **"+c.branding.name+"**.\n\nPlease choose the category that best matches your request.\n\nYour message will be saved until a support ticket is created.","ModMail",COLORS.SKY_BLUE),buttons()],flags:MessageFlags.IsComponentsV2}).catch(()=>{});
   }catch(e){console.error("ModMail DM error:",e);}
  });
  client.on("messageCreate",async m=>{
   if(m.author.bot||!m.guild)return;
   try{
    const s=await tickets.doc(m.guild.id).collection("modmail").where("channelId","==",m.channel.id).where("status","==","open").limit(1).get();
    if(s.empty)return;
    const d=s.docs[0].data(),u=await client.users.fetch(d.userId).catch(()=>null);if(!u)return;
    const c=await getGuildConfig(m.guild.id);
    const body="🛡️ Staff ("+m.author.tag+")\n\n"+(m.content||"*No text content*")+"\n\n-# "+c.branding.name+" • ModMail";
    await u.send({components:[card(c,body,"","ModMail",COLORS.SKY_BLUE)],flags:MessageFlags.IsComponentsV2,files:[...m.attachments.values()].map(a=>a.url)}).catch(()=>{});
   }catch(e){console.error("ModMail staff message error:",e);}
  });
  client.on("interactionCreate",async i=>{
   if(!i.isButton()||!i.customId.startsWith("modmail_")||!i.guildId)return;
   const key=i.customId.slice(8);
   if(!categories[key])return;
   try{
    const c=await getGuildConfig(i.guildId),existing=await findOpen(i.guildId,i.user.id);
    if(existing)return i.reply({content:"You already have an open ModMail ticket: <#"+existing.data().channelId+">",ephemeral:true});
    const pending=await pendingRef(i.guildId,i.user.id).get(),msgs=pending.exists?pending.data().messages||():[];
    const n=Date.now().toString().slice(-6);
    const ch=await i.guild.channels.create({name:"modmail-"+key+"-"+n,type:ChannelType.GuildText,permissionOverwrites:[
     {id:i.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
     {id:i.client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels]}
    ]});
    if(c.moderation.staffRoleId)await ch.permissionOverwrites.edit(c.moderation.staffRoleId,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true}).catch(()=>{});
    await ticketRef(i.guildId,ch.id).set({channelId:ch.id,userId:i.user.id,category:key,status:"open",createdAt:new Date().toISOString()});
    for(const x of msgs)await ch.send({components:[card(c,(i.user.tag)+"\n\n"+(x.content||"*No text content*")+"\n\n-# Previous ModMail Message","", "ModMail",COLORS.SKY_BLUE)],flags:MessageFlags.IsComponentsV2,files:x.attachments||[]}).catch(()=>{});
    await pendingRef(i.guildId,i.user.id).delete().catch(()=>{});
    await ch.send({content:c.moderation.staffRoleId?"<@&"+c.moderation.staffRoleId+">":"",components:[card(c,EMOJIS.MESSAGE+" ModMail Ticket","**User**\n"+i.user+"\n\n**Category**\n"+categories[key]+"\n\n**Status**\n🟢 Open\n\nStaff can reply directly in this channel. Use `/modmail close` when finished.","ModMail",COLORS.GREEN)] ,flags:MessageFlags.IsComponentsV2});
    return i.update({components:[card(c,EMOJIS.SUCCESS+" Ticket Created","Your **"+categories[key]+"** ModMail ticket has been created.\n\nPlease continue sending messages here in DMs.","ModMail",COLORS.GREEN)] ,flags:MessageFlags.IsComponentsV2});
   }catch(e){console.error("ModMail create error:",e);if(!i.replied)await i.reply({content:"Unable to create the ModMail ticket.",ephemeral:true}).catch(()=>{});}
  });
 }
};