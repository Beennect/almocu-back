const jwt = require('jsonwebtoken');
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3RlciIsInN1YiI6IjM5YTc0YTRkLTU2YjgtNDNlYS1iMzkyLTlhOTc1MDcxMWFmOCIsInJvbGVzIjpbImFkbWluIl0sImlhdCI6MTc3NzU2Mzc2MywiZXhwIjoxNzc3NjUwMTYzfQ.ZZVwv0DBxoXV80wNpFrOQRgmCfSaUKMp9Af-lL3B-Vs";
const secret = 'super-secret-key-123';

try {
  const decoded = jwt.verify(token, secret);
  console.log("Token válido!");
  console.log(JSON.stringify(decoded, null, 2));
} catch (err) {
  console.log("Token inválido!");
  console.log(err.message);
}
