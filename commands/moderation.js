const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../firebase');
const { COLORS, EMOJIS, card } = require('../lib/ui');
const { getGuildConfig } = require('../lib/guildConfig');
const { db: firebaseDb } = require('../firebase');

function parseDuration(input){ const m=String(input||'').toLowerCase().match(/^(\d+)(s|m|h|d|w)$/); if(!m)return null; const ms=Number(m[1])*({s:1000,m:60000,h:3600000,d:86400000,w:604800000}[m[2]]); return ms>0&&ms<=28*86400000?ms:null; }
function allowed(member,c){ return !!c.moderation.staffRoleId&&member.roles.cache.has(c.moderation.staffRoleId); }
async function logAction(guild,data,c){ try{await db.collection('guilds').doc(guild.id).collection('moderationLogs').add({...data,timestamp:new Date().toISOString()});}catch(e){console.error('Moderation Firebase log:',e);} if(!c.moderation.logChannelId)return; try{const ch=await guild.channels.fetch(c.moderation.logChannelId);if(ch)await ch.send(card(c,EMOJIS.SHIELD+' Moderation Log','**Action**
'+data.action+'

**Target**
<@'+data.targetId+'> ('+data.targetId+')

**Moderator**
<@'+data.moderatorId+'>

**Reason**
'+data.reason,'Moderation',COLORS.SKY_BLUE));}catch(e){console.error('Moderation channel log:',e);} }
function memberFromMessage(m,args){if(!args[0])return null;const x=args[0].match(/^<@!?(\d+)>$/);return x?m.mentions.members.get(x[1])||null:null;}
async function act(ctx,member,action,reason,c){ if(member.id===ctx.user.id)return ctx.reply(card(c,EMOJIS.ERROR+' Action Blocked','You cannot moderate yourself.','Moderation',COLORS.RED)); if(member.id===ctx.client.user.id)return ctx.reply(card(c,EMOJIS.ERROR+' Action Blocked','You cannot moderate the bot.','Moderation',COLORS.RED)); if(!member.manageable)return ctx.reply(card(c,EMOJIS.ERROR+' Action Blocked','Discord role hierarchy prevents me from managing this member.','Moderation',COLORS.RED)); try{if(action==='kick')await member.kick(reason);if(action==='ban')await member.ban({reason,deleteMessageSeconds:86400});if(action==='timeout')await member.timeout(ctx._duration,reason);if(action==='untimeout')await member.timeout(null,reason);const title=action==='kick'?'Member Kicked':action==='ban'?'Member Banned':action==='timeout'?'Member Timed Out':'Timeout Removed';const p=card(c,EMOJIS.SUCCESS+' '+title,EMOJIS.SHIELD+' **User**
'+member+'

'+EMOJIS.MESSAGE+' **Reason**
'+reason+'

'+EMOJIS.SETTINGS+' **Moderator**
'+ctx.user+'

'+EMOJIS.SPARKLES+' Action completed successfully.','Moderation',COLORS.GREEN);await ctx.reply(p);await logAction(ctx.guild,{action:title,targetId:member.id,moderatorId:ctx.user.id,reason},c);}catch(e){console.error('Moderation action:',e);return ctx.reply(card(c,EMOJIS.ERROR+' Action Failed','Discord rejected this action. Check my permissions and role hierarchy.','Moderation',COLORS.RED));} }

const data=new SlashCommandBuilder().setName('moderation').setDescription('Server moderation tools.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
.addSubcommand(s=>s.setName('kick').setDescription('Kick a member.').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason')))
.addSubcommand(s=>s.setName('ban').setDescription('Ban a member.').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason')))
.addSubcommand(s=>s.setName('unban').setDescription('Unban by user ID.').addStringOption(o=>o.setName('user-id').setDescription('Discord user ID').setRequired(true)))
.addSubcommand(s=>s.setName('timeout').setDescription('Timeout a member.').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)).addStringOption(o=>o.setName('duration').setDescription('10m, 2h, 1d').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason')))
.addSubcommand(s=>s.setName('untimeout').setDescription('Remove a timeout.').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason')))
.addSubcommand(s=>s.setName('purge').setDescription('Delete recent messages.').addIntegerOption(o=>o.setName('amount').setDescription('1-100').setMinValue(1).setMaxValue(100).setRequired(true)));

async function execute(i,c){if(!i.memberPermissions.has(PermissionFlagsBits.ManageGuild))return i.reply({content:'You need Manage Server permission.',ephemeral:true});const sub=i.options.getSubcommand();if(sub==='purge'){try{const n=await i.channel.bulkDelete(i.options.getInteger('amount',true),true);await logAction(i.guild,{action:'Messages Purged',targetId:i.user.id,moderatorId:i.user.id,reason:n.size+' messages deleted'},c);return i.reply(card(c,EMOJIS.SUCCESS+' Messages Purged',EMOJIS.MESSAGE+' **Deleted**
'+n.size+' message(s)

'+EMOJIS.SETTINGS+' **Moderator**
'+i.user,'Moderation',COLORS.GREEN));}catch{return i.reply(card(c,EMOJIS.ERROR+' Purge Failed','I could not delete those messages.','Moderation',COLORS.RED));}}
if(sub==='unban'){const id=i.options.getString('user-id',true);if(!/^\d{17,20}$/.test(id))return i.reply(card(c,EMOJIS.ERROR+' Invalid User ID','Please provide a valid Discord user ID.','Moderation',COLORS.RED));try{const u=await i.client.users.fetch(id);await i.guild.members.unban(id,'Moderation action by '+i.user.tag);await logAction(i.guild,{action:'Member Unbanned',targetId:id,moderatorId:i.user.id,reason:'No reason provided'},c);return i.reply(card(c,EMOJIS.SUCCESS+' Member Unbanned',EMOJIS.SHIELD+' **User**
'+u.tag+' ('+id+')

'+EMOJIS.SETTINGS+' **Moderator**
'+i.user,'Moderation',COLORS.GREEN));}catch{return i.reply(card(c,EMOJIS.ERROR+' Unban Failed','That user may not be banned, or Discord rejected the action.','Moderation',COLORS.RED));}}
const member=i.options.getMember('user');if(!member)return i.reply({content:'That user is not in this server.',ephemeral:true});const reason=i.options.getString('reason')?.trim()||'No reason provided';if(sub==='timeout'){const d=parseDuration(i.options.getString('duration',true));if(!d)return i.reply(card(c,EMOJIS.ERROR+' Invalid Duration','Use 10m, 2h, 1d, or 1w. Maximum is 28 days.','Moderation',COLORS.RED));i._duration=d;}return act(i,member,sub,reason,c);}

module.exports={data,execute,registerPrefix(client){client.on('messageCreate',async m=>{if(m.author.bot||!m.guild)return;const c=await getGuildConfig(m.guild.id);const hasPrefix=m.content.startsWith(c.prefix);const np=(await firebaseDb.collection('guilds').doc(m.guild.id).collection('noPrefix').doc(m.author.id).get()).exists;if(!hasPrefix&&!np)return;const raw=hasPrefix?m.content.slice(c.prefix.length).trim():m.content.trim();const a=raw.split(/ +/),cmd=(a.shift()||'').toLowerCase();if(!['kick','ban','unban','timeout','untimeout','purge'].includes(cmd))return;try{const c=await getGuildConfig(m.guild.id);if(!allowed(m.member,c))return m.channel.send(card(c,EMOJIS.ERROR+' Permission Denied','You do not have permission to use this command.','Moderation',COLORS.RED));if(cmd==='purge'){const n=Number(a[0]);if(!Number.isInteger(n)||n<1||n>100)return m.channel.send(card(c,EMOJIS.ERROR+' Invalid Usage','Use `.purge <1-100>`.','Moderation',COLORS.RED));const d=await m.channel.bulkDelete(n,true);await logAction(m.guild,{action:'Messages Purged',targetId:m.author.id,moderatorId:m.author.id,reason:d.size+' messages deleted'},c);return m.channel.send(card(c,EMOJIS.SUCCESS+' Messages Purged',EMOJIS.MESSAGE+' **Deleted**
'+d.size+' message(s)','Moderation',COLORS.GREEN));}if(cmd==='unban'){const id=a[0];if(!/^\d{17,20}$/.test(id||''))return m.channel.send(card(c,EMOJIS.ERROR+' Invalid User ID','Use `.unban <user ID>`.','Moderation',COLORS.RED));try{const u=await client.users.fetch(id);await m.guild.members.unban(id,'Moderation action by '+m.author.tag);await logAction(m.guild,{action:'Member Unbanned',targetId:id,moderatorId:m.author.id,reason:'No reason provided'},c);return m.channel.send(card(c,EMOJIS.SUCCESS+' Member Unbanned',EMOJIS.SHIELD+' **User**
'+u.tag+' ('+id+')','Moderation',COLORS.GREEN));}catch{return m.channel.send(card(c,EMOJIS.ERROR+' Unban Failed','That user may not be banned, or Discord rejected the action.','Moderation',COLORS.RED));}}const member=memberFromMessage(m,a);if(!member)return m.channel.send(card(c,EMOJIS.ERROR+' Invalid Usage','You must explicitly mention the member.','Moderation',COLORS.RED));const reason=a.slice(1).join(' ')||'No reason provided';if(cmd==='timeout'){const d=parseDuration(a[1]);if(!d)return m.channel.send(card(c,EMOJIS.ERROR+' Invalid Duration','Use `.timeout @user 10m [reason]` (maximum 28 days).','Moderation',COLORS.RED));m._duration=d;}return act(m,member,cmd,reason,c);}catch(e){console.error('Moderation system error:',e);}});}};