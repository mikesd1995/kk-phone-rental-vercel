'use strict';
const VERSION='KK_INBOX_READ_MODEL_V1';
function build(store,query={}){
 if(!store||typeof store.listConversations!=='function') throw Object.assign(new Error('inbox store unavailable'),{code:'INBOX_STORE_UNAVAILABLE'});
 const conversations=store.listConversations({channel:query.channel,status:query.status,search:query.search,limit:query.limit});
 return {schema_version:VERSION,generated_at:new Date().toISOString(),filters:{channel:String(query.channel||''),status:String(query.status||''),search:String(query.search||'')},counts:{conversations:conversations.length,unread:conversations.reduce((n,c)=>n+Number(c.unread_count||0),0)},conversations};
}
function thread(store,conversationId,query={}){
 if(!store||typeof store.listMessages!=='function') throw Object.assign(new Error('inbox store unavailable'),{code:'INBOX_STORE_UNAVAILABLE'});
 return {schema_version:VERSION,conversation_id:String(conversationId||''),messages:store.listMessages(conversationId,{limit:query.limit})};
}
module.exports={VERSION,build,thread};
