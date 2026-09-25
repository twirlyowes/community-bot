const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { db } = require("../firebase");
const { COLORS, EMOJIS, card, getAvatarURL } = require("../lib/ui");
const { getGuildConfig } = require("../lib/guildConfig");

const MAX_WARNINGS = 5;

function explicitMention(message,args){
  if(!args[0]) return null;
  const match=args[0].match(/^<@!?(d+)>$/);
  return match ? message.mentions.members.get(match[1]) || null : null;
}

function ref(guildId,userId){
  return db.collection("guilds").doc(guildId).collection("warnings").doc(userId);
}

function staffAllowed(message,config){
  return !!config.moderation.staffRoleId &&
    message.member.roles.cache.has(config.moderation.staffRoleId);
}

async function sendLog(message,payload,config){
  if(!config.moderation.logChannelId) return;
  try{
    const ch=await message.guild.channels.fetch(config.moderation.logChannelId);
    if(ch) await ch.send(payload);
  }catch(error){ console.error("Warning log error:",error); }
}

module.exports={
  data:new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Manage server warnings.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s=>s.setName("list").setDescription("View a member's warnings.").addUserOption(o=>o.setName("user").setDescription("Member").setRequired(true)))
    .addSubcommand(s=>s.setName("remove").setDescription("Remove a warning.").addUserOption(o=>o.setName("user").setDescription("Member").setRequired(true)).addStringOption(o=>o.setName("id").setDescription("Warning ID").setRequired(true)))
    .addSubcommand(s=>s.setName("reset").setDescription("Clear all warnings.").addUserOption(o=>o.setName("user").setDescription("Member").setRequired(true)))
    .addSubcommand(s=>s.setName("add").setDescription("Warn a member.").addUserOption(o=>o.setName("user").setDescription("Member").setRequired(true)).addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(false))),

  async execute(i,config){
    if(!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))
      return i.reply({content:"You need Manage Server permission.",ephemeral:true});

    const sub=i.options.getSubcommand();
    const user=i.options.getMember("user");
    if(!user) return i.reply({content:"That user is not in this server.",ephemeral:true});

    const r=ref(i.guildId,user.id);
    const snap=await r.get();
    const warnings=snap.exists?snap.data().warnings||[]:[];

    if(sub==="list"){
      if(!warnings.length) return i.reply(card(config,"Clean Record",`${EMOJIS.SHIELD} **User**\n${user}\n\n${EMOJIS.WARNING} **Warnings**\nNo warnings found.`,"Warning System",COLORS.GREEN));
      const blocks=warnings.slice(-MAX_WARNINGS).reverse().map((w,n)=>
        `**Warning #${warnings.length-n} • ID: ${w.id}**\n\n${EMOJIS.SHIELD} **Moderator**\n${w.moderator}\n\n${EMOJIS.MESSAGE} **Reason**\n${w.reason}\n\n${EMOJIS.CLOCK} **Date**\n<t:${Math.floor(new Date(w.timestamp).getTime()/1000)}:R>`
      ).join("\n\n");
      return i.reply(card(config,"Infraction History",`${EMOJIS.SHIELD} **User**\n${user}\n\n${EMOJIS.STATS} **Total Warnings**\n${warnings.length}/${MAX_WARNINGS}\n\n${blocks}`,"Warning System",COLORS.YELLOW));
    }

    if(sub==="add"){
      if(user.id===i.user.id) return i.reply({content:"You cannot warn yourself.",ephemeral:true});
      const reason=i.options.getString("reason")?.trim()||"No reason provided";
      const id=Math.floor(100000+Math.random()*900000).toString();
      const now=new Date();
      warnings.push({id,moderator:i.user.tag,reason,timestamp:now.toISOString()});
      await r.set({warnings});
      let notified="Yes";
      try{ await user.send(card(config,`${EMOJIS.WARNING} Warning Received | ${i.guild.name}`,`You have received a warning in **${i.guild.name}**.\n\n**Reason:** ${reason}`,"Warning System",COLORS.YELLOW)); }
      catch{ notified="No (DMs Closed)"; }
      const payload=card(config,`${EMOJIS.SUCCESS} ${user.user.username} has been warned.`,`**Reason**\n${reason}\n\n**Warned by**\n${i.user.username} (${i.user.id})\n\n**Warning ID**\n${id}\n\n**Member Notified**\n${notified}\n\n**Total Warnings**\n${warnings.length}/${MAX_WARNINGS}`,"Warning System",COLORS.GREEN);
      await i.reply(payload);
      return;
    }

    if(sub==="remove"){
      const id=i.options.getString("id",true);
      const idx=warnings.findIndex(w=>w.id===id);
      if(idx<0) return i.reply({content:`No warning found with ID \`${id}\`.`,ephemeral:true});
      const removed=warnings.splice(idx,1)[0];
      if(warnings.length) await r.set({warnings}); else await r.delete();
      return i.reply(card(config,`${EMOJIS.SUCCESS} Warning Removed`,`${EMOJIS.SHIELD} **User**\n${user}\n\n${EMOJIS.WARNING} **Warning ID**\n\`${removed.id}\`\n\n${EMOJIS.MESSAGE} **Reason**\n${removed.reason}\n\n${EMOJIS.SETTINGS} **Removed By**\n${i.user}\n\n${EMOJIS.SPARKLES} Warning has been removed successfully.`,"Warning System",COLORS.GREEN));
    }

    if(sub==="reset"){
      if(!warnings.length) return i.reply({content:"That user has no warnings to reset.",ephemeral:true});
      await r.delete();
      return i.reply(card(config,`${EMOJIS.SUCCESS} Warning History Reset`,`${EMOJIS.SHIELD} **User**\n${user}\n\n${EMOJIS.WARNING} **Action**\nAll warnings have been removed\n\n${EMOJIS.SETTINGS} **Reset By**\n${i.user}\n\n${EMOJIS.SPARKLES} Infraction history has been cleared successfully.`,"Warning System",COLORS.GREEN));
    }
  },

  registerPrefix(client){
    client.on("messageCreate",async message=>{
      if(message.author.bot||!message.guild||!message.content.startsWith(".")) return;
      const args=message.content.slice(1).trim().split(/ +/);
      const command=(args.shift()||"").toLowerCase();
      if(!["warn","wlist","wremove","wreset"].includes(command)) return;
      try{
        const config=await getGuildConfig(message.guild.id);
        if(!staffAllowed(message,config)) return message.channel.send(card(config,`${EMOJIS.ERROR} Permission Denied`,"You do not have permission to use this command.","Warning System",COLORS.RED));
        const user=explicitMention(message,args);
        if(!user) return message.channel.send(card(config,`${EMOJIS.ERROR} Invalid Usage`,`You must explicitly ping the user.\n\n**Usage:** \`.warn @user [reason]\`\n\nReplying to a message does not count.`,"Warning System",COLORS.RED));
        const r=ref(message.guild.id,user.id);
        const snap=await r.get();
        const warnings=snap.exists?snap.data().warnings||[]:[];

        if(command==="warn"){
          const reason=args.slice(1).join(" ")||"No reason provided";
          const id=Math.floor(100000+Math.random()*900000).toString();
          const now=new Date();
          warnings.push({id,moderator:message.author.tag,reason,timestamp:now.toISOString()});
          await r.set({warnings});
          let notified="Yes";
          try{await user.send(card(config,`${EMOJIS.WARNING} Warning Received | ${message.guild.name}`,`You have received a warning in **${message.guild.name}**.\n\n**Reason:** ${reason}`,"Warning System",COLORS.YELLOW));}catch{notified="No (DMs Closed)";}
          const payload=card(config,`${EMOJIS.SUCCESS} ${user.user.username} has been warned.`,`**Reason**\n${reason}\n\n**Warned by**\n${message.author.username} (${message.author.id})\n\n**Warning ID**\n${id}\n\n**Member Notified**\n${notified}\n\n**Total Warnings**\n${warnings.length}/${MAX_WARNINGS}`,"Warning System",COLORS.GREEN);
          await message.channel.send(payload);
          return sendLog(message,payload,config);
        }

        if(command==="wlist"){
          if(!warnings.length) return message.channel.send(card(config,"Clean Record",`${EMOJIS.SHIELD} **User**\n${user}\n\n${EMOJIS.WARNING} **Warnings**\nNo warnings found.`,"Warning System",COLORS.GREEN));
          const blocks=warnings.slice(-MAX_WARNINGS).reverse().map((w,n)=>`**Warning #${warnings.length-n} • ID: ${w.id}**\n\n${EMOJIS.SHIELD} **Moderator**\n${w.moderator}\n\n${EMOJIS.MESSAGE} **Reason**\n${w.reason}\n\n${EMOJIS.CLOCK} **Date**\n<t:${Math.floor(new Date(w.timestamp).getTime()/1000)}:R>`).join("\n\n");
          return message.channel.send(card(config,"Infraction History",`${EMOJIS.SHIELD} **User**\n${user}\n\n${EMOJIS.STATS} **Total Warnings**\n${warnings.length}/${MAX_WARNINGS}\n\n${blocks}`,"Warning System",COLORS.YELLOW));
        }

        if(command==="wremove"){
          const id=args.find(x=>/^\d{6}$/.test(x));
          if(!id) return message.channel.send(card(config,`${EMOJIS.ERROR} Missing Warning ID`,"Please provide a valid 6-digit Warning ID.","Warning System",COLORS.RED));
          const idx=warnings.findIndex(w=>w.id===id);
          if(idx<0) return message.channel.send(card(config,`${EMOJIS.ERROR} Warning Not Found`,`No warning found with ID **${id}**.`,"Warning System",COLORS.RED));
          const removed=warnings.splice(idx,1)[0];
          if(warnings.length) await r.set({warnings}); else await r.delete();
          const payload=card(config,`${EMOJIS.SUCCESS} Warning Removed`,`${EMOJIS.SHIELD} **User**\n${user}\n\n${EMOJIS.WARNING} **Warning ID**\n\`${removed.id}\`\n\n${EMOJIS.MESSAGE} **Reason**\n${removed.reason}\n\n${EMOJIS.SETTINGS} **Originally Warned By**\n${removed.moderator}\n\n${EMOJIS.SETTINGS} **Removed By**\n${message.author}\n\n${EMOJIS.SPARKLES} Warning has been removed successfully.`,"Warning System",COLORS.GREEN);
          await message.channel.send(payload);
          return sendLog(message,payload,config);
        }

        if(command==="wreset"){
          if(!warnings.length) return message.channel.send(card(config,`${EMOJIS.ERROR} No Warnings Found`,`**${user.user.tag}** does not have any warnings to reset.`,"Warning System",COLORS.RED));
          await r.delete();
          const payload=card(config,`${EMOJIS.SUCCESS} Warning History Reset`,`${EMOJIS.SHIELD} **User**\n${user}\n\n${EMOJIS.WARNING} **Action**\nAll warnings have been removed\n\n${EMOJIS.SETTINGS} **Reset By**\n${message.author}\n\n${EMOJIS.SPARKLES} Infraction history has been cleared successfully.`,"Warning System",COLORS.GREEN);
          await message.channel.send(payload);
          return sendLog(message,payload,config);
        }
      }catch(error){
        console.error("Warning system error:",error);
        await message.channel.send(card(await getGuildConfig(message.guild.id),`${EMOJIS.ERROR} Error`,"An error occurred inside the warning system.","Warning System",COLORS.RED)).catch(()=>{});
      }
    });
  }
};