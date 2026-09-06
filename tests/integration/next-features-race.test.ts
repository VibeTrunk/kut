import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url=process.env.KUT_LOCAL_DATABASE_URL??"postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const fx={user:"30000000-0000-4000-8000-000000000001",low:"30000000-0000-4000-8000-000000000002",player:"30000000-0000-4000-8000-000000000011",season:"30000000-0000-4000-8000-000000000021",session:"30000000-0000-4000-8000-000000000022",packKey:"30000000-0000-4000-8000-000000000031"};
let admin:Client,a:Client,b:Client;
async function cleanup(){
  await admin.query("delete from kut.user_notifications where user_id=any($1::uuid[])",[[fx.user,fx.low]]);
  await admin.query("delete from kut.session_report_requests where user_id=any($1::uuid[])",[[fx.user,fx.low]]);
  await admin.query("delete from kut.session_report_results where session_id=$1",[fx.session]);
  await admin.query("delete from kut.session_report_rewards where session_id=$1",[fx.session]);
  await admin.query("delete from kut.session_kudos where session_id=$1",[fx.session]);
  await admin.query("delete from kut.session_reports where session_id=$1",[fx.session]);
  await admin.query("delete from kut.session_survey_eligibility where session_id=$1",[fx.session]);
  await admin.query("delete from kut.session_surveys where session_id=$1",[fx.session]);
  await admin.query("delete from kut.attendance_rewards where session_id=$1",[fx.session]);
  await admin.query("delete from kut.attendance where session_id=$1",[fx.session]);
  await admin.query("delete from kut.match_sessions where id=$1",[fx.session]);
  await admin.query("delete from kut.season_rating_rules where season_id=$1",[fx.season]);
  await admin.query("delete from kut.seasons where id=$1",[fx.season]);
  const openings=await admin.query("select id from kut.pack_openings where user_id=any($1::uuid[])",[[fx.user,fx.low]]); const ids=openings.rows.map(r=>r.id);
  if(ids.length){const cards=await admin.query("select result.card_id,card.edition_id from kut.pack_opening_cards result join kut.user_cards card on card.id=result.card_id where result.opening_id=any($1::uuid[])",[ids]);for(const row of cards.rows)await admin.query("update kut.card_editions set minted_count=greatest(0,minted_count-1) where id=$1",[row.edition_id]);await admin.query("delete from kut.pack_opening_cards where opening_id=any($1::uuid[])",[ids]);await admin.query("delete from kut.user_cards where id=any($1::uuid[])",[cards.rows.map(r=>r.card_id)]);await admin.query("delete from kut.pack_openings where id=any($1::uuid[])",[ids]);}
  await admin.query("delete from kut.wallet_ledger where user_id=any($1::uuid[])",[[fx.user,fx.low]]);
  await admin.query("delete from kut.wallets where user_id=any($1::uuid[])",[[fx.user,fx.low]]);
  await admin.query("delete from kut.profiles where id=any($1::uuid[])",[[fx.user,fx.low]]);
  await admin.query("delete from auth.users where id=any($1::uuid[])",[[fx.user,fx.low]]);
  await admin.query("delete from kut.players where id=$1",[fx.player]);
}
async function begin(client:Client,user:string){await client.query("begin");await client.query("set local role authenticated");await client.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);}
async function run(client:Client,sql:string,args:unknown[]){try{const result=await client.query(sql,args);await client.query("commit");return{result,error:null};}catch(error){await client.query("rollback");return{result:null,error};}}

beforeAll(async()=>{admin=new Client({connectionString:url});a=new Client({connectionString:url});b=new Client({connectionString:url});await Promise.all([admin.connect(),a.connect(),b.connect()]);await cleanup();await admin.query("insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values($1,'race-feature@example.test','authenticated','authenticated','{}','{}',now(),now()),($2,'race-low@example.test','authenticated','authenticated','{}','{}',now(),now())",[fx.user,fx.low]);await admin.query("insert into kut.players(id,slug,display_name,archetype) values($1,'feature-race-player','Feature Race Player','all_rounder')",[fx.player]);await admin.query("insert into kut.profiles(id,display_name,role,player_id) values($1,'Feature Race','user',$3),($2,'Feature Low','user',null)",[fx.user,fx.low,fx.player]);await admin.query("insert into kut.wallets(user_id,balance) values($1,500),($2,174)",[fx.user,fx.low]);});
afterAll(async()=>{await cleanup();await Promise.all([admin.end(),a.end(),b.end()]);});

describe("next-feature concurrency",()=>{
  it("opens one 175-coin pack for concurrent same-key retries",async()=>{await Promise.all([begin(a,fx.user),begin(b,fx.user)]);const results=await Promise.all([run(a,"select kut.open_pack('tfh-pack',175,$1) result",[fx.packKey]),run(b,"select kut.open_pack('tfh-pack',175,$1) result",[fx.packKey])]);expect(results.every(r=>r.error===null)).toBe(true);const [opening,wallet,cards]=await Promise.all([admin.query("select price_paid from kut.pack_openings where user_id=$1",[fx.user]),admin.query("select balance from kut.wallets where user_id=$1",[fx.user]),admin.query("select count(*)::int count from kut.pack_opening_cards where opening_id in(select id from kut.pack_openings where user_id=$1)",[fx.user])]);expect(opening.rows).toEqual([{price_paid:"175"}]);expect(wallet.rows[0].balance).toBe("325");expect(cards.rows[0].count).toBe(3);});
  it("does not debit 174 coins or a stale quote",async()=>{await begin(a,fx.low);const low=await run(a,"select kut.open_pack('tfh-pack',175,$1)",["30000000-0000-4000-8000-000000000032"]);expect(low.error).not.toBeNull();await begin(a,fx.low);const stale=await run(a,"select kut.open_pack('tfh-pack',999,$1) result",["30000000-0000-4000-8000-000000000033"]);expect(stale.result?.rows[0].result).toMatchObject({price_changed:true,current_price:175});expect((await admin.query("select balance from kut.wallets where user_id=$1",[fx.low])).rows[0].balance).toBe("174");});
  it("credits one report reward across a submit race",async()=>{await admin.query("insert into kut.seasons(id,name,starts_on,is_active) values($1,'Race Reports',current_date,false)",[fx.season]);await admin.query("insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at,rating_rules_version) values($1,$2,current_date,'other','published',now(),2)",[fx.session,fx.season]);await admin.query("insert into kut.attendance(session_id,player_id,goals) values($1,$2,0)",[fx.session,fx.player]);const cats=["10000000-0000-4000-8000-000000000001","10000000-0000-4000-8000-000000000002","10000000-0000-4000-8000-000000000003"];await admin.query("insert into kut.session_surveys(session_id,opened_at,closes_at,category_ids,selection_seed) values($1,now(),now()+interval '24 hours',$2,$3)",[fx.session,cats,"30000000-0000-4000-8000-000000000040"]);await admin.query("insert into kut.session_survey_eligibility(session_id,player_id,user_id) values($1,$2,$3)",[fx.session,fx.player,fx.user]);const nominations=Object.fromEntries(cats.map(c=>[c,null]));await Promise.all([begin(a,fx.user),begin(b,fx.user)]);const results=await Promise.all([run(a,"select kut.submit_session_report($1,0,$2,0,$3,'submit') result",[fx.session,nominations,"30000000-0000-4000-8000-000000000041"]),run(b,"select kut.submit_session_report($1,0,$2,0,$3,'submit') result",[fx.session,nominations,"30000000-0000-4000-8000-000000000042"])]);expect(results.filter(r=>r.error===null)).toHaveLength(2);expect((await admin.query("select count(*)::int count from kut.session_report_rewards where session_id=$1",[fx.session])).rows[0].count).toBe(1);expect((await admin.query("select sum(amount) total from kut.wallet_ledger where user_id=$1 and reason='session_report_reward'",[fx.user])).rows[0].total).toBe("50");});
});
