const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('public news list uses 10 items per page and resets pagination on search',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../news.html'),'utf8');
 assert.match(html,/const PAGE_SIZE=10/);
 assert.match(html,/slice\(start,start\+PAGE_SIZE\)/);
 assert.match(html,/currentPage=1;render\(\)/);
 assert.match(html,/id="pagination"/);
});

test('admin news list uses 20 items per page and keeps historical news',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../admin-news.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../admin-news.html'),'utf8');
 assert.match(js,/const ADMIN_PAGE_SIZE=20/);
 assert.match(js,/slice\(start,start\+ADMIN_PAGE_SIZE\)/);
 assert.match(html,/id="adminPagination"/);
 assert.match(html,/不會因時間自動刪除/);
});
