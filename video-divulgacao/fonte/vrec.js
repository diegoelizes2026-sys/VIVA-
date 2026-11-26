const {chromium}=require('playwright');const {spawn}=require('child_process');const fs=require('fs');
(async()=>{const v=process.argv[2];const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1080,height:1920}});
await pg.goto('file://'+__dirname+'/viral.html?v='+v);await pg.evaluate(()=>document.fonts.ready);
const meta=await pg.evaluate(()=>({T:TOTAL,ev:EVENTS}));fs.writeFileSync(`ev_${v}.json`,JSON.stringify(meta));
const fps=30,N=Math.round(meta.T*fps);
const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',''+fps,'-c:v','mjpeg','-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','17','-preset','medium',`v_${v}.mp4`],{stdio:['pipe','ignore','inherit']});
for(let i=0;i<N;i++){await pg.evaluate(t=>render(t),i/fps);const buf=await pg.screenshot({type:'jpeg',quality:95});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();})();
