// Runs the browser module under node and prints matrices as 0/1 rows.
const fs=require('fs');
global.window={};
eval(fs.readFileSync('/home/user/replyplate/qr.js','utf8'));
const QR=global.window.QR;
const cases=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const out=cases.map(c=>{
  try{ const q=QR.encode(c.text,c.level);
    return {ok:true,size:q.size,version:q.version,mask:q.mask,
            rows:q.modules.map(r=>r.join(''))};
  }catch(e){ return {ok:false,err:e.message}; }
});
console.log(JSON.stringify(out));
