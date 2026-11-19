require('dotenv').config();
const m=require('mariadb'),fs=require('fs');
(async()=>{const u=new URL(process.env.DATABASE_URL);const c=await m.createConnection({host:u.hostname,port:+u.port||3306,user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1),multipleStatements:true});
const name='20261013100000_customer_agent_assignment';
const sql=fs.readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8');
await c.query(sql);
console.log('applied');await c.end()})().catch(e=>{console.error(e.message);process.exit(1)});
