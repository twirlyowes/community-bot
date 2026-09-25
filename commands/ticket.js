const {SlashCommandBuilder,PermissionFlagsBits,ChannelType}=require("discord.js");
const {db}=require("../firebase");
const {card,COLORS,EMOJIS}=require("../lib/ui");
const {getGuildConfig}=require("../lib/guildConfig");
const tickets=g=>db.collection("guilds").doc(g).collection("tickets");
const data=new SlashCommandBuilder().setName("ticket").setDescription("Support ticket tools.")
.addSubcommand(s=>s.setName("create").setDescription("Create a support ticket.").addStringOption(o=>o.setName("reason").setDescription("Reason").setMaxLength(200)))
.addSubcommand(s=>s.setName("close").setDescription("Close this ticket."))
.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);
async function execute(i,c){
 if(i.options.getSubcommand()==="create"){
  const existing=await tickets(i.guildId).where("userId","==",i.user.id).where("status","==","open").limit(1).get();
  if(!existing.empty)return i.reply({content:"You already have an open ticket: <#"+existing.docs[0].data().channelId+">",ephemeral:true});
  const name=("ticket-"+i.user.username).toLowerCase().replace(/[^a-z0-9-]/g,"").slice(0,80)||"ticket";
  const ch=await i.guild.channels.create({name,type:ChannelType.GuildText});
  await tickets(i.guildId).doc(ch.id).set({channelId:ch.id,userId:i.user.id,status:"open",reason:i.options.getString("reason")||"No reason provided",createdAt:new Date().toISOString()});
  await ch.send(card(c,EMOJIS.MESSAGE+" Ticket Created","**Opened by**\n"+i.user+"\n\n**Reason**\n"+(i.options.getString("reason")||"No reason provided")+"\n\nStaff can assist you here.","Tickets",COLORS.SKY_BLUE));
  return i.reply({content:"Ticket created: <#"+ch.id+">",ephemeral:true});
 }
 const s=await tickets(i.guildId).doc(i.channelId).get();
 if(!s.exists||s.data().status!=="open")return i.reply({content:"This command can only be used inside an open ticket.",ephemeral:true});
 await s.ref.update({status:"closed",closedBy:i.user.id,closedAt:new Date().toISOString()});
 return i.reply(card(c,EMOJIS.SUCCESS+" Ticket Closed","This ticket has been closed by "+i.user+".","Tickets",COLORS.GREEN));
}
module.exports={data,execute};