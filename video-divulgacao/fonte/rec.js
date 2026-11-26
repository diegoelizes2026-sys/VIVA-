const {chromium}=require('playwright');const {spawn}=require('child_process');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1080,height:1920}});
await pg.goto('file://'+__dirname+'/scene.html');await pg.evaluate(()=>document.fonts.ready);
const fps=30,N=26*fps;const ff=spawn('ffmpeg',['-y','-f','image2pipe','-framerate',''+fps,'-c:v','mjpeg','-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','17','-preset','medium','video_only.mp4'],{stdio:['pipe','ignore','inherit']});
for(let i=0;i<N;i++){await pg.evaluate(t=>render(t),i/fps);const buf=await pg.screenshot({type:'jpeg',quality:95});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();})();
