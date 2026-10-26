import {parseSave} from './save-parser.mjs';
self.onmessage=event=>{try{const data=parseSave(event.data);self.postMessage({ok:true,data});}catch(error){self.postMessage({ok:false,code:error.code||'PARSE',error:error instanceof Error?error.message:'파일을 읽을 수 없습니다.'});}finally{self.close();}};
