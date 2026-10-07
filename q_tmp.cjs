require('dotenv').config();
const m=require('mariadb');
(async()=>{const u=new URL(process.env.DATABASE_URL);const c=await m.createConnection({host:u.hostname,port:+u.port||3306,user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1)});
for (const q of process.argv.slice(2)){console.log(q);console.log(JSON.stringify(await c.query(q),(k,v)=>typeof v==='bigint'?Number(v):v).slice(0,3000));}
await c.end()})().catch(e=>{console.error(e.message);process.exit(1)});
