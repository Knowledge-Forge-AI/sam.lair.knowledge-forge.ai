import { getCollection } from 'astro:content';
export const formatDate = (date: string) => new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' }).format(new Date(`${date}T12:00:00Z`));
export async function journalEntries() {
  const entries = (await getCollection('journal')).map(post => ({...post.data,href:`/journal/${post.id}/`}));
  entries.push({title:'Why I built a modular operating model for coding agents',description:'My original APG v0.3.0 release reflection, preserved as written.',date:'2026-07-22',updated:'2026-07-22',category:'APGR',kind:'release',releases:['agentic-praxis-grimoire@v0.3.0'],sources:[],href:'/blog/personal-apg-v030-release-reflection/'});
  return entries.sort((a,b)=>b.date.localeCompare(a.date)||a.title.localeCompare(b.title));
}
