/** Retry one saved recording. Timeout and cancellation always settle the attempt. */
/**
 * @template T
 * @param {(signal: AbortSignal, attempt: number) => Promise<T>} task
 * @param {{signal?: AbortSignal, onAttempt?: (attempt: number) => Promise<void>, reset?: () => Promise<void>, attempts?: number, timeouts?: number[], delayMs?: number}} options
 * @returns {Promise<T>}
 */
export async function retrySavedAudio(task, { signal, onAttempt = async (attempt) => {void attempt;}, reset = async () => {}, attempts = 3, timeouts = [90000,30000,30000], delayMs = 250 } = {}) {
  let last;
  for (let attempt=1;attempt<=attempts;attempt++) {
    if(signal?.aborted)throw new DOMException("Processing cancelled. Your recording is saved.","AbortError");
    await onAttempt(attempt);
    const controller=new AbortController();
    let timer, parent;
    const stopped=new Promise((_,reject)=>{
      parent=()=>{controller.abort();reject(new DOMException("Processing cancelled. Your recording is saved.","AbortError"));};
      signal?.addEventListener("abort",parent,{once:true});
      timer=setTimeout(()=>{controller.abort();reject(new Error("Speech processing timed out. Your recording is saved in History."));},timeouts[Math.min(attempt-1,timeouts.length-1)]);
    });
    try {
      if(signal?.aborted)parent();
      return await Promise.race([Promise.resolve().then(()=>task(controller.signal,attempt)),stopped]);
    }catch(error){
      last=error;
      if(signal?.aborted)throw error;
      if(/API key|denied access|usage or rate limit|too large|download.*first|supports English|No speech|unavailable on this device/i.test(error.message || ""))throw error;
      if(attempt===attempts)throw error;
      await reset();
      if(delayMs)await new Promise(resolve=>setTimeout(resolve,delayMs));
    }finally {clearTimeout(timer);signal?.removeEventListener("abort",parent);}
  }
  throw last;
}
