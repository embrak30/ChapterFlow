export function manuscriptMetadata(name:string,size:number) {
  if(!/\.docx?$/i.test(name)) throw new Error('Choose a Microsoft Word document (.docx or .doc).');
  if(!Number.isSafeInteger(size)||size<=0||size>20*1024*1024) throw new Error('Choose a Word file larger than zero and no larger than 20 MB.');
  return {fileName:name.slice(0,240),size,contentType:name.toLowerCase().endsWith('.docx')?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/msword'};
}
