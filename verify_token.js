const jwt = require('jsonwebtoken');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkFJX1Rlc3RlciIsInN1YiI6ImY4MGNhM2RlLTM1ZjctNDkyYi1hMDdjLTkxMTY1NWEzNjZiOSIsImlhdCI6MTc3NzU1OTk5MywiZXhwIjoxNzc3NjQ2MzkzfQ.9jC6KmWC2znjceX2obQXO8mjIWrMoeUuzznelTLSQFU';
const decoded = jwt.decode(token);
console.log(JSON.stringify(decoded, null, 2));
