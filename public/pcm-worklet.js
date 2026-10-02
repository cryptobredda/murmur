class MurmurCapture extends AudioWorkletProcessor {
  constructor(){super();this.buffer=new Float32Array(4096);this.offset=0;this.port.onmessage=e=>{if(e.data==='flush'){if(this.offset)this.port.postMessage(this.buffer.slice(0,this.offset));this.offset=0;this.port.postMessage({type:'flush'});}};}
  process(inputs){const input=inputs[0];if(input&&input[0]){for(let i=0;i<input[0].length;i++){this.buffer[this.offset++]=input[0][i];if(this.offset===this.buffer.length){this.port.postMessage(this.buffer.slice());this.offset=0;}}}return true;}
}
registerProcessor('murmur-capture',MurmurCapture);
