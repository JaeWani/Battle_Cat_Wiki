import test from 'node:test';
import assert from 'node:assert/strict';
import {validContentPassword} from '../public/js/content-password.mjs';
test('content passwords preserve spaces and accept the bcrypt byte boundary',()=>{
 for(const password of ['abcd',' pass ', '가나다라','a'.repeat(72),'가'.repeat(24),'😀'.repeat(18)])assert.equal(validContentPassword(password),password);
});
test('content passwords reject missing, short, whitespace-only and oversized input',()=>{
 for(const password of [undefined,null,1234,'','abc','   ','\t\n  ','a'.repeat(73),'가'.repeat(25),'😀'.repeat(19),'abc\0d'])assert.throws(()=>validContentPassword(password));
});
