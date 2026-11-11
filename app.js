import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
const $ = id => document.getElementById(id);
const configured = SUPABASE_URL.startsWith('https://') && !SUPABASE_PUBLISHABLE_KEY.startsWith('YOUR_');
const db = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;
let login = false;
const errorText = e => (e?.message || 'Неизвестная ошибка');
const money = n => new Intl.NumberFormat('ru-RU').format(n) + ' ◈';
async function refresh() {
 if (!db) { $('authError').textContent = 'Настрой Supabase URL и ключ в config.js'; return; }
 const {data:{user},error:authError} = await db.auth.getUser();
 if (authError || !user) { $('auth').classList.remove('hidden'); $('dashboard').classList.add('hidden'); return; }
 const {data:p,error:e} = await db.from('profiles').select('username,balance,card_last4').eq('id',user.id).single();
 if (e) throw e;
 $('auth').classList.add('hidden'); $('dashboard').classList.remove('hidden');
 $('name').textContent = '@'+p.username; $('balance').textContent = money(p.balance);
 $('last4').textContent = p.card_last4; $('cardName').textContent = p.username.toUpperCase();
 const {data:tx,error:te} = await db.rpc('my_demo_history'); if (te) throw te;
 const box = $('transactions'); box.replaceChildren();
 if (!tx.length) { box.textContent = 'Пока пусто'; return; }
 for (const t of tx) {
  const row = document.createElement('div'); row.className = 'tx';
  const label = document.createElement('span'); label.textContent = (t.direction === 'out' ? 'Отправлено @' : 'Получено от @')+t.counterparty+' · '+new Date(t.created_at).toLocaleDateString('ru-RU');
  const value = document.createElement('b'); value.textContent = (t.direction === 'out' ? '−' : '+')+money(t.amount);
  row.append(label,value); box.append(row);
 }
}
$('toggle').onclick = () => {
 login = !login; $('authTitle').textContent = login ? 'Войти' : 'Создать аккаунт';
 $('authSubmit').textContent = login ? 'Войти' : 'Зарегистрироваться';
 $('toggle').textContent = login ? 'Создать аккаунт' : 'Уже есть аккаунт?';
 $('username').classList.toggle('hidden',login); $('authError').textContent = '';
};
$('authSubmit').onclick = async () => {
 try {
  if (!db) throw Error('Сначала настрой Supabase в config.js');
  $('authError').textContent = '';
  const email = $('email').value.trim(), password = $('password').value;
  if (login) {
   const {error} = await db.auth.signInWithPassword({email,password}); if(error) throw error;
  } else {
   const username = $('username').value.trim().toLowerCase();
   if (!/^[a-z0-9_]{3,20}$/.test(username)) throw Error('Ник: 3–20 латинских букв, цифр или _');
   if (password.length < 8) throw Error('Пароль минимум 8 символов');
   const {data,error} = await db.auth.signUp({email,password,options:{data:{username}}}); if(error) throw error;
   if (!data.session) { $('authError').textContent = 'Проверь почту и подтверди email, затем войди.'; return; }
  }
  $('password').value = ''; await refresh();
 } catch(e) { $('authError').textContent = errorText(e); }
};
$('send').onclick = async () => {
 try {
  $('transferError').textContent = '';
  const amount = Number($('amount').value);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw Error('Укажи целое положительное число');
  const {error} = await db.rpc('send_demo_coins',{target_username:$('recipient').value.replace(/^@/,'').trim(),coins:amount});
  if(error) throw error;
  $('recipient').value = ''; $('amount').value = ''; await refresh();
 } catch(e) { $('transferError').textContent = errorText(e); }
};
$('logout').onclick = async () => { if(db) await db.auth.signOut(); await refresh(); };
refresh().catch(e => { $('authError').textContent = errorText(e); });
