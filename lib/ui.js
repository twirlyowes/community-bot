const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");

const COLORS = {
  SKY_BLUE: 0x38BDF8,
  GREEN: 0x57F287,
  RED: 0xED4245,
  YELLOW: 0xF1C40F
};

const EMOJIS = {
  SPARKLES: "<a:sparkles:1532986077651140620>",
  SHIELD: "<:Shield_2:1532989398642327594>",
  BAN: "<a:ban:1532989769766801511>",
  SETTINGS: "<a:settings:1532990547394957393>",
  TERMINAL: "<:terminal:1532991459005829264>",
  WARNING: "<a:Warning:1532986372716236932>",
  MESSAGE: "<a:LP_Message:1532991009066324049>",
  CLOCK: "<a:Clock:1532990759371018372>",
  VOICE: "<a:voice:1532987137199440003>",
  STATS: "<:Stats:1532990723408793661>",
  HOME: "<:HOME:1532991400503673055>",
  LINK: "<:Link:1532991169984991302>",
  SUCCESS: "<a:success:1532986625343099050>",
  ERROR: "<a:error:1532986765105696778>"
};

function getBotName(config) {
  return config?.branding?.name || "Community Bot";
}

function footer(config, feature = "General") {
  return `-# ${getBotName(config)} • ${feature}`;
}

function createCard({ color=COLORS.SKY_BLUE, content="", avatarURL=null, avatarDescription="User avatar" }={}) {
  const container=new ContainerBuilder().setAccentColor(color);
  const text=new TextDisplayBuilder().setContent(content);
  if(avatarURL){
    const thumbnail=new ThumbnailBuilder().setURL(avatarURL).setDescription(avatarDescription);
    container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(text).setThumbnailAccessory(thumbnail));
  } else {
    container.addTextDisplayComponents(text);
  }
  return container;
}

function getAvatarURL(user) {
  if(!user) return null;
  const target=user.user||user;
  if(!target||typeof target.displayAvatarURL!=="function") return null;
  return target.displayAvatarURL({extension:"png",size:128});
}

function messageOptions(container,ephemeral=false) {
  return {components:[container],flags:MessageFlags.IsComponentsV2|(ephemeral?MessageFlags.Ephemeral:0)};
}

function card(config,title,body,feature=title,color) {
  const content=`## ${title}\n\n${body}\n\n${footer(config,feature)}`;
  return messageOptions(createCard({color:color||config?.branding?.color||COLORS.SKY_BLUE,content}));
}

module.exports={COLORS,EMOJIS,createCard,getAvatarURL,footer,messageOptions,card};