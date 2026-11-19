import {spawn} from 'node:child_process';
const args=process.argv.slice(2);
const index=args.indexOf('--port');
const port=index>=0?args[index+1]:'4173';
const child=spawn('node',['node_modules/wrangler/bin/wrangler.js','dev','--ip','0.0.0.0','--port',port],{stdio:'inherit'});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??0));
