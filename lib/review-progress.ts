export function reviewProgressFields(formData:FormData) {
  const names=['structure_rating','structure_feedback','mission_alignment_rating','mission_alignment_feedback','flow_rating','flow_feedback','story_rating','story_feedback','writing_rating','writing_feedback','anonymity_rating','anonymity_feedback','recommendations','overall_recommendation'];
  const fields:Record<string,string|string[]>={structure_items:formData.getAll('structure_items').filter((value):value is string=>typeof value==='string')};
  for(const name of names) {const value=formData.get(name);fields[name]=typeof value==='string'?value:'';}
  if(JSON.stringify(fields).length>200000) throw new Error('The review is too long to save. Please shorten your responses.');
  return fields;
}
